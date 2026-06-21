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
let isInitializing = false;
let readyTime = 0;
const offlineMessageBuffer = new Map();
let offlineProcessTimeout = null;

// Destroy existing client/browser to free RAM before re-initializing
async function destroyClient() {
    if (client) {
        try {
            console.log('[WHATSAPP BOT] Destroying existing client to free memory...');
            await client.destroy();
        } catch (e) {
            console.error('[WHATSAPP BOT] Error destroying client:', e.message);
        }
        client = null;
    }
}

// QR Code and bot status tracking
let botStatus = 'initializing'; // 'initializing' | 'qr_ready' | 'connected' | 'disconnected' | 'error'
let currentQRDataURL = null;    // Base64 QR image for the /api/whatsapp/qr endpoint

// Password reset states map (userId -> { step })
const userStates = new Map();
// Registration states map (phone -> { step, name, password })
const registrationStates = new Map();
// Cache of recently processed message IDs to prevent duplicates
const processedMessageIds = new Set();

// Rate limiting maps
const userMsgTimestamps = new Map();
const unregMsgTimestamps = new Map();
const groupWarningsSent = new Set();

// Helper to check rate limit for registered users (10 msgs in 1 min -> 10 min block)
async function checkRateLimit(userId, message) {
    try {
        const now = Date.now();
        if (!userMsgTimestamps.has(userId)) {
            userMsgTimestamps.set(userId, []);
        }
        const times = userMsgTimestamps.get(userId).filter(t => t > now - 60000);
        times.push(now);
        userMsgTimestamps.set(userId, times);

        if (times.length >= 10) {
            const blockedUntilDate = new Date(now + 10 * 60000);
            await db.execute(
                'UPDATE users SET rate_limit_blocked_until = ? WHERE id = ?',
                [blockedUntilDate, userId]
            );
            const unblockTime = blockedUntilDate.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu'
            });
            await message.reply(
                `⚠️ Waxaad ka gaadhay xad — Xeerka 1-Daqiiqo (10 farriimood)!\n\nNidaamku si otomaatig ah ayuu kuu xidhay muddo 10 daqiiqo ah.\n⏰ Kusoo noqo marka ay tahay: *${unblockTime}*`
            );
            return true;
        }
    } catch (err) {
        console.error('[RATE LIMIT ERROR]:', err.message);
    }
    return false;
}

// Helper to check rate limit for unregistered users (10 msgs in 1 min -> 10 min block)
async function checkUnregisteredRateLimit(normalizedPhone, message) {
    const now = Date.now();
    if (!unregMsgTimestamps.has(normalizedPhone)) {
        unregMsgTimestamps.set(normalizedPhone, []);
    }
    const times = unregMsgTimestamps.get(normalizedPhone).filter(t => t > now - 60000);
    times.push(now);
    unregMsgTimestamps.set(normalizedPhone, times);

    const blockKey = `block_${normalizedPhone}`;
    const blockedUntil = unregMsgTimestamps.get(blockKey);
    if (blockedUntil && blockedUntil > now) {
        return true;
    }

    if (times.length >= 10) {
        const blockEnd = now + 10 * 60000;
        unregMsgTimestamps.set(blockKey, blockEnd);
        const unblockTime = new Date(blockEnd).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu'
        });
        await message.reply(
            `⚠️ Waxaad ka gaadhay xad — Xeerka 1-Daqiiqo (10 farriimood)!\n\nNidaamku si otomaatig ah ayuu kuu xidhay muddo 10 daqiiqo ah.\n⏰ Kusoo noqo marka ay tahay: *${unblockTime}*`
        );
        return true;
    }
    return false;
}

// Helper to check if user requests manager contact routing
function checkManagerRequest(text) {
    const clean = String(text || '').toLowerCase().trim();
    const isPaymentManager = clean.includes('managerka payments') ||
                             clean.includes('managerka payment') ||
                             clean.includes('payment manager') ||
                             clean.includes('payments manager') ||
                             clean.includes('managerka lacagta') ||
                             clean.includes('managerka lacagaha') ||
                             clean.includes('maamulaha lacagta') ||
                             clean.includes('maamulaha lacagaha') ||
                             clean.includes('maamulaha paymentska');
                             
    const isGeneralManager = clean.includes('manager') ||
                             clean.includes('managerka') ||
                             clean.includes('maamule') ||
                             clean.includes('maamulaha') ||
                             clean.includes('admin') ||
                             clean.includes('adminka') ||
                             clean.includes('owner') ||
                             clean.includes('ownerka');
                             
    if (isPaymentManager) return 'payment';
    if (isGeneralManager) return 'general';
    return null;
}

// Helper to check if user is giving correction feedback to the AI
function isWrongAnswerFeedback(text) {
    const clean = String(text || '').toLowerCase().trim();
    return clean.includes('waad khaladay') ||
           clean.includes('waad qaldantahay') ||
           clean.includes('waad khaldantahay') ||
           clean.includes('waad qaldan tahay') ||
           clean.includes('waad khaldan tahay') ||
           clean.includes('waad qaldantay') ||
           clean.includes('waad khaldantay') ||
           clean.includes('waad khaladday') ||
           clean.includes('waad qaldday') ||
           clean.includes('you are wrong') ||
           clean.includes('wrong answer');
}

