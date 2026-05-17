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
