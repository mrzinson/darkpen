const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber, validatePassword } = require('./verificationService');
const bcrypt = require('bcrypt');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');

// Create temp directory for voice notes if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

let client = null;

// QR Code and bot status tracking
let botStatus = 'initializing'; // 'initializing' | 'qr_ready' | 'connected' | 'disconnected' | 'error'
let currentQRDataURL = null;    // Base64 QR image for the /api/whatsapp/qr endpoint

// Password reset states map (userId -> { step })
const userStates = new Map();

exports.getBotStatus = () => botStatus;
exports.getQRCode = () => currentQRDataURL;

// ─── MySQL Remote Auth Store ───────────────────────────────────────────────────
// Implements the RemoteAuth store interface so whatsapp-web.js can persist
// the session inside our existing MySQL database instead of the local filesystem.
class MySQLRemoteAuthStore {
    constructor(dbPool, dataPath) {
        this.db = dbPool;
        this.dataPath = dataPath;
    }

    async _ensureTable() {
        await this.db.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                session_key VARCHAR(255) UNIQUE,
                session_data LONGBLOB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    }

    // Called by RemoteAuth to check if a saved session exists
    async sessionExists({ session }) {
        try {
            await this._ensureTable();
            const [rows] = await this.db.execute(
                'SELECT id FROM whatsapp_sessions WHERE session_key = ? LIMIT 1',
                [session]
            );
            return rows.length > 0;
        } catch (err) {
            console.error('[MySQL Store] sessionExists error:', err.message);
            return false;
        }
    }

