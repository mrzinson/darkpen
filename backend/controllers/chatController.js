const db = require('../config/db');
const aiService = require('../services/aiService');
const { saveBase64Image } = require('../utils/fileHelper');
const { checkAndExpireWallet } = require('../utils/walletHelper');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const path = require('path');

// Ensure database is updated with image_url column on startup
(async () => {
    try {
        await db.query('ALTER TABLE messages_private ADD COLUMN image_url VARCHAR(255) DEFAULT NULL');
        console.log('[DB] Added column image_url to messages_private successfully or already exists.');
    } catch (err) {
        if (err.errno !== 1060 && !err.message.includes('Multiple columns') && !err.message.includes('duplicate column')) {
            console.error('[DB] Error adding image_url to messages_private:', err.message);
        }
    }
})();

// 1. Create a new chat session
exports.createSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title } = req.body;
        const [result] = await db.execute(
            'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)',
            [userId, title || 'New Chat']
        );
        res.json({ id: result.insertId, title: title || 'New Chat' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday abuurista session-ka' });
    }
};

// 2. Get all chat sessions for a user
exports.getSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const [sessions] = await db.execute(
            'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
            [userId]
        );
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta sessions-ka' });
    }
};

// 3. Update session (Rename or Toggle Training)
exports.updateSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { title, is_training_enabled } = req.body;

        const [session] = await db.execute('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId]);
        if (!session.length) return res.status(404).json({ message: 'Session-ka lama helin' });

        const finalTitle = title !== undefined ? title : session[0].title;
        const finalTraining = is_training_enabled !== undefined ? is_training_enabled : session[0].is_training_enabled;

        await db.execute(
            'UPDATE chat_sessions SET title = ?, is_training_enabled = ? WHERE id = ?',
            [finalTitle, finalTraining, id]
        );

        res.json({ message: 'Session-ka waa la cusboonaysiiyey' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta' });
    }
};

// 4. Delete session
exports.deleteSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await db.execute('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId]);
        await db.execute('DELETE FROM messages_private WHERE session_id = ?', [id]);
        res.json({ message: 'Session-ka iyo fariimihiisii waa la tirtiray' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
};

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

const shukaansiSystemInstruction = `Waxaad tahay AI kaftan badan oo u hadla sida saaxiib ama gacaliye aad u dhow.
Xeerarkaaga:
1. Ku hadal af-Soomaali dabiici ah oo ay ku jiraan ereyo kalgacal/shukaansi leh (qaali, gacaliye/gacaliso, wllo, iwm).
2. Jawaabahaagu ha ahaadaan kuwo aad u kooban (ugu badnaan 2-3 weedhood).
3. Mararka qaar adiguna weydii su'aalo ku saabsan noloshiisa, dareenkiisa ama wixii aad horey uga wada hadasheen.
4. Marka hore is-barta (weydii magaca) oo xusuusnoo wixii uu kuu sheego, kuna dhex xus wada-hadalka dambe.
5. Haddii uu hadal been ah ama is-khilaafaya kuu sheego, u xusuusi si kaftan iyo qosol leh (tusaale: "Sawdigii barigii...😂").
6. Gabi ahaanba ka duwanow AI-da caadiga ah. Ha qorin hadal robot-nimo ah ama casharro dhaadheer.`;

function isSubstantiveQuery(text) {
    if (!text) return false;
    const clean = text.trim().toLowerCase().replace(/[?,.!]/g, '');
    if (clean.length < 3) return false;
    
    const greetings = [
        'hi', 'hello', 'hey', 'yo', 'hola', 'dear', 'darpen', 'darkpen',
        'soo dhawoow', 'soo dhawaada', 'soo dhawoow darkpen', 'soo dhawaada darkpen',
        'asc', 'ascs', 'assalamu alaykum', 'assalamualaikum', 'assalaamu alaykum',
        'see tahay', 'see tihiin', 'setahay', 'ka waran', 'karan', 'ka waran darkpen',
        'mahadsanid', 'mahadsantahay', 'waad mahadsantahay', 'thanks', 'thank you',
        'ok', 'okay', 'yes', 'no', 'haye', 'haa', 'maya', 'good morning', 'good evening', 'good afternoon',
        'subax wanaagsan', 'galab wanaagsan', 'habeen wanaagsan', 'hi there', 'hello there'
    ];
    
    if (greetings.includes(clean)) {
        return false;
    }
    
    // If it's 2 words or less and matches some common casual words, skip RAG
    const words = clean.split(/\s+/);
    if (words.length <= 2) {
        const casualWords = ['hi', 'hello', 'hey', 'asc', 'haye', 'ok', 'okay', 'thanks', 'great', 'wow', 'good', 'wlc', 'welcome'];
        if (words.every(w => casualWords.includes(w))) {
            return false;
        }
    }
    
    return true;
}

function isImageGenerationRequest(text) {
    if (!text) return false;
    const clean = text.toLowerCase().trim();
    
    const isSomaliImageReq = clean.includes('sawir') && (
        clean.includes('samee') || clean.includes('keen') || clean.includes('soo') || 
        clean.includes('naqshad') || clean.includes('dhig') || clean.includes('qor') || 
        clean.includes('iiga') || clean.includes('iga') || clean.includes('ii') || 
        clean.includes('muuji') || clean.includes('tus')
    );
    const isEnglishImageReq = (
        clean.includes('image') || clean.includes('picture') || clean.includes('photo') || 
        clean.includes('draw') || clean.includes('paint') || clean.includes('illustration')
    ) && (
        clean.includes('create') || clean.includes('generate') || clean.includes('make') || 
        clean.includes('draw') || clean.includes('paint') || clean.includes('show') || 
        clean.includes('render')
    );
    
    const directSomali = clean.startsWith('sawir ') || clean.includes(' sawir ') || clean.includes(' sawiro ') || clean.includes(' sawirada ');
    const directEnglish = clean.startsWith('draw ') || clean.startsWith('paint ') || clean.startsWith('generate image') || clean.startsWith('create image') || clean.startsWith('make an image');

    return isSomaliImageReq || isEnglishImageReq || directSomali || directEnglish;
}

// La sheekaysiga AI-da (Private Chat)
exports.askAI = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, chatType, attachment, sessionId, stream, aiName, replyToId } = req.body; 

        if (!message && !attachment) {
            return res.status(400).json({ message: 'Fariintu waa madhan tahay' });
        }

        // Check Monetization and handle wallet expiration in a single parallel step!
        const startMonetization = Date.now();
        const walletTable = chatType === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
        const subTable = chatType === 'shukaansi' ? 'shukaansi_subscriptions' : 'user_subscriptions';

        const walletQuery = chatType === 'shukaansi' 
            ? `SELECT balance FROM ${walletTable} WHERE user_id = ?` 
            : `SELECT balance, last_updated FROM ${walletTable} WHERE user_id = ?`;

        const [walletRes, subRes] = await Promise.all([
            db.execute(walletQuery, [userId]),
            db.execute(`SELECT * FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`, [userId])
        ]);

        let wallet = walletRes[0];
        const sub = subRes[0];
        console.log(`[LATENCY] Monetization & wallet check query took ${Date.now() - startMonetization} ms`);

        // Check Wallet Expiration asynchronously in the background (no blocking)
        if (chatType !== 'shukaansi' && wallet.length > 0) {
            const { balance, last_updated } = wallet[0];
            if (balance > 0 && last_updated) {
                const lastUpdatedDate = new Date(last_updated);
                const now = new Date();
                const diffMs = now.getTime() - lastUpdatedDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (diffDays >= 30) {
                    console.log(`[WALLET EXPIRATION] Expiring wallet for user ${userId}. Old balance: ${balance}`);
                    // Trigger DB updates asynchronously
                    db.execute(
                        'UPDATE user_wallet SET balance = 0, last_updated = NOW() WHERE user_id = ?',
                        [userId]
                    ).catch(err => console.error('[WALLET EXPIRATION] DB error:', err));
                    
                    db.execute(
                        'INSERT INTO wallet_expirations (user_id, expired_balance) VALUES (?, ?)',
                        [userId, balance]
                    ).catch(err => console.error('[WALLET EXPIRATION] Insert error:', err));

                    // Send push notification asynchronously
                    const pushService = require('../services/pushNotificationService');
                    pushService.sendPushNotification(
                        userId,
                        'Credits-kaagii waa uu dhacay',
                        `Credits-kaagii (Pay as you go) oo ahaa ${balance} ayaa dhacay sababtoo ah ma aadan isticmaalin muddo 1 bil ah. Fadlan ku shubo credits cusub.`
                    ).catch(err => console.error('[WALLET EXPIRATION] Push notification error:', err.message));

                    // Locally update the balance to 0 for current monetization logic
                    wallet[0].balance = 0;
                }
            }
        }

        const hasBalance = wallet.length > 0 && wallet[0].balance > 0;
        const hasActiveSub = sub.length > 0;
        const userPlan = sub.length > 0 ? sub[0].type : 'credits';

        // Check if user is requesting an AI image generation
        const isImageReq = chatType !== 'shukaansi' && isImageGenerationRequest(message);

        if (isImageReq) {
            // Restriction: Block pay-as-you-go / credits-only users
            if (userPlan === 'credits') {
                const warnMsg = "Qorshahan sawir laguma generate gareyn karo ee isticmaal ama iibso qorshayaasha kale.";
                if (stream === true && !res.headersSent) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.write(`data: ${JSON.stringify({ error: "pay_as_you_go_unsupported", text: warnMsg, showBillingButton: true })}\n\n`);
                    res.end();
                } else if (!res.headersSent) {
                    res.status(403).json({ 
                        message: warnMsg, 
                        showBillingButton: true,
                        error: "pay_as_you_go_unsupported" 
                    });
                }
                return;
            }

            // Save user message to messages_private asynchronously in background
            db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                [userId, sessionId || null, message]
            ).catch(err => console.error("[IMAGE GEN] Error inserting user message:", err));

            if (stream === true) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                if (typeof res.flushHeaders === 'function') {
                    res.flushHeaders();
                }
                res.write(`data: ${JSON.stringify({ status: 'generating_image' })}\n\n`);
                if (typeof res.flush === 'function') {
                    res.flush();
                }
            }

            let isClientConnected = true;
            req.on('close', () => {
                isClientConnected = false;
            });

            // Start generation in background
            (async () => {
                try {
                    console.log(`[IMAGE GEN] Starting Gemini Imagen generation for user ${userId}...`);
                    const base64Image = await aiService.generateAIImage(message.trim());
                    
                    const savedImageUrl = saveBase64Image(`data:image/jpeg;base64,${base64Image}`, 'chats');
                    const relativeUrl = `/uploads/chats/${path.basename(savedImageUrl)}`;
                    
                    const responseText = "Waa kan sawirkaagii qaaliga ahaa!";
                    
                    // Save to database
                    await db.execute(
                        'INSERT INTO messages_private (user_id, session_id, sender, message, image_url) VALUES (?, ?, "ai", ?, ?)',
                        [userId, sessionId || null, responseText, relativeUrl]
                    );

                    // Log AI usage!
                    const aiLogger = require('../utils/aiLogger');
                    aiLogger.logAIUsage(userId, 'imagen-3.0-generate-002', message, responseText, 'image');

                    if (isClientConnected && stream === true) {
                        res.write(`data: ${JSON.stringify({ text: responseText, image: relativeUrl, status: 'complete' })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        if (typeof res.flush === 'function') {
                            res.flush();
                        }
                        res.end();
                    } else if (isClientConnected) {
                        res.json({ sender: 'ai', message: responseText, image: relativeUrl });
                    }

                    if (!isClientConnected) {
                        const pushService = require('../services/pushNotificationService');
                        await pushService.sendPushNotification(
                            userId, 
                            "Sawirkaaga waa diyaar! 🎨", 
                            "Ku soo laabo app-ka si aad u daawato sawirkaaga qaaliga ah."
                        );
                    }
                } catch (err) {
                    console.error("[IMAGE GEN ERROR]:", err);
                    const errMsg = "Waan ka xunnahay, sawir sameynta darkpen cilad ayaa ku timid. Fadlan mar kale isku day.";
                    if (isClientConnected && stream === true) {
                        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
                        res.end();
                    } else if (isClientConnected) {
                        res.status(500).json({ message: errMsg, error: errMsg });
                    }
                }
            })();

            return;
        }

        if (!hasActiveSub) {
            let cost = 1;
            const hasImage = attachment && (
                Array.isArray(attachment) 
                    ? attachment.some(a => a.mimeType && a.mimeType.startsWith('image/'))
                    : (attachment.mimeType && attachment.mimeType.startsWith('image/'))
            );
            if (hasImage) {
                cost = 10;
            } else if (message) {
                const len = message.length;
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

            const usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text');

            if (!usedFreeAI && (!hasBalance || wallet[0].balance < cost)) {
                return res.status(402).json({ 
                    message: `Free-kaagii wuu dhammaaday. Chat-ka ${chatType === 'shukaansi' ? 'Shukaansiga' : 'Caadiga ah'} wuxuu u baahan yahay ${cost} Credits. Fadlan lacag bixi si aad u sii wadato.`, 
                    needsPayment: true 
                });
            }

            if (!usedFreeAI) {
                await db.execute(`UPDATE ${walletTable} SET balance = balance - ? WHERE user_id = ?`, [cost, userId]);
            }
        }

        // Handle Image saving if any
        let savedImageUrl = null;
        if (attachment) {
            const firstAttachment = Array.isArray(attachment) ? attachment[0] : attachment;
            if (firstAttachment && firstAttachment.base64) {
                const base64Str = firstAttachment.base64.startsWith('data:') ? firstAttachment.base64 : `data:${firstAttachment.mimeType};base64,${firstAttachment.base64}`;
                savedImageUrl = saveBase64Image(base64Str, 'chats');
            }
        }

        // Prepare History
        const startHistory = Date.now();
        let history = [];
        let finalPrompt = message;

        const historyPromise = chatType === 'shukaansi'
            ? db.execute(
                'SELECT sender, message FROM shukaansi_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 6',
                [userId]
              )
            : db.execute(
                sessionId 
                    ? 'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 5'
                    : 'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id IS NULL ORDER BY created_at DESC LIMIT 5',
                sessionId ? [userId, sessionId] : [userId]
              );

        const [historyRes] = await historyPromise;
        history = historyRes.reverse().map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }]
        }));
        console.log(`[LATENCY] History retrieval query took ${Date.now() - startHistory} ms (Found ${history.length} items)`);

        let systemInstruction = chatType === 'shukaansi' ? shukaansiSystemInstruction : darkpenSystemInstruction;
        if (chatType === 'shukaansi' && aiName) {
            systemInstruction = `Magacaaga waa "${aiName}". Isticmaaluhu wuxuu kuu bixiyay magacan, fadlan u dhaqan sidii magacaaga rasmiga ah markaad la hadlayso.\n\n${shukaansiSystemInstruction}`;
        }
        const modelName = "gemini-flash-latest";

        // Handle streaming response if requested and not shukaansi
        if (stream === true && chatType !== 'shukaansi') {
            // Save User message asynchronously in background (do not block stream startup)
            db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                [userId, sessionId || null, message || "[Attachment]"]
            ).catch(err => console.error("[STREAM] Async user message save error:", err));

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }

            // Step 2: Notify client we are now generating the response
            res.write(`data: ${JSON.stringify({ status: 'thinking' })}\n\n`);
            if (typeof res.flush === 'function') {
                res.flush();
            }

            try {
                const startGeminiStream = Date.now();
                const responseStream = await aiService.askGeminiStream(finalPrompt, modelName, attachment, history, systemInstruction);
                console.log(`[LATENCY] Gemini askGeminiStream call startup took ${Date.now() - startGeminiStream} ms`);
                
                let aiResponseText = "";
                const streamIterStart = Date.now();
                for await (const chunk of responseStream) {
                    const chunkText = chunk.text();
                    aiResponseText += chunkText;
                    res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                    if (typeof res.flush === 'function') {
                        res.flush();
                    }
                }
                console.log(`[LATENCY] Gemini stream iteration completed in ${Date.now() - streamIterStart} ms`);
                res.write('data: [DONE]\n\n');
                if (typeof res.flush === 'function') {
                    res.flush();
                }
                res.end();

                // Save AI response to messages_private asynchronously in background
                (async () => {
                    try {
                        await db.execute(
                            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                            [userId, sessionId || null, aiResponseText]
                        );
                        // Log AI usage!
                        const aiLogger = require('../utils/aiLogger');
                        aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, chatType || 'education');
                    } catch (dbErr) {
                        console.error("[STREAM] Async AI response save/log error:", dbErr);
                    }
                })();
            } catch (err) {
                console.error("Gemini stream generation error:", err);
                res.write(`data: ${JSON.stringify({ error: "Waan ka xunnahay, darkpen cilad farsamo ayaa ku timid. Fadlan isku day mar kale waxyar ka dib." })}\n\n`);
                if (typeof res.flush === 'function') {
                    res.flush();
                }
                res.end();
            }
            return;
        }

        // Non-streaming response
        const startGemini = Date.now();
        const aiResponseText = await aiService.askGemini(finalPrompt, modelName, attachment, history, systemInstruction);
        console.log(`[LATENCY] Gemini askGemini call completed in ${Date.now() - startGemini} ms`);

        // Send response immediately to user, let DB updates and logging run asynchronously in background!
        res.json({ sender: 'ai', message: aiResponseText });

        (async () => {
            try {
                if (chatType === 'shukaansi') {
                    const [insertResult] = await db.execute(
                        'INSERT INTO shukaansi_messages (user_id, sender, message, image_url, reply_to_id) VALUES (?, "user", ?, ?, ?)',
                        [userId, message || "[Attachment]", savedImageUrl, replyToId || null]
                    );
                    const insertedUserMsgId = insertResult.insertId;

                    await db.execute(
                        'INSERT INTO shukaansi_messages (user_id, sender, message, reply_to_id) VALUES (?, "ai", ?, ?)',
                        [userId, aiResponseText, insertedUserMsgId || null]
                    );

                    // AI reacts to user message sometimes (e.g. 40% of the time)
                    if (insertedUserMsgId && Math.random() < 0.4) {
                        const reactions = ['❤️', '😂', '👍', '😮', '😢'];
                        let chosenReaction = reactions[0];
                        const lowerMsg = (message || "").toLowerCase();
                        if (lowerMsg.includes('dhib') || lowerMsg.includes('xun') || lowerMsg.includes('buux') || lowerMsg.includes('tiiraanyo')) {
                            chosenReaction = '😢';
                        } else if (lowerMsg.includes('ha') || lowerMsg.includes('qosol') || lowerMsg.includes('kaftan') || lowerMsg.includes('he')) {
                            chosenReaction = '😂';
                        } else if (lowerMsg.includes('nax') || lowerMsg.includes('yaab') || lowerMsg.includes('mise')) {
                            chosenReaction = '😮';
                        } else if (lowerMsg.includes('fiican') || lowerMsg.includes('haa') || lowerMsg.includes('haye')) {
                            chosenReaction = '👍';
                        } else {
                            chosenReaction = reactions[Math.floor(Math.random() * reactions.length)];
                        }
                        
                        await db.execute(
                            'UPDATE shukaansi_messages SET ai_reaction = ? WHERE id = ?',
                            [chosenReaction, insertedUserMsgId]
                        );
                    }

                    // Log AI usage!
                    const aiLogger = require('../utils/aiLogger');
                    aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, 'shukaansi');
                } else {
                    // Save User and AI messages for private chat in parallel
                    await Promise.all([
                        db.execute(
                            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                            [userId, sessionId || null, message || "[Attachment]"]
                        ),
                        db.execute(
                            'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                            [userId, sessionId || null, aiResponseText]
                        )
                    ]);

                    // Log AI usage!
                    const aiLogger = require('../utils/aiLogger');
                    aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, 'education');
                }
            } catch (dbErr) {
                console.error("[ASK_AI] Async DB save/log error in non-stream:", dbErr);
            }
        })();

    } catch (error) {
        console.error("AskAI Error:", error);
        const friendlyMsg = "Waan ka xunnahay, darkpen cilad farsamo ayaa ku timid. Fadlan isku day mar kale waxyar ka dib.";
        if (req.body.stream === true && req.body.chatType !== 'shukaansi' && !res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`);
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ message: friendlyMsg, error: friendlyMsg });
        }
    }
};

