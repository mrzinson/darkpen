const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Hubi in API keys ay ku jiraan .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * La hadal OpenAI
 */
exports.askOpenAI = async (prompt, history = [], model = "gpt-4o-mini", attachment = null) => {
    try {
        let content = [{ type: "text", text: prompt }];

        if (attachment) {
            content.push({
                type: "image_url",
                image_url: {
                    url: `data:${attachment.mimeType};base64,${attachment.base64}`
                }
            });
        }

        const messages = [
            { role: "system", content: "Waxaad tahay macallin iyo caawiye caqli badan oo ardayda u fududeeya fahamka duruusta. Si kooban oo naxariis leh ugu jawaab af-Soomaali iyo english key rabaan oo ay kugula hadlaan labadaba." },
            ...history,
            { role: "user", content: content }
        ];

        const response = await openai.chat.completions.create({
            model: model, 
            messages: messages,
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Error:", error);
        throw new Error("Waan ka xunnahay, darkpen waa mashquul hadda.");
    }
};

/**
 * La hadal Gemini
 */
exports.askGemini = async (prompt, modelName = "gemini-flash-latest", attachment = null, history = [], systemInstruction = null) => {
    try {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction
        });
        
        let parts = [{ text: prompt }];

        if (attachment) {
            const atts = Array.isArray(attachment) ? attachment : [attachment];
            for (const att of atts) {
                if (att && att.base64 && att.mimeType) {
                    parts.push({
                        inlineData: {
                            data: att.base64,
                            mimeType: att.mimeType
                        }
                    });
                }
            }
        }

        const result = await model.generateContent({
            contents: [
                ...history,
                { role: "user", parts: parts }
            ]
        });
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        throw new Error("Waan ka xunnahay, darkpen cilad ayaa ku timid.");
    }
};

/**
 * La hadal Gemini adigoo ku jawaabaya qaab Streaming ah
 */
exports.askGeminiStream = async (prompt, modelName = "gemini-flash-latest", attachment = null, history = [], systemInstruction = null) => {
    try {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction
        });
        
        let parts = [{ text: prompt }];

        if (attachment) {
            const atts = Array.isArray(attachment) ? attachment : [attachment];
            for (const att of atts) {
                if (att && att.base64 && att.mimeType) {
                    parts.push({
                        inlineData: {
                            data: att.base64,
                            mimeType: att.mimeType
                        }
                    });
                }
            }
        }

        const result = await model.generateContentStream({
            contents: [
                ...history,
                { role: "user", parts: parts }
            ]
        });
        return result.stream;
    } catch (error) {
        console.error("Gemini Stream Error:", error);
        throw new Error("Waan ka xunnahay, adeegga streaming-ka ee zinsonai ee loogu tala galay darkpen cilad ayaa ku timid.");
    }
};

const fs = require('fs');
const db = require('../config/db');

// Xisaabinta isku-ekaanshaha (Cosine Similarity)
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

let cachedEmbeddings = null;
let isCacheLoading = false;

// Function to load/reload embeddings
async function loadEmbeddingsIntoCache() {
    if (isCacheLoading) return;
    isCacheLoading = true;
    try {
        console.log("[EMBEDDINGS CACHE] Loading embeddings from DB...");
        const [rows] = await db.execute('SELECT title, chunk_text, embedding FROM book_embeddings');
        cachedEmbeddings = rows.map(row => {
            let parsedEmbedding = row.embedding;
            if (typeof parsedEmbedding === 'string') {
                try {
                    parsedEmbedding = JSON.parse(parsedEmbedding);
                } catch (err) {
                    console.error("Error parsing embedding JSON:", err);
                    parsedEmbedding = null;
                }
            }
            return {
                title: row.title,
                text: row.chunk_text,
                embedding: parsedEmbedding
            };
        }).filter(item => item.embedding !== null && Array.isArray(item.embedding));
        console.log(`[EMBEDDINGS CACHE] Loaded ${cachedEmbeddings.length} embeddings successfully!`);
    } catch (err) {
        console.error("[EMBEDDINGS CACHE] Error loading embeddings:", err);
    } finally {
        isCacheLoading = false;
    }
}

