const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber } = require('./verificationService');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');
const AdmZip = require('adm-zip');

// Create temp directory for voice notes if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

let client = null;

// QR Code and bot status tracking
let botStatus = 'initializing'; // 'initializing' | 'qr_ready' | 'connected' | 'disconnected' | 'error'
let currentQRDataURL = null;    // Base64 QR image for the /api/whatsapp/qr endpoint

exports.getBotStatus = () => botStatus;
exports.getQRCode = () => currentQRDataURL;

// Database session persistence functions
async function restoreSessionFromDatabase() {
    try {
        console.log('[WHATSAPP BOT] Checking database for saved session...');
        
        // 1. Create table if not exists
        await db.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                session_key VARCHAR(255) UNIQUE,
                session_data LONGBLOB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 2. Query session
        const [rows] = await db.execute(
            'SELECT session_data FROM whatsapp_sessions WHERE session_key = "default" LIMIT 1'
        );

        if (rows.length === 0) {
            console.log('[WHATSAPP BOT] No saved session found in database.');
            return false;
        }

        console.log('[WHATSAPP BOT] Saved session found! Restoring...');
        const zipBuffer = rows[0].session_data;
        
        const authDir = path.join(__dirname, '../.wwebjs_auth');
        
        // Clear any existing auth directory to prevent corruption
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
        }
        
        fs.mkdirSync(authDir, { recursive: true });

        // Save buffer to temporary file
        const tempZipPath = path.join(__dirname, '../session_temp.zip');
        fs.writeFileSync(tempZipPath, zipBuffer);

        // Extract using adm-zip
        const zip = new AdmZip(tempZipPath);
        zip.extractAllTo(authDir, true);

        // Delete temporary file
        fs.unlinkSync(tempZipPath);

        console.log('[WHATSAPP BOT] Session restored successfully.');
        return true;
    } catch (err) {
        console.error('[WHATSAPP BOT] Failed to restore session from database:', err);
        return false;
    }
}