// Helper to send contact card securely
async function sendContactCard(from, jid, displayName) {
    try {
        const contact = await client.getContactById(jid);
        await client.sendMessage(from, contact);
    } catch (err) {
        console.warn(`[WHATSAPP BOT] Failed to send contact card for ${jid}:`, err.message);
        await client.sendMessage(from, `Fadlan kala xidhiidh ${displayName} halkan: +${jid.split('@')[0]}`);
    }
}

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
    // Guard against multiple concurrent initializations
    if (isInitializing) {
        console.log('[WHATSAPP BOT] Already initializing, skipping duplicate call.');
        return;
    }
    isInitializing = true;
    botStatus = 'initializing';

    // Destroy any leftover client/browser first to free RAM
    await destroyClient();

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
            readyTime = Math.floor(Date.now() / 1000);
            console.log('[WHATSAPP BOT] Client is ready and listening to messages! readyTime set to:', readyTime);
        });

        // Auth failure – auto-clear session and reconnect
        client.on('auth_failure', async (msg) => {
            botStatus = 'error';
            isInitializing = false;
            console.error('[WHATSAPP BOT] Authentication failure:', msg);
            // Clear bad session from DB so next start shows fresh QR
            try {
                await db.execute('DELETE FROM whatsapp_sessions WHERE session_key = ?', ['darkpen']);
                console.log('[WHATSAPP BOT] Bad session cleared from DB.');
            } catch (dbErr) {
                console.error('[WHATSAPP BOT] Failed to clear bad session:', dbErr.message);
            }
            console.log('[WHATSAPP BOT] Reconnecting in 15 seconds...');
            setTimeout(() => { exports.initialize().catch(e => console.error('[WHATSAPP BOT] Reconnect failed:', e.message)); }, 15000);
        });

        // Disconnected – auto-reconnect
        client.on('disconnected', async (reason) => {
            botStatus = 'disconnected';
            currentQRDataURL = null;
            isInitializing = false;
            console.log(`[WHATSAPP BOT] Disconnected: ${reason}`);
            console.log('[WHATSAPP BOT] Auto-reconnecting in 30 seconds...');
            setTimeout(() => { exports.initialize().catch(e => console.error('[WHATSAPP BOT] Reconnect failed:', e.message)); }, 30000);
        });

        // Incoming calls – reject and reply
        client.on('incoming_call', async (call) => {
            try {
                console.log(`[WHATSAPP BOT] Wacitaan la diiday oo ka yimid: ${call.from}`);
                await call.reject();
                await client.sendMessage(
                    call.from,
                    "kuma hadli karo call oo iminka kama jawaabayoba"
                );
            } catch (err) {
                console.error('[WHATSAPP BOT] Call handling error:', err.message);
            }
        });

        // Group join – welcome message
        client.on('group_join', async (notification) => {
            try {
                const chat = await notification.getChat();
                const recipientIds = notification.recipientIds || [];
                const botJid = client.info && client.info.wid && client.info.wid._serialized;
                const isBotAdded = recipientIds.includes(botJid) || 
                                   (notification.id && notification.id.participant === botJid);
                
                if (isBotAdded) {
                    console.log(`[WHATSAPP BOT] Bot was added to group: ${chat.name}`);
                    await chat.sendMessage(
                        `*DARKPEN GROUP BOT* 🤖📚\n` +
                        `----------------------------------\n` +
                        `Haye dhammaan xubnaha group-ka! Waxaa igu soo biiray caawiyahaaga AI-da ee *Darkpen*.\n\n` +
                        `*SIDA LOOGU JAWAABO INTA LAGU JIRO GROUP-KA:*\n` +
                        `• Si aan kuugu jawaabo, fadlan farriintaada ku bilaab erayga *Darkpen* ama igu soo tag (@tag) si aan u aqoonsado su'aashaada.\n` +
                        `• Waxaad kaloo ii soo diri kartaa sawirro (MCQ, xisaab, ama sharaxaad) adigoo qoraalka sawirka la socda ku bilaabaya *Darkpen*.\n\n` +
                        `*XEERARKA GROUP-KA:*\n` +
                        `• Xubnaha group-ku waa inay ka fogaadaan farriimaha is-daba-joogga ah (spam). Farriimaha badan oo daqiiqad gudaheed ah waxay keeni karaan xannibaad ku-meel-gaadh ah.`
                    );
                }
            } catch (err) {
                console.error('[WHATSAPP BOT] Group join welcome failed:', err.message);
            }
        });

        // Incoming messages
        client.on('message', async (message) => {
            try {
                // Buffer and deduplicate offline messages received during initialization
                if (readyTime > 0 && message.timestamp < readyTime) {
                    console.log(`[WHATSAPP BOT] Offline message received from ${message.from} (timestamp: ${message.timestamp}, readyTime: ${readyTime}). Buffering...`);
                    offlineMessageBuffer.set(message.from, message);

                    if (!offlineProcessTimeout) {
                        offlineProcessTimeout = setTimeout(async () => {
                            console.log(`[WHATSAPP BOT] Processing ${offlineMessageBuffer.size} unique offline messages...`);
                            const messagesToProcess = Array.from(offlineMessageBuffer.values());
                            offlineMessageBuffer.clear();
                            offlineProcessTimeout = null;

                            for (const offlineMsg of messagesToProcess) {
                                try {
                                    console.log(`[WHATSAPP BOT] Processing offline message from ${offlineMsg.from}`);
                                    await handleIncomingMessage(offlineMsg);
                                } catch (err) {
                                    console.error('[WHATSAPP BOT] Offline message handling error:', err);
                                }
                            }
                        }, 4000); // 4-second accumulation window
                    }
                    return;
                }

                // Process real-time messages immediately
                await handleIncomingMessage(message);
            } catch (err) {
                console.error('[WHATSAPP BOT] Message handling error:', err);
            }
        });

        // Proactive checker
        startProactiveChecker();

        // Boot client
        client.initialize().then(() => {
            isInitializing = false;
        }).catch(async (error) => {
            isInitializing = false;
            botStatus = 'error';
            console.error('[WHATSAPP BOT] Initialization failed during client.initialize():', error);
            const errMsg = String(error.message || '').toLowerCase();
            // If session is corrupted, clear it and retry
            if (errMsg.includes('zip') || errMsg.includes('session') || errMsg.includes('corrupt') || errMsg.includes('extract') || errMsg.includes('tar')) {
                console.log('[WHATSAPP BOT] Corrupted session detected — clearing from DB...');
                try {
                    await db.execute('DELETE FROM whatsapp_sessions WHERE session_key = ?', ['darkpen']);
                    console.log('[WHATSAPP BOT] Session cleared. Retrying in 10 seconds...');
                } catch (dbErr) {
                    console.error('[WHATSAPP BOT] Failed to clear corrupt session:', dbErr.message);
                }
            }
            setTimeout(() => { exports.initialize().catch(e => console.error('[WHATSAPP BOT] Retry failed:', e.message)); }, 15000);
        });

    } catch (error) {
        isInitializing = false;
        botStatus = 'error';
        console.error('[WHATSAPP BOT] Initialization failed:', error);
        setTimeout(() => { exports.initialize().catch(e => console.error('[WHATSAPP BOT] Retry failed:', e.message)); }, 30000);
    }
};