    // Called by RemoteAuth after it creates the zip at `${session}.zip` inside the dataPath directory
    async save({ session }) {
        try {
            const zipPath = path.join(this.dataPath, `${session}.zip`);
            if (!fs.existsSync(zipPath)) {
                console.warn('[MySQL Store] Zip file not found at:', zipPath);
                return;
            }
            const zipBuffer = fs.readFileSync(zipPath);
            await this._ensureTable();
            await this.db.execute(
                `INSERT INTO whatsapp_sessions (session_key, session_data)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE session_data = VALUES(session_data), updated_at = CURRENT_TIMESTAMP`,
                [session, zipBuffer]
            );
            console.log(`[MySQL Store] Session '${session}' saved to DB. Size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        } catch (err) {
            console.error('[MySQL Store] save error:', err.message);
        }
    }

    // Called by RemoteAuth on startup; must write the zip to `path` so RemoteAuth can extract it
    async extract({ session, path: zipDestPath }) {
        try {
            await this._ensureTable();
            const [rows] = await this.db.execute(
                'SELECT session_data FROM whatsapp_sessions WHERE session_key = ? LIMIT 1',
                [session]
            );
            if (rows.length === 0) {
                console.log(`[MySQL Store] No session found for '${session}'.`);
                return;
            }
            const dir = path.dirname(zipDestPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(zipDestPath, rows[0].session_data);
            console.log(`[MySQL Store] Session '${session}' zip written to: ${zipDestPath}`);
        } catch (err) {
            console.error('[MySQL Store] extract error:', err.message);
            throw err; // rethrow to prevent unCompressSession from failing silently / crashing
        }
    }

    // Called by RemoteAuth on auth_failure or explicit logout
    async delete({ session }) {
        try {
            await this.db.execute(
                'DELETE FROM whatsapp_sessions WHERE session_key = ?',
                [session]
            );
            console.log(`[MySQL Store] Session '${session}' deleted from DB.`);
        } catch (err) {
            console.error('[MySQL Store] delete error:', err.message);
        }
    }
}

// ─── Initialize function ───────────────────────────────────────────────────────
exports.initialize = async () => {
    try {
        console.log('[WHATSAPP BOT] Initializing...');

        // 1. Create table whatsapp_cooldowns if not exists
        await db.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_cooldowns (
                user_id INT PRIMARY KEY,
                message_count INT DEFAULT 1,
                cooldown_until TIMESTAMP NULL,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                notified_expiry BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[WHATSAPP BOT] Table whatsapp_cooldowns checked/created.');

        // 2. Puppeteer headless mode (always headless on server)
        const isServer = process.env.RENDER || process.env.NODE_ENV === 'production';
        const isHeadless = isServer ? true : (process.env.WHATSAPP_HEADLESS === 'true');
        console.log(`[WHATSAPP BOT] Headless mode: ${isHeadless} (server: ${!!isServer})`);

        if (isServer) {
            process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '../.cache/puppeteer');
            console.log(`[WHATSAPP BOT] Setting PUPPETEER_CACHE_DIR to: ${process.env.PUPPETEER_CACHE_DIR}`);
        }

        // 3. Find Chrome executable
        const puppeteerCacheDir = process.env.PUPPETEER_CACHE_DIR;
        let renderChromePath = null;

        if (puppeteerCacheDir && fs.existsSync(puppeteerCacheDir)) {
            try {
                const chromeDir = path.join(puppeteerCacheDir, 'chrome');
                if (fs.existsSync(chromeDir)) {
                    const versions = fs.readdirSync(chromeDir);
                    for (const version of versions) {
                        const candidate = path.join(chromeDir, version, 'chrome-linux64', 'chrome');
                        if (fs.existsSync(candidate)) {
                            renderChromePath = candidate;
                            console.log(`[WHATSAPP BOT] Found Chrome in cache: ${renderChromePath}`);
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('[WHATSAPP BOT] Error scanning Puppeteer cache:', err.message);
            }
        }

        const possibleChromePaths = [
            renderChromePath,
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ].filter(Boolean);

        let foundChrome = process.env.PUPPETEER_EXECUTABLE_PATH || null;
        if (!foundChrome) {
            for (const p of possibleChromePaths) {
                if (fs.existsSync(p)) {
                    foundChrome = p;
                    break;
                }
            }
        }

        const puppeteerOptions = {
            headless: isHeadless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--disable-accelerated-2d-canvas',
                '--blink-settings=imagesEnabled=false',
                '--js-flags=--max-old-space-size=120',
                '--disable-features=IsolateOrigins,site-per-process',
                '--renderer-process-limit=1',
                '--password-store=basic',
                '--use-mock-keychain',
            ]
        };

        if (foundChrome) {
            puppeteerOptions.executablePath = foundChrome;
            console.log(`[WHATSAPP BOT] Using Chrome: ${foundChrome}`);
        } else {
            console.warn('[WHATSAPP BOT] No Chrome found! Bot may fail.');
        }

        // 4. Resolve dataPath and create RemoteAuth store backed by MySQL
        const dataPath = path.resolve(process.cwd(), '.wwebjs_auth');
        const store = new MySQLRemoteAuthStore(db, dataPath);

        // 5. Create WhatsApp client with RemoteAuth
        //    RemoteAuth handles session backup/restore automatically via the store
        client = new Client({
            authStrategy: new RemoteAuth({
                clientId: 'darkpen',   // used as the session key in the DB
                dataPath: dataPath,
                store: store,
                backupSyncIntervalMs: 300000,  // back up every 5 minutes while connected
            }),
            puppeteer: puppeteerOptions,
            authTimeoutMs: 0,  // no timeout – keep waiting for QR scan
        });

        // ── Events ────────────────────────────────────────────────────────────

        // QR code generation
        client.on('qr', async (qr) => {
            console.log('\n--- WHATSAPP QR CODE ---');
            console.log('Fadlan browser-ka u tag: /api/whatsapp/qr si aad QR-ka u sawirto');
            qrcode.generate(qr, { small: true });
            console.log('------------------------\n');
            try {
                currentQRDataURL = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
                botStatus = 'qr_ready';
                console.log('[WHATSAPP BOT] QR Code ready at /api/whatsapp/qr');
            } catch (err) {
                console.error('[WHATSAPP BOT] Failed to generate QR image:', err.message);
            }
        });

        // Loading progress
        client.on('loading_screen', (percent, message) => {
            console.log(`[WHATSAPP BOT] Loading: ${percent}% - ${message}`);
        });

        // Session saved remotely
        client.on('remote_session_saved', () => {
            console.log('[WHATSAPP BOT] Session saved to database by RemoteAuth.');
        });

        // Ready
        client.on('ready', () => {
            botStatus = 'connected';
            currentQRDataURL = null;
            console.log('[WHATSAPP BOT] Client is ready and listening to messages!');
        });

        // Auth failure – RemoteAuth will delete the session from store automatically
        client.on('auth_failure', (message) => {
            botStatus = 'error';
            console.error('[WHATSAPP BOT] Authentication failure:', message);
        });

        // Disconnected
        client.on('disconnected', (reason) => {
            botStatus = 'disconnected';
            currentQRDataURL = null;
            console.log(`[WHATSAPP BOT] Disconnected: ${reason}`);
        });

        // Incoming calls – reject and reply
        client.on('incoming_call', async (call) => {
            try {
                console.log(`[WHATSAPP BOT] Wacitaan la diiday oo ka yimid: ${call.from}`);
                await call.reject();
                await client.sendMessage(
                    call.from,
                    "Ma qaban karo call, iga raali noqo. Fadlan qoraal ahaan ama cod ahaan iigu soo dir su'aashaada."
                );
            } catch (err) {
                console.error('[WHATSAPP BOT] Call handling error:', err.message);
            }
        });

        // Incoming messages
        client.on('message', async (message) => {
            try {
                await handleIncomingMessage(message);
            } catch (err) {
                console.error('[WHATSAPP BOT] Message handling error:', err);
            }
        });

        // Proactive checker
        startProactiveChecker();

        // Boot client
        client.initialize().catch(error => {
            botStatus = 'error';
            console.error('[WHATSAPP BOT] Initialization failed during client.initialize():', error);
        });

    } catch (error) {
        botStatus = 'error';
        console.error('[WHATSAPP BOT] Initialization failed:', error);
    }
};

// ─── Helper: clean phone number ───────────────────────────────────────────────
function getCleanNumber(rawJid) {
    const digits = rawJid.split('@')[0];
    return normalizePhoneNumber(digits);
}

// ─── Proactive Checker ────────────────────────────────────────────────────────
function startProactiveChecker() {
    setInterval(async () => {
        try {
            if (!client) return;

            const [expired] = await db.execute(
                `SELECT wc.user_id, u.whatsapp_number
                 FROM whatsapp_cooldowns wc
                 JOIN users u ON wc.user_id = u.id
                 WHERE wc.cooldown_until <= NOW() AND wc.notified_expiry = FALSE`
            );

            for (const row of expired) {
                if (row.whatsapp_number) {
                    const cleaned = row.whatsapp_number.replace(/\+/g, '');
                    const jid = `${cleaned}@c.us`;
                    try {
                        console.log(`[WHATSAPP BOT] Sending proactive notification to ${jid}`);
                        await client.sendMessage(
                            jid,
                            "Saacadihii sugitaanka ee kugu xirnaa waa dhammaadeen, hadda waad ila hadli kartaa. Maxaan kaa caawin karaa?"
                        );
                        await db.execute(
                            'UPDATE whatsapp_cooldowns SET notified_expiry = TRUE WHERE user_id = ?',
                            [row.user_id]
                        );
                    } catch (sendErr) {
                        console.error(`[WHATSAPP BOT] Proactive send failed for ${jid}:`, sendErr.message);
                    }
                }
            }
        } catch (err) {
            console.error('[WHATSAPP BOT] Proactive checker error:', err.message);
        }
    }, 60000);
}

// ─── Main message handler ─────────────────────────────────────────────────────
async function handleIncomingMessage(message) {
    if (message.fromMe) return;

    console.log(`[WHATSAPP BOT DEBUG] Incoming message:
      from: ${message.from}
      author: ${message.author}
      fromMe: ${message.fromMe}
      type: ${message.type}
      body: ${message.body}`);

    // Intercept call logs / missed calls
    if (message.type === 'call_log') {
        console.log(`[WHATSAPP BOT] Call log message detected from: ${message.from}`);
        try {
            await message.reply("Ma qaban karo call, iga raali noqo. Fadlan qoraal ahaan ama cod ahaan iigu soo dir su'aashaada.");
        } catch (err) {
            console.error('[WHATSAPP BOT] Error replying to call log:', err.message);
        }
        return;
    }

    // Ignore other system/unsupported messages (only allow text, image, audio/ptt)
    const allowedTypes = ['chat', 'image', 'audio', 'ptt'];
    if (!allowedTypes.includes(message.type)) {
        return;
    }

    const isGroup = message.from.endsWith('@g.us');
    let senderNumberRaw = '';

    try {
        const contact = await message.getContact();
        if (contact && contact.id && contact.id.user) {
            senderNumberRaw = contact.id.user;
        }
        console.log('[WHATSAPP BOT DEBUG] Fetched contact ID user:', senderNumberRaw);
    } catch (err) {
        console.error('[WHATSAPP BOT DEBUG] Failed to get contact:', err.message);
    }

    if (!senderNumberRaw) {
        const senderRaw = isGroup ? (message.author || '') : message.from;
        if (senderRaw) senderNumberRaw = senderRaw.split('@')[0];
    }

    const normalizedPhone = normalizePhoneNumber(senderNumberRaw);
    console.log(`[WHATSAPP BOT DEBUG] Extracted senderNumberRaw: ${senderNumberRaw}, normalizedPhone: ${normalizedPhone}`);

    if (!normalizedPhone) return;

    // 1. Look up user in database
    const [users] = await db.execute(
        'SELECT id, name, is_suspended FROM users WHERE whatsapp_number = ? LIMIT 1',
        [normalizedPhone]
    );

    if (users.length === 0) {
        if (!isGroup) {
            await message.reply(
                `*Kulama hadli karo* sababtoo ah waxaa la igu amray in aan la hadlo oo kaliya dadka ka diwaan gashan app-ka *Darkpen*.\n\n` +
                `Si aad isu diwaangeliso, fadlan raac qodobadan fudud:\n\n` +
                `1. *Lasoo deg App-ka:* Play Store-ka ku qor *Darkpen* si aad u soo degsato, ama raac link-gan:\n` +
                `   🔗 https://play.google.com/store/apps/details?id=com.darkpen.app\n\n` +
                `2. *Isu-diwaangeli:* Marka uu kuusoo dego, iska diwaangeli adigoo adeegsanaya lambarkan WhatsApp-ka ah ee aad hadda igala hadlayso.\n\n` +
                `3. *Ku shubo Credit:* Ku shubo ugu yaraan *$0.50* si aad u hesho credit, ka dibna iigu soo laabo si aan kuu caawiyo.`
            );
        }
        return;
    }