// Clear/invalidate cache
exports.clearEmbeddingsCache = () => {
    console.log("[EMBEDDINGS CACHE] Invalidating cache...");
    cachedEmbeddings = null;
};

// Raadinta xogta buugaagta
exports.findRelevantChunks = async (queryText) => {
    try {
        // Load cache if not already loaded
        if (!cachedEmbeddings) {
            await loadEmbeddingsIntoCache();
        }

        if (!cachedEmbeddings || cachedEmbeddings.length === 0) {
            return "";
        }

        const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        const result = await model.embedContent(queryText);
        const queryEmbedding = result.embedding.values;

        // Perform fast cosine similarity search in memory
        const scoredChunks = cachedEmbeddings.map(item => {
            const score = cosineSimilarity(queryEmbedding, item.embedding);
            return {
                title: item.title,
                text: item.text,
                score: score
            };
        });

        // Kala sooc (Sort) - ka ugu sareeya ugu horreysii
        scoredChunks.sort((a, b) => b.score - a.score);

        // Soo qaado 3-da ugu dhow ee score-koodu fiican yahay (> 0.6 waa isku ekaansho wanaagsan)
        const topChunks = scoredChunks.filter(c => c.score > 0.6).slice(0, 3);
        
        if (topChunks.length === 0) return "";

        let context = "XOGTA MANHAJKA IYO BUUGAAGTA APP-KA:\n";
        topChunks.forEach((c) => {
            context += `[Xigasho: ${c.title}]: ${c.text}\n\n`;
        });
        
        return context;
    } catch (e) {
        console.error("Cilad raadinta buugaagta:", e);
        return "";
    }
};

/**
 * Generate 10 Quiz Questions from raw text
 */
exports.generateQuestionsFromText = async (text) => {
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `Based on the following text from educational books, generate 10 multiple-choice questions in Somali.
        Each question must have 4 options and 1 correct answer (index 0-3).
        
        Text:
        ${text}

        Return a JSON array of objects with this format:
        [
          { "question": "...", "options": ["...", "...", "...", "..."], "answer": 0 },
          ...
        ]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Question Generation Error:", e);
        // Fallback to empty if AI fails
        return [];
    }
};

/**
 * Transcribe Audio using Gemini (replacing OpenAI Whisper)
 */
exports.transcribeAudio = async (filePath) => {
    try {
        const fs = require('fs');
        const audioBuffer = fs.readFileSync(filePath);
        const base64Audio = audioBuffer.toString('base64');
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const result = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                data: base64Audio,
                                mimeType: "audio/mp4"
                            }
                        },
                        { text: "Fadlan u beddel codkan qoraal ahaan (Transcribe). Kaliya soo qor waxa lagu hadlayo adigoo isticmaalaya luuqadda lagu hadlayo." }
                    ]
                }
            ]
        });
        
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Gemini Transcription Error:", error);
        throw new Error("Waan ka xunnahay, codka lama fahmin.");
    }
};

const Jimp = require('jimp');

/**
 * Generate image using Gemini Imagen 3 with Watermark
 */
exports.generateAIImage = async (prompt) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not defined in environment variables.");
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: prompt
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "1:1",
                    outputMimeType: "image/jpeg"
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Imagen API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
            throw new Error("No image data returned in predictions");
        }

        const rawBase64 = data.predictions[0].bytesBase64Encoded;

        // Apply "Darkpen AI" Watermark in bottom-right corner using Jimp
        try {
            const buffer = Buffer.from(rawBase64, 'base64');
            const image = await Jimp.read(buffer);
            
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
            
            const text = "Darkpen AI";
            const x = image.bitmap.width - 200;
            const y = image.bitmap.height - 60;
            
            image.print(font, x, y, text);
            
            const watermarkedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
            return watermarkedBuffer.toString('base64');
        } catch (jimpErr) {
            console.error("Jimp Watermark Error (falling back to original image):", jimpErr);
            return rawBase64;
        }
    } catch (error) {
        console.error("Gemini Imagen Generation Error:", error);
        throw new Error("Waan ka xunnahay, image generation is busy right now.");
    }
};
