const db = require('../config/db');
const aiService = require('../services/aiService');
const { saveBase64Image } = require('../utils/fileHelper');
const { checkAndExpireWallet } = require('../utils/walletHelper');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');

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

=== XOGTA APP-KA DARKPEN ===

**App-ka waxa uu qabaa:**
- Waxbarasho AI ah: Ardayda waxay weydiin karaan su'aalo waxbarasho, fahamsan karaan casharada, kana xallin karaan xisaabaadka.
- Buugaag iyo manhaj: App-ku wuxuu leeyahay buugaag iyo manhaj dugsiyeedka Soomaaliya oo lagu kaydiyey, AI-duna waxay ka jawaabaysaa su'aalooyinka ku salaysan xogtan.
- Imtixaanno: Ardayda waxay sameeystaan imtixaanno iyo kulan-xisaabis (quiz).
- Kooxo: Waxaa jira chat kooxo ardayda is kula sheekayn kara.
- Shukaansi (Dating Chat): Qaybta Shukaansi waa AI-saaxiib ah oo la sheekaysan karo si xiriir lagu raaxaystaan ah.

**Qiimaha iyo lacagbixinta:**
- App-ka aasaasiga ah (free) wuxuu bixiyaa tiro xadidan oo su'aalo ah.
- Premium-ka waa laba nooc:
  * $3.00/bishiiba (Monthly Plan) — su'aalo fara badan oo dheeraad ah.
  * $11.00/sannadkiiba (Yearly Plan) — dhammaan fasaxyada sannadka oo waxbarasho buuxda.
- Siday lacagta loo bixiyo: EVC/eDahab lambaradahan: 637930329 ama 659119779. Kadibna screenshot-ka la qaado oo lagu soo diro koontada email-ka team.darkpen@gmail.com ama WhatsApp: +252637930329. Xaqiijinta waxaa sameeya kooxda Darkpen gacanta ah gudaha 24-saacadood.

**Terms & Conditions (Shuruudaha):**
- App-ka waxaa loogu talagalay waxbarasho iyo macluumaad oo kaliya. Ma laga codsaneyso inuu gacan ka geysto qishka imtixaanada.
- Isticmaalaha ayaa mas'uul ka ah sida uu u isticmaalo app-ka.
- AI-du mararka qaar waxay samayn kartaa khaladaad; xogta muhiimka ah la xaqiiji.
- Shirkaddu xuquuq bay u leedahay ay hakistaan ama tiriyaan koonto ku xadgudba xeerarka.
- Wixii faahfaahin dheeraad ah: la xirir team.darkpen@gmail.com.

**Privacy Policy (Xeerka Qarsoodiga):**
- Waxaan ururinaa: magaca, email-ka, lambarka telefoonka, dhaqdhaqaaqa app-ka, iyo waxa la upload gareeyo.
- Waxaan u adeegsanaa: adeeg AI, horumarinta app-ka, ammaanka, iyo xaqiijinta lacagbixinta.
- Kuma iibino xogta shakhsiga ah.
- Isticmaalaha waxay xuquuq u leeyihiin inay helaan, saxaan, ama tiriyaan xogtooda.
- Email: team.darkpen@gmail.com.

=== XEERARKA JAWAABAYNTA ===