    const user = users[0];

    if (user.is_suspended) {
        console.log(`[WHATSAPP BOT] User ${user.name} (${normalizedPhone}) is suspended. Ignoring.`);
        return;
    }

    const userId = user.id;

    // ─── Password Reset Flow ──────────────────────────────────────────────────────
    const cleanBody = (message.body || '').toLowerCase().trim();
    // Normalize common typos before keyword matching
    const normalizedBody = cleanBody
        .replace(/resset/g, 'reset')     // password resset → password reset
        .replace(/ressett/g, 'reset')
        .replace(/passward/g, 'password') // passward → password
        .replace(/pasword/g, 'password')  // pasword → password
        .replace(/passwrod/g, 'password') // passwrod → password
        .replace(/pssword/g, 'password')  // pssword → password
        .replace(/paswword/g, 'password') // paswword → password
        .replace(/ilaawey/g, 'ilaaway')   // Somali typos
        .replace(/ilaawaye/g, 'ilaaway')
        .replace(/illaaway/g, 'ilaaway')
        .replace(/baddal/g, 'badal')
        .replace(/badaal/g, 'badal');
    const state = userStates.get(userId);

    if (state && state.step === 'awaiting_password') {
        const passwordError = validatePassword(message.body);
        if (passwordError) {
            await message.reply("Fadlan furaha sirta ah (password) ha ahaado ugu yaraan 8 xaraf. Fadlan mar kale qor furahaaga cusub:");
            return;
        }

        try {
            const hashedPassword = await bcrypt.hash(message.body.trim(), 12);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
            userStates.delete(userId);
            await message.reply("Amniga: Furahaaga sirta ah (password) waa la bedelay si guul leh! Fadlan ilaasho furahaaga cusub. Hadda waad u isticmaali kartaa inaad ku gasho app-ka.");
            
            // Also send support contact card
            try {
                const supportContact = await client.getContactById('252637930329@c.us');
                await client.sendMessage(message.from, supportContact);
            } catch (err) {}
        } catch (err) {
            console.error('[WHATSAPP BOT] Password reset db update failed:', err.message);
            await message.reply("Waan ka xunnahay, cilad ayaa ku timid kaydinta furahaaga cusub. Fadlan mar kale isku day waxyar ka dib.");
        }
        return;
    }