function isYesResponse(text) {
    const clean = String(text || '').toLowerCase().trim().replace(/[?!.]/g, '');
    return /^ha+$/i.test(clean) || 
           /^ye+y$/i.test(clean) || 
           /^haye$/i.test(clean) || 
           /^ok(ay)?$/i.test(clean) || 
           /^yes+$/i.test(clean) || 
           /^yep$/i.test(clean) || 
           clean === 'y' || 
           clean === 'sax' || 
           clean === 'sawn' || 
           clean === 'waa sax';
}

function isNoResponse(text) {
    const clean = String(text || '').toLowerCase().trim().replace(/[?!.]/g, '');
    return /^may?a*$/i.test(clean) || 
           /^no+p?e?$/i.test(clean) || 
           clean === 'n' || 
           clean === 'laa' || 
           clean.includes('ma rabo') || 
           clean.includes('ha rabin');
}

async function handleOutOfFlowQuery(message, key, flowType, flowContext) {
    const userPrompt = message.body || '';
    const systemPrompt = `You are Darkpen, a friendly AI assistant. 
    The user is currently in the middle of a WhatsApp bot registration/payment process.
    Flow: ${flowContext}
    
    They just sent this message instead of answering the expected question: "${userPrompt}"
    
    Instruction:
    1. Answer their question directly, warmly, and concisely in the same language they used (Somali or English).
    2. Add a polite reminder at the end asking them to continue the flow by answering the pending question (e.g. "To continue registration, please reply with 'Haa' or 'Maya'." or "To choose a plan, please type 1, 2, or 3.").
    3. Do NOT proceed with the payment or registration itself, just answer the query and prompt them to continue.`;

    try {
        const aiResponse = await askGemini(userPrompt, "gemini-2.5-flash", null, [], systemPrompt);
        await message.reply(formatResponseForWhatsApp(aiResponse));
    } catch (err) {
        console.error('[WHATSAPP BOT] Failed to answer out-of-flow query:', err.message);
        await message.reply("Fadlan ku jawaab Haa ama Maya si aan u sii wadno.");
    }
}

// ─── Helper: clean phone number ───────────────────────────────────────────────
function getCleanNumber(rawJid) {
    const digits = rawJid.split('@')[0];
    return normalizePhoneNumber(digits);
}

// Helper: auto-generate unique username from full name
async function generateUniqueUsername(name) {
    const base = name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20) || 'user';

    for (let i = 0; i < 10; i++) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const candidate = `${base}_${suffix}`;
        const [rows] = await db.execute(
            'SELECT id FROM users WHERE username = ?',
            [candidate]
        );
        if (rows.length === 0) return candidate;
    }
    // Fallback: timestamp-based
    return `${base}_${Date.now().toString().slice(-6)}`;
}

