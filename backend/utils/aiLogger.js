const db = require('../config/db');

/**
 * Log AI request and cost statistics to the database
 * @param {number} userId - The ID of the user who made the request
 * @param {string} modelName - The AI model name used
 * @param {string} promptText - The prompt text sent to the AI
 * @param {string} completionText - The completion text received from the AI
 * @param {string} chatType - The type of chat (e.g. 'education', 'shukaansi')
 */
exports.logAIUsage = async (userId, modelName, promptText, completionText, chatType) => {
    try {
        if (!userId) return;

        // Estimate tokens: 1 token is roughly 4 characters
        const promptTokens = Math.max(1, Math.ceil((promptText || '').length / 4));
        const completionTokens = Math.max(1, Math.ceil((completionText || '').length / 4));

        // Determine costs based on model pricing (USD per token)
        let promptCost = 0;
        let completionCost = 0;

        const model = (modelName || '').toLowerCase();

        if (model.includes('gemini-flash') || model.includes('gemini-1.5-flash') || model.includes('latest')) {
            // Gemini 1.5 Flash: $0.075 / 1M input tokens, $0.30 / 1M output tokens
            promptCost = promptTokens * 0.000000075;
            completionCost = completionTokens * 0.00000030;
        } else if (model.includes('gpt-4o-mini')) {
            // GPT-4o-mini: $0.150 / 1M input tokens, $0.60 / 1M output tokens
            promptCost = promptTokens * 0.00000015;
            completionCost = completionTokens * 0.00000060;
        } else if (model.includes('dall-e')) {
            // OpenAI DALL-E 3 image generation: flat $0.040 per image
            promptCost = 0.040;
            completionCost = 0;
        } else {
            // Default to Gemini Flash pricing if unspecified
            promptCost = promptTokens * 0.000000075;
            completionCost = completionTokens * 0.00000030;
        }

        const totalCost = promptCost + completionCost;

        await db.execute(
            `INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, modelName || 'unknown', promptTokens, completionTokens, totalCost, chatType || 'general']
        );
    } catch (error) {
        console.error('[AI Logger Error]: Failed to log AI usage:', error.message);
    }
};