    // Broad & natural language password reset detection (Somali + English + typo-tolerant)
    // Check against both the raw cleanBody and the typo-normalized version
    const _checkPwReset = (body) =>
        // English phrases
        body.includes('password reset') ||
        body.includes('reset password') ||
        body.includes('forgot password') ||
        body.includes('forget password') ||
        body.includes('change password') ||
        body.includes('change my password') ||
        body.includes('lost password') ||
        body.includes('cant login') ||
        body.includes("can't login") ||
        body.includes("can't log in") ||
        body.includes('reset my password') ||
        body.includes('update password') ||
        // Somali phrases – natural speech
        (body.includes('password') && (
            body.includes('badal') ||
            body.includes('ilaaways') ||
            body.includes('ilaaway') ||
            body.includes('ma galin') ||
            body.includes('ma geli') ||
            body.includes('iga') ||
            body.includes('ii') ||
            body.includes('cusub') ||
            body.includes('waan') ||
            body.includes('waxaan')
        )) ||
        (body.includes('furaha') && (
            body.includes('badal') ||
            body.includes('ilaaways') ||
            body.includes('ilaaway') ||
            body.includes('ma galin') ||
            body.includes('cusub') ||
            body.includes('iga') ||
            body.includes('ii')
        )) ||
        // Common full phrases
        body.includes('passwordka waan ilaaway') ||
        body.includes('password waan ilaaway') ||
        body.includes('furaha waan ilaaway') ||
        body.includes('passwordka iga badal') ||
        body.includes('password iga badal') ||
        body.includes('furaha iga badal') ||
        body.includes('bedel password') ||
        body.includes('bedel furaha') ||
        body.includes('furaha badal') ||
        body.includes('password badal') ||
        body.includes('ma geli karo password') ||
        body.includes('ma galin karo') ||
        body.includes('app lagama geli karo') ||
        body.includes('kuma geli karo') ||
        body.includes('password ilaaway') ||
        body.includes('furaheygii waan ilaaway') ||
        body.includes('furaheygii ilaaway');