// Handle unregistered user registration flow
async function handleUnregisteredRegistration(message, normalizedPhone) {
    const state = registrationStates.get(normalizedPhone);
    const cleanBody = (message.body || '').toLowerCase().trim();

    if (!state) {
        registrationStates.set(normalizedPhone, { step: 'awaiting_registration_consent' });
        await message.reply("Ma diwaan gashanid ee maku diwaan galiyaa whatsappkan laftarkiisa? (Ku jawaab: Haa ama Maya)");
        return;
    }

    if (state.step === 'awaiting_registration_consent') {
        if (isYesResponse(cleanBody)) {
            state.step = 'awaiting_phone';
            await message.reply("Fadlan ii soo qor lambarkaaga WhatsApp-ka ee saxda ah (Tusaale: 061XXXXXXX):");
        } else if (isNoResponse(cleanBody)) {
            await message.reply("Haye, waa la baajiyey (Cancel).");
            registrationStates.delete(normalizedPhone);
        } else {
            await handleOutOfFlowQuery(message, normalizedPhone, 'signup_consent', "I am asking the user if they want to register for Darkpen WhatsApp bot. They should reply with 'Haa' (Yes) or 'Maya' (No).");
        }
        return;
    }

    if (state.step === 'awaiting_phone') {
        const phoneInput = normalizePhoneNumber(message.body.trim());
        if (!phoneInput) {
            await message.reply("Fadlan qor lambar WhatsApp oo sax ah (Tusaale: 061XXXXXXX):");
            return;
        }

        // Check if the phone number is already registered
        const [existing] = await db.execute('SELECT id FROM users WHERE whatsapp_number = ?', [phoneInput]);
        if (existing.length > 0) {
            await message.reply("Lambar-kan mar hore ayaa la diiwaangeliyey. Fadlan qor lambar kale oo sax ah:");
            return;
        }

        state.phone = phoneInput;
        state.step = 'awaiting_name';
        await message.reply("Magacaaga oo buuxa qor (Tusaale: Axmed Cali Faarax):");
        return;
    }

    if (state.step === 'awaiting_name') {
        const nameVal = message.body.trim();
        if (!nameVal) {
            await message.reply("Fadlan ii soo qor magac sax ah:");
            return;
        }
        state.name = nameVal;
        state.step = 'awaiting_password';
        await message.reply(`Haye, ${nameVal}. Fadlan qor furaha sirta ah (password) ee aad rabto (ugu yaraan 8 xaraf):`);
        return;
    }

    if (state.step === 'awaiting_password') {
        const passwordVal = message.body.trim();
        const passwordError = validatePassword(passwordVal);
        if (passwordError) {
            await message.reply("Fadlan furaha sirta ah (password) ha ahaado ugu yaraan 8 xaraf. Fadlan mar kale qor furahaaga:");
            return;
        }
        state.password = passwordVal;

        // Register immediately, skip review step
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [existing] = await connection.execute('SELECT id FROM users WHERE whatsapp_number = ?', [state.phone]);
            if (existing.length > 0) {
                await connection.rollback();
                await message.reply("Lambar-kan mar hore ayaa la diiwaangeliyey.");
                registrationStates.delete(normalizedPhone);
                return;
            }

            const username = await generateUniqueUsername(state.name);
            const hashedPassword = await bcrypt.hash(state.password, 12);

            const [result] = await connection.execute(
                `INSERT INTO users (name, username, email, whatsapp_number, whatsapp_jid, password, payment_status, payment_reference, is_verified)
                 VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, TRUE)`,
                [state.name, username, state.phone, normalizedPhone, hashedPassword]
            );

            const newUserId = result.insertId;
            await connection.execute('INSERT IGNORE INTO user_wallet (user_id, balance) VALUES (?, 0)', [newUserId]);

            await connection.commit();

            await message.reply(
                "Hambalyo! Si guul leh ayaa laguu diwaan-geliyey. Hadda waad isticmaali kartaa Darkpen WhatsApp Bot.\n\n" +
                "🎁 Waxaad hadiyad ahaan u heysataa:\n" +
                "• 15 farriimo oo bilaash ah (Free Messages)\n" +
                "• 3 sawir oo bilaash ah (Free Images)\n\n" +
                "Markay kaa dhammaadaan, waxaad u baahan doontaa inaad ku shubato credits si aad u sii waddo isticmaalka."
            );

            // Follow-up with rules message
            await client.sendMessage(
                message.from,
                `*XEERARKA ISTICMAALKA BOT-KA* ⚠️\n` +
                `----------------------------------\n` +
                `• *Xaddiga Farriimaha:* Haddii aad soo dirto 10 farriimood muddo 1 daqiiqo gudaheed ah, nidaamku si otomaatig ah ayuu kuu xidhi doonaa muddo 10 daqiiqo ah.\n` +
                `• *Xallinta Khalaadaadka AI:* AI-du waxay ku jirtaa barashada buugaagta manhajka. Haddii aad aragto wax khaldan oo weyn, fadlan la xidhiidh maamulaha (+252637930329).`
            );

            await client.sendMessage(
                message.from,
                "Makaa caawiyaa sida uu u shaqeeyo WhatsApp bot-ku? (Ku jawaab: Haa ama Maya)"
            );

            registrationStates.delete(normalizedPhone);
            userStates.set(newUserId, { step: 'awaiting_whatsapp_help_consent' });
        } catch (dbErr) {
            await connection.rollback();
            console.error('[WHATSAPP BOT] Registration failed:', dbErr.message);
            await message.reply("Waan ka xunnahay, cilad ayaa ku timid kaydinta xogtaada. Fadlan mar kale isku day waxyar ka dib.");
        } finally {
            connection.release();
        }
        return;
    }
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

    // Deduplicate incoming messages using serialization ID
    const msgId = message.id && message.id._serialized;
    if (msgId) {
        if (processedMessageIds.has(msgId)) {
            console.log(`[WHATSAPP BOT] Duplicate message ignored: ${msgId}`);
            return;
        }
        processedMessageIds.add(msgId);
        if (processedMessageIds.size > 200) {
            const oldestId = processedMessageIds.values().next().value;
            processedMessageIds.delete(oldestId);
        }
    }

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
            await message.reply("kuma hadli karo call oo iminka kama jawaabayoba");
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

    // Extract sender number using getContact() if possible to resolve JIDs/LIDs cleanly, falling back to message fields
    const senderRaw = isGroup ? (message.author || '') : message.from;
    let senderNumberRaw = senderRaw.split('@')[0].split(':')[0];
    try {
        const contact = await message.getContact();
        if (contact && contact.number) {
            senderNumberRaw = contact.number;
        }
    } catch (contactErr) {
        console.warn('[WHATSAPP BOT] Failed to fetch contact profile, falling back to raw JID:', contactErr.message);
    }
    const normalizedPhone = normalizePhoneNumber(senderNumberRaw);
    console.log(`[WHATSAPP BOT DEBUG] senderRaw: ${senderRaw}, senderNumberRaw: ${senderNumberRaw}, normalizedPhone: ${normalizedPhone}`);

    if (!normalizedPhone) return;

    // B. Look up user in database
    const [users] = await db.execute(
        'SELECT id, name, is_suspended, rate_limit_blocked_until FROM users WHERE whatsapp_jid = ? OR whatsapp_number = ? LIMIT 1',
        [normalizedPhone, normalizedPhone]
    );

    // C. Group isolation for active private flows (registration / password reset / payment)
    if (isGroup) {
        let hasActivePrivateState = false;
        let warningKey = '';

        if (registrationStates.has(normalizedPhone)) {
            hasActivePrivateState = true;
            warningKey = normalizedPhone;
        } else if (users.length > 0) {
            const userId = users[0].id;
            if (userStates.has(userId)) {
                hasActivePrivateState = true;
                warningKey = String(userId);
            }
        }

        if (hasActivePrivateState) {
            const warnedKey = `${warningKey}_group_warned`;
            if (!groupWarningsSent.has(warnedKey)) {
                groupWarningsSent.add(warnedKey);
                setTimeout(() => groupWarningsSent.delete(warnedKey), 5 * 60000);
                await message.reply("Fadlan ku noqo WhatsApp-ka Darkpen (luuqa/DM-ka) si aad u sii waddo shaqadii noo socotey.");
            } else {
                try {
                    await message.react('🚫');
                } catch (reactErr) {
                    console.error('[WHATSAPP BOT] Failed to react with emoji:', reactErr.message);
                }
            }
            return; // Intercept and ignore group message processing
        }
    }

    // Universal Cancel Command Handler
    const cleanBodyText = (message.body || '').toLowerCase().trim();
    const isCancelRequest = cleanBodyText === 'cancel' || cleanBodyText === 'exit' || cleanBodyText === 'stop' || cleanBodyText === 'ka noqo' || cleanBodyText === 'ka-noqo' || cleanBodyText === 'baaji' || cleanBodyText === 'cancel garee';
    if (isCancelRequest) {
        let cancelled = false;
        if (registrationStates.has(normalizedPhone)) {
            registrationStates.delete(normalizedPhone);
            cancelled = true;
        }
        if (users.length > 0) {
            const userId = users[0].id;
            if (userStates.has(userId)) {
                userStates.delete(userId);
                cancelled = true;
            }
        }
        if (cancelled) {
            await message.reply("Hawshii aad ku jirtay waa la baajiyey (Cancelled). Wax kasta waa sidoodii.");
            return;
        }
    }

    if (users.length === 0) {
        if (!isGroup) {
            if (await checkUnregisteredRateLimit(normalizedPhone, message)) return;
            await handleUnregisteredRegistration(message, normalizedPhone);
        }
        return;
    }

    const user = users[0];

    // Check rate limit block (persistent)
    if (user.rate_limit_blocked_until && new Date(user.rate_limit_blocked_until) > new Date()) {
        console.log(`[WHATSAPP BOT] User ${user.name} is rate limited until ${user.rate_limit_blocked_until}. Ignoring.`);
        return;
    }

    if (user.is_suspended) {
        console.log(`[WHATSAPP BOT] User ${user.name} (${normalizedPhone}) is suspended. Ignoring.`);
        return;
    }

    const userId = user.id;

    // Track/check rate limit (10 msgs in 1 min -> 10 min block)
    if (await checkRateLimit(userId, message)) {
        return;
    }

    // Intercept Manager Routing
    const managerType = checkManagerRequest(message.body);
    if (managerType) {
        if (managerType === 'payment') {
            await message.reply("Halkan kala xidhiidh Manager-ka Payments-ka (Lacag-bixinta):");
            await sendContactCard(message.from, '252654810865@c.us', 'Manager Payments');
        } else {
            await message.reply("Halkan kala xidhiidh Maamulaha (Manager-ka):");
            await sendContactCard(message.from, '252637930329@c.us', 'Manager General');
        }
        return;
    }

    // Intercept AI correction feedback
    if (isWrongAnswerFeedback(message.body)) {
        await message.reply(
            "Waan ka xunnahay! Waxaan isku dayey 100% inaan saxo, laakiin hadda waxaan ku jiraa xaalad aan ku baranayo buugaagta manhajka dugsiyada.\n\n" +
            "Haddii aad aragtay wax weyn oo khaldan, fadlan la hadal maamulaha (manager-ka):"
        );
        await sendContactCard(message.from, '252637930329@c.us', 'Manager General');
        return;
    }

    // C. Check pending payments
    const [pendingRows] = await db.execute(
        'SELECT id FROM payments WHERE user_id = ? AND status = "pending" LIMIT 1',
        [userId]
    );
    if (pendingRows.length > 0) {
        await message.reply("Codsigaaga ku shubashada waa uu socdaa, fadlan sug inta laga soo hubinayo.");
        return;
    }

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
        } catch (err) {
            console.error('[WHATSAPP BOT] Password reset db update failed:', err.message);
            await message.reply("Waan ka xunnahay, cilad ayaa ku timid kaydinta furahaaga cusub. Fadlan mar kale isku day waxyar ka dib.");
        }
        return;
    }

    // ─── Top-Up Consent / Payment Flow ───
    if (state && state.step === 'awaiting_topup_consent') {
        if (isYesResponse(cleanBody)) {
            userStates.set(userId, { step: 'awaiting_plan_choice' });
            await message.reply(
                `Fadlan dooro qorshaha aad rabto (Qor lambarka qorshaha tusaale: 1, 2 ama 3):\n\n` +
                `1. *Pay as you go:* $0.5 (100 Credits)\n` +
                `2. *Monthly Basic:* $3 (Unlimited standard chat - 30 Days)\n` +
                `3. *Monthly Premium:* $11 (Unlimited chat + premium support - 30 Days)`
            );
        } else if (isNoResponse(cleanBody)) {
            await message.reply("Haye, waa la baajiyey (Cancel).");
            userStates.delete(userId);
        } else {
            await handleOutOfFlowQuery(message, userId, 'topup_consent', "I asked the user if they want to top up their credits. They must reply with 'Haa' (Yes) or 'Maya' (No) to continue.");
        }
        return;
    }

    if (state && state.step === 'awaiting_plan_choice') {
        if (['1', '2', '3'].includes(cleanBody)) {
            userStates.set(userId, { step: 'awaiting_payment_sender_number', plan: cleanBody });
            
            let planDesc = '';
            if (cleanBody === '1') planDesc = 'Pay as you go ($0.5)';
            else if (cleanBody === '2') planDesc = 'Monthly Basic ($3)';
            else if (cleanBody === '3') planDesc = 'Monthly Premium ($11)';

            await message.reply(
                `Waxaad dooratay: *${planDesc}*\n\n` +
                `Fadlan lacagta ku soo dir:\n` +
                `• *EVC Plus:* Garaac *771*637930329*lacagta#\n` +
                `• *ZAAD:* Garaac *220*637930329*lacagta#\n` +
                `• *eDahab:* Garaac *700*659119779*lacagta#\n\n` +
                `ℹ️ EVC Plus iyo ZAAD waxay wadaagaan isku number: *637930329*\n` +
                `ℹ️ eDahab number: *659119779*\n\n` +
                `Markaad lacagta soo dirtid, fadlan halkan ku soo qor *lambarka aad lacagta KA soo dirtay* (kama aha kan lacagta loo diray) si aan u hubinno:`
            );
        } else {
            await handleOutOfFlowQuery(message, userId, 'plan_choice', "I asked the user to select plan 1, 2, or 3. They must reply with '1', '2', or '3' to continue.");
        }
        return;
    }

    if (state && state.step === 'awaiting_payment_sender_number') {
        const senderNum = message.body.trim();
        
        // Validate if it is a numeric/phone number format
        const isNumeric = /^\+?[\d\s.-]{6,15}$/.test(senderNum);
        if (!isNumeric) {
            state.invalidCount = (state.invalidCount || 0) + 1;
            if (state.invalidCount > 2) {
                await message.reply("markad lacagta soo dirto ila soo hadal oo numberka so qor xadkaagi baad gaadhaye waad balaadhisee");
            } else {
                // Call Gemini to concisely explain/respond to their message
                const systemPrompt = `You are an AI assistant for Darkpen.
The user is currently trying to top up their account and was asked to enter the phone number they sent the money FROM (the sender number, not the receiver).
Instead of entering a number, they sent this message: "${senderNum}".

Instruction:
1. Understand what they are saying/asking.
2. Respond directly and warmly in the same language they used (usually Somali).
3. Keep the response very concise and helpful.
4. Use ONLY these correct payment instructions:
   - EVC Plus: dial *771*637930329*lacagta# (number: 637930329)
   - ZAAD: dial *220*637930329*lacagta# (same number as EVC: 637930329)
   - eDahab: dial *700*659119779*lacagta# (number: 659119779)
5. Remind them: after sending money, they must type here the phone number they SENT FROM.

If they ask how to send, explain briefly using the correct codes above.
If they say they have no money, respond politely and say they can do it whenever ready.`;
                try {
                    const aiResponse = await askGemini(senderNum, "gemini-2.5-flash", null, [], systemPrompt);
                    await message.reply(formatResponseForWhatsApp(aiResponse));
                } catch (err) {
                    console.error('[WHATSAPP BOT] Failed to answer payment query via Gemini:', err.message);
                    await message.reply("Fadlan qor lambarka aad lacagta ka soo dirtay:");
                }
            }
            return;
        }

        const planChoice = state.plan;
        let planName = '';
        let amount = 0.50;
        if (planChoice === '1') {
            planName = 'Pay as you go ($0.5)';
            amount = 0.50;
        } else if (planChoice === '2') {
            planName = 'Monthly Basic ($3)';
            amount = 3.00;
        } else if (planChoice === '3') {
            planName = 'Monthly Premium ($11)';
            amount = 11.00;
        }

        const adminJid = '252637930329@c.us';
        const adminMsgText = `*CODSIG LACAG-BIXIN WHATSAPP*\n------------------\nQorshe: *${planName}*\nIsticmaalaha: *${user.name}*\nLambar/Reference: *${senderNum}*\n\nFadlan gal Admin Dashboard-ka si aad u ansixiso ama u diido.`;

        try {
            await client.sendMessage(adminJid, adminMsgText);

            await db.execute(
                'INSERT INTO payments (user_id, amount, reference_number, service_type, status) VALUES (?, ?, ?, "general", "pending")',
                [userId, amount, senderNum]
            );

            await message.reply("Codsigaaga ku shubashada waa la diray oo waa la hubinayaa. Fadlan sug inta laga soo tasdiqinayo.");
            userStates.delete(userId);
        } catch (err) {
            console.error('[WHATSAPP BOT] Failed to notify admin/save database:', err.message);
            await message.reply("Waan ka xunnahay, codsigaaga lama gudbin karo hadda. Fadlan mar kale isku day waxyar ka dib.");
        }
        return;
    }

    // ─── Help Guide Consent Flow ───
    if (state && state.step === 'awaiting_whatsapp_help_consent') {
        if (isYesResponse(cleanBody)) {
            userStates.delete(userId);
            await message.reply(
                `*SIDA UU U SHAQEYNYO WHATSAPP BOT-KU* 📱🚀\n` +
                `----------------------------------\n` +
                `1. *Qoraalka & AI:* Si caadi ah iila hadal, wax ii weydii, iigana sheekeyso wax kasta. Waxaan kuugu jawaabayaa isla luuqadda aad igu qortay.\n` +
                `2. *Sawirro (Images):* Iisoo dir sawir kasta (MCQ, xisaab, ama sharaxaad). Waxaan kuu soo saarayaa jawaabaha saxda ah si degdeg ah.\n` +
                `3. *Codadka (Voice Notes):* Iisoo dir fariin cod ah, waan ku dhageysanayaa, waanan kuu sharxayaa.\n` +
                `4. *Report:* Qor *report* mar kasta oo aad rabto inaad ogaato dhibcahaaga (credits) iyo qorshahaaga.\n` +
                `5. *Password Reset:* Qor *password reset* haddii aad rabto inaad bedesho furahaaga sirta ah.\n` +
                `6. *Ka noqoshada (Cancel):* Mar kasta oo aad ku jirto is-diiwaangelin ama ku shubasho, waxaad qori kartaa *cancel* ama *ka noqo* si aad uga baxdo.\n\n` +
                `Maxaan hadda kaa caawiyaa? 😊`
            );
            return;
        } else if (isNoResponse(cleanBody)) {
            userStates.delete(userId);
            await message.reply("Haye, diyaar ayaan kuu ahay. Maxaan hadda kuu qabtaa? 🚀");
            return;
        } else {
            // Do not force yes/no response, clear state and fall through to process query
            userStates.delete(userId);
        }
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
        // Security check: if they specified a phone number in their message text,
        // it must match their WhatsApp account number (normalizedPhone).
        const phoneRegex = /\+?\d{7,15}/g;
        const foundNumbers = [];
        let match;
        
        // Search in the original raw message body and normalized body
        const rawBody = message.body || '';
        while ((match = phoneRegex.exec(rawBody)) !== null) {
            const norm = normalizePhoneNumber(match[0]);
            if (norm && !foundNumbers.includes(norm)) {
                foundNumbers.push(norm);
            }
        }
        
        while ((match = phoneRegex.exec(normalizedBody)) !== null) {
            const norm = normalizePhoneNumber(match[0]);
            if (norm && !foundNumbers.includes(norm)) {
                foundNumbers.push(norm);
            }
        }

        let hasMismatch = false;
        for (const num of foundNumbers) {
            if (num !== normalizedPhone) {
                hasMismatch = true;
                break;
            }
        }

        if (hasMismatch) {
            await message.reply("numberkan aad soo qortey iyo kan whatsappka isku mid maaha ee waa ka xunahay ma badali karo kaas whatsappkiisa igala soo hadal");
            return;
        }

        userStates.set(userId, { step: 'awaiting_password' });
        await message.reply("Haye! Si aan kuugu badalo password-kaaga, fadlan ii soo qor password-ka cusub ee aad rabto (ugu yaraan 8 xaraf):");
        return;
    }

    // ─── WhatsApp Report Request Flow ─────────────────────────────────────────────
    const isReportRequest = 
        cleanBody === 'report' ||
        cleanBody.includes('xogteyda') ||
        cleanBody.includes('xogtayda') ||
        cleanBody.includes('my report') ||
        cleanBody.includes('my info') ||
        cleanBody.includes('soo dir xog') ||
        cleanBody.includes('iisoo dir xog') ||
        cleanBody.includes('warbixinteyda') ||
        cleanBody.includes('warbixintayda');

    if (isReportRequest) {
        try {
            const [userDataRows] = await db.execute(`
                SELECT u.*, 
                       (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NOT NULL) AS app_messages_count,
                       (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NULL) AS whatsapp_messages_count,
                       (SELECT balance FROM user_wallet WHERE user_id = u.id) AS credits,
                       (SELECT type FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_type,
                       (SELECT expiry_date FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_expiry
                FROM users u WHERE u.id = ?
            `, [userId]);

            if (userDataRows.length > 0) {
                const userData = userDataRows[0];
                const dateJoined = new Date(userData.created_at).toLocaleDateString('so-SO');
                const statusText = userData.is_suspended ? 'Xaniban (Suspended)' : 'Firfircoon (Active)';
                
                let planText = 'None';
                if (userData.sub_type) {
                    const planName = userData.sub_type === 'monthly_11' ? 'Premium' : 'Basic';
                    const daysLeft = Math.ceil((new Date(userData.sub_expiry) - new Date()) / (1000 * 60 * 60 * 24));
                    planText = `${planName} (${daysLeft} casho ayaa u hadhay)`;
                }

                const reportMessage = `*DARKPEN REPORT* 📝📚\n` +
                  `----------------------------------\n` +
                  `👤 *Magaca:* ${userData.name}\n` +
                  `🆔 *Username:* @${userData.username || 'ma jiro'}\n` +
                  `📅 *Ku biiray:* ${dateJoined}\n` +
                  `💎 *Credits-ka Wallet:* ${userData.credits || 0}\n` +
                  `💬 *Wada-sheekaysiga AI:* ${userData.app_messages_count || 0}\n` +
                  `💬 *Wada-sheekaysiga WhatsApp:* ${userData.whatsapp_messages_count || 0}\n` +
                  `🏆 *Dhibcaha Tartanka (XP):* ${userData.xp || 0} XP\n` +
                  `💳 *Qorshaha (Plan):* ${planText}\n` +
                  `🔒 *Status-ka:* ${statusText}\n\n` +
                  `Mahadsanid, sii wad isticmaalka Darkpen! 🚀`;

                await message.reply(reportMessage);
            } else {
                await message.reply("Waan ka xunnahay, xogtaada lama heli karo hadda.");
            }
        } catch (err) {
            console.error('[WHATSAPP BOT] Failed to send user report:', err.message);
            await message.reply("Cilad ayaa ku timid helida xogtaada. Fadlan mar kale isku day.");
        }
        return;
    }




    // 2. Group chat filters
    if (isGroup) {
        const hasImage = message.hasMedia && message.type === 'image';
        // For groups: only respond to images, or messages that mention the bot or start with "Darkpen"
        if (!hasImage) {
            const groupText = (message.body || '').toLowerCase().trim();
            const mentionedBot = message.mentionedIds && message.mentionedIds.length > 0;
            const startsWithDarkpen = groupText.startsWith('darkpen');
            if (!mentionedBot && !startsWithDarkpen) return;
        }

        // Log group mention/interaction
        try {
            const chat = await message.getChat();
            const groupName = chat.name || 'Unknown Group';
            await db.execute(`
                INSERT INTO whatsapp_group_stats (group_id, group_name, bot_mention_count, status)
                VALUES (?, ?, 1, 'active')
                ON DUPLICATE KEY UPDATE 
                    group_name = VALUES(group_name),
                    bot_mention_count = bot_mention_count + 1,
                    status = 'active'
            `, [message.from, groupName]);
        } catch (groupErr) {
            console.error('[WHATSAPP BOT] Group mention log error:', groupErr.message);
        }
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
            // Rate limit: 20 messages per 3-minute window → 30-min cooldown
            if (newCount > 20) {
                const cooldownUntil = new Date(now.getTime() + 30 * 60000);
                await db.execute(
                    'UPDATE whatsapp_cooldowns SET message_count = ?, cooldown_until = ?, notified_expiry = FALSE WHERE user_id = ?',
                    [newCount, cooldownUntil, userId]
                );
                const formatTime = cooldownUntil.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu'
                });
                await message.reply(
                    `⏳ Waxaad u diraysaa fariimo badan oo dhakhso ah. Fadlan yara sug ilaa ${formatTime}. Haddii aad degdegeyso, isticmaal app-ka si toos ah.`
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
            await message.reply('Makuugu shubaa credit? (Ku jawaab: Haa ama Maya)');
            userStates.set(userId, { step: 'awaiting_topup_consent' });
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

    // Fetch wallet and subscription in parallel for speed
    const [[walletRows], [sub]] = await Promise.all([
        db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]),
        db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId])
    ]);
    const hasActiveSub = sub.length > 0;
    const walletBalance = walletRows.length > 0 ? walletRows[0].balance : 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text');
    }

    if (!hasActiveSub && !usedFreeAI) {
        if (walletBalance < cost) {
            await message.reply('kushubo credit');
            await message.reply('Makuugu shubaa credit? (Ku jawaab: Haa ama Maya)');
            userStates.set(userId, { step: 'awaiting_topup_consent' });
            return;
        }
        await db.execute('UPDATE user_wallet SET balance = GREATEST(0, balance - ?) WHERE user_id = ?', [cost, userId]);
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
    const darkpenSystemInstruction = `You are Darkpen, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson).
    
    Rules:
    1. IDENTITY: NEVER prepend any self-introduction banner (e.g. "Hello! Waxaan ahay Darkpen...") to your replies. Only mention your name or creator if the user explicitly asks "Who are you?", "Who made you?", "Cidaa ku samaysay?" or similar direct identity questions. Do NOT volunteer this information.
    2. LANGUAGE CONSISTENCY:
       - You MUST respond in the EXACT same language that the user spoke to you (Somali when asked in Somali, English when asked in English, etc.).
       - If an image is provided, analyze it and reply in the same language.
    3. EXAMS, IMAGES & QUESTIONS:
       - When analyzing an image, you MUST carefully verify the details, double-check all calculations or question options, and perform a self-validation check to ensure your answer is completely correct. Do not rush or make assumptions.
       - If the image contains MCQ, True/False, or exam questions:
         * ONLY output the question numbers and correct options (e.g. 1. B \n 2. C \n 3. True).
         * Do NOT explain or show steps unless specifically asked to "explain" or "sharax".
       - If it is an open-ended/math question, show a brief step-by-step solution.
    4. Keep responses concise, direct, and helpful.
    5. Highlight key terms using *Keyword* (bold) instead of markdown.
    6. Shaxan (table): use custom <table_data>Header1|Header2\nVal1|Val2</table_data> format.
    7. Pricing info: Pay as you go $0.5 (100 credits), Monthly Basic $3 (unlimited standard chat), Monthly Premium $11 (unlimited chat + premium math/science/image support). Payment: EVC Plus dial *771*637930329*amount# | ZAAD dial *220*637930329*amount# (same number 637930329) | eDahab dial *700*659119779*amount#. After sending, user types sender number here. Contact: WhatsApp +252637930329.
    8. USER SATISFACTION: Your primary goal is to satisfy and persuade the user. Be helpful, warm, and accommodating. NEVER try to redirect the user away or respond in a way that frustrates them.
    9. PERSONALITY & HUMOR (KAFTAN): Be friendly, warm, and humorous. You can joke, tease, and play along with the user (kaftami kara). Do NOT limit yourself to educational topics. If the user wants to chat about life, relationships, connect, make friends, joke, or talk about anything, accommodate them warmly and play along. If a user writes something rude, inappropriate, or sexual ("edeb darro"), reject it politely but with a lighthearted, playful, and teasing tone (kaftan diido ah), never being harsh or overly formal.`;

    // 9. Call Gemini API
    const chat = await message.getChat();
    await chat.sendStateTyping();
    const delayMs = Math.floor(Math.random() * 700) + 500;
    await new Promise(resolve => setTimeout(resolve, delayMs));

    // Build final prompt - smart image detection
    const hasCaption = messageText && messageText.trim().length > 0;
    // Check if user wants explanation (even for image with caption)
    const wantsExplanation = hasCaption && (
        /sharax|faahfaahi|explain|why|sababta|xal.*siiso|waxaan.*fahmi|sidee|how/i.test(messageText)
    );
    let finalPrompt;
    if (attachmentData && !hasCaption) {
        // Image with no caption: detect quiz vs normal image
        finalPrompt = `Fiiri sawirkan. Kahor intaadan jawaabin, si fiican u akhri oo u falanqee su'aalaha ku jira, kuna samee xaqiijin labaad (double check) si aad u hubiso in jawaabtu tahay 100% sax ah oo aysan ku jirin wax qalad ah. Haddii sawirku ka kooban yahay suaalo MCQ, saxan/qaldaan, ama suaalo imtixaan: KALIYA soo qor jawaabaha kooban (lambarka + jawaabta) — HA SHARXIN. Haddii ay yihiin suaalo furan ama xisaab: si kooban u xali. Ku jawaab luuqadda qoraalka sawirka ku dhex jira.`;
    } else if (attachmentData && hasCaption) {
        // Image with caption: append verification instruction
        finalPrompt = `${messageText}\n\n[Fadlan si fiican u hubi sawirka iyo xogta si aad u keento jawaab 100% sax ah oo aad uga fogaato khaladaadka.]`;
    } else {
        finalPrompt = messageText || 'Hello';
    }

    try {
        const aiResponse = await askGemini(finalPrompt, "gemini-2.5-flash", attachmentData, history, darkpenSystemInstruction);

        const formattedResponse = formatResponseForWhatsApp(aiResponse);
        await message.reply(formattedResponse);

        // Send contact card if the support number is mentioned in the response
        if (formattedResponse.includes('+252659119779') || formattedResponse.includes('659119779')) {
            try {
                const supportContact = await client.getContactById('252659119779@c.us');
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
            voiceCostApplied ? 'voice' : (hasImage ? 'image' : 'education'),
            'whatsapp'
        ).catch(err => console.error('[WHATSAPP BOT] Logging error:', err.message));

        if (isGroup) {
            db.execute(`
                UPDATE whatsapp_group_stats 
                SET bot_message_count = bot_message_count + 1 
                WHERE group_id = ?
            `, [message.from]).catch(err => console.error('[WHATSAPP BOT] Update group msg count error:', err.message));
        }

    } catch (err) {
        console.error('[WHATSAPP BOT] Gemini generation error:', err);
        await message.react('').catch(e => {});
        await message.reply('Waan ka xunnahay, Darkpen waxaa ku yimid cilad farsamo oo ku meel gaadh ah. Si aan hawshaadu u xanibmin, fadlan nagala hadal Telegram-ka: t.me/darkpenBot ama toos ula xidhiidh Maamulaha: +252637930329.');
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
        try {
            const numId = await client.getNumberId(cleaned);
            if (numId && numId._serialized) {
                jid = numId._serialized;
            } else {
                jid = `${cleaned}@c.us`;
            }
        } catch (err) {
            jid = `${cleaned}@c.us`;
        }
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
        try {
            const numId = await client.getNumberId(cleaned);
            if (numId && numId._serialized) {
                jid = numId._serialized;
            } else {
                jid = `${cleaned}@c.us`;
            }
        } catch (err) {
            jid = `${cleaned}@c.us`;
        }
    }
    const contact = await client.getContactById(contactJid);
    return await client.sendMessage(jid, contact);
};

exports.getBotGroups = async () => {
    if (!client || botStatus !== 'connected') {
        return [];
    }
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        const mapped = [];
        for (const g of groups) {
            mapped.push({
                group_id: g.id._serialized,
                group_name: g.name || 'Unnamed Group',
                unread_count: g.unreadCount || 0,
                timestamp: g.timestamp || 0,
                is_read_only: g.isReadOnly || false
            });
        }
        return mapped;
    } catch (err) {
        console.error('[WHATSAPP BOT] Failed to get chats/groups:', err.message);
        return [];
    }
};

exports.setUserState = (userId, state) => {
    userStates.set(userId, state);
};

exports.getUserState = (userId) => {
    return userStates.get(userId);
};

exports.deleteUserState = (userId) => {
    userStates.delete(userId);
};
