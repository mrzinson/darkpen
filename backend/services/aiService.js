const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff(fn, retries = 3, delay = 600) {
    let lastError = null;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.status || (error.statusText ? parseInt(error.statusText) : null);
            const isTransient = 
                status === 503 || 
                status === 429 || 
                (error.message && (
                    error.message.includes('503') || 
                    error.message.includes('429') || 
                    error.message.includes('Service Unavailable') || 
                    error.message.includes('Too Many Requests') || 
                    error.message.includes('high demand')
                ));
            
            if (isTransient && i < retries - 1) {
                console.warn(`[GEMINI RETRY] Retrying due to transient error (attempt ${i + 1}/${retries}). Error: ${error.message}`);
                await sleep(delay * Math.pow(2, i)); // 600ms, 1200ms, 2400ms...
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

/**
 * La hadal Gemini
 */
exports.askGemini = async (prompt, modelName = "gemini-flash-latest", attachment = null, history = [], systemInstruction = null) => {
    const fallbackModels = Array.from(new Set([modelName, "gemini-2.5-flash", "gemini-flash-latest"]));
    let lastError = null;

    for (const currentModel of fallbackModels) {
        try {
            console.log(`[GEMINI SERVICE] Attempting generateContent with model: ${currentModel}`);
            const model = genAI.getGenerativeModel({ 
                model: currentModel,
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

            const responseText = await retryWithBackoff(async () => {
                const result = await model.generateContent({
                    contents: [
                        ...history,
                        { role: "user", parts: parts }
                    ]
                });
                const response = await result.response;
                return response.text();
            });
            
            return responseText;
        } catch (error) {
            console.warn(`[GEMINI SERVICE WARNING] Model ${currentModel} failed: ${error.message}`);
            lastError = error;
        }
    }

    console.error("Gemini Error after all fallback models and retries:", lastError);
    throw new Error("Waan ka xunnahay, darkpen cilad ayaa ku timid.");
};

/**
 * La hadal Gemini adigoo ku jawaabaya qaab Streaming ah
 */
exports.askGeminiStream = async (prompt, modelName = "gemini-flash-latest", attachment = null, history = [], systemInstruction = null) => {
    const fallbackModels = Array.from(new Set([modelName, "gemini-2.5-flash", "gemini-flash-latest"]));
    let lastError = null;

    for (const currentModel of fallbackModels) {
        try {
            console.log(`[GEMINI SERVICE] Attempting generateContentStream with model: ${currentModel}`);
            const model = genAI.getGenerativeModel({ 
                model: currentModel,
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

            const stream = await retryWithBackoff(async () => {
                const result = await model.generateContentStream({
                    contents: [
                        ...history,
                        { role: "user", parts: parts }
                    ]
                });
                return result.stream;
            });
            
            return stream;
        } catch (error) {
            console.warn(`[GEMINI SERVICE WARNING] Model stream ${currentModel} failed: ${error.message}`);
            lastError = error;
        }
    }

    console.error("Gemini Stream Error after all fallback models and retries:", lastError);
    throw new Error("Waan ka xunnahay, adeegga streaming-ka ee zinsonai ee loogu tala galay darkpen cilad ayaa ku timid.");
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

        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
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
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
        
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