    const isPasswordResetRequest = _checkPwReset(cleanBody) || _checkPwReset(normalizedBody);

    if (isPasswordResetRequest) {
        userStates.set(userId, { step: 'awaiting_password' });
        await message.reply("Haye! Si aan kuugu badalo password-kaaga, fadlan ii soo qor password-ka cusub ee aad rabto (ugu yaraan 8 xaraf):");
        return;
    }


    // 2. Group chat filters
    if (isGroup) {
        const hasImage = message.hasMedia && message.type === 'image';
        const keywords = [
            'waa maxay', 'qeex', 'sharax', 'maxaa', 'sidee', 'ii sheeg',
            'chemistry', 'biology', 'physics', 'math', 'xisaab', 'fiisigis',
            'english', 'taariikh', 'juqraafi', 'solve', 'explain', 'imtixaan',
            'cashar', 'su\'aal', 'sidee u', 'farqiga'
        ];
        const textClean = (message.body || '').toLowerCase().trim();
        const matchesKeyword = keywords.some(kw => textClean.includes(kw));
        if (!hasImage && !matchesKeyword) return;
    }

    // React with 👀
    await message.react('👀').catch(err => console.error('[WHATSAPP BOT] Failed to react 👀:', err.message));

    // 3. Rate limiting
    const now = new Date();
    const [cooldownRow] = await db.execute(
        'SELECT message_count, cooldown_until, last_message_at FROM whatsapp_cooldowns WHERE user_id = ?',
        [userId]
    );

