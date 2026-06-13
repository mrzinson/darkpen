const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber } = require('./verificationService');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');

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
        await sendCloudMessage(from, `numberkan ( ${from} ) kama diwaan gashana appka isa soo diwaan gali markaas igu soo noqo`);
        return;
    }

    const user = users[0];

    // If user is suspended, ignore
    if (user.is_suspended) {
        console.log(`[WHATSAPP CLOUD] User ${user.name} (${normalizedPhone}) is suspended. Ignoring.`);
        return;
    }

    const userId = user.id;

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

                await sendCloudMessage(
                    from, 
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
    if (!usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;

        if (balance < cost) {
            await sendCloudMessage(from, 'kushubo credit');
            return;
        }

        // Deduct cost
        await db.execute('UPDATE user_wallet SET balance = balance - ? WHERE user_id = ?', [cost, userId]);
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

    // 7. Call Gemini API
    try {
        const finalPrompt = messageText || 'Fadlan sharax sawirkan';
        const aiResponse = await askGemini(finalPrompt, "gemini-flash-latest", attachmentData, history, darkpenSystemInstruction);

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
            voiceCostApplied ? 'voice' : (hasImage ? 'image' : 'education')
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
    
    // Format <table_data>content</table_data>
    formatted = formatted.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (match, tableContent) => {
        const lines = tableContent.trim().split('\n');
        const formattedTable = lines.map(line => {
            const columns = line.split('|');
            return columns.map(col => `*${col.trim()}*`).join('  |  ');
        }).join('\n');
        return `\n*Shaxda:*\n------------------\n${formattedTable}\n------------------\n`;
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
