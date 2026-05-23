const db = require('../config/db');

const FREE_TEXT_LIMIT = 2;
const FREE_IMAGE_LIMIT = 1;

async function ensureFreeUsageRow(userId) {
    await db.execute(
        `INSERT IGNORE INTO user_free_ai_usage (user_id, free_text_used, free_image_used)
         VALUES (?, 0, 0)`,
        [userId]
    );
}

async function tryUseFreeAI(userId, kind) {
    const column = kind === 'image' ? 'free_image_used' : 'free_text_used';
    const limit = kind === 'image' ? FREE_IMAGE_LIMIT : FREE_TEXT_LIMIT;

    await ensureFreeUsageRow(userId);

    const [result] = await db.execute(
        `UPDATE user_free_ai_usage
         SET ${column} = ${column} + 1
         WHERE user_id = ? AND ${column} < ?`,
        [userId, limit]
    );

    return result.affectedRows > 0;
}

module.exports = {
    FREE_TEXT_LIMIT,
    FREE_IMAGE_LIMIT,
    tryUseFreeAI,
};