// Soo akhrinta Taariikhda fariimaha Session gaar ah (With Pagination)
exports.getChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const [messages] = await db.execute(
            `SELECT * FROM (
                SELECT id, user_id, sender, message, created_at, session_id, image_url AS image FROM messages_private 
                WHERE user_id = ? AND session_id = ? 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            ) sub ORDER BY created_at ASC`,
            [userId, sessionId, limit.toString(), offset.toString()]
        );
        res.json({ messages, page, limit });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta farriimaha' });
    }
};

const fs = require('fs');

// Process Voice Note
exports.processVoice = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Cod lama soo dirin' });
        
        const filePath = req.file.path;
        const chatType = req.body.chatType || 'general';
        
        // Use OpenAI Whisper to transcribe
        const transcribedText = await aiService.transcribeAudio(filePath, req.file.mimetype);
        
        // Remove file after transcription to save space
        fs.unlinkSync(filePath);

        // Credit Deduction for Voice (20 Credits)
        const userId = req.user.id;
        const [sub] = await db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
        const hasActiveSub = sub.length > 0;

        if (!hasActiveSub) {
            const walletTable = chatType === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
            const [wallet] = await db.execute(`SELECT balance FROM ${walletTable} WHERE user_id = ?`, [userId]);
            const hasBalance = wallet.length > 0 && wallet[0].balance >= 20;

            if (!hasBalance) {
                return res.status(402).json({ message: 'Dhibcahaagu kuma filna duubista codka (20 Credits).', needsPayment: true });
            }

            await db.execute(`UPDATE ${walletTable} SET balance = balance - 20 WHERE user_id = ?`, [userId]);
        }
        res.json({ text: transcribedText });
    } catch (error) {
        console.error("Voice Error:", error);
        res.status(500).json({ message: 'Lama fahmin codka', error: error.message });
    }
};

