const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber, validatePassword, validateUsername, normalizeUsername } = require('./verificationService');
const bcrypt = require('bcrypt');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');

let bot = null;
let botStatus = 'initializing';

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// States map: chatId -> { step, data }
// Steps: 'awaiting_password' | 'reg_name' | 'reg_username' | 'reg_password'
const telegramUserStates = new Map();
const pendingPosts = new Map();
const groupLimits = new Map();
let botInfo = { username: '', id: null };

exports.getBotStatus = () => botStatus;


// ─── Telegram raw API helper (for reactions & other new features) ─────────────
async function telegramRawAPI(method, body = {}) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    } catch (err) {
        // Silent - reactions are cosmetic only
    }
}

// ─── React with emoji to a message (👀 seen indicator) ───────────────────────
async function reactToMessage(chatId, messageId, emoji = '👀') {
    await telegramRawAPI('setMessageReaction', {
        chat_id: chatId,
        message_id: messageId,
        reaction: [{ type: 'emoji', emoji }],
        is_big: false
    });
}

// ─── Send animated loading message → returns {chatId, messageId} ─────────────
async function sendLoadingMessage(chatId, text = '⏳ Xaqiijinaya...') {
    try {
        const sent = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        return { chatId, messageId: sent.message_id };
    } catch (err) {
        return null;
    }
}

// ─── Update a loading message with new text ───────────────────────────────────
async function editLoadingMessage(handle, newText) {
    if (!handle) return;
    try {
        await bot.editMessageText(newText, {
            chat_id: handle.chatId,
            message_id: handle.messageId,
            parse_mode: 'Markdown'
        });
    } catch (err) { /* ignore */ }
}

// ─── Delete a message ─────────────────────────────────────────────────────────
async function deleteMsg(chatId, messageId) {
    try { await bot.deleteMessage(chatId, messageId); } catch (err) { /* ignore */ }
}

// ─── Initialize function ───────────────────────────────────────────────────────
exports.initialize = async () => {
    try {
        console.log('[TELEGRAM BOT] Initializing...');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS telegram_users (
                telegram_chat_id VARCHAR(50) PRIMARY KEY,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[TELEGRAM BOT] Table telegram_users checked/created.');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS telegram_cooldowns (
                user_id INT PRIMARY KEY,
                message_count INT DEFAULT 1,
                cooldown_until TIMESTAMP NULL,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                notified_expiry BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[TELEGRAM BOT] Table telegram_cooldowns checked/created.');

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            botStatus = 'disabled';
            console.log('[TELEGRAM BOT] TELEGRAM_BOT_TOKEN is missing. Telegram Bot disabled.');
            return;
        }

        const TelegramBot = require('node-telegram-bot-api');
        bot = new TelegramBot(token, { polling: true });
        botStatus = 'connected';
        console.log('[TELEGRAM BOT] Bot client connected and listening (Polling mode)!');

        // Fetch and cache Bot Details (username & ID)
        const bInfo = await bot.getMe();
        botInfo.username = bInfo.username;
        botInfo.id = bInfo.id;
        console.log(`[TELEGRAM BOT] Bot Details cached. Username: @${botInfo.username}, ID: ${botInfo.id}`);

        bot.on('message', async (msg) => {
            try {
                await handleIncomingMessage(msg);
            } catch (err) {
                console.error('[TELEGRAM BOT] Error handling message:', err);
            }
        });

        // Register callback_query event listener for owner's approve/reject buttons
        bot.on('callback_query', async (query) => {
            try {
                await handleCallbackQuery(query);
            } catch (err) {
                console.error('[TELEGRAM BOT] Callback query handling failed:', err);
            }
        });

        startProactiveChecker();
        startSchedulerChecker();

    } catch (err) {
        botStatus = 'error';
        console.error('[TELEGRAM BOT] Initialization failed:', err);
    }
};

// ─── Proactive Cooldown Notifier ──────────────────────────────────────────────
function startProactiveChecker() {
    setInterval(async () => {
        try {
            if (!bot) return;
            const [expired] = await db.execute(
                `SELECT tc.user_id, tu.telegram_chat_id
                 FROM telegram_cooldowns tc
                 JOIN telegram_users tu ON tc.user_id = tu.user_id
                 WHERE tc.cooldown_until <= NOW() AND tc.notified_expiry = FALSE`
            );
            for (const row of expired) {
                try {
                    await bot.sendMessage(row.telegram_chat_id,
                        "✅ Saacadihii sugitaanka waa dhammaadeen\\! Hadda waad ila hadli kartaa\\. Maxaan kaa caawin karaa?");
                    await db.execute(
                        'UPDATE telegram_cooldowns SET notified_expiry = TRUE WHERE user_id = ?',
                        [row.user_id]
                    );
                } catch (e) {
                    console.error('[TELEGRAM BOT] Proactive send failed:', e.message);
                }
            }
        } catch (err) {
            console.error('[TELEGRAM BOT] Proactive checker error:', err.message);
        }
    }, 60000);
}