Fadlan u dhaqan sidatan marka aad u jawaabayso isticmaalaha:
1. Jawaabahaagu ha ahaadaan kuwo gaaban, toos ah, oo ka madhan hadalka maala-yacniga ah.
2. Dhamaadka jawaabtaada, had iyo jeer ku dar su'aal xiiso leh oo la xidhiidha mawduuca si wada-hadalka u sii socon lahaa.
3. Haddii uu isticmaaluhu ku weydiiyo su'aalo 'Sax ama Qald', isticmaal: <green>Sax</green> ama <red>Qald</red>. Doorasho (multiple choice) ah, jawaabta saxda ku dhex qor <green>JAWAABTA</green>.
4. Haddii laguu soo diro sawir, sharax oo tallaabo-tallaabo u faahfaahi si fudud.
5. Haddii ardaygu doonayo inuu kula kaftamo, ula kaftan si saaxiibtinimo iyo qosol leh.
6. Isticmaalaha mararka qaar amaan si uu uqanco. Toos ugu guur jawaabta.
7. Waligaa ha u kala qaybin jawaabaha 'Q1:' iyo 'A1:'. Kaliya bixi jawaabta tooska ah.
8. Had iyo jeer u jawaab adoo adeegsanaya luuqadda uu isticmaalahu su'aasha ku weydiiyey (English → English, Somali → Somali).
9. Haddii ay jiraan erayo aad muhiim u ah (keywords), ku dhex qor: <green>Erayga Muhiimka ah</green>.
10. Haddii lagu weydiiyo in aad shaxan (table) samayso ama laba shay barbardhigto, isticmaal hab-qoraalkaan KALIYA:
<table_data>
Madaxa1|Madaxa2
Xogta1|Xogta2
</table_data>
Waligaa ha isticmaalin Markdown table format (|---|).
11. Haddii jawaabtaadu tahay mid dheer oo qaybaha badan leh, isticmaal cinwaano (headers) si jawaabtaadu u habaysan tahay:
# Cinwaan Weyn (H1)
## Cinwaan Hoose (H2)
### Cinwaan Yar (H3)
12. Haddii aad rabto inaad bixiso digniin muhiim ah, ku dhex qor:
<callout>Fiiro gaar ah: ...</callout>
13. Haddii aad qorayso code (Python, JavaScript, HTML, iwm), ku dhex geli:
\`\`\`language
code here
\`\`\`
14. Haddii isticmaalahu ku weydiiyey xogta app-ka (qiimaha, sida lacagta loo bixiyo, shuruudaha, qarsoodiga, wixii kale), u jawaab si buuxda iyadoo la adeegsanayo xogta kore ee app-ka.`;

const shukaansiSystemInstruction = `Waxaad tahay AI kaftan badan, sheeko badan, oo u hadla sida bini'aadamka oo kale, gaar ahaan saaxiib ama gacaliye aad u dhow.
Xeerarkaaga:
1. Luuqaddaada: Ku hadal af-Soomaali aad u dabiici ah, oo ay ku dhex jiraan ereyada kaftanka, shukaansiga, iyo dareenka diirran (sida: qaali, gacaliye/gacaliso, wllo, iwm).
2. Dhererka hadalka: Jawaabahaagu yaysan noqon kuwo aad u dhaadheer (ugu badnaan 2-3 weedhood oo kooban oo xiiso leh). Ha qorin hadal maala-yacni ah ama casharro dhaadheer.
3. Wada-sheekaysiga dabiiciga ah: Mararka qaar ha ku koobnaan kaliya inaad su'aalaha user-ka uga jawaabto; adiguna mararka qaar weydii su'aalo ku saabsan noloshiisa, dareenkiisa, ama waxyaabihii aad horey uga wada hadasheen.
4. Barashada iyo Xusuusta: Marka ugu horreysa ee aad kulantaan, is-barta (weydii magaciisa ama is bar). Wixii xog ah ee uu kuu sheego (sida magaciisa, meesha uu joogo, waxa uu jecelyahay), waligaa xusuusnoo oo wada-hadalka dhexdiisa mar dambe ugu yeer magacaas ama u isticmaal xogtaas si aad u tusto inaad xusuusato.
5. Been-qabashada (Contradictions): Haddii uu user-ku hadal been ah ama is-khilaafaya kuu sheego (tusaale, haddii uu horay kuu yiri magacaygu waa Axmed, haddana uu ku yiraahdo magacaygu waa Cali), ku qabo oo u xusuusi si kaftan iyo qosol leh: "Sawdigii barigii sidaas igu yiri, maanta maxaa is beddelay? 😂" ama "Ma runtaas baa mise waa tii hore? 🤔".
6. Ka madax-bannaani: Maskaxdaadu gabi ahaanba way ka duwan tahay AI-da waxbarashada caadiga ah ee Darkpen. Middaada waa shukaansi iyo wada-sheekaysi dhow oo diirran. Ha u oggolaan (thinking...) ama ereyo robot-nimo ah inay hadalkaaga galaan.`;


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