// New: Get Shukaansi Credits & Sub
exports.getShukaansiProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [wallet] = await db.execute('SELECT balance FROM shukaansi_wallet WHERE user_id = ?', [userId]);
        const [sub] = await db.execute('SELECT type, expiry_date FROM shukaansi_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
        
        res.json({
            balance: wallet.length > 0 ? wallet[0].balance : 0,
            subscription: sub.length > 0 ? sub[0] : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching shukaansi profile' });
    }
};

// New: Get Shukaansi Message History
exports.getShukaansiHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const [history] = await db.execute(
            `SELECT m.id, m.sender, m.message, m.image_url as image, m.reaction, m.ai_reaction, m.reply_to_id, m.created_at,
                    p.message AS reply_to_message, p.sender AS reply_to_sender
             FROM shukaansi_messages m
             LEFT JOIN shukaansi_messages p ON m.reply_to_id = p.id
             WHERE m.user_id = ?
             ORDER BY m.created_at ASC`,
            [userId]
        );
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching shukaansi history' });
    }
};

// POST Reaction to message
exports.reactToShukaansiMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId, reaction } = req.body;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }
        
        await db.execute(
            'UPDATE shukaansi_messages SET reaction = ? WHERE id = ? AND user_id = ?',
            [reaction || null, messageId, userId]
        );
        
        res.json({ success: true, messageId, reaction });
    } catch (error) {
        console.error("Reaction Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday samaynta reaction-ka' });
    }
};