async function backupSessionToDatabase() {
    try {
        const authDir = path.join(__dirname, '../.wwebjs_auth');
        if (!fs.existsSync(authDir)) {
            console.warn('[WHATSAPP BOT] No auth directory found to backup.');
            return;
        }

        console.log('[WHATSAPP BOT] Zipping session files...');
        const zip = new AdmZip();

        // Helper to recursively add files, skipping cache folders and locked files
        function addFolderRecursively(localDir, zipPath) {
            if (!fs.existsSync(localDir)) return;
            try {
                const items = fs.readdirSync(localDir);
                for (const item of items) {
                    try {
                        const fullLocalPath = path.join(localDir, item);
                        const fullZipPath = zipPath ? `${zipPath}/${item}` : item;
                        const stat = fs.statSync(fullLocalPath);

                        if (stat.isDirectory()) {
                            // Skip bulky cache directories to keep blob small and fast
                            if (['Cache', 'Code Cache', 'GPUCache', 'CacheStorage', 'ScriptCache', 'Service Worker', 'Crashpad'].includes(item)) {
                                continue;
                            }
                            addFolderRecursively(fullLocalPath, fullZipPath);
                        } else {
                            // Skip lock files to prevent file-busy errors and boot issues on restore
                            if (item === 'LOCK' || item.toLowerCase().includes('lock')) {
                                continue;
                            }
                            zip.addLocalFile(fullLocalPath, zipPath);
                        }
                    } catch (itemErr) {
                        console.warn(`[WHATSAPP BOT] Skipping file/folder due to error: ${item}. Error: ${itemErr.message}`);
                    }
                }
            } catch (dirErr) {
                console.error(`[WHATSAPP BOT] Failed to read directory: ${localDir}. Error: ${dirErr.message}`);
            }
        }

        addFolderRecursively(authDir, '');
        
        const zipBuffer = zip.toBuffer();
        console.log(`[WHATSAPP BOT] Session zipped. Size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Save to database
        await db.execute(
            `INSERT INTO whatsapp_sessions (session_key, session_data) 
             VALUES ('default', ?) 
             ON DUPLICATE KEY UPDATE session_data = ?, updated_at = CURRENT_TIMESTAMP`,
            [zipBuffer, zipBuffer]
        );
        console.log('[WHATSAPP BOT] Session backed up to database successfully.');
    } catch (err) {
        console.error('[WHATSAPP BOT] Session backup to database failed:', err);
    }
}

// Initialize function
exports.initialize = async () => {
    try {
        console.log('[WHATSAPP BOT] Initializing...');

        // Restore auth session from database if available
        await restoreSessionFromDatabase();

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

        // On Render (and other cloud servers), always run headless
        // On local Windows, respect the WHATSAPP_HEADLESS env var (default false for QR visibility)
        const isServer = process.env.RENDER || process.env.NODE_ENV === 'production';
        const isHeadless = isServer ? true : (process.env.WHATSAPP_HEADLESS === 'true');
        console.log(`[WHATSAPP BOT] Headless mode: ${isHeadless} (server: ${!!isServer})`);

        if (isServer) {
            process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '../.cache/puppeteer');
            console.log(`[WHATSAPP BOT] Setting PUPPETEER_CACHE_DIR to: ${process.env.PUPPETEER_CACHE_DIR}`);
        }

        // 2. Setup whatsapp client options with stability flags
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
                '--renderer-process-limit=1'
            ]
        };

        // Look for Chrome/Chromium executable in order of priority:
        // 1. Explicit env variable (highest priority)
        // 2. Render Puppeteer cache path (auto-installed via npm run build)
        // 3. Common local paths (Windows / Linux)
        const puppeteerCacheDir = process.env.PUPPETEER_CACHE_DIR;
        
        // Dynamically find Chrome in the Render cache directory in case the version changed
        let renderChromePath = null;
        if (fs.existsSync(puppeteerCacheDir)) {
            try {
                const chromeDir = path.join(puppeteerCacheDir, 'chrome');
                if (fs.existsSync(chromeDir)) {
                    const versions = fs.readdirSync(chromeDir);
                    for (const version of versions) {
                        const versionPath = path.join(chromeDir, version);
                        if (fs.statSync(versionPath).isDirectory()) {
                            const possibleExecutable = path.join(versionPath, 'chrome-linux64', 'chrome');
                            if (fs.existsSync(possibleExecutable)) {
                                renderChromePath = possibleExecutable;
                                console.log(`[WHATSAPP BOT] Found Chrome dynamically in cache: ${renderChromePath}`);
                                break;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('[WHATSAPP BOT] Error scanning Puppeteer cache:', err.message);
            }
        }

        const possibleChromePaths = [
            '/usr/bin/google-chrome',                                                 // Linux system
            '/usr/bin/chromium-browser',                                              // Linux Chromium
            '/usr/bin/chromium',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',             // Windows
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ];

        if (renderChromePath) {
            possibleChromePaths.unshift(renderChromePath);
        }

        let foundChrome = null;
        for (const p of possibleChromePaths) {
            if (fs.existsSync(p)) {
                foundChrome = p;
                break;
            }
        }

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            console.log(`[WHATSAPP BOT] Using executable path from env: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        } else if (foundChrome) {
            puppeteerOptions.executablePath = foundChrome;
            console.log(`[WHATSAPP BOT] Using Chrome/Chromium: ${foundChrome}`);
        } else {
            console.warn('[WHATSAPP BOT] No Chrome found! Bot may fail. Run: npx puppeteer browsers install chrome');
        }

        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '../.wwebjs_auth')
            }),
            puppeteer: puppeteerOptions,
            authTimeoutMs: 600000 // Set to 10 minutes (setting to 0 defaults to 30 seconds in whatsapp-web.js)
        });

        // Event: QR code generation
        client.on('qr', async (qr) => {
            console.log('\n--- WHATSAPP QR CODE ---');
            console.log('Fadlan browser-ka u tag: /api/whatsapp/qr si aad QR-ka u sawirto');
            qrcode.generate(qr, { small: true });
            console.log('------------------------\n');
            // Store QR as base64 image for the API endpoint
            try {
                currentQRDataURL = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
                botStatus = 'qr_ready';
                console.log('[WHATSAPP BOT] QR Code ready at /api/whatsapp/qr');
            } catch (err) {
                console.error('[WHATSAPP BOT] Failed to generate QR image:', err.message);
            }
        });

        // Event: Loading progress
        client.on('loading_screen', (percent, message) => {
            console.log(`[WHATSAPP BOT] Loading: ${percent}% - ${message}`);
        });

        // Event: Ready
        client.on('ready', () => {
            botStatus = 'connected';
            currentQRDataURL = null; // clear QR once connected
            console.log('[WHATSAPP BOT] Client is ready and listening to messages!');
            
            // Backup session to database after 10 seconds to ensure all initial files are written
            setTimeout(async () => {
                try {
                    console.log('[WHATSAPP BOT] Starting database session backup...');
                    await backupSessionToDatabase();
                } catch (backupErr) {
                    console.error('[WHATSAPP BOT] Session backup failed:', backupErr.message);
                }
            }, 10000);
        });

        // Event: Disconnected
        client.on('disconnected', async (reason) => {
            botStatus = 'disconnected';
            currentQRDataURL = null;
            console.log(`[WHATSAPP BOT] Disconnected: ${reason}`);
            
            // Delete session from database on logout
            try {
                await db.execute('DELETE FROM whatsapp_sessions WHERE session_key = "default"');
                console.log('[WHATSAPP BOT] Deleted session from database due to logout.');
            } catch (delErr) {
                console.error('[WHATSAPP BOT] Failed to delete session from DB:', delErr.message);
            }
        });

        // Event: Call handling (Missed Call rejection)
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

        // Event: Message handling
        client.on('message', async (message) => {
            try {
                await handleIncomingMessage(message);
            } catch (err) {
                console.error('[WHATSAPP BOT] Message handling error:', err);
            }
        });

        // Proactive checker: runs every 1 minute
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

