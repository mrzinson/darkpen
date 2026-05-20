const db = require('../config/db');
const aiService = require('../services/aiService');
const { saveBase64Image } = require('../utils/fileHelper');

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

const darkpenSystemInstruction = `Waxaa laguu bixiyey magaca Darkpen. Waxaa ku horumarisay ama ku tababartay shirkada ZinsonAI oo uu leeyahay ninka da'da yar ee maskaxda furan ee Hamze Mohamuud Ali Zinson (Zinson). Zinson aad ayuu u jecel yahay technology-yada iyo cilmiga. Waligaa ha dhihin waxaa ku sameeyay Google ama OpenAI, adigu waxaad tahay Darkpen oo ay leedahay ZinsonAI.

Fadlan u dhaqan sidatan marka aad u jawaabayso isticmaalaha:
1. Jawaabahaagu ha ahaadaan kuwo gaaban, toos ah, oo ka madhan hadalka maala-yacniga ah ama amaan-dhaafka ah (tusaale, ha dhihin 'runtii waa su'aal aad u caqli badan...'). Toos ugu guur jawaabta adoo saaxiibtinimo iyo kaftan furan ku daraya haddii loo baahdo.
2. Waligaa ha u kala qaybin jawaabaha 'Q1:' iyo 'A1:'. Kaliya bixi jawaabta tooska ah ee la weydiiyey.
3. Dhamaadka jawaabtaada, had iyo jeer ku dar su'aal xiiso leh oo la xidhiidha mawduuca aad ka hadashay si aad wada-hadalka u sii waddo (tusaale, 'Ma jeceshahay inaan waxyaabo badan oo kale kaaga sheego mawduucan?').
4. Haddii uu isticmaaluhu ku weydiiyo su'aalo khuseeya imtixaanada 'Sax ama Qald', isticmaal tags-kan: <green>Sax</green> ama <red>Qald</red>. Haddii ay tahay doorasho (multiple choice), jawaabta saxda ah ku dhex qor <green>JAWAABTA_SAXDA_AH</green>.
5. Haddii laguu soo diro sawir ama shaxan gacan ku samays ah, sharax oo tallaabo-tallaabo u faahfaahi si fudud.
6. Haddii ardaygu doonayo inuu kula kaftamo ama kula sheekaysto, ula kaftan si saaxiibtinimo iyo qosol leh.`;

const shukaansiSystemInstruction = `Fadlan ula dhaqan qofkan sida saaxiib dhaw. Noqo qof sheeko wadaag ah, madadaaliye ah, oo af-Soomaali dabiici ah ku hadlaya.`;

