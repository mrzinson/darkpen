const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

// Soo akhrinta Imtixaanaadka
router.get('/exams', auth, async (req, res) => {
    try {
        const [exams] = await db.execute('SELECT * FROM exams ORDER BY created_at DESC');
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin imtixaanaadka' });
    }
});

// Soo akhrinta Buugta Manhajka
router.get('/books', auth, async (req, res) => {
    try {
        const [books] = await db.execute('SELECT * FROM books ORDER BY created_at DESC');
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin buugta' });
    }
});

// Soo akhrinta User Profile (with Wallet balance)
router.get('/profile', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [user] = await db.execute(`
            SELECT u.id, u.name, u.email, u.username, u.profile_picture, u.role,
                   (SELECT balance FROM user_wallet WHERE user_id = u.id) as balance,
                   (SELECT type FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() LIMIT 1) as subscription_type
            FROM users u WHERE u.id = ?
        `, [userId]);

        if (user.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ user: user[0] });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

router.get('/search', auth, userController.searchUsers);

// Cusboonaysiinta Profile-ka
router.put('/profile', auth, userController.updateProfile);

module.exports = router;