// ─── Main message handler ─────────────────────────────────────────────────────
async function handleIncomingMessage(msg) {
    if (!bot) return;
    const chatId = msg.chat.id;
    const msgId  = msg.message_id;
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    const isOwner = chatId.toString() === (process.env.TELEGRAM_OWNER_CHAT_ID || '');

    // Owner manual trigger commands (for testing/admin use)
    if (msg.text && isOwner) {
        if (msg.text.startsWith('/post_tip')) {
            await triggerDailyTipGeneration(chatId);
            return;
        }
        if (msg.text.startsWith('/post_poll')) {
            await triggerSaturdayPollGeneration(chatId);
            return;
        }
        if (msg.text.startsWith('/skip_today')) {
            const schedulerFile = require('path').join(__dirname, '../uploads/telegram_scheduler.json');
            try {
                const state = JSON.parse(require('fs').readFileSync(schedulerFile, 'utf8'));
                const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Mogadishu', year: 'numeric', month: '2-digit', day: '2-digit' });
                const parts = formatter.formatToParts(new Date());
                const dp = {}; parts.forEach(p => { dp[p.type] = p.value; });
                const todayStr = `${dp.year}-${dp.month}-${dp.day}`;
                state.lastDailyTipDate = todayStr;
                state.lastSaturdayPollDate = todayStr;
                require('fs').writeFileSync(schedulerFile, JSON.stringify(state));
                await bot.sendMessage(chatId, '⏭️ Maanta\u2019s automatic post waa la joojiyay. Berri ayuu dib u bilaabi doonaa.');
            } catch(e) {
                await bot.sendMessage(chatId, '❌ Skip-garayntu way fashilantay: ' + e.message);
            }
            return;
        }
    }

    // Intercept group messages for separate group handler
    if (isGroup) {
        await handleGroupMessage(msg);
        return;
    }

    // /start command
    if (msg.text && msg.text.startsWith('/start')) {
        await handleStartCommand(msg);
        return;
    }

    // ── 1. Check for pending registration state (unlinked user in reg flow) ──
    const pendingState = telegramUserStates.get(`unreg_${chatId}`);
    if (pendingState) {
        await handleRegistrationFlow(msg, pendingState);
        return;
    }

    // ── 2. Look up linked account ──────────────────────────────────────────────
    const [linked] = await db.execute(
        'SELECT user_id FROM telegram_users WHERE telegram_chat_id = ? LIMIT 1',
        [chatId.toString()]
    );

    if (linked.length === 0) {
        if (msg.contact) {
            await handleContactSharing(msg);
            return;
        }
        if (!isGroup) await sendContactPrompt(chatId);
        return;
    }

    const userId = linked[0].user_id;

    // ── 3. Retrieve user record ────────────────────────────────────────────────
    const [users] = await db.execute(
        'SELECT id, name, is_suspended FROM users WHERE id = ? LIMIT 1',
        [userId]
    );

    if (users.length === 0) {
        await db.execute('DELETE FROM telegram_users WHERE telegram_chat_id = ?', [chatId.toString()]);
        if (!isGroup) await sendContactPrompt(chatId);
        return;
    }

    const user = users[0];
    if (user.is_suspended) return;

    // If user shares contact again when already linked
    if (msg.contact) {
        await bot.sendMessage(chatId, `✅ Koontadaada mar hore ayaa la xaqiijiyay! (${user.name})`);
        return;
    }

    // ── 4. 👀 Seen reaction (cosmetic animation) ───────────────────────────────
    await reactToMessage(chatId, msgId, '👀');

    // ── 5. Password Reset State ───────────────────────────────────────────────
    const pwState = telegramUserStates.get(`pw_${userId}`);
    if (pwState && pwState.step === 'awaiting_password') {
        const msgText = msg.text || '';
        const pwErr = validatePassword(msgText);
        if (pwErr) {
            await bot.sendMessage(chatId, '❌ Password-ku waa inuu ahaadaa *ugu yaraan 8 xaraf*\\. Mar kale isku day:', { parse_mode: 'Markdown' });
            return;
        }
        try {
            const hashed = await bcrypt.hash(msgText.trim(), 12);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
            telegramUserStates.delete(`pw_${userId}`);
            await bot.sendMessage(chatId,
                '✅ *Password-kaaga waa la bedelay si guul leh\\!*\n\nHadda waad u isticmaali kartaa app\\-ka password\\-kaaga cusub\\.',
                { parse_mode: 'Markdown' });
        } catch (err) {
            await bot.sendMessage(chatId, '❌ Cilad ayaa ku timid. Fadlan mar kale isku day.');
        }
        return;
    }

    // ── 6. Rate Limiting ──────────────────────────────────────────────────────
    const now = new Date();
    const [coolRow] = await db.execute(
        'SELECT message_count, cooldown_until, last_message_at FROM telegram_cooldowns WHERE user_id = ?',
        [userId]
    );

    if (coolRow.length > 0) {
        const { message_count, cooldown_until, last_message_at } = coolRow[0];
        if (cooldown_until && new Date(cooldown_until) > now) return;

        const diffMin = (now - new Date(last_message_at)) / 60000;
        if (diffMin > 3) {
            await db.execute('UPDATE telegram_cooldowns SET message_count=1, cooldown_until=NULL, notified_expiry=FALSE WHERE user_id=?', [userId]);
        } else {
            const newCount = message_count + 1;
            if (newCount > 20) {
                const coolUntil = new Date(now.getTime() + 30 * 60000);
                await db.execute('UPDATE telegram_cooldowns SET message_count=?, cooldown_until=?, notified_expiry=FALSE WHERE user_id=?', [newCount, coolUntil, userId]);
                const t = coolUntil.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu' });
                await bot.sendMessage(chatId, `⏳ Fariimo badan ayaad soo dirtay\\. Fadlan sug ilaa *${t}*\\.`, { parse_mode: 'Markdown' });
                return;
            }
            await db.execute('UPDATE telegram_cooldowns SET message_count=?, notified_expiry=FALSE WHERE user_id=?', [newCount, userId]);
        }
    } else {
        await db.execute('INSERT INTO telegram_cooldowns (user_id, message_count, cooldown_until, notified_expiry) VALUES (?,1,NULL,FALSE)', [userId]);
    }

    // ── 7. Keyword Detection (password reset / report) ────────────────────────
    const msgText  = msg.text || msg.caption || '';
    const cleanBody = msgText.toLowerCase().trim();
    const normBody  = cleanBody
        .replace(/resset|ressett/g, 'reset')
        .replace(/passward|pasword|passwrod|pssword|paswword/g, 'password')
        .replace(/ilaawey|ilaawaye|illaaway/g, 'ilaaway')
        .replace(/baddal|badaal/g, 'badal');

    // Password reset request
    if (_checkPwReset(cleanBody) || _checkPwReset(normBody)) {
        const [uRows] = await db.execute('SELECT whatsapp_number FROM users WHERE id=? LIMIT 1', [userId]);
        const registered = uRows.length > 0 ? uRows[0].whatsapp_number : '';
        const phoneRegex = /\+?\d{7,15}/g;
        let hasMismatch = false;
        let m;
        while ((m = phoneRegex.exec(msgText)) !== null) {
            const n = normalizePhoneNumber(m[0]);
            if (n && n !== registered) { hasMismatch = true; break; }
        }
        if (hasMismatch) {
            await bot.sendMessage(chatId, '❌ Numberka aad qortay iyo kan akoonkaaga ku jira isku mid maaha\\.');
            return;
        }
        telegramUserStates.set(`pw_${userId}`, { step: 'awaiting_password' });
        await bot.sendMessage(chatId,
            '🔐 *Password Beddelid*\n\nFadlan qor password\\-ka cusub ee aad rabto \\(*ugu yaraan 8 xaraf*\\):',
            { parse_mode: 'Markdown' });
        return;
    }

    // Report request
    const isReport = cleanBody === 'report' ||
        cleanBody.includes('xogteyda') || cleanBody.includes('xogtayda') ||
        cleanBody.includes('my report') || cleanBody.includes('my info') ||
        cleanBody.includes('warbixinteyda') || cleanBody.includes('warbixintayda');

    if (isReport) {
        await sendUserReport(chatId, userId);
        return;
    }

    // ── 8. Media (Voice / Photo) ──────────────────────────────────────────────
    const isVoice = !!(msg.voice || msg.audio);
    const isPhoto  = !!(msg.photo && msg.photo.length > 0);

    let processedText = msgText;
    let voiceCostApplied = false;
    let attachmentData  = null;

    if (isVoice) {
        if (isGroup) return;
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id=?', [userId]);
        if (!wallet.length || wallet[0].balance < 20) {
            await bot.sendMessage(chatId, '❌ Dhibcahaagu kuma filna dhegeysiga codka *(20 Credits)*\\.', { parse_mode: 'Markdown' });
            return;
        }
        const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;
        const loadHandle = await sendLoadingMessage(chatId, '🎙️ _Dhegeysanaya codka\\.\\.\\._');
        try {
            const localPath = await bot.downloadFile(fileId, uploadsDir);
            processedText = await transcribeAudio(localPath, 'audio/ogg');
            voiceCostApplied = true;
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
            await deleteMsg(chatId, loadHandle?.messageId);
        } catch (e) {
            await editLoadingMessage(loadHandle, '❌ Waan ka xunnahay\\, codka lama fahmin\\.');
            return;
        }
    }

    if (isPhoto) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        try {
            const localPath = await bot.downloadFile(fileId, uploadsDir);
            const buf = fs.readFileSync(localPath);
            attachmentData = { base64: buf.toString('base64'), mimeType: 'image/jpeg' };
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        } catch (e) {
            await bot.sendMessage(chatId, '❌ Sawirka laguma guulaysan in la soo dejiyo\\.');
            return;
        }
    }

    // ── 9. Credit Check ───────────────────────────────────────────────────────
    let cost = voiceCostApplied ? 20 : isPhoto ? 10 :
        (processedText.length < 150 ? 1 : processedText.length < 500 ? 3 :
         processedText.length < 1500 ? 7 : 12);

    const [sub] = await db.execute(
        'SELECT * FROM user_subscriptions WHERE user_id=? AND expiry_date>NOW()',
        [userId]
    );
    const hasActiveSub = sub.length > 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, isPhoto ? 'image' : 'text');
    }

    if (!hasActiveSub && !usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id=?', [userId]);
        const balance = wallet.length ? wallet[0].balance : 0;
        if (balance < cost) {
            await bot.sendMessage(chatId, '💳 *Credit-kaagu kuma filna\\!*\n\nKu shubo credit si aad u sii wadato isticmaalka\\.', { parse_mode: 'Markdown' });
            return;
        }
        await db.execute('UPDATE user_wallet SET balance=GREATEST(0,balance-?) WHERE user_id=?', [cost, userId]);
    }

    // ── 10. Chat history ──────────────────────────────────────────────────────
    const [histRows] = await db.execute(
        'SELECT sender, message FROM messages_private WHERE user_id=? AND session_id="telegram" ORDER BY created_at DESC LIMIT 5',
        [userId]
    );
    const history = histRows.reverse().map(r => ({
        role: r.sender === 'user' ? 'user' : 'model',
        parts: [{ text: r.message }]
    }));

    // ── 11. Typing indicator + AI call ───────────────────────────────────────
    await bot.sendChatAction(chatId, 'typing');
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 300));

    const hasCaption = processedText && processedText.trim().length > 0;
    let finalPrompt = attachmentData && !hasCaption
        ? 'Fiiri sawirkan. Haddii sawirku ka kooban yahay suaalo MCQ/saxan/qaldaan: KALIYA soo qor jawaabaha kooban. Haddii ay yihiin suaalo furan ama xisaab: si kooban u xali.'
        : (processedText || 'Hello');

    const systemInstruction = `You are Darkpen, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson).
Rules:
1. IDENTITY: NEVER prepend any self-introduction banner. Only mention your name or creator if the user explicitly asks "Who are you?", "Who made you?", "Cidaa ku samaysay?".
2. LANGUAGE: Respond in the EXACT same language the user used (Somali → Somali, English → English).
3. EXAMS: MCQ/True-False images → only output question numbers and correct options. No explanation unless asked.
4. Keep responses concise, direct, and helpful.
5. Bold key terms using *Keyword*.
6. Tables: use <table_data>Header1|Header2\\nVal1|Val2</table_data> format.
7. Pricing: Pay as you go $0.5 (100 credits), Basic $3/month, Premium $11/month. EVC/eDahab: 637930329 or 659119779. Screenshot → WhatsApp +252637930329 or team.darkpen@gmail.com.
8. Be helpful, warm, accommodating. Never redirect the user away frustratingly.`;

    try {
        const aiResp = await askGemini(finalPrompt, 'gemini-2.5-flash', attachmentData, history, systemInstruction);
        const formatted = formatResponseForTelegram(aiResp);
        await sendMessageWithFallback(chatId, formatted);

        // Replace 👀 with ❤️ after responding
        await reactToMessage(chatId, msgId, '❤️');

        // Async DB saves
        db.execute('INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, "telegram", "user", ?)', [userId, finalPrompt])
            .catch(e => console.error('[TELEGRAM BOT] DB user msg:', e.message));
        db.execute('INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, "telegram", "ai", ?)', [userId, aiResp])
            .catch(e => console.error('[TELEGRAM BOT] DB ai msg:', e.message));
        logAIUsage(userId, 'gemini-1.5-flash', finalPrompt, aiResp,
            voiceCostApplied ? 'voice' : isPhoto ? 'image' : 'education', 'telegram')
            .catch(e => console.error('[TELEGRAM BOT] Logging:', e.message));

    } catch (err) {
        console.error('[TELEGRAM BOT] Gemini error:', err);
        await bot.sendMessage(chatId, '⚠️ Waan ka xunnahay\\, cilad farsamo ayaa ku timid\\. Mar kale isku day\\.', { parse_mode: 'Markdown' });
    }
}

