const db = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateQuiz = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Check if user is suspended from the tournament
        const [userRow] = await db.execute('SELECT is_suspended_from_tournament, tournament_opt_in FROM users WHERE id = ?', [userId]);
        if (userRow.length === 0) {
            return res.status(404).json({ message: 'User-ka lama helin' });
        }
        if (userRow[0].is_suspended_from_tournament) {
            return res.status(403).json({ message: 'Waan ka xunnahay, koontadaada waxaa laga joojiyey ka qayb galka tartanka. Fadlan la xiriir maamulka.' });
        }

        // 2. Check 24-hour limit on quiz attempts
        const [attempts] = await db.execute(
            'SELECT created_at FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (attempts.length > 0) {
            const lastAttemptTime = new Date(attempts[0].created_at).getTime();
            const now = Date.now();
            const diffMs = now - lastAttemptTime;
            const limitMs = 24 * 60 * 60 * 1000; // 24 hours

            if (diffMs < limitMs) {
                const secondsRemaining = Math.ceil((limitMs - diffMs) / 1000);
                return res.status(400).json({
                    status: 'locked',
                    seconds_remaining: secondsRemaining,
                    message: 'Hore ayaad u gashay tartanka maanta. Waxaad geli kartaa 24 saac kadib isku-daygaagii hore.'
                });
            }
        }

        // 3. Check Monetization: 5 Days Free, then 30 credits
        const [attemptsCount] = await db.execute('SELECT COUNT(*) as total FROM quiz_attempts WHERE user_id = ?', [userId]);
        const totalAttempts = attemptsCount[0].total;

        if (totalAttempts >= 5) {
            // Costs 30 credits
            const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
            const balance = wallet.length > 0 ? wallet[0].balance : 0;

            if (balance < 30) {
                return res.status(402).json({
                    status: 'insufficient_credits',
                    message: 'Waan ka xunnahay, 5-tii maalmood ee lacag la\'aanta (free) ahayd way kuu dhammaadeen. Tartanka maanta wuxuu u baahan yahay 30 Credits. Fadlan ku shubo credits si aad u sii wadato!'
                });
            }

            // Deduct 30 credits
            await db.execute('UPDATE user_wallet SET balance = balance - 30 WHERE user_id = ?', [userId]);
        }

        // 4. Generate 10-subject multilingual questions via Gemini
        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            generationConfig: { responseMimeType: "application/json" }
        });

        // Pull some educational chunks for context if available to ground questions
        const [rows] = await db.execute('SELECT chunk_text FROM book_embeddings ORDER BY RAND() LIMIT 5');
        const contextText = rows.map(r => r.chunk_text).join("\n\n");

        const prompt = `Based on Somalian and Somaliland secondary school curriculum topics, generate a high-quality educational quiz containing exactly 10 questions.
        Each question must belong to a specific subject and be written in its corresponding academic instruction language as defined below:

        1. Tarbiyada (Islamic Studies) -> Written in ARABIC. Format: multiple-choice.
        2. Arabic Language -> Written in ARABIC. Format: multiple-choice.
        3. Somali Language -> Written in SOMALI. Format: multiple-choice.
        4. Physics -> Written in ENGLISH. Format: multiple-choice.
        5. Chemistry -> Written in ENGLISH. Format: multiple-choice.
        6. Biology -> Written in ENGLISH. Format: multiple-choice.
        7. History -> Written in ENGLISH. Format: multiple-choice.
        8. Geography -> Written in ENGLISH. Format: multiple-choice.
        9. English Language -> Written in ENGLISH. Format: multiple-choice.
        10. Mathematics -> Written in ENGLISH. Format: structured/short-answer (an analytical/critical-thinking math problem, NOT multiple choice).

        Textbook context to inspire the questions:
        ${contextText}

        All multiple-choice questions must have exactly 4 options and 1 correct answer (index 0-3).
        The Mathematics question must be a structured question with NO options, where the correct "answer" is a short text or number.

        Return a strict JSON object with this format:
        {
          "questions": [
            {
              "subject": "Tarbiyada",
              "type": "multiple-choice",
              "question": "...",
              "options": ["...", "...", "...", "..."],
              "answer": 0
            },
            ...
            {
              "subject": "Mathematics",
              "type": "structured",
              "question": "An analytical math word problem...",
              "answer": "15"
            }
          ]
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text().trim();
        const quizData = JSON.parse(responseText);

        res.json({
            status: 'success',
            opted_in: userRow[0].tournament_opt_in,
            free_attempts_used: totalAttempts,
            questions: quizData.questions
        });

    } catch (error) {
        console.error("Quiz Generation Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo saarista quiska' });
    }
};

exports.optIn = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.execute('UPDATE users SET tournament_opt_in = 1 WHERE id = ?', [userId]);
        res.json({
            status: 'success',
            message: 'Hambalyo! Waxaad si guul leh ugu biirtay Tartanka Qaran ee Billaha ah.'
        });
    } catch (error) {
        console.error("Opt-in Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray ka biirista tartanka' });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const userId = req.user.id;
        const { score } = req.body;

        if (score === undefined || score < 0 || score > 10) {
            return res.status(400).json({ message: 'Score-ku waa inuu u dhaxeeyo 0 iyo 10' });
        }

        // 1 correct answer = 10 XP
        const xpEarned = score * 10;

        // Check if opted in to save XP. Even if not opted in, attempt is recorded to restrict multiple entries.
        const [userRow] = await db.execute('SELECT tournament_opt_in FROM users WHERE id = ?', [userId]);
        const optedIn = userRow.length > 0 ? userRow[0].tournament_opt_in : 0;

        // Save attempt
        await db.execute(
            'INSERT INTO quiz_attempts (user_id, score, xp_earned) VALUES (?, ?, ?)',
            [userId, score, optedIn ? xpEarned : 0]
        );

        if (optedIn) {
            // Update user total XP
            await db.execute(
                'UPDATE users SET xp = xp + ? WHERE id = ?',
                [xpEarned, userId]
            );
        }

        // Fetch new total XP
        const [updatedUserRow] = await db.execute('SELECT xp FROM users WHERE id = ?', [userId]);
        const newTotalXp = updatedUserRow.length > 0 ? updatedUserRow[0].xp : 0;

        res.json({
            status: 'success',
            xp_earned: optedIn ? xpEarned : 0,
            new_total_xp: newTotalXp,
            opted_in: optedIn,
            message: optedIn ? `Hambalyo! Waxaad heshay +${xpEarned} XP!` : 'Natiijadaada waa la keydiyey! Ku biir tartanka si aad u kasbato dhibco (XP).'
        });
    } catch (error) {
        console.error("Submit Quiz Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday kaydinta natiijada quiska' });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch top 3 fully visible users
        const [top3] = await db.execute(`
            SELECT id, name, username, profile_picture, xp 
            FROM users 
            WHERE tournament_opt_in = 1 AND is_suspended_from_tournament = 0
            ORDER BY xp DESC, id ASC 
            LIMIT 3
        `);

        // Fetch ranks 4-20
        const [others] = await db.execute(`
            SELECT id, name, username, profile_picture, xp 
            FROM users 
            WHERE tournament_opt_in = 1 AND is_suspended_from_tournament = 0
            ORDER BY xp DESC, id ASC 
            LIMIT 17 OFFSET 3
        `);

        // Map others with blurred/masked values to preserve privacy
        const maskedOthers = others.map(u => ({
            id: u.id,
            name: 'Contestant',
            username: 'hidden',
            profile_picture: null,
            xp: u.xp,
            is_blurred: true
        }));

        const leaderboard = [...top3, ...maskedOthers];

        // Get calling user's rank
        const [userRankRow] = await db.execute(`
            SELECT COUNT(*) + 1 AS user_rank 
            FROM users 
            WHERE tournament_opt_in = 1 AND xp > (SELECT xp FROM users WHERE id = ?)
        `, [userId]);

        const [userInfoRow] = await db.execute(`
            SELECT xp, tournament_opt_in FROM users WHERE id = ?
        `, [userId]);

        const userRank = userRankRow.length > 0 ? userRankRow[0].user_rank : 0;
        const userXp = userInfoRow.length > 0 ? userInfoRow[0].xp : 0;
        const optedIn = userInfoRow.length > 0 ? userInfoRow[0].tournament_opt_in : 0;

        res.json({
            status: 'success',
            leaderboard: leaderboard,
            user: {
                id: userId,
                xp: userXp,
                rank: optedIn ? userRank : '--',
                opted_in: optedIn
            }
        });
    } catch (error) {
        console.error("Get Leaderboard Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday soo saarista Leaderboard-ka' });
    }
};


