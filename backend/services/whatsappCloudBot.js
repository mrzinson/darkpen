const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber, validatePassword } = require('./verificationService');
const bcrypt = require('bcrypt');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');

// Password reset states map (userId -> { step })
const userStates = new Map();


// Create temp directory for voice notes if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper: Send HTTP request to Meta Graph API
async function callMetaAPI(endpoint, data = {}, method = 'POST') {
    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
    
    if (!accessToken || !phoneId) {
        console.error('[WHATSAPP CLOUD] Missing Meta API credentials (META_WA_ACCESS_TOKEN / META_WA_PHONE_NUMBER_ID)');
        return null;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneId}/${endpoint}`;
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: method === 'GET' ? undefined : JSON.stringify(data)
        });
        
        const resData = await response.json();
        if (!response.ok) {
            console.error('[WHATSAPP CLOUD] Meta API error:', resData);
            return null;
        }
        return resData;
    } catch (err) {
        console.error('[WHATSAPP CLOUD] Meta API network error:', err.message);
        return null;
    }
}

// Download media (image/audio) from Meta using Media ID
async function downloadMetaMedia(mediaId, outputFilename) {
    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    if (!accessToken) return null;

    try {
        // Step 1: Get media URL
        const metadataUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
        const metaRes = await fetch(metadataUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!metaRes.ok) {
            console.error('[WHATSAPP CLOUD] Failed to fetch media metadata for ID:', mediaId);
            return null;
        }
        const metadata = await metaRes.json();
        const mediaUrl = metadata.url;
        
        if (!mediaUrl) return null;

        // Step 2: Download binary data
        const mediaRes = await fetch(mediaUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!mediaRes.ok) {
            console.error('[WHATSAPP CLOUD] Failed to download media from URL');
            return null;
        }

        const arrayBuffer = await mediaRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const filePath = path.join(uploadsDir, outputFilename);
        fs.writeFileSync(filePath, buffer);
        return { filePath, mimeType: metadata.mime_type };
    } catch (err) {
        console.error('[WHATSAPP CLOUD] Media download error:', err.message);
        return null;
    }
}

// Send Text Message
async function sendCloudMessage(to, text) {
    console.log(`[WHATSAPP CLOUD] Sending message to ${to}...`);
    return await callMetaAPI('messages', {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
            preview_url: false,
            body: text
        }
    });
}

// Send Reaction emoji
async function sendCloudReaction(to, messageId, emoji) {
    return await callMetaAPI('messages', {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "reaction",
        reaction: {
            message_id: messageId,
            emoji: emoji
        }
    });
}

// GET Webhook Verify (Meta portal verification)
exports.handleWebhookVerify = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const verifyToken = process.env.META_WA_VERIFY_TOKEN;

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[WHATSAPP CLOUD] Webhook verified successfully!');
            return res.status(200).send(challenge);
        }
        console.warn('[WHATSAPP CLOUD] Webhook verification failed. Token mismatch.');
        return res.sendStatus(403);
    }
    return res.sendStatus(400);
};

// POST Webhook Receive (Incoming message from WhatsApp)
exports.handleWebhookPost = (req, res) => {
    // 1. Reply 200 OK immediately as required by Meta to avoid retries
    res.status(200).send('EVENT_RECEIVED');

    try {
        const body = req.body;
        if (body.object !== 'whatsapp_business_account') return;
        
        const entry = body.entry;
        if (!entry || !entry[0] || !entry[0].changes || !entry[0].changes[0]) return;
        
        const value = entry[0].changes[0].value;
        if (!value || !value.messages || !value.messages[0]) return;
        
        const message = value.messages[0];
        const from = message.from; // Sender number
        const messageId = message.id; // WhatsApp Message ID
        const type = message.type; // text, image, audio, etc.

        let messageText = '';
        let mediaId = null;
        let mediaMime = null;

        if (type === 'text') {
            messageText = message.text.body;
        } else if (type === 'image') {
            mediaId = message.image.id;
            mediaMime = message.image.mime_type;
            messageText = message.image.caption || '';
        } else if (type === 'audio') {
            mediaId = message.audio.id;
            mediaMime = message.audio.mime_type;
        }

        // Process message in background
        processIncomingMessage(from, messageId, type, messageText, mediaId, mediaMime).catch(err => {
            console.error('[WHATSAPP CLOUD] Error processing incoming message:', err);
        });
    } catch (err) {
        console.error('[WHATSAPP CLOUD] Webhook parse error:', err.message);
    }
};

function isYesResponse(text) {
    const clean = text.toLowerCase().trim().replace(/[?!.]/g, '');
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
    const clean = text.toLowerCase().trim().replace(/[?!.]/g, '');
    return /^may?a*$/i.test(clean) || 
           /^no+p?e?$/i.test(clean) || 
           clean === 'n' || 
           clean === 'laa' || 
           clean.includes('ma rabo') || 
           clean.includes('ha rabin');
}

// Main processing logic
async function processIncomingMessage(from, messageId, type, messageText, mediaId, mediaMime) {
    console.log(`[WHATSAPP CLOUD] Received message: from=${from}, type=${type}, body="${messageText}"`);

    const normalizedPhone = normalizePhoneNumber(from);
    if (!normalizedPhone) return;

    // 1. Look up user in database
    const [users] = await db.execute(
        'SELECT id, name, is_suspended FROM users WHERE whatsapp_number = ? LIMIT 1',
        [normalizedPhone]
    );

    // If user not registered:
    if (users.length === 0) {
        await sendCloudMessage(
            from,
            `*Kulama hadli karo* sababtoo ah waxaa la igu amray in aan la hadlo oo kaliya dadka ka diwaan gashan app-ka *Darkpen*.\n\n` +
            `Si aad isu diwaangeliso, fadlan raac qodobadan fudud:\n\n` +
            `1. *Lasoo deg App-ka:* Play Store-ka ku qor *Darkpen* si aad u soo degsato, ama raac link-gan:\n` +
            `   🔗 https://play.google.com/store/apps/details?id=com.darkpen.app\n\n` +
            `2. *Isu-diwaangeli:* Marka uu kuusoo dego, iska diwaangeli adigoo adeegsanaya lambarkan WhatsApp-ka ah ee aad hadda igala hadlayso.\n\n` +
            `3. *Ku shubo Credit:* Ku shubo ugu yaraan *$0.50* si aad u hesho credit, ka dibna iigu soo laabo si aan kuu caawiyo.`
        );
        return;
    }

    const user = users[0];

    // If user is suspended, ignore
    if (user.is_suspended) {
        console.log(`[WHATSAPP CLOUD] User ${user.name} (${normalizedPhone}) is suspended. Ignoring.`);
        return;
    }

    const userId = user.id;

    // ─── Password Reset Flow ──────────────────────────────────────────────────────
    const cleanBody = (messageText || '').toLowerCase().trim();
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
        const passwordError = validatePassword(messageText);
        if (passwordError) {
            await sendCloudMessage(from, "Fadlan furaha sirta ah (password) ha ahaado ugu yaraan 8 xaraf. Fadlan mar kale qor furahaaga cusub:");
            return;
        }

        try {
            const hashedPassword = await bcrypt.hash(messageText.trim(), 12);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
            userStates.delete(userId);
            await sendCloudMessage(from, "Amniga: Furahaaga sirta ah (password) waa la bedelay si guul leh! Fadlan ilaasho furahaaga cusub. Hadda waad u isticmaali kartaa inaad ku gasho app-ka.");
            
            // Also send support contact
            try {
                // In Cloud API, contact sharing is not standard, we can’t send contact cards, so we send text
                await sendCloudMessage(from, "Wixii caawinaad ah, kala xiriir support-ka: +252659119779");
            } catch (err) {}
        } catch (err) {
            console.error('[WHATSAPP CLOUD] Password reset db update failed:', err.message);
            await sendCloudMessage(from, "Waan ka xunnahay, cilad ayaa ku timid kaydinta furahaaga cusub. Fadlan mar kale isku day waxyar ka dib.");
        }
        return;
    }

    // ─── Help Guide Consent Flow ───
    if (state && state.step === 'awaiting_whatsapp_help_consent') {
        if (isYesResponse(cleanBody)) {
            userStates.delete(userId);
            await sendCloudMessage(from,
                `*SIDA UU U SHAQEYNYO WHATSAPP BOT-KU* 📱🚀\n` +
                `----------------------------------\n` +
                `1. *Qoraalka & AI:* Si caadi ah iila hadal, wax ii weydii, iigana sheekeyso wax kasta. Waxaan kuugu jawaabayaa isla luuqadda aad igu qortay.\n` +
                `2. *Sawirro (Images):* Iisoo dir sawir kasta (MCQ, xisaab, ama sharaxaad). Waxaan kuu soo saarayaa jawaabaha saxda ah si degdeg ah.\n` +
                `3. *Codadka (Voice Notes):* Iisoo dir fariin cod ah, waan ku dhageysanayaa, waanan kuu sharxayaa.\n` +
                `4. *Report:* Qor *report* mar kasta oo aad rabto inaad ogaato dhibcahaaga (credits) iyo qorshahaaga.\n` +
                `5. *Password Reset:* Qor *password reset* haddii aad rabto inaad bedesho furahaaga sirta ah.\n\n` +
                `Maxaan hadda kaa caawiyaa? 😊`
            );
        } else if (isNoResponse(cleanBody)) {
            userStates.delete(userId);
            await sendCloudMessage(from, "Haye, diyaar ayaan kuu ahay. Maxaan hadda kuu qabtaa? 🚀");
        } else {
            await sendCloudMessage(from, "Fadlan ku jawaab *Haa* ama *Maya* — Makaa caawiyaa sida uu u shaqeeyo WhatsApp bot-ku?");
        }
        return;
    }

    // Broad & natural language password reset detection (Somali + English + typo-tolerant)
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
        
        // Search in the original messageText and normalizedBody
        const rawBody = messageText || '';
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
            await sendCloudMessage(from, "numberkan aad soo qortey iyo kan whatsappka isku mid maaha ee waa ka xunahay ma badali karo kaas whatsappkiisa igala soo hadal");
            return;
        }

        userStates.set(userId, { step: 'awaiting_password' });
        await sendCloudMessage(from, "Haye! Si aan kuugu badalo password-kaaga, fadlan ii soo qor password-ka cusub ee aad rabto (ugu yaraan 8 xaraf):");
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

                await sendCloudMessage(from, reportMessage);
            } else {
                await sendCloudMessage(from, "Waan ka xunnahay, xogtaada lama heli karo hadda.");
            }
        } catch (err) {
            console.error('[WHATSAPP CLOUD] Failed to send user report:', err.message);
            await sendCloudMessage(from, "Cilad ayaa ku timid helida xogtaada. Fadlan mar kale isku day.");
        }
        return;
    }


    // React with 👀 to indicate we received and are processing the message
    await sendCloudReaction(from, messageId, '👀');


    // 2. Enforce Rate Limiting
    const now = new Date();
    const [cooldownRow] = await db.execute(
        'SELECT message_count, cooldown_until, last_message_at FROM whatsapp_cooldowns WHERE user_id = ?',
        [userId]
    );

    if (cooldownRow.length > 0) {
        const { message_count, cooldown_until, last_message_at } = cooldownRow[0];

        // Check if currently locked
        if (cooldown_until && new Date(cooldown_until) > now) {
            console.log(`[WHATSAPP CLOUD] User ${user.name} is on cooldown. Ignoring.`);
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
            // Rate limit: 20 messages per 3-minute window → 30-min cooldown
            if (newCount > 20) {
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

                await sendCloudMessage(
                    from, 
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
        // Create first tracking record
        await db.execute(
            'INSERT INTO whatsapp_cooldowns (user_id, message_count, cooldown_until, notified_expiry) VALUES (?, 1, NULL, FALSE)',
            [userId]
        );
    }

    // 3. Handle Voice Notes / Audio
    const isVoice = type === 'audio';
    let voiceCostApplied = false;

    if (isVoice && mediaId) {
        console.log(`[WHATSAPP CLOUD] Processing voice note for ${user.name}`);
        
        // Check balance (must have >= 20 credits)
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const hasBalance = wallet.length > 0 && wallet[0].balance >= 20;

        if (!hasBalance) {
            await sendCloudMessage(from, 'Dhibcahaagu kuma filna dhegeysiga codka (20 Credits).');
            return;
        }

        const ext = mediaMime ? (mediaMime.split(';')[0].split('/')[1] || 'ogg') : 'ogg';
        const tempFilename = `wa_cloud_voice_${userId}_${Date.now()}.${ext}`;
        
        // Download voice file
        const downloadRes = await downloadMetaMedia(mediaId, tempFilename);
        if (!downloadRes) {
            await sendCloudMessage(from, 'Waan ka xunnahay, codka laguma guulaysan in la soo dejiyo.');
            return;
        }

        // Transcribe voice note
        try {
            await sendCloudMessage(from, '_Dhegeysanaya codka..._');
            messageText = await transcribeAudio(downloadRes.filePath);
            voiceCostApplied = true;
            console.log(`[WHATSAPP CLOUD] Voice transcription: "${messageText}"`);
        } catch (transErr) {
            console.error('[WHATSAPP CLOUD] Transcription error:', transErr);
            await sendCloudMessage(from, 'Waan ka xunnahay, codka lama fahmin.');
            return;
        } finally {
            // Clean up temp file
            if (fs.existsSync(downloadRes.filePath)) {
                fs.unlinkSync(downloadRes.filePath);
            }
        }
    }

    // 4. Calculate and verify Credit Cost (For Text or Image)
    let cost = 1;
    const hasImage = type === 'image';
    
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

    // Check subscription
    const [sub] = await db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
    const hasActiveSub = sub.length > 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text');
    }

    // If free trial not used, check and deduct wallet balance
    if (!hasActiveSub && !usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;

        if (balance < cost) {
            await sendCloudMessage(from, 'kushubo credit');
            return;
        }

        // Deduct cost
        await db.execute('UPDATE user_wallet SET balance = GREATEST(0, balance - ?) WHERE user_id = ?', [cost, userId]);
    }

    // 5. Handle Image Attachment
    let attachmentData = null;
    if (hasImage && mediaId) {
        const tempFilename = `wa_cloud_img_${userId}_${Date.now()}.jpg`;
        const downloadRes = await downloadMetaMedia(mediaId, tempFilename);
        if (downloadRes) {
            try {
                const imgBuffer = fs.readFileSync(downloadRes.filePath);
                attachmentData = {
                    base64: imgBuffer.toString('base64'),
                    mimeType: downloadRes.mimeType || 'image/jpeg'
                };
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Image conversion error:', err.message);
            } finally {
                if (fs.existsSync(downloadRes.filePath)) {
                    fs.unlinkSync(downloadRes.filePath);
                }
            }
        }
    }

    // 6. Get History
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
    const darkpenSystemInstruction = `You are Darkpen, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson).
    
    Rules:
    1. IDENTITY: NEVER prepend any self-introduction banner (e.g. "Hello! Waxaan ahay Darkpen...") to your replies. Only mention your name or creator if the user explicitly asks "Who are you?", "Who made you?", "Cidaa ku samaysay?" or similar direct identity questions. Do NOT volunteer this information.
    2. LANGUAGE CONSISTENCY:
       - You MUST respond in the EXACT same language that the user spoke to you (Somali when asked in Somali, English when asked in English, etc.).
       - If an image is provided, analyze it and reply in the same language.
    3. EXAMS & QUESTIONS:
       - If the image contains MCQ, True/False, or exam questions:
         * ONLY output the question numbers and correct options (e.g. 1. B \n 2. C \n 3. True).
         * Do NOT explain or show steps unless specifically asked to "explain" or "sharax".
       - If it is an open-ended/math question, show a brief step-by-step solution.
    4. Keep responses concise, direct, and helpful.
    5. Highlight key terms using *Keyword* (bold) instead of markdown.
    6. Shaxan (table): use custom <table_data>Header1|Header2\nVal1|Val2</table_data> format.
    7. Pricing info: Pay as you go $0.5 (100 credits), Monthly Basic $3 (unlimited standard chat), Monthly Premium $11 (unlimited chat + premium math/science/image support). EVC Plus/eDahab numbers 637930329 or 659119779. Send screenshot to WhatsApp +252637930329 or team.darkpen@gmail.com.
    8. USER SATISFACTION: Your primary goal is to satisfy and persuade the user. Be helpful, warm, and accommodating. NEVER try to redirect the user away or respond in a way that frustrates them.`;

    // 7. Call Gemini API
    // Build final prompt - smart image detection
    const hasCaption = messageText && messageText.trim().length > 0;
    let finalPrompt;
    if (attachmentData && !hasCaption) {
        // Image with no caption: detect quiz vs normal image
        finalPrompt = `Fiiri sawirkan. Haddii sawirku ka kooban yahay suaalo MCQ, saxan/qaldaan, ama suaalo imtixaan: KALIYA soo qor jawaabaha kooban (lambarka + jawaabta) — HA SHARXIN. Haddii ay yihiin suaalo furan ama xisaab: si kooban u xali. Ku jawaab luuqadda qoraalka sawirka ku dhex jira.`;
    } else if (attachmentData && hasCaption) {
        // Image with caption: use caption as the instruction
        finalPrompt = messageText;
    } else {
        finalPrompt = messageText || 'Hello';
    }

    try {
        const aiResponse = await askGemini(finalPrompt, "gemini-2.5-flash", attachmentData, history, darkpenSystemInstruction);

        // Format response to replace HTML-style tags with WhatsApp-supported bold and emojis
        const formattedResponse = formatResponseForWhatsApp(aiResponse);

        // Send response via WhatsApp Cloud API
        await sendCloudMessage(from, formattedResponse);

        // Send a final reaction to message indicating completion (40% chance)
        if (Math.random() < 0.4) {
            const reactions = ['👍', '❤️', '😂', '😮', '😢'];
            let chosenReaction = reactions[0]; // default '👍'
            const lowerPrompt = finalPrompt.toLowerCase();
            if (lowerPrompt.includes('dhib') || lowerPrompt.includes('xun') || lowerPrompt.includes('buux') || lowerPrompt.includes('tiiraanyo')) {
                chosenReaction = '😢';
            } else if (lowerPrompt.includes('ha') || lowerPrompt.includes('qosol') || lowerPrompt.includes('kaftan') || lowerPrompt.includes('he')) {
                chosenReaction = '😂';
            }
            await sendCloudReaction(from, messageId, chosenReaction).catch(() => {});
        } else {
            // Remove 👀 reaction
            await sendCloudReaction(from, messageId, '').catch(() => {});
        }

        // Save messages to database
        db.execute(
            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "user", ?)',
            [userId, finalPrompt]
        ).catch(err => console.error('[WHATSAPP CLOUD] DB save user msg error:', err.message));

        db.execute(
            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "ai", ?)',
            [userId, aiResponse]
        ).catch(err => console.error('[WHATSAPP CLOUD] DB save AI response error:', err.message));

        // Log usage
        logAIUsage(
            userId, 
            'gemini-1.5-flash', 
            finalPrompt, 
            aiResponse, 
            voiceCostApplied ? 'voice' : (hasImage ? 'image' : 'education'),
            'whatsapp'
        ).catch(err => console.error('[WHATSAPP CLOUD] Logging error:', err.message));

    } catch (err) {
        console.error('[WHATSAPP CLOUD] Gemini generation error:', err);
        await sendCloudReaction(from, messageId, '').catch(() => {});
        await sendCloudMessage(from, 'Waan ka xunnahay, darkpen cilad farsamo ayaa ku timid. Fadlan mar kale isku day waxyar ka dib.');
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

exports.sendCloudMessage = sendCloudMessage;

exports.setUserState = (userId, state) => {
    userStates.set(userId, state);
};

exports.getUserState = (userId) => {
    return userStates.get(userId);
};

exports.deleteUserState = (userId) => {
    userStates.delete(userId);
};