    if (cooldownRow.length > 0) {
        const { message_count, cooldown_until, last_message_at } = cooldownRow[0];

        if (cooldown_until && new Date(cooldown_until) > now) {
            console.log(`[WHATSAPP BOT] User ${user.name} is on cooldown. Ignoring.`);
            return;
        }

        const lastMsgDate = new Date(last_message_at);
        const diffMinutes = (now.getTime() - lastMsgDate.getTime()) / (1000 * 60);

        if (diffMinutes > 3) {
            await db.execute(
                'UPDATE whatsapp_cooldowns SET message_count = 1, cooldown_until = NULL, notified_expiry = FALSE WHERE user_id = ?',
                [userId]
            );
        } else {
            const newCount = message_count + 1;
            if (newCount > 30) {
                const cooldownUntil = new Date(now.getTime() + 30 * 60000);
                await db.execute(
                    'UPDATE whatsapp_cooldowns SET message_count = ?, cooldown_until = ?, notified_expiry = FALSE WHERE user_id = ?',
                    [newCount, cooldownUntil, userId]
                );
                const formatTime = cooldownUntil.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu'
                });
                await message.reply(
                    `Fadlan yara sug ilaa ${formatTime} (sii wad wada-sheekaysiga dhanka abka haddii aad degdegeyso) si uu u nasto Darkpen.`
                );
                return;
            } else {
                await db.execute(
                    'UPDATE whatsapp_cooldowns SET message_count = ?, notified_expiry = FALSE WHERE user_id = ?',
                    [newCount, userId]
                );
            }
        }
    } else {
        await db.execute(
            'INSERT INTO whatsapp_cooldowns (user_id, message_count, cooldown_until, notified_expiry) VALUES (?, 1, NULL, FALSE)',
            [userId]
        );
    }

    // 4. Handle voice notes (DM only)
    const isVoice = message.hasMedia && (message.type === 'ptt' || message.type === 'audio');
    let messageText = message.body || '';
    let voiceCostApplied = false;

    if (isVoice) {
        if (isGroup) return;

        console.log(`[WHATSAPP BOT] Voice message received from ${user.name}`);
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const hasBalance = wallet.length > 0 && wallet[0].balance >= 20;

        if (!hasBalance) {
            await message.reply('Dhibcahaagu kuma filna dhegeysiga codka (20 Credits).');
            return;
        }

        const media = await message.downloadMedia();
        if (!media || !media.data) {
            await message.reply('Waan ka xunnahay, codka laguma guulaysan in la soo dejiyo.');
            return;
        }

        const fileExt = media.mimetype.split(';')[0].split('/')[1] || 'ogg';
        const tempFileName = `wa_voice_${userId}_${Date.now()}.${fileExt}`;
        const tempFilePath = path.join(uploadsDir, tempFileName);
        fs.writeFileSync(tempFilePath, Buffer.from(media.data, 'base64'));

        try {
            await client.sendMessage(message.from, '_Dhegeysanaya codka..._');
            messageText = await transcribeAudio(tempFilePath, media.mimetype.split(';')[0]);
            voiceCostApplied = true;
            console.log(`[WHATSAPP BOT] Voice transcription: "${messageText}"`);
        } catch (transErr) {
            console.error('[WHATSAPP BOT] Transcription error:', transErr);
            await message.reply('Waan ka xunnahay, codka lama fahmin.');
            return;
        } finally {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    }

    // 5. Calculate credit cost
    let cost = 1;
    const hasImage = message.hasMedia && message.type === 'image';

    if (voiceCostApplied) {
        cost = 20;
    } else if (hasImage) {
        cost = 10;
    } else {
        const len = messageText.length;
        if (len < 150) cost = 1;
        else if (len < 500) cost = 3;
        else if (len < 1500) cost = 7;
        else cost = 12;
    }

    const [sub] = await db.execute(
        'SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()',
        [userId]
    );
    const hasActiveSub = sub.length > 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text');
    }

    if (!usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;
        if (balance < cost) {
            await message.reply('kushubo credit');
            return;
        }
        await db.execute('UPDATE user_wallet SET balance = balance - ? WHERE user_id = ?', [cost, userId]);
    }

    // 6. Handle image attachment
    let attachmentData = null;
    if (hasImage) {
        const media = await message.downloadMedia();
        if (media && media.data) {
            attachmentData = { base64: media.data, mimeType: media.mimetype };
        }
    }

    // 7. Get chat history
    let history = [];
    const [historyRes] = await db.execute(
        'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id IS NULL ORDER BY created_at DESC LIMIT 5',
        [userId]
    );
    history = historyRes.reverse().map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }]
    }));

    // 8. System prompt
    const darkpenSystemInstruction = `Waxaa laguu bixiyey magaca Darkpen. Waxaa ku horumarisay shirkada ZinsonAI oo uu leeyahay Hamze Mohamuud Ali Zinson (Zinson). Waligaa ha dhihin waxaa ku sameeyay Google ama OpenAI, adigu waxaad tahay Darkpen oo ay leedahay ZinsonAI.
    
    Rules:
    1. Luuqaddaada: Ku jawaab af-Soomaali, Carabi, Ingiriis, ama luuqad kasta oo uu isticmaaluhu kuula soo hadlay farriintiisa u dambaysay (haddii uu Carabi kuugu soo qoro Carabi ugu jawaab, haddii uu Ingiriis kuugu soo qoro Ingiriis ugu jawaab, iwm).
    2. Jawaabahaagu ha ahaadaan kuwo gaaban, toos ah, oo waxtar leh (yareey hadallada aan loo baahnayn ee fluff-ka ah laakiin macnaha iyo faahfaahinta waxtarka leh ha lumin).
    3. Dhamaadka jawaabtaada, ku dar su'aal xiiso leh oo la xidhiidha mawduuca si wada-hadalku u sii socdo.
    4. 'Sax ama Qald': isticmaal <green>Sax</green> ama <red>Qald</red>. Doorasho (multiple choice): jawaabta saxda ah ku dhex qor <green>JAWAABTA</green>.
    5. Shaxan (table) ama barbardhig: Marna ha isticmaalin Markdown table (|---|) ama qaab grid ah. Xogta shaxda u soo qor qaab <table_data>Madaxa1|Madaxa2\nXogta1|Xogta2</table_data> si nidaamku si toos ah ugu beddelo qaab liis fudud ah oo ku habboon WhatsApp.
    6. Haddii laguu soo diro sawir, sharax oo tallaabo-tallaabo u faahfaahi si fudud.
    7. Cinwaanada: isticmaal plain bold (*Cinwaan*) halkii aad isticmaali lahayd #.
    8. Code-ka: ku dhex geli \`\`\`language ... \`\`\`.
    9. Ammaanka iyo Xogta App-ka:
       - Waxaad ka jawaabi kartaa su'aalaha caadiga ah ee sharciga ah ee ku saabsan app-ka (qiimaha, bixinta, terms-ka) sida soo socota:
         * Qiimaha: Premium monthly ($3/bishiiba), yearly ($11/sannadkiiba).
         * Bixinta: EVC/eDahab 637930329 ama 659119779. Screenshot-ka u dir WhatsApp: +252637930329 ama team.darkpen@gmail.com.
         * Terms & Privacy: Kaliya ujeedo waxbarasho iyo macluumaad. Xogta la ururiyo waa magac, email, lambar si AI loogu adeegsado. La xiriir team.darkpen@gmail.com wixii faahfaahin ah.
       - Ammaanka: Aad u ilaali amniga nidaamka. Marna ha bixin xogta hoose ee server-ka, hab-dhismeedka database-ka, furayaasha sirta ah (security keys), ama wax kasta oo daciifin kara amniga app-ka.`;

    // 9. Call Gemini API
    const chat = await message.getChat();
    await chat.sendStateTyping();
    const delayMs = Math.floor(Math.random() * 700) + 500;
    await new Promise(resolve => setTimeout(resolve, delayMs));

    try {
        const finalPrompt = messageText || 'Fadlan sharax sawirkan';
        const aiResponse = await askGemini(finalPrompt, "gemini-flash-latest", attachmentData, history, darkpenSystemInstruction);

        const formattedResponse = formatResponseForWhatsApp(aiResponse);
        await message.reply(formattedResponse);

        // Send contact card if the support number is mentioned in the response
        if (formattedResponse.includes('+252637930329') || formattedResponse.includes('637930329')) {
            try {
                const supportContact = await client.getContactById('252637930329@c.us');
                await client.sendMessage(message.from, supportContact);
            } catch (err) {
                console.error('[WHATSAPP BOT] Failed to send contact card:', err.message);
            }
        }

        // Emoji reaction (40% chance)
        let chosenReaction = '';
        if (Math.random() < 0.4) {
            const reactions = ['❤️', '😂', '👍', '😮', '😢'];
            chosenReaction = reactions[2];
            const lowerPrompt = finalPrompt.toLowerCase();
            if (lowerPrompt.includes('dhib') || lowerPrompt.includes('xun') || lowerPrompt.includes('tiiraanyo')) chosenReaction = '😢';
            else if (lowerPrompt.includes('qosol') || lowerPrompt.includes('kaftan')) chosenReaction = '😂';
            else if (lowerPrompt.includes('nax') || lowerPrompt.includes('yaab') || lowerPrompt.includes('mise')) chosenReaction = '😮';
            else if (lowerPrompt.includes('fiican') || lowerPrompt.includes('haye')) chosenReaction = '👍';
            else chosenReaction = reactions[Math.floor(Math.random() * reactions.length)];
        }
        await message.react(chosenReaction).catch(err => console.error('[WHATSAPP BOT] Failed to update reaction:', err.message));

        // Save to DB asynchronously
        db.execute(
            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "user", ?)',
            [userId, finalPrompt]
        ).catch(err => console.error('[WHATSAPP BOT] DB save user msg error:', err.message));

        db.execute(
            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "ai", ?)',
            [userId, aiResponse]
        ).catch(err => console.error('[WHATSAPP BOT] DB save AI response error:', err.message));

        logAIUsage(
            userId,
            'gemini-1.5-flash',
            finalPrompt,
            aiResponse,
            voiceCostApplied ? 'voice' : (hasImage ? 'image' : 'education')
        ).catch(err => console.error('[WHATSAPP BOT] Logging error:', err.message));

    } catch (err) {
        console.error('[WHATSAPP BOT] Gemini generation error:', err);
        await message.react('').catch(e => {});
        await message.reply('Waan ka xunnahay, darkpen cilad farsamo ayaa ku timid. Fadlan mar kale isku day waxyar ka dib.');
    }
}