// ─── /start command ───────────────────────────────────────────────────────────
async function handleStartCommand(msg) {
    const chatId = msg.chat.id;
    const [linked] = await db.execute(
        'SELECT user_id FROM telegram_users WHERE telegram_chat_id=? LIMIT 1',
        [chatId.toString()]
    );

    if (linked.length > 0) {
        const [usr] = await db.execute('SELECT name FROM users WHERE id=? LIMIT 1', [linked[0].user_id]);
        const name = usr.length ? usr[0].name : 'Adeer';
        await bot.sendMessage(chatId,
            `🤖 *Ku soo dhawaada Darkpen Bot\\!*\n\n` +
            `Haye *${escapeMd(name)}*\\, koontadaada waa xaqiijisantahay ✅\n\n` +
            `Maxaan kuu qabtaa maanta?`,
            { parse_mode: 'Markdown' }
        );
    } else {
        await sendContactPrompt(chatId);
    }
}

// ─── Beautiful contact prompt with styled button ───────────────────────────────
async function sendContactPrompt(chatId) {
    await bot.sendMessage(chatId,
        `👋 *Ku soo dhawaada Darkpen Bot\\!* 🤖📚\n\n` +
        `Darkpen waa AI assistant\\.ka ugu fiican Soomaalida\\!\n\n` +
        `🔐 *Si aad u bilowdo*, fadlan xaqiiji koontadaada Darkpen\n` +
        `adoo gujinaya badhanka hoose\\:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [[{
                    text: '📱 Xaqiiji Koontadaada  ✨',
                    request_contact: true
                }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
}

// ─── Handle shared contact ─────────────────────────────────────────────────────
async function handleContactSharing(msg) {
    const chatId  = msg.chat.id;
    const contact = msg.contact;

    if (!contact || contact.user_id !== msg.from.id) {
        await bot.sendMessage(chatId, '❌ Fadlan la wadaag *lambarkaaga saxda ah* adigoo gujinaaya badhanka\\.', { parse_mode: 'Markdown' });
        return;
    }

    // Show loading animation
    const loader = await sendLoadingMessage(chatId,
        '🔍 _Xaqiijinaya koontadaada\\.\\.\\._'
    );

    const rawPhone    = contact.phone_number;
    const normalized  = normalizePhoneNumber(rawPhone);

    if (!normalized) {
        await editLoadingMessage(loader, '❌ Lambarkaagu ma saxna\\. Fadlan isku day mar kale\\.');
        return;
    }

    // Step 1: searching DB
    await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\\.\\.\\._\n`[██░░░░░░░░] 20%`');
    await new Promise(r => setTimeout(r, 600));
    await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\\.\\.\\._\n`[████░░░░░░] 40%`');
    await new Promise(r => setTimeout(r, 600));

    const [users] = await db.execute(
        'SELECT id, name, is_suspended FROM users WHERE whatsapp_number=? LIMIT 1',
        [normalized]
    );

    await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\\.\\.\\._\n`[██████░░░░] 60%`');
    await new Promise(r => setTimeout(r, 500));

    if (users.length === 0) {
        // ── User not found → start registration agent flow ───────────────────
        await editLoadingMessage(loader, '📋 _Diyaarinaya diiwaan\\-gelinta\\.\\.\\._\n`[████████░░] 80%`');
        await new Promise(r => setTimeout(r, 500));
        await deleteMsg(chatId, loader?.messageId);

        // Store phone + start registration flow
        telegramUserStates.set(`unreg_${chatId}`, {
            step: 'reg_name',
            phone: normalized
        });

        await bot.sendMessage(chatId,
            `👋 *Soo dhowow Darkpen\\!*\n\n` +
            `Lambarkan *${escapeMd(normalized)}* lama helin diiwaanka\\.\n\n` +
            `📝 *Waxaan kaa caawinayaa inaad diwaangasho hadda\\!*\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*Tallaabada 1 / 3*\n` +
            `👤 *Magacaaga full\\-name\\-kaaga* maxaa?\n` +
            `_\\(Tusaale: Axmed Cali\\)_`,
            {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            }
        );
        return;
    }

    const user = users[0];

    await editLoadingMessage(loader, '✅ _La helay\\.\\.\\._\n`[██████████] 100%`');
    await new Promise(r => setTimeout(r, 400));
    await deleteMsg(chatId, loader?.messageId);

    if (user.is_suspended) {
        await bot.sendMessage(chatId,
            '🚫 *Koontadaada waa la xanibay\\.* Fadlan la xidhiidh taageerada\\.',
            { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
        );
        return;
    }

    try {
        await db.execute(
            'INSERT INTO telegram_users (telegram_chat_id, user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',
            [chatId.toString(), user.id]
        );

        await bot.sendMessage(chatId,
            `✅ *Xaqiijin guul leh\\!*\n\n` +
            `Ku soo dhawaada *${escapeMd(user.name)}*\\! 🎉\n\n` +
            `🤖 Darkpen Bot waa diyaar\\. Su'aashaada iigu soo dir\\!`,
            {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            }
        );
    } catch (err) {
        console.error('[TELEGRAM BOT] Link error:', err.message);
        await bot.sendMessage(chatId, '❌ Cilad farsamo ayaa ku timid\\. Mar kale isku day\\.', {
            parse_mode: 'Markdown', reply_markup: { remove_keyboard: true }
        });
    }
}

