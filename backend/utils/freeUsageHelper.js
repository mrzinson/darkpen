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

    // Try to update first to avoid redundant database calls for existing users (99% of requests)
    const [result] = await db.execute(
        `UPDATE user_free_ai_usage
         SET ${column} = ${column} + 1
         WHERE user_id = ? AND ${column} < ?`,
        [userId, limit]
    );

    if (result.affectedRows > 0) {
        return true;
    }

    // If 0 rows affected, insert the row if it was missing, then retry the update
    const [insertResult] = await db.execute(
        `INSERT IGNORE INTO user_free_ai_usage (user_id, free_text_used, free_image_used)
         VALUES (?, 0, 0)`,
        [userId]
    );

    if (insertResult.affectedRows > 0) {
        const [retryResult] = await db.execute(
            `UPDATE user_free_ai_usage
             SET ${column} = ${column} + 1
             WHERE user_id = ? AND ${column} < ?`,
            [userId, limit]
        );
        return retryResult.affectedRows > 0;
    }

    return false;
}

module.exports = {
    FREE_TEXT_LIMIT,
    FREE_IMAGE_LIMIT,
    tryUseFreeAI,
};