// ─── Helper: Format response for WhatsApp ─────────────────────────────────────
function formatResponseForWhatsApp(text) {
    if (!text) return '';
    let formatted = text;
    
    // Convert custom HTML-style tags to WhatsApp bold
    formatted = formatted.replace(/<green>([\s\S]*?)<\/green>/gi, '*$1*');
    formatted = formatted.replace(/<red>([\s\S]*?)<\/red>/gi, '*$1*');
    formatted = formatted.replace(/<callout>([\s\S]*?)<\/callout>/gi, '*$1*');
    
    // Format custom table data into a clean WhatsApp-friendly list
    formatted = formatted.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (match, tableContent) => {
        const lines = tableContent.trim().split('\n');
        if (lines.length === 0) return '';
        const headers = lines[0].split('|').map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split('|').map(c => c.trim()));
        
        let output = '\n*Xogta Shaxda:*\n';
        rows.forEach(row => {
            output += '------------------\n';
            row.forEach((col, idx) => {
                const header = headers[idx] || '';
                output += `• *${header}:* ${col}\n`;
            });
        });
        output += '------------------\n';
        return output;
    });

    // 1. Convert markdown headers (# Title, ## Title, etc.) to WhatsApp bold titles
    formatted = formatted.replace(/^(#{1,6})\s+(.+)$/gm, '*$2*');

    // 2. Convert markdown bold (**bold**) to WhatsApp bold (*bold*)
    formatted = formatted.replace(/\*\*([\s\S]*?)\*\*/g, '*$1*');

    // 3. Convert markdown underline/italic (__italic__) to WhatsApp italic (_italic_)
    formatted = formatted.replace(/__([\s\S]*?)__/g, '_$1_');

    // 4. Convert markdown list items (* item or - item) to bullet points (• item)
    // This prevents WhatsApp from interpreting '* ' as the start of a bold block across lines.
    formatted = formatted.replace(/^\s*[\*\-]\s+/gm, '• ');

    // 5. Remove syntax highlighting language from code blocks (e.g. ```javascript -> ```)
    formatted = formatted.replace(/```[a-zA-Z0-9-]+\n/g, '```\n');

    return formatted;
}

exports.sendWhatsAppMessage = async (to, content) => {
    if (!client || botStatus !== 'connected') {
        throw new Error('WhatsApp bot is not connected');
    }
    let jid = to;
    if (!to.includes('@')) {
        const cleaned = to.replace(/\+/g, '').trim();
        jid = `${cleaned}@c.us`;
    }
    return await client.sendMessage(jid, content);
};

exports.sendWhatsAppContact = async (to, contactJid) => {
    if (!client || botStatus !== 'connected') {
        throw new Error('WhatsApp bot is not connected');
    }
    let jid = to;
    if (!to.includes('@')) {
        const cleaned = to.replace(/\+/g, '').trim();
        jid = `${cleaned}@c.us`;
    }
    const contact = await client.getContactById(contactJid);
    return await client.sendMessage(jid, contact);
};