// ─── Registration Agent Flow ───────────────────────────────────────────────────
async function handleRegistrationFlow(msg, state) {
    const chatId = msg.chat.id;
    const input  = (msg.text || '').trim();

    if (!input) return;

    if (state.step === 'reg_name') {
        if (input.length < 2 || input.length > 60) {
            await bot.sendMessage(chatId,
                '❌ Fadlan magac sax ah geli \\(*2\\-60 xaraf*\\):',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        state.step = 'reg_username';
        state.name = input;
        telegramUserStates.set(`unreg_${chatId}`, state);

        await bot.sendMessage(chatId,
            `✅ *${escapeMd(input)}* — waa qurux badnaan\\!\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*Tallaabada 2 / 3*\n` +
            `🆔 *Username* dooro:\n` +
            `_\\(3\\-30 xaraf: a\\-z, 0\\-9, \\_\\)_\n` +
            `_Tusaale: axmed\\_cali_`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (state.step === 'reg_username') {
        const username = normalizeUsername(input);
        const usernameErr = validateUsername(username);
        if (usernameErr) {
            await bot.sendMessage(chatId,
                `❌ *${escapeMd(usernameErr)}*\n\nMar kale isku day:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Check if username already taken
        const [existing] = await db.execute('SELECT id FROM users WHERE username=? LIMIT 1', [username]);
        if (existing.length > 0) {
            await bot.sendMessage(chatId,
                `❌ Username *${escapeMd(username)}* hore ayaa loo qaatay\\. Username kale isku day:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        state.step     = 'reg_password';
        state.username = username;
        telegramUserStates.set(`unreg_${chatId}`, state);

        await bot.sendMessage(chatId,
            `✅ *@${escapeMd(username)}* — waa xor\\!\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*Tallaabada 3 / 3*\n` +
            `🔐 *Password* dooro:\n` +
            `_\\(ugu yaraan 8 xaraf — lama muuqdo diiwaangelinta ka dib\\)_`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (state.step === 'reg_password') {
        const pwErr = validatePassword(input);
        if (pwErr) {
            await bot.sendMessage(chatId,
                `❌ *${escapeMd(pwErr)}*\n\nMar kale isku day:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Show loading animation for registration
        const loader = await sendLoadingMessage(chatId, '⚙️ _Koontada la sameynayaa\\.\\.\\._\n`[██░░░░░░░░] 20%`');
        await new Promise(r => setTimeout(r, 500));
        await editLoadingMessage(loader, '⚙️ _Koontada la sameynayaa\\.\\.\\._\n`[█████░░░░░] 50%`');

        try {
            const hashedPw = await bcrypt.hash(input, 12);

            // Insert user
            const [result] = await db.execute(
                `INSERT INTO users (name, username, password, whatsapp_number, role, is_verified, is_suspended)
                 VALUES (?, ?, ?, ?, 'user', 1, 0)`,
                [state.name, state.username, hashedPw, state.phone]
            );
            const newUserId = result.insertId;

            await editLoadingMessage(loader, '⚙️ _Koontada la sameynayaa\\.\\.\\._\n`[████████░░] 80%`');
            await new Promise(r => setTimeout(r, 400));

            // Create wallet
            await db.execute(
                'INSERT INTO user_wallet (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE balance=balance',
                [newUserId]
            ).catch(() => {});

            // Create free AI usage record
            await db.execute(
                'INSERT INTO user_free_ai_usage (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id=user_id',
                [newUserId]
            ).catch(() => {});

            // Link to telegram
            await db.execute(
                'INSERT INTO telegram_users (telegram_chat_id, user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',
                [chatId.toString(), newUserId]
            );

            await editLoadingMessage(loader, '✅ _La diyaariyay\\!_\n`[██████████] 100%`');
            await new Promise(r => setTimeout(r, 400));
            await deleteMsg(chatId, loader?.messageId);

            // Clear state
            telegramUserStates.delete(`unreg_${chatId}`);

            await bot.sendMessage(chatId,
                `🎉 *Diwaangelintaada waa guul\\!*\n\n` +
                `👤 *Magaca:* ${escapeMd(state.name)}\n` +
                `🆔 *Username:* @${escapeMd(state.username)}\n` +
                `📱 *Lambarka:* ${escapeMd(state.phone)}\n\n` +
                `━━━━━━━━━━━━━━━\n` +
                `✨ Hadda waad isticmaali kartaa Darkpen Bot\\!\n` +
                `💳 Ku shubo *$0\\.50* \\(100 credits\\) si aad u bilowdo:\n` +
                `EVC\\+/eDahab → *637930329* ama *659119779*\n` +
                `Ka dib screenshot WhatsApp\\-ka u dir: *\\+252637930329*\n\n` +
                `🤖 Su'aashaada iigu soo dir\\!`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('[TELEGRAM BOT] Registration error:', err);
            await editLoadingMessage(loader, '❌ Cilad farsamo ayaa ku timid\\. Mar kale /start isku day\\.');
            telegramUserStates.delete(`unreg_${chatId}`);
        }
    }
}

// ─── User Report ──────────────────────────────────────────────────────────────
async function sendUserReport(chatId, userId) {
    try {
        const [rows] = await db.execute(`
            SELECT u.*,
                   (SELECT COUNT(*) FROM messages_private WHERE user_id=u.id AND session_id IS NOT NULL AND session_id!='telegram') AS app_count,
                   (SELECT COUNT(*) FROM messages_private WHERE user_id=u.id AND session_id='telegram') AS tg_count,
                   (SELECT balance FROM user_wallet WHERE user_id=u.id) AS credits,
                   (SELECT type FROM user_subscriptions WHERE user_id=u.id AND expiry_date>NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_type,
                   (SELECT expiry_date FROM user_subscriptions WHERE user_id=u.id AND expiry_date>NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_expiry
            FROM users u WHERE u.id=?`, [userId]);

        if (!rows.length) {
            await bot.sendMessage(chatId, '❌ Xogtaada lama heli karo\\.', { parse_mode: 'Markdown' });
            return;
        }
        const d = rows[0];
        let plan = 'Bilaash \\(Free\\)';
        if (d.sub_type) {
            const name = d.sub_type === 'monthly_11' ? 'Premium' : 'Basic';
            const days = Math.ceil((new Date(d.sub_expiry) - new Date()) / 86400000);
            plan = `${name} \\(${days} casho\\)`;
        }
        const status = d.is_suspended ? '🚫 Xaniban' : '✅ Firfircoon';

        await sendMessageWithFallback(chatId,
            `📊 *DARKPEN REPORT*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `👤 *Magaca:* ${escapeMd(d.name)}\n` +
            `🆔 *Username:* @${escapeMd(d.username || 'ma jiro')}\n` +
            `📅 *Ku biiray:* ${new Date(d.created_at).toLocaleDateString('so-SO')}\n` +
            `💎 *Credits:* ${d.credits || 0}\n` +
            `💬 *App chats:* ${d.app_count || 0}\n` +
            `📱 *Telegram chats:* ${d.tg_count || 0}\n` +
            `🏆 *XP:* ${d.xp || 0}\n` +
            `💳 *Plan:* ${plan}\n` +
            `🔒 *Status:* ${status}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `Mahadsanid, sii wad isticmaalka Darkpen\\! 🚀`
        );
    } catch (err) {
        console.error('[TELEGRAM BOT] Report error:', err.message);
        await bot.sendMessage(chatId, '❌ Cilad ayaa ku timid helida xogtaada\\.', { parse_mode: 'Markdown' });
    }
}

// ─── sendMessageWithFallback ──────────────────────────────────────────────────
async function sendMessageWithFallback(chatId, text, opts = {}) {
    try {
        return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });
    } catch (err) {
        console.warn('[TELEGRAM BOT] Markdown failed, falling back to plain text.');
        const clean = text
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\\/g, '');
        return await bot.sendMessage(chatId, clean, { ...opts, parse_mode: undefined });
    }
}

// ─── Format AI response for Telegram Markdown ─────────────────────────────────
function formatResponseForTelegram(text) {
    if (!text) return '';
    let f = text;
    f = f.replace(/<green>([\s\S]*?)<\/green>/gi, '*$1*');
    f = f.replace(/<red>([\s\S]*?)<\/red>/gi, '*$1*');
    f = f.replace(/<callout>([\s\S]*?)<\/callout>/gi, '*$1*');
    f = f.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (_, content) => {
        const lines = content.trim().split('\n');
        if (!lines.length) return '';
        const headers = lines[0].split('|').map(h => h.trim());
        const rows    = lines.slice(1).map(l => l.split('|').map(c => c.trim()));
        let out = '\n*Xogta Shaxda:*\n';
        rows.forEach(row => {
            out += '------------------\n';
            row.forEach((col, i) => { out += `• *${headers[i] || ''}:* ${col}\n`; });
        });
        out += '------------------\n';
        return out;
    });
    f = f.replace(/^(#{1,6})\s+(.+)$/gm, '*$2*');
    f = f.replace(/\*\*([\s\S]*?)\*\*/g, '*$1*');
    f = f.replace(/__([\s\S]*?)__/g, '_$1_');
    f = f.replace(/^\s*[*\-]\s+/gm, '• ');
    f = f.replace(/```[a-zA-Z0-9-]+\n/g, '```\n');
    return f;
}

// ─── Escape Markdown V2 special chars ─────────────────────────────────────────
function escapeMd(text = '') {
    return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// ─── Password Reset Keyword Checker ───────────────────────────────────────────
function _checkPwReset(body) {
    return body.includes('password reset') || body.includes('reset password') ||
        body.includes('forgot password') || body.includes('forget password') ||
        body.includes('change password') || body.includes('lost password') ||
        body.includes("can't login") || body.includes("can't log in") ||
        body.includes('reset my password') || body.includes('update password') ||
        (body.includes('password') && (body.includes('badal') || body.includes('ilaaway') ||
            body.includes('ma galin') || body.includes('ma geli') || body.includes('cusub'))) ||
        (body.includes('furaha') && (body.includes('badal') || body.includes('ilaaway') ||
            body.includes('ma galin') || body.includes('cusub'))) ||
        body.includes('password waan ilaaway') || body.includes('furaha waan ilaaway') ||
        body.includes('passwordka iga badal') || body.includes('furaha iga badal') ||
        body.includes('bedel password') || body.includes('bedel furaha') ||
        body.includes('password ilaaway') || body.includes('furaheygii ilaaway');
}

// ─── Group Message Handler ───────────────────────────────────────────────────
async function handleGroupMessage(msg) {
    const chatId = msg.chat.id;
    const msgId = msg.message_id;
    const text = msg.text || msg.caption || '';
    
    if (!text) return;
    
    // Check if bot was mentioned OR if it is a reply to the bot's message
    const botMention = `@${botInfo.username}`;
    const isMentioned = text.includes(botMention);
    const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.id === botInfo.id;
    
    if (!isMentioned && !isReplyToBot) {
        // 3% chance of commenting randomly on any text that talks about AI/technology/Darkpen to make it interactive!
        const words = text.toLowerCase();
        const keywords = ['darkpen', 'ai', 'gemini', 'chatgpt', 'bot', 'fariin', 'credits', 'waxbarasho', 'baro', 'programming'];
        const hasKeyword = keywords.some(k => words.includes(k));
        
        if (hasKeyword && Math.random() < 0.03) {
            // Proceed to reply
        } else {
            return;
        }
    }
    
    // Enforce Group Rate Limiting
    const now = Date.now();
    if (!groupLimits.has(chatId)) {
        groupLimits.set(chatId, []);
    }
    const timestamps = groupLimits.get(chatId);
    // filter timestamps in last 2 minutes (120,000 ms)
    const validTimestamps = timestamps.filter(t => now - t < 120000);
    if (validTimestamps.length >= 5) {
        return; // Exceeded rate limit for group
    }
    validTimestamps.push(now);
    groupLimits.set(chatId, validTimestamps);
    
    // Send seen reaction 👀
    await reactToMessage(chatId, msgId, '👀');
    await bot.sendChatAction(chatId, 'typing');
    
    // System Instruction for Group
    const groupInstruction = `You are Darkpen, a witty, humorous, and tech-savvy AI assistant and active team member of the Darkpen app, developed by ZinsonAI.
Rules:
1. TALK ONLY about the Darkpen app, AI models (like Gemini, ChatGPT, Claude), technology, learning, or productivity. If someone asks something completely unrelated, playfully redirect them back to technology or Darkpen.
2. TONE: Be highly humorous, entertaining, and witty. Use natural Somali slang (e.g. "sxb", "bahalka", "xaaladu waa kacsantahay", "asaageena", "heer sare") or English depending on the user's language.
3. Keep replies very short and punchy (1-3 sentences maximum).
4. Act as a proud team member of Darkpen. If someone mentions a competitor (like ChatGPT), playfully claim Darkpen is better or faster for Somalis.
5. Do NOT use markdown headers or heavy formatting. Keep it clean.`;

    let finalPrompt = text.replace(botMention, '').trim();
    if (msg.reply_to_message && msg.reply_to_message.text) {
        finalPrompt = `[User replied to: "${msg.reply_to_message.text}"]\nReply comment: ${finalPrompt}`;
    }
    
    try {
        const aiResp = await askGemini(finalPrompt, 'gemini-2.5-flash', null, [], groupInstruction);
        const formatted = formatResponseForTelegram(aiResp);
        
        await bot.sendMessage(chatId, formatted, {
            reply_to_message_id: msgId,
            parse_mode: 'Markdown'
        });
        
        // React with ❤️
        await reactToMessage(chatId, msgId, '❤️');
    } catch (err) {
        console.error('[TELEGRAM BOT] Group reply error:', err);
    }
}

// ─── Trigger Daily Tip Generation ────────────────────────────────────────────
async function triggerDailyTipGeneration(ownerChatId) {
    try {
        const loadingMsg = await bot.sendMessage(ownerChatId, '🤖 _Waxaa la soo saarayaa Daily Tip..._', { parse_mode: 'Markdown' });
        
        const today = new Date().toLocaleDateString('so-SO', { timeZone: 'Africa/Mogadishu', weekday: 'long', day: 'numeric', month: 'long' });
        
        const prompt = `Generate an extremely useful, interesting and well-structured daily tip for Somali students and tech users.
Focus on one of: AI tools, study hacks, Darkpen app features, productivity, or a mindblowing tech fact.
Write in Somali. Use short punchy sentences. Include at least 3 specific bullet points. Be specific not generic.
Output raw text only with *bold* for key phrases. No hashtags.`;
        const systemInstruction = 'You are Darkpen AI, a premium Somali educational assistant. Generate high-quality daily tips in Somali. Be specific, practical and engaging. Use *bold* for key terms.';
        
        const content = await askGemini(prompt, 'gemini-2.5-flash', null, [], systemInstruction);
        const formatted = formatResponseForTelegram(content);
        
        // Build beautiful channel post
        const channelPost = `╔══════════════════╗
🌅 *DARKPEN DAILY TIP*
${today}
╚══════════════════╝

${formatted}

━━━━━━━━━━━━━━━━━━
📲 *Darkpen App* — Barashada Cusub
🔗 t.me/darkpenBot`;
        
        const postId = 'tip_' + Date.now();
        pendingPosts.set(postId, { type: 'tip', content: channelPost });
        
        try { await bot.deleteMessage(ownerChatId, loadingMsg.message_id); } catch(e) {}
        
        await bot.sendMessage(ownerChatId, 
            `📢 *PREVIEW — Daily Tip*\n\nHalkan hoose ayaa channelka loo dhigi doonaa:\n\n${channelPost}\n\n👇 *Dooro:*`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Ogolow — Post Channel', callback_data: `approve_${postId}` },
                        { text: '❌ Diid', callback_data: `reject_${postId}` }
                    ]]
                }
            }
        );
    } catch (err) {
        console.error('[TELEGRAM BOT] Daily tip gen error:', err);
        await bot.sendMessage(ownerChatId, `❌ Qalad: ${err.message}`);
    }
}

// ─── Trigger Saturday Poll Generation ────────────────────────────────────────
async function triggerSaturdayPollGeneration(ownerChatId) {
    try {
        const loadingMsg = await bot.sendMessage(ownerChatId, '📊 _Waxaa la soo saarayaa Saturday Poll..._', { parse_mode: 'Markdown' });
        
        const prompt = `Generate a fun, thought-provoking and engaging Telegram poll question with exactly 3 options in Somali.
The poll MUST be one of these styles:
- Darkpen vs ChatGPT/Gemini comparison (competitive, funny)
- What feature should Darkpen add next?
- AI usage habits of Somali students
- Tech prediction about AI in Somalia
Make the question punchy and controversial enough to get votes.
Output ONLY a valid JSON object:
{"question": "...", "options": ["...", "...", "..."]}`;
        const systemInstruction = 'Output ONLY valid JSON. No markdown, no explanation, no code fences.';
        
        const aiResp = await askGemini(prompt, 'gemini-2.5-flash', null, [], systemInstruction);
        
        let pollData;
        try {
            const cleanJson = aiResp.replace(/```json|```/g, '').trim();
            pollData = JSON.parse(cleanJson);
        } catch (e) {
            pollData = {
                question: 'Darkpen iyo ChatGPT — Kee baad isticmaashaa marka aad barato?',
                options: ['🇸🇴 Darkpen — mid Soomaali ah!', '🤖 ChatGPT — caalamiga', '👀 Labadaba waaan isticmaale']
            };
        }
        
        const postId = 'poll_' + Date.now();
        pendingPosts.set(postId, {
            type: 'poll',
            question: pollData.question,
            options: pollData.options
        });
        
        try { await bot.deleteMessage(ownerChatId, loadingMsg.message_id); } catch(e) {}
        
        const previewText = `📊 *PREVIEW — Saturday Poll*

*Su'aasha:*
${pollData.question}

*Dookhyada:*
${pollData.options.map((o, i) => `${i+1}. ${o}`).join('\n')}

👇 *Dooro:*`;
        
        await bot.sendMessage(ownerChatId, previewText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Ogolow — Post Group+Channel', callback_data: `approve_${postId}` },
                    { text: '❌ Diid', callback_data: `reject_${postId}` }
                ]]
            }
        });
    } catch (err) {
        console.error('[TELEGRAM BOT] Saturday poll gen error:', err);
        await bot.sendMessage(ownerChatId, `❌ Qalad: ${err.message}`);
    }
}

// ─── Handle Callback Query (Moderation Buttons) ──────────────────────────────
async function handleCallbackQuery(callbackQuery) {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const ownerChatId = message.chat.id.toString();
    const ownerConfigId = (process.env.TELEGRAM_OWNER_CHAT_ID || '').trim();
    
    if (ownerChatId !== ownerConfigId) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Adigu awood uma lihid!', show_alert: true });
        return;
    }

    if (!data.startsWith('approve_') && !data.startsWith('reject_')) return;
    
    // Always answer the callback immediately to stop the loading spinner
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const action = data.split('_')[0];
    const postId = data.substring(action.length + 1);
    const post = pendingPosts.get(postId);

    if (!post) {
        await bot.sendMessage(ownerChatId, '⚠️ Fariintan lama helin ama mar hore ayaa la goostay.');
        // Remove the inline keyboard from old message
        try {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: ownerChatId,
                message_id: message.message_id
            });
        } catch(e) {}
        return;
    }

    pendingPosts.delete(postId);
    
    // Remove the inline keyboard buttons immediately
    try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: ownerChatId,
            message_id: message.message_id
        });
    } catch(e) {}

    if (action === 'approve') {
        let postedTo = [];
        let errors = [];
        
        if (post.type === 'tip') {
            if (process.env.TELEGRAM_CHANNEL_ID) {
                try {
                    await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, post.content, { parse_mode: 'Markdown' });
                    postedTo.push('Channel (@darkpenapp)');
                } catch(e) {
                    // Try without markdown if formatting fails
                    try {
                        const plain = post.content.replace(/[*_`]/g, '').replace(/\\/g, '');
                        await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, plain);
                        postedTo.push('Channel (plain text)');
                    } catch(e2) {
                        errors.push('Channel: ' + e2.message);
                    }
                }
            } else {
                errors.push('TELEGRAM_CHANNEL_ID lama helin .env-ga');
            }
        } else if (post.type === 'poll') {
            if (process.env.TELEGRAM_GROUP_ID) {
                try {
                    await bot.sendPoll(process.env.TELEGRAM_GROUP_ID, post.question, post.options, { is_anonymous: false });
                    postedTo.push('Group');
                } catch(e) { errors.push('Group: ' + e.message); }
            }
            if (process.env.TELEGRAM_CHANNEL_ID) {
                try {
                    await bot.sendPoll(process.env.TELEGRAM_CHANNEL_ID, post.question, post.options, { is_anonymous: false });
                    postedTo.push('Channel');
                } catch(e) { errors.push('Channel: ' + e.message); }
            }
        }
        
        if (postedTo.length > 0) {
            await bot.sendMessage(ownerChatId, `✅ Waa la daabacay!\n\n📍 Halka loo dhigay: ${postedTo.join(', ')}`);
        }
        if (errors.length > 0) {
            await bot.sendMessage(ownerChatId, `⚠️ Qaarkood way fashilantay:\n${errors.join('\n')}`);
        }
    } else {
        await bot.sendMessage(ownerChatId, '❌ Waa la diiday. Fariintu lama daabacin.');
    }
}

// ─── Daily & Saturday Scheduler Checker ──────────────────────────────────────
function startSchedulerChecker() {
    const schedulerFile = path.join(__dirname, '../uploads/telegram_scheduler.json');
    
    if (!fs.existsSync(schedulerFile)) {
        fs.writeFileSync(schedulerFile, JSON.stringify({ lastDailyTipDate: '', lastSaturdayPollDate: '' }));
    }
    
    setInterval(async () => {
        try {
            const ownerId = process.env.TELEGRAM_OWNER_CHAT_ID;
            if (!ownerId || !bot) return;
            
            const state = JSON.parse(fs.readFileSync(schedulerFile, 'utf8'));
            const now = new Date();
            
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Africa/Mogadishu',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false
            });
            const parts = formatter.formatToParts(now);
            const dateParts = {};
            parts.forEach(p => { dateParts[p.type] = p.value; });
            
            const todayStr = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
            const currentHour = parseInt(dateParts.hour, 10);
            
            // 1. Daily Tip at 9:00 AM or later
            if (todayStr !== state.lastDailyTipDate && currentHour >= 9) {
                console.log(`[TELEGRAM SCHEDULER] Triggering daily tip for date: ${todayStr}`);
                state.lastDailyTipDate = todayStr;
                fs.writeFileSync(schedulerFile, JSON.stringify(state));
                await triggerDailyTipGeneration(ownerId);
            }
            
            // 2. Saturday Poll at 10:00 AM or later
            const dayOfWeek = now.getDay(); 
            if (dayOfWeek === 6 && todayStr !== state.lastSaturdayPollDate && currentHour >= 10) {
                console.log(`[TELEGRAM SCHEDULER] Triggering Saturday poll for date: ${todayStr}`);
                state.lastSaturdayPollDate = todayStr;
                fs.writeFileSync(schedulerFile, JSON.stringify(state));
                await triggerSaturdayPollGeneration(ownerId);
            }
        } catch (err) {
            console.error('[TELEGRAM SCHEDULER] Error:', err.message);
        }
    }, 300000); // Check every 5 minutes
}