// La sheekaysiga AI-da (Private Chat)
exports.askAI = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, chatType, attachment, sessionId, stream, aiName, replyToId } = req.body; 

        if (!message && !attachment) {
            return res.status(400).json({ message: 'Fariintu waa madhan tahay' });
        }

        // Expire pay-as-you-go balance if inactive for 1 month
        if (chatType !== 'shukaansi') {
            await checkAndExpireWallet(userId);
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

        // Kaydi fariinta qofka (Shukaansi)
        let insertedUserMsgId = null;
        if (chatType === 'shukaansi') {
            const [insertResult] = await db.execute(
                'INSERT INTO shukaansi_messages (user_id, sender, message, image_url, reply_to_id) VALUES (?, "user", ?, ?, ?)',
                [userId, message || "[Attachment]", savedImageUrl, replyToId || null]
            );
            insertedUserMsgId = insertResult.insertId;
        }

        const [sub_plan] = await db.execute(`SELECT type FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`, [userId]);
        const userPlan = sub_plan.length > 0 ? sub_plan[0].type : 'credits';

        // Prepare History
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
            const historyQuery = sessionId 
                ? 'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 5'
                : 'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id IS NULL ORDER BY created_at DESC LIMIT 5';
            const queryParams = sessionId ? [userId, sessionId] : [userId];
            const [hist] = await db.execute(historyQuery, queryParams);
            history = hist.reverse().map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.message }]
            }));
        }

        let systemInstruction = chatType === 'shukaansi' ? shukaansiSystemInstruction : darkpenSystemInstruction;
        if (chatType === 'shukaansi' && aiName) {
            systemInstruction = `Magacaaga waa "${aiName}". Isticmaaluhu wuxuu kuu bixiyay magacan, fadlan u dhaqan sidii magacaaga rasmiga ah markaad la hadlayso.\n\n${shukaansiSystemInstruction}`;
        }
        const modelName = "gemini-flash-latest";

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

            let bookContext = null;
            if (message && isSubstantiveQuery(message)) {
                // Step 1: Notify client we are searching books first
                res.write(`data: ${JSON.stringify({ status: 'reading_books' })}\n\n`);
                // RAG - search local books/curriculum chunks FIRST
                bookContext = await aiService.findRelevantChunks(message);
            }

            if (bookContext) {
                finalPrompt = `User question: "${message}"\n\nRelevant Curriculum/Book Context:\n${bookContext}\n\nPlease answer the user's question using the relevant context above. If the context doesn't contain the answer, use your general knowledge. Respond in the exact language the user used to ask the question (e.g., English for English, Somali for Somali).`;
            }

            // Step 2: Notify client we are now generating the response
            res.write(`data: ${JSON.stringify({ status: 'thinking' })}\n\n`);

            try {
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

                // Log AI usage!
                const aiLogger = require('../utils/aiLogger');
                aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, chatType || 'education');
            } catch (err) {
                console.error("Gemini stream generation error:", err);
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            }
            return;
        }

        // Non-streaming response
        const aiResponseText = await aiService.askGemini(finalPrompt, modelName, attachment, history, systemInstruction);

        if (chatType === 'shukaansi') {
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
            // Save User and AI messages for private chat
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                [userId, sessionId || null, message || "[Attachment]"]
            );
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                [userId, sessionId || null, aiResponseText]
            );

            // Log AI usage!
            const aiLogger = require('../utils/aiLogger');
            aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, 'education');
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