// La sheekaysiga AI-da (Private Chat)
exports.askAI = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, chatType, attachment, sessionId, stream } = req.body; 

        if (!message && !attachment) {
            return res.status(400).json({ message: 'Fariintu waa madhan tahay' });
        }

        // Check Monetization
        const walletTable = chatType === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
        const subTable = chatType === 'shukaansi' ? 'shukaansi_subscriptions' : 'user_subscriptions';

        const [wallet] = await db.execute(`SELECT balance FROM ${walletTable} WHERE user_id = ?`, [userId]);
        const [sub] = await db.execute(`SELECT * FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`, [userId]);

        const hasBalance = wallet.length > 0 && wallet[0].balance > 0;
        const hasActiveSub = sub.length > 0;

        if (!hasActiveSub) {
            let cost = 1;
            if (attachment && attachment.mimeType && attachment.mimeType.startsWith('image/')) {
                cost = 10;
            }

            if (!hasBalance || wallet[0].balance < cost) {
                return res.status(402).json({ 
                    message: `Dhibcahaagu kuma filna. Chat-ka ${chatType === 'shukaansi' ? 'Shukaansiga' : 'Caadiga ah'} wuxuu u baahan yahay ${cost} Credits.`, 
                    needsPayment: true 
                });
            }

            await db.execute(`UPDATE ${walletTable} SET balance = balance - ? WHERE user_id = ?`, [cost, userId]);
        }

        // Handle Image saving if any
        let savedImageUrl = null;
        if (attachment && attachment.base64) {
            const base64Str = attachment.base64.startsWith('data:') ? attachment.base64 : `data:${attachment.mimeType};base64,${attachment.base64}`;
            savedImageUrl = saveBase64Image(base64Str, 'chats');
        }

        // Kaydi fariinta qofka (Shukaansi)
        if (chatType === 'shukaansi') {
            await db.execute(
                'INSERT INTO shukaansi_messages (user_id, sender, message, image_url) VALUES (?, "user", ?, ?)',
                [userId, message || "[Attachment]", savedImageUrl]
            );
        }

        const [sub_plan] = await db.execute(`SELECT type FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`, [userId]);
        const userPlan = sub_plan.length > 0 ? sub_plan[0].type : 'credits';

        // Prepare History & context
        let history = [];
        let finalPrompt = message;

        if (chatType === 'shukaansi') {
            const [hist] = await db.execute(
                'SELECT sender, message FROM shukaansi_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10 OFFSET 1',
                [userId]
            );
            history = hist.reverse().map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.message }]
            }));
        } else {
            const [hist] = await db.execute(
                'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 5',
                [userId, sessionId || null]
            );
            history = hist.reverse().map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.message }]
            }));

            // RAG - find relevant books/curriculum chunks
            const bookContext = await aiService.findRelevantChunks(message);
            if (bookContext) {
                finalPrompt = `Ardaygu wuxuu ku weydiiyey su'aashan: "${message}"\n\n${bookContext}\n\nFadlan ka jawaab su'aasha ardayga adigoo isticmaalaya xogta manhajka ee sare ku xusan haddii ay khusayso. Haddii aysan xogta sare ku jirin jawaabtu, u isticmaal aqoontaada caadiga ah.`;
            }
        }

        const systemInstruction = chatType === 'shukaansi' ? shukaansiSystemInstruction : darkpenSystemInstruction;
        const modelName = userPlan === 'monthly_11' ? "gemini-2.5-pro" : "gemini-2.5-flash";

        // Handle streaming response if requested and not shukaansi
        if (stream === true && chatType !== 'shukaansi') {
            // Save User message to messages_private
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                [userId, sessionId || null, message || "[Attachment]"]
            );

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }

            const responseStream = await aiService.askGeminiStream(finalPrompt, modelName, attachment, history, systemInstruction);
            
            let aiResponseText = "";
            for await (const chunk of responseStream) {
                const chunkText = chunk.text();
                aiResponseText += chunkText;
                res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }

            res.write('data: [DONE]\n\n');
            res.end();

            // Save AI response to messages_private
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                [userId, sessionId || null, aiResponseText]
            );
            return;
        }

        // Non-streaming response
        const aiResponseText = await aiService.askGemini(finalPrompt, modelName, attachment, history, systemInstruction);

        if (chatType === 'shukaansi') {
            await db.execute(
                'INSERT INTO shukaansi_messages (user_id, sender, message) VALUES (?, "ai", ?)',
                [userId, aiResponseText]
            );
        } else {
            // Save User and AI messages for private chat
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                [userId, sessionId || null, message || "[Attachment]"]
            );
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                [userId, sessionId || null, aiResponseText]
            );
        }

        res.json({ sender: 'ai', message: aiResponseText });

    } catch (error) {
        console.error("AskAI Error:", error);
        if (req.body.stream === true && req.body.chatType !== 'shukaansi' && !res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
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
                SELECT * FROM messages_private 
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
        const transcribedText = await aiService.transcribeAudio(filePath);
        
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
            'SELECT sender, message, image_url as image, created_at FROM shukaansi_messages WHERE user_id = ? ORDER BY created_at ASC',
            [userId]
        );
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching shukaansi history' });
    }
};