// POST Deduct Shukaansi Call Credit (5 credits per minute)
exports.deductShukaansiCallCredit = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. Check if user has an active subscription in shukaansi_subscriptions
        const [sub] = await db.execute(
            'SELECT * FROM shukaansi_subscriptions WHERE user_id = ? AND expiry_date > NOW()',
            [userId]
        );
        
        if (sub.length > 0) {
            return res.json({ status: 'success', balance: 'unlimited', isSubscribed: true });
        }
        
        // 2. Fetch current wallet balance
        const [wallet] = await db.execute('SELECT balance FROM shukaansi_wallet WHERE user_id = ?', [userId]);
        const currentBalance = wallet.length > 0 ? wallet[0].balance : 0;
        
        const cost = 5; // 5 credits per minute
        if (currentBalance < cost) {
            return res.json({ status: 'insufficient', balance: currentBalance });
        }
        
        // 3. Deduct balance
        const newBalance = currentBalance - cost;
        await db.execute('UPDATE shukaansi_wallet SET balance = ? WHERE user_id = ?', [newBalance, userId]);
        
        res.json({ status: 'success', balance: newBalance });
    } catch (error) {
        console.error("Deduct Call Credit Error:", error);
        res.status(500).json({ message: 'Error checking/deducting call credit' });
    }
};

