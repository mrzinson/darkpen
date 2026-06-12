const db = require('../config/db');
const pushService = require('../services/pushNotificationService');

async function checkAndExpireWallet(userId) {
    try {
        // Query current balance and last_updated
        const [walletRows] = await db.query(
            'SELECT balance, last_updated FROM user_wallet WHERE user_id = ?',
            [userId]
        );

        if (walletRows.length === 0) return;

        const { balance, last_updated } = walletRows[0];

        if (balance <= 0) return;

        // Calculate difference in days between now and last_updated
        const lastUpdatedDate = new Date(last_updated);
        const now = new Date();
        const diffMs = now.getTime() - lastUpdatedDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // If older than 10 days, expire it!
        if (diffDays >= 10) {
            console.log(`[WALLET EXPIRATION] Expiring wallet for user ${userId}. Old balance: ${balance}`);

            // 1. Set balance to 0
            await db.query(
                'UPDATE user_wallet SET balance = 0, last_updated = NOW() WHERE user_id = ?',
                [userId]
            );

            // 2. Insert expiration record
            await db.query(
                'INSERT INTO wallet_expirations (user_id, expired_balance) VALUES (?, ?)',
                [userId, balance]
            );

            // 3. Send push notification to the user
            try {
                await pushService.sendPushNotification(
                    userId,
                    'Credits-kaagii waa uu dhacay',
                    `Credits-kaagii (Pay as you go) oo ahaa ${balance} ayaa dhacay sababtoo ah ma aadan isticmaalin muddo 10 casho ah. Fadlan ku shubo credits cusub.`
                );
            } catch (err) {
                console.error('[WALLET EXPIRATION] Push notification error:', err.message);
            }
        }
    } catch (error) {
        console.error('[WALLET EXPIRATION] Error in checkAndExpireWallet:', error);
    }
}

module.exports = { checkAndExpireWallet };