// Check and clean number to format matching database
function getCleanNumber(rawJid) {
    const digits = rawJid.split('@')[0];
    return normalizePhoneNumber(digits);
}

// Proactive Checker to send message when cooldown expires
function startProactiveChecker() {
    setInterval(async () => {
        try {
            if (!client) return;

            // Find users whose cooldown_until has passed and notified_expiry is false
            const [expired] = await db.execute(
                `SELECT wc.user_id, u.whatsapp_number 
                 FROM whatsapp_cooldowns wc
                 JOIN users u ON wc.user_id = u.id
                 WHERE wc.cooldown_until <= NOW() AND wc.notified_expiry = FALSE`
            );

            for (const row of expired) {
                if (row.whatsapp_number) {
                    // Convert back to whatsapp format (remove '+' and add '@c.us')
                    const cleaned = row.whatsapp_number.replace(/\+/g, '');
                    const jid = `${cleaned}@c.us`;
                    try {
                        console.log(`[WHATSAPP BOT] Sending proactive notification to ${jid}`);
                        await client.sendMessage(
                            jid, 
                            "Saacadihii sugitaanka ee kugu xirnaa waa dhammaadeen, hadda waad ila hadli kartaa. Maxaan kaa caawin karaa?"
                        );
                        
                        // Set notified_expiry to true
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
    }, 60000); // Check every 1 minute
}

// Main message handler logic
async function handleIncomingMessage(message) {
    if (message.fromMe) {
        return;
    }

    console.log(`[WHATSAPP BOT DEBUG] Incoming message:
      from: ${message.from}
      author: ${message.author}
      fromMe: ${message.fromMe}
      type: ${message.type}
      body: ${message.body}`);

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
        if (senderRaw) {
            senderNumberRaw = senderRaw.split('@')[0];
        }
    }

    const normalizedPhone = normalizePhoneNumber(senderNumberRaw);
    console.log(`[WHATSAPP BOT DEBUG] Extracted senderNumberRaw: ${senderNumberRaw}, normalizedPhone: ${normalizedPhone}`);

    if (!normalizedPhone) return;

    // 1. Look up user in database
    const [users] = await db.execute(
        'SELECT id, name, is_suspended FROM users WHERE whatsapp_number = ? LIMIT 1',
        [normalizedPhone]
    );

    // If user not registered:
    if (users.length === 0) {
        // Only reply if it's direct message (DM) to avoid spamming groups
        if (!isGroup) {
            await message.reply(
                `numberkan ( ${senderNumberRaw} ) kama diwaan gashana appka isa soo diwaan gali markaas igu soo noqo`
            );
        }
        return;
    }

    const user = users[0];

    // If user is suspended, ignore
    if (user.is_suspended) {
        console.log(`[WHATSAPP BOT] User ${user.name} (${normalizedPhone}) is suspended. Ignoring.`);
        return;
    }

    const userId = user.id;

    // 2. Group Chats: Check filters (Images or Academic Keywords)
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

        // Ignore if it doesn't contain an image or a scientific keyword
        if (!hasImage && !matchesKeyword) {
            return;
        }
    }

    // React with 👀 to indicate we received and are processing the message
    await message.react('👀').catch(err => console.error('[WHATSAPP BOT] Failed to react 👀:', err.message));

    // 3. Enforce Rate Limiting
    const now = new Date();
    const [cooldownRow] = await db.execute(
        'SELECT message_count, cooldown_until, last_message_at FROM whatsapp_cooldowns WHERE user_id = ?',
        [userId]
    );

    if (cooldownRow.length > 0) {
        const { message_count, cooldown_until, last_message_at } = cooldownRow[0];

        // Check if currently locked
        if (cooldown_until && new Date(cooldown_until) > now) {
            console.log(`[WHATSAPP BOT] User ${user.name} is on cooldown. Ignoring.`);
            return;
        }

        // Check if the 3-minute window has passed since their last message
        const lastMsgDate = new Date(last_message_at);
        const diffMinutes = (now.getTime() - lastMsgDate.getTime()) / (1000 * 60);

        if (diffMinutes > 3) {
            // Reset window count
            await db.execute(
                'UPDATE whatsapp_cooldowns SET message_count = 1, cooldown_until = NULL, notified_expiry = FALSE WHERE user_id = ?',
                [userId]
            );
        } else {
            const newCount = message_count + 1;
            if (newCount > 30) {
                // Lock for 30 minutes
                const cooldownUntil = new Date(now.getTime() + 30 * 60000);
                await db.execute(
                    'UPDATE whatsapp_cooldowns SET message_count = ?, cooldown_until = ?, notified_expiry = FALSE WHERE user_id = ?',
                    [newCount, cooldownUntil, userId]
                );

                const formatTime = cooldownUntil.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false, 
                    timeZone: 'Africa/Mogadishu' 
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
        // Create first tracking record
        await db.execute(
            'INSERT INTO whatsapp_cooldowns (user_id, message_count, cooldown_until, notified_expiry) VALUES (?, 1, NULL, FALSE)',
            [userId]
        );
    }

    // 4. Handle Voice Notes (Private Chat only)
    const isVoice = message.hasMedia && (message.type === 'ptt' || message.type === 'audio');
    let messageText = message.body || '';
    let voiceCostApplied = false;

    if (isVoice) {
        if (isGroup) {
            // Ignore voice messages in groups
            return;
        }

        console.log(`[WHATSAPP BOT] Voice message received from ${user.name}`);
        
        // Check balance (must have >= 20 credits)
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const hasBalance = wallet.length > 0 && wallet[0].balance >= 20;

        if (!hasBalance) {
            await message.reply('Dhibcahaagu kuma filna dhegeysiga codka (20 Credits).');
            return;
        }

        // Download media and save to temp file
        const media = await message.downloadMedia();
        if (!media || !media.data) {
            await message.reply('Waan ka xunnahay, codka laguma guulaysan in la soo dejiyo.');
            return;
        }

        const fileExt = media.mimetype.split(';')[0].split('/')[1] || 'ogg';
        const tempFileName = `wa_voice_${userId}_${Date.now()}.${fileExt}`;
        const tempFilePath = path.join(uploadsDir, tempFileName);

        fs.writeFileSync(tempFilePath, Buffer.from(media.data, 'base64'));

        // Transcribe voice note
        try {
            await client.sendMessage(message.from, '_Dhegeysanaya codka..._');
            messageText = await transcribeAudio(tempFilePath);
            voiceCostApplied = true;
            console.log(`[WHATSAPP BOT] Voice transcription: "${messageText}"`);
        } catch (transErr) {
            console.error('[WHATSAPP BOT] Transcription error:', transErr);
            await message.reply('Waan ka xunnahay, codka lama fahmin.');
            return;
        } finally {
            // Clean up temp file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    // 5. Calculate and verify Credit Cost (For Text or Image)
    let cost = 1;
    const hasImage = message.hasMedia && message.type === 'image';
    
    if (voiceCostApplied) {
        cost = 20;
    } else if (hasImage) {
        cost = 10;
    } else {
        const len = messageText.length;
        if (len < 150) {
            cost = 1;
        } else if (len < 500) {
            cost = 3;
        } else if (len < 1500) {
            cost = 7;
        } else {
            cost = 12;
        }
    }

    // Check subscription (active subscription bypasses free limits but wallet deduction is applied same as app)
    const [sub] = await db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
    const hasActiveSub = sub.length > 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text');
    }

    // If free trial not used, check and deduct wallet balance
    if (!usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;

        if (balance < cost) {
            await message.reply('kushubo credit');
            return;
        }

        // Deduct cost
        await db.execute('UPDATE user_wallet SET balance = balance - ? WHERE user_id = ?', [cost, userId]);
    }

    // 6. Handle Image Attachment (Download for Gemini if exists)
    let attachmentData = null;
    if (hasImage) {
        const media = await message.downloadMedia();
        if (media && media.data) {
            attachmentData = {
                base64: media.data,
                mimeType: media.mimetype
            };
        }
    }

    // 7. Get History
    let history = [];
    const [historyRes] = await db.execute(
        'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id IS NULL ORDER BY created_at DESC LIMIT 5',
        [userId]
    );

    history = historyRes.reverse().map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }]
    }));

    // System Instructions
    const darkpenSystemInstruction = `Waxaa laguu bixiyey magaca Darkpen. Waxaa ku horumarisay shirkada ZinsonAI oo uu leeyahay Hamze Mohamuud Ali Zinson (Zinson). Waligaa ha dhihin waxaa ku sameeyay Google ama OpenAI, adigu waxaad tahay Darkpen oo ay leedahay ZinsonAI.
    
    Rules:
    1. Luuqaddaada: Ku jawaab af-Soomaali ahaan by default (ama luuqadda laguula soo hadlo).
    2. Jawaabahaagu ha ahaadaan kuwo gaaban, toos ah, oo waxtar leh. Toos ugu guur jawaabta.
    3. Dhamaadka jawaabtaada, ku dar su'aal xiiso leh oo la xidhiidha mawduuca si wada-hadalka u sii socdo.
    4. 'Sax ama Qald': isticmaal <green>Sax</green> ama <red>Qald</red>. Doorasho (multiple choice): jawaabta saxda ah ku dhex qor <green>JAWAABTA</green>.
    5. Digniinaha muhiimka ah ku qor: <callout>Fiiro gaar ah: ...</callout>.
    6. Keywords muhiim ah ku qor: <green>Erayga Muhiimka ah</green>.
    7. Shaxan (table) ama barbardhig: isticmaal KALIYA hab-qoraalkaan (marna ha isticmaalin Markdown table format |---|):
    <table_data>
    Madaxa1|Madaxa2
    Xogta1|Xogta2
    </table_data>
    8. Haddii laguu soo diro sawir, sharax oo tallaabo-tallaabo u faahfaahi si fudud.
    9. Cinwaanada: isticmaal # Cinwaan Weyn (H1), ## (H2), ### (H3).
    10. Code-ka: ku dhex geli \`\`\`language ... \`\`\`.
    11. Marka lagaa weydiiyo xogta app-ka (qiimaha, lacagbixinta, shuruudaha, qarsoodiga):
    - Qiimaha: Premium monthly ($3/bishiiba), yearly ($11/sannadkiiba).
    - Bixinta: EVC/eDahab 637930329 ama 659119779. Screenshot-ka u dir WhatsApp: +252637930329 ama team.darkpen@gmail.com.
    - Terms & Privacy: Kaliya ujeedo waxbarasho iyo macluumaad. Xogta la ururiyo waa magac, email, lambar si AI loogu adeegsado. La xiriir team.darkpen@gmail.com wixii faahfaahin ah.`;

    // 8. Call Gemini API
    const chat = await message.getChat();
    // Simulate typing
    await chat.sendStateTyping();
    // Wait brief typing simulation delay to prevent bot bans but keep it fast
    const delayMs = Math.floor(Math.random() * 700) + 500;
    await new Promise(resolve => setTimeout(resolve, delayMs));

    try {
        const finalPrompt = messageText || 'Fadlan sharax sawirkan';
        const aiResponse = await askGemini(finalPrompt, "gemini-flash-latest", attachmentData, history, darkpenSystemInstruction);

        // Format response to replace HTML-style tags with WhatsApp-supported bold and emojis
        const formattedResponse = formatResponseForWhatsApp(aiResponse);

        // Reply to message (quotes user's message)
        const sentMessage = await message.reply(formattedResponse);

        // Decide emoji reaction to place on the user's incoming message (40% chance)
        let chosenReaction = '';
        if (Math.random() < 0.4) {
            const reactions = ['❤️', '😂', '👍', '😮', '😢'];
            chosenReaction = reactions[2]; // default '👍'
            const lowerPrompt = finalPrompt.toLowerCase();
            if (lowerPrompt.includes('dhib') || lowerPrompt.includes('xun') || lowerPrompt.includes('buux') || lowerPrompt.includes('tiiraanyo')) {
                chosenReaction = '😢';
            } else if (lowerPrompt.includes('ha') || lowerPrompt.includes('qosol') || lowerPrompt.includes('kaftan') || lowerPrompt.includes('he')) {
                chosenReaction = '😂';
            } else if (lowerPrompt.includes('nax') || lowerPrompt.includes('yaab') || lowerPrompt.includes('mise')) {
                chosenReaction = '😮';
            } else if (lowerPrompt.includes('fiican') || lowerPrompt.includes('haa') || lowerPrompt.includes('haye')) {
                chosenReaction = '👍';
            } else {
                chosenReaction = reactions[Math.floor(Math.random() * reactions.length)];
            }
        }

        // Replace or clear the 👀 reaction on user's message
        await message.react(chosenReaction).catch(err => console.error('[WHATSAPP BOT] Failed to update reaction:', err.message));

        // 9. Save message transaction to DB asynchronously
        db.execute(
            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "user", ?)',
            [userId, finalPrompt]
        ).catch(err => console.error('[WHATSAPP BOT] DB save user msg error:', err.message));

        db.execute(
            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "ai", ?)',
            [userId, aiResponse]
        ).catch(err => console.error('[WHATSAPP BOT] DB save AI response error:', err.message));

        // 10. Log AI usage
        logAIUsage(
            userId, 
            'gemini-1.5-flash', 
            finalPrompt, 
            aiResponse, 
            voiceCostApplied ? 'voice' : (hasImage ? 'image' : 'education')
        ).catch(err => console.error('[WHATSAPP BOT] Logging error:', err.message));

    } catch (err) {
        console.error('[WHATSAPP BOT] Gemini generation error:', err);
        // Clear the 👀 reaction on error
        await message.react('').catch(e => {});
        await message.reply('Waan ka xunnahay, darkpen cilad farsamo ayaa ku timid. Fadlan mar kale isku day waxyar ka dib.');
    }
}

// Helper: Format HTML tags into WhatsApp bolding
function formatResponseForWhatsApp(text) {
    if (!text) return '';
    
    let formatted = text;
    
    // Replace <green>content</green> with *content*
    formatted = formatted.replace(/<green>([\s\S]*?)<\/green>/gi, '*$1*');
    
    // Replace <red>content</red> with *content*
    formatted = formatted.replace(/<red>([\s\S]*?)<\/red>/gi, '*$1*');
    
    // Replace <callout>content</callout> with *$1*
    formatted = formatted.replace(/<callout>([\s\S]*?)<\/callout>/gi, '*$1*');
    
    // Format <table_data>content</table_data>
    formatted = formatted.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (match, tableContent) => {
        const lines = tableContent.trim().split('\n');
        const formattedTable = lines.map(line => {
            const columns = line.split('|');
            return columns.map(col => `*${col.trim()}*`).join('  |  ');
        }).join('\n');
        return `\n*Shaxda:*\n------------------\n${formattedTable}\n------------------\n`;
    });
    
    return formatted;
}

