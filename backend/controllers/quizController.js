const db = require('../config/db');
const aiService = require('../services/aiService');

exports.generateQuiz = async (req, res) => {
    try {
        // 1. Soo qaado 10 cutub oo random ah oo ka dhex jira database-ka
        const [rows] = await db.execute('SELECT chunk_text FROM book_embeddings ORDER BY RAND() LIMIT 10');
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Lama helin xog buugaag ah oo quiz laga sameeyo.' });
        }

        const combinedText = rows.map(r => r.chunk_text).join("\n\n---\n\n");

        // 2. Weydiiso Gemini inay quiz ka samayso
        const questions = await aiService.generateQuestionsFromText(combinedText);

        res.json({ questions });
    } catch (error) {
        console.error("Quiz Generation Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo saarista quiska' });
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

        // Save attempt
        await db.execute(
            'INSERT INTO quiz_attempts (user_id, score, xp_earned) VALUES (?, ?, ?)',
            [userId, score, xpEarned]
        );

        // Update user total XP
        await db.execute(
            'UPDATE users SET xp = xp + ? WHERE id = ?',
            [xpEarned, userId]
        );

        // Fetch new total XP
        const [userRow] = await db.execute('SELECT xp FROM users WHERE id = ?', [userId]);
        const newTotalXp = userRow.length > 0 ? userRow[0].xp : 0;

        res.json({
            status: 'success',
            xp_earned: xpEarned,
            new_total_xp: newTotalXp,
            message: `Hambalyo! Waxaad heshay +${xpEarned} XP!`
        });
    } catch (error) {
        console.error("Submit Quiz Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday kaydinta natiijada quiska' });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch top 20 users with highest XP
        const [leaders] = await db.execute(`
            SELECT id, name, username, profile_picture, xp 
            FROM users 
            ORDER BY xp DESC, id ASC 
            LIMIT 20
        `);

        // Get calling user's rank
        const [userRankRow] = await db.execute(`
            SELECT COUNT(*) + 1 AS user_rank 
            FROM users 
            WHERE xp > (SELECT xp FROM users WHERE id = ?)
        `, [userId]);

        const [userInfoRow] = await db.execute(`
            SELECT xp FROM users WHERE id = ?
        `, [userId]);

        const userRank = userRankRow.length > 0 ? userRankRow[0].user_rank : 0;
        const userXp = userInfoRow.length > 0 ? userInfoRow[0].xp : 0;

        res.json({
            status: 'success',
            leaderboard: leaders,
            user: {
                id: userId,
                xp: userXp,
                rank: userRank
            }
        });
    } catch (error) {
        console.error("Get Leaderboard Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday soo saarista Leaderboard-ka' });
    }
};

