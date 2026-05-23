const db = require('../config/db');
const aiService = require('../services/aiService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateExamPdf = async (req, res) => {
    try {
        const { topic, grade, subject, questionCount = 10 } = req.body;

        if (!topic || !grade || !subject) {
            return res.status(400).json({ message: 'Fadlan buuxi dhammaan xogta (topic, grade, subject)' });
        }

        console.log(`Generating exam for: ${subject} - ${topic} (${grade})`);

        // 1. Gather context from book embeddings related to the subject/topic
        const queryText = `${subject} ${topic} ${grade}`;
        let context = await aiService.findRelevantChunks(queryText);

        if (!context) {
            // Fallback: search database by simple text match if vector search yielded nothing
            const [rows] = await db.execute(
                'SELECT chunk_text FROM book_embeddings WHERE chunk_text LIKE ? OR title LIKE ? LIMIT 5',
                [`%${topic}%`, `%${subject}%`]
            );
            if (rows.length > 0) {
                context = "XOGTA LAGA REEBAY BUUGAAGTA:\n" + rows.map(r => r.chunk_text).join("\n\n---\n\n");
            }
        }

        // 2. Generate questions via Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `Based on the following curriculum context (if provided), generate a high-quality academic exam paper for Somali secondary schools.
        
        Details:
        - Subject: ${subject}
        - Topic: ${topic}
        - Grade: ${grade}
        - Total Questions: ${questionCount} (Provide a mix of multiple-choice questions and short-answer/structured questions).
        
        Curriculum Context:
        ${context || "No context provided. Use standard high-quality Somali curriculum knowledge."}
        
        The exam must be written completely in SOMALI language.
        Please structure your output exactly as a structured JSON object with two fields so we can format it nicely:
        {
          "title": "A high-quality educational title for the exam",
          "instructions": "Exam instructions for the student (e.g. Ka jawaab dhammaan su'aalaha, waqtiga waa 1 saac)",
          "questions": [
            {
              "type": "multiple-choice",
              "question": "The question text...",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "answer": "Correct Option text or index"
            },
            {
              "type": "structured",
              "question": "The structured/short-answer question text...",
              "answer": "The sample correct answer for the teacher"
            }
          ]
        }
        
        Make sure the response is strict JSON. Do not include markdown code block formatting (like \`\`\`json).`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();

        // Clean up markdown block if model accidentally included it
        if (responseText.startsWith('```json')) {
            responseText = responseText.substring(7);
        }
        if (responseText.endsWith('```')) {
            responseText = responseText.substring(0, responseText.length - 3);
        }
        responseText = responseText.trim();

        let examData;
        try {
            examData = JSON.parse(responseText);
        } catch (jsonErr) {
            console.error("JSON Parsing failed for exam response:", responseText);
            throw new Error("AI failed to generate a valid exam format. Try again.");
        }

        // 3. Generate PDF using PDFKit
        const doc = new PDFDocument({ margin: 50 });
        const filename = `exam-${Date.now()}.pdf`;
        const examsDir = path.join(__dirname, '..', 'uploads', 'exams');

        // Ensure directory exists
        if (!fs.existsSync(examsDir)) {
            fs.mkdirSync(examsDir, { recursive: true });
        }

        const pdfPath = path.join(examsDir, filename);
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        // Styling helper
        const colors = {
            primary: '#1E3A8A', // Deep Blue
            secondary: '#3B82F6', // Blue Accent
            text: '#1F2937', // Dark Gray
            lightGray: '#9CA3AF',
            border: '#E5E7EB'
        };

        // --- PAGE 1: EXAM PAPER ---
        doc.fillColor(colors.primary)
           .fontSize(22)
           .text('MADASHA WAXBARASHADA DARKPEN', { align: 'center' })
           .moveDown(0.2);

        doc.fillColor(colors.secondary)
           .fontSize(14)
           .text(`IMTIXAANKA: ${examData.title || subject.toUpperCase()}`, { align: 'center' })
           .moveDown(0.4);

        doc.fillColor(colors.text)
           .fontSize(11)
           .text(`Mawduuca: ${topic}   |   Fasalka: ${grade}   |   Maaddada: ${subject}`, { align: 'center' })
           .moveDown(0.8);

        // Draw horizontal line
        doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor(colors.primary).lineWidth(1.5).stroke().moveDown(1);

        // Instructions
        doc.fillColor('#B91C1C') // Red-ish for instructions
           .fontSize(11)
           .text(`Hanuunin: ${examData.instructions || "Ka jawaab dhammaan su'aalaha si taxadir leh."}`, { oblique: true })
           .moveDown(1.5);

        // Render Questions
        doc.fillColor(colors.text).fontSize(12);
        
        examData.questions.forEach((q, idx) => {
            doc.fillColor(colors.primary).fontSize(12).text(`Su'aasha ${idx + 1}: `, { continued: true });
            doc.fillColor(colors.text).fontSize(11).text(q.question);
            doc.moveDown(0.5);

            if (q.type === 'multiple-choice' && Array.isArray(q.options)) {
                q.options.forEach((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                    doc.fontSize(10).text(`      ${letter}) ${opt}`).moveDown(0.3);
                });
            } else {
                // Draw space for structured answer
                doc.fontSize(10).fillColor(colors.lightGray).text('      Jawaab: __________________________________________________________________').moveDown(0.4);
                doc.text('      __________________________________________________________________________').moveDown(0.4);
            }
            doc.moveDown(1);

            // Add new page if current page height exceeds safe limit
            if (doc.y > 650) {
                doc.addPage();
            }
        });

        // --- PAGE 2: ANSWER KEY ---
        doc.addPage();
        doc.fillColor(colors.primary)
           .fontSize(18)
           .text('FURAHA JAWAABAHA (ANSWER KEY)', { align: 'center' })
           .moveDown(0.5);

        doc.fillColor(colors.secondary)
           .fontSize(12)
           .text(`Macalimiinta & Waalidiinta Kaliya`, { align: 'center' })
           .moveDown(0.5);

        doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor(colors.secondary).lineWidth(1).stroke().moveDown(1.5);

        doc.fillColor(colors.text).fontSize(11);

        examData.questions.forEach((q, idx) => {
            doc.fillColor(colors.primary).fontSize(11).text(`Jawaabta S${idx + 1}: `, { continued: true });
            doc.fillColor('#047857').fontSize(11).text(q.answer);
            doc.moveDown(0.8);
        });

        doc.end();

        // Wait for PDF writing to finish
        writeStream.on('finish', () => {
            const pdfUrl = `/uploads/exams/${filename}`;
            res.json({
                status: 'success',
                title: examData.title,
                pdfUrl: pdfUrl,
                message: 'Imtixaankaaga PDF-ka ah si guul leh ayaa loo diyaariyey!'
            });
        });

    } catch (error) {
        console.error("Exam Generator Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday soo saarista imtixaanka PDF-ka ah' });
    }
};
