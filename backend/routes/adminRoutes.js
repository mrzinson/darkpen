const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

const fs = require('fs');
const { clearEmbeddingsCache } = require('../services/aiService');

// Robustly resolve and create uploads directory inside the backend folder
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// 1. Stats Overview
router.get('/stats', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT COUNT(*) as total FROM users');
        const [recentUsers] = await db.execute('SELECT id, name, email, created_at, role FROM users ORDER BY created_at DESC LIMIT 5');
        const [pendingPayments] = await db.execute('SELECT COUNT(*) as total FROM payments WHERE status = "pending"');
        
        // Calculate Total Revenue from approved payments
        const [revenueRes] = await db.execute('SELECT SUM(amount) as total FROM payments WHERE status = "approved"');
        const totalRevenue = revenueRes[0].total || 0;

        // Active Chats (number of chat sessions)
        const [chatsRes] = await db.execute('SELECT COUNT(*) as total FROM chat_sessions');
        const activeChats = chatsRes[0].total || 0;

        // Chart Data: Last 7 days revenue
        const [chartData] = await db.execute(`
            SELECT DATE(created_at) as date, SUM(amount) as revenue 
            FROM payments 
            WHERE status = 'approved' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Format chart data for Recharts
        const formattedChartData = chartData.map(item => ({
            name: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: parseFloat(item.revenue) || 0
        }));

        res.json({
            totalUsers: users[0].total,
            pendingPayments: pendingPayments[0].total,
            totalRevenue, 
            activeChats,
            recentUsers,
            chartData: formattedChartData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday stats-ka' });
    }
});

// 2. Users Management
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.email, 
                u.password, 
                u.whatsapp_number, 
                u.role, 
                u.is_suspended, 
                u.created_at,
                COALESCE(uw.balance, 0) AS credits,
                COALESCE(sw.balance, 0) AS shukaansi_credits,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND sender = 'user') AS private_messages_count,
                (SELECT COUNT(*) FROM group_messages_v2 WHERE user_id = u.id) AS group_messages_count
            FROM users u
            LEFT JOIN user_wallet uw ON u.id = uw.user_id
            LEFT JOIN shukaansi_wallet sw ON u.id = sw.user_id
            ORDER BY u.created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ message: 'Lama helin users-ka' });
    }
});

// 2a. Suspend/Unsuspend User
router.post('/users/:id/suspend', async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await db.execute('SELECT is_suspended FROM users WHERE id = ?', [id]);
        if (users.length === 0) return res.status(404).json({ message: 'User-ka lama helin' });
        
        const newStatus = users[0].is_suspended ? 0 : 1;
        await db.execute('UPDATE users SET is_suspended = ? WHERE id = ?', [newStatus, id]);
        
        res.json({ 
            status: 'success', 
            message: newStatus ? 'User-ka waa la laalay (Suspended)' : 'User-ka waa laga qaaday laaliddii (Active)', 
            is_suspended: newStatus 
        });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday laalida user-ka' });
    }
});

// 2b. Delete User
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'User-ka si guul leh ayaa loo tirtiray' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista user-ka' });
    }
});

// 3. Payments Management
router.get('/payments', async (req, res) => {
    try {
        const [payments] = await db.execute(`
            SELECT p.*, u.name as user_name 
            FROM payments p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.created_at DESC
        `);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin payments-ka' });
    }
});

router.post('/payments/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const [payment] = await db.execute('SELECT * FROM payments WHERE id = ?', [id]);
        
        if (payment.length === 0) return res.status(404).json({ message: 'Lama helin lacag-bixintan' });

        const p = payment[0];
        console.log(`[PAYMENT] Approving ID: ${id}, User: ${p.user_id}, Amount: ${p.amount}`);
        await db.execute('UPDATE payments SET status = "approved" WHERE id = ?', [id]);
        
        // 1. Hubi inta ay lacagtu tahay
        // $0.5 (5,000) = 100 Credits
        // $3 (30,000) = 1 Month Basic
        // $11 (110,000) = 1 Month Premium
        
        const walletTable = p.service_type === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
        const subTable = p.service_type === 'shukaansi' ? 'shukaansi_subscriptions' : 'user_subscriptions';

        if (p.amount >= 11.0) {
            // Premium Subscription ($11.00)
            await db.execute(`INSERT INTO ${subTable} (user_id, type, expiry_date) VALUES (?, "monthly_11", DATE_ADD(NOW(), INTERVAL 30 DAY))`, [p.user_id]);
        } else if (p.amount >= 3.0) {
            // Basic Subscription ($3.00)
            await db.execute(`INSERT INTO ${subTable} (user_id, type, expiry_date) VALUES (?, "monthly_3", DATE_ADD(NOW(), INTERVAL 30 DAY))`, [p.user_id]);
        } else if (p.amount >= 0.5) {
            // Add Credits ($0.50)
            await db.execute(
                `INSERT INTO ${walletTable} (user_id, balance) VALUES (?, 100) ON DUPLICATE KEY UPDATE balance = balance + 100`,
                [p.user_id]
            );
        }

        // 2. Cusboonaysii user-ka guud ahaan (Users table)
        await db.execute('UPDATE users SET payment_status = "approved" WHERE id = ?', [p.user_id]);

        // 3. Haddii ay ahayd Group Join, u oggolaaw gelitaanka
        const [groupReg] = await db.execute('SELECT * FROM group_registrations WHERE payment_ref = ?', [p.reference_number]);
        if (groupReg.length > 0) {
            await db.execute('UPDATE group_registrations SET status = "approved" WHERE id = ?', [groupReg[0].id]);
        }

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            p.user_id,
            'Dalabka Lacag-bixinta',
            `Dalabkaaga lacag-bixinta ee $${p.amount} waa la ansixiyey! Adeegyadaadu hadda waa firfircoon yihiin.`
        );

        res.json({ message: 'Lacag-bixinta waa la oggolaaday, xogta user-ka waa la cusboonaysiiyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday approval-ka' });
    }
});

router.post('/payments/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const [payment] = await db.execute('SELECT * FROM payments WHERE id = ?', [id]);
        if (payment.length === 0) return res.status(404).json({ message: 'Lama helin lacag-bixintan' });
        const p = payment[0];

        await db.execute('UPDATE payments SET status = "rejected" WHERE id = ?', [id]);
        await db.execute('UPDATE users SET payment_status = "rejected" WHERE id = ?', [p.user_id]);

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            p.user_id,
            'Dalabka Lacag-bixinta',
            `Dalabkaaga lacag-bixinta ee $${p.amount} waa la diiday. Fadlan la xiriir caawiyaha.`
        );

        res.json({ message: 'Lacag-bixinta waa la diiday!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

// 4. Exams Management
router.get('/exams', async (req, res) => {
    try {
        const [exams] = await db.execute('SELECT * FROM exams ORDER BY created_at DESC');
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin imtixaanaadka' });
    }
});

const ingestionService = require('../services/ingestionService');

router.post('/exams', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, description, category, year } = req.body;
        const imageUrl = req.files['image'] ? `/uploads/${req.files['image'][0].filename}` : null;
        const pdfUrl = req.files['pdf'] ? `/uploads/${req.files['pdf'][0].filename}` : null;

        const [result] = await db.execute(
            'INSERT INTO exams (title, description, category, year, image_url, pdf_url) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, category || 'General', year || '2025', imageUrl, pdfUrl]
        );

        // Ingest into RAG in background
        if (pdfUrl) {
            const pdfPath = path.join(__dirname, '..', 'uploads', path.basename(pdfUrl));
            ingestionService.ingestPDF(result.insertId, 'exam', title, category, pdfPath);
        }

        res.json({ message: 'Imtixaanka si guul leh ayaa loo soo geliyay! AI-duna hadda ayay bilaabaysaa barashada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo gelinta imtixaanka' });
    }
});

router.delete('/exams/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM exams WHERE id = ?', [req.params.id]);
        await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = "exam"', [req.params.id]);
        clearEmbeddingsCache();
        res.json({ message: 'Imtixaanka waa la tirtiray' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

// 5. Books Management
router.get('/books', async (req, res) => {
    try {
        const [books] = await db.execute('SELECT * FROM books ORDER BY created_at DESC');
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin buugaagta' });
    }
});

router.post('/books', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, author, category, grade } = req.body;
        const imageUrl = req.files['image'] ? `/uploads/${req.files['image'][0].filename}` : null;
        const pdfUrl = req.files['pdf'] ? `/uploads/${req.files['pdf'][0].filename}` : null;

        const [result] = await db.execute(
            'INSERT INTO books (title, author, category, grade, image_url, pdf_url) VALUES (?, ?, ?, ?, ?, ?)',
            [title, author, category || 'General', grade || 'Form 4', imageUrl, pdfUrl]
        );

        // Ingest into RAG in background
        if (pdfUrl) {
            const pdfPath = path.join(__dirname, '..', 'uploads', path.basename(pdfUrl));
            ingestionService.ingestPDF(result.insertId, 'book', title, category, pdfPath);
        }

        res.json({ message: 'Buugga si guul leh ayaa loo soo geliyay! AI-duna hadda ayay bilaabaysaa barashada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo gelinta buugga' });
    }
});

router.delete('/books/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM books WHERE id = ?', [req.params.id]);
        await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = "book"', [req.params.id]);
        clearEmbeddingsCache();
        res.json({ message: 'Buugga waa la tirtiray' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

// 6. Group Management
router.get('/groups', async (req, res) => {
    try {
        const [groups] = await db.execute(`
            SELECT g.*, u.name as admin_name, u.username as admin_handle,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            (SELECT COUNT(*) FROM group_messages_v2 WHERE group_id = g.id) as message_count
            FROM groups_list g
            JOIN users u ON g.created_by = u.id
            ORDER BY g.created_at DESC
        `);
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin groups-ka' });
    }
});

router.post('/groups/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE groups_list SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ message: 'Status waa la bedelay!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

router.delete('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM groups_list WHERE id = ?', [id]);
        res.json({ message: 'Group-ka waa la tirtiray!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

// ==========================================
// 7. Dynamic Promotional Cards CRUD Endpoints
// ==========================================

router.get('/promo-cards', async (req, res) => {
    try {
        const [cards] = await db.execute('SELECT * FROM promo_cards ORDER BY created_at DESC');
        res.json(cards);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin promotional cards' });
    }
});

router.post('/promo-cards', upload.single('image'), async (req, res) => {
    try {
        const { title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, route, overlay_color_light, overlay_color_dark, reward_credits, reward_type, promo_type } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (!imageUrl) {
            return res.status(400).json({ message: 'Fadlan soo geli sawirka xayaysiiska.' });
        }

        await db.execute(
            `INSERT INTO promo_cards (title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, image_url, route, overlay_color_light, overlay_color_dark, reward_credits, reward_type, promo_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title_en, title_so, desc_en, desc_so, 
                button_text_en, button_text_so, imageUrl, route, 
                overlay_color_light || 'rgba(29, 78, 216, 0.65)', 
                overlay_color_dark || 'rgba(30, 41, 59, 0.75)',
                parseInt(reward_credits) || 0,
                reward_type || null,
                promo_type || 'normal'
            ]
        );

        res.json({ message: 'Xayaysiiska si guul leh ayaa loo soo geliyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo gelinta xayaysiiska' });
    }
});

router.put('/promo-cards/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, route, overlay_color_light, overlay_color_dark, reward_credits, reward_type, promo_type } = req.body;
        
        let query = `UPDATE promo_cards SET title_en = ?, title_so = ?, desc_en = ?, desc_so = ?, button_text_en = ?, button_text_so = ?, route = ?, overlay_color_light = ?, overlay_color_dark = ?, reward_credits = ?, reward_type = ?, promo_type = ?`;
        let params = [title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, route, overlay_color_light, overlay_color_dark, parseInt(reward_credits) || 0, reward_type || null, promo_type || 'normal'];

        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            query += `, image_url = ?`;
            params.push(imageUrl);
        }

        query += ` WHERE id = ?`;
        params.push(id);

        await db.execute(query, params);
        res.json({ message: 'Xayaysiiska waa la cusboonaysiiyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta' });
    }
});

router.put('/promo-cards/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE promo_cards SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ message: 'Status-ka xayaysiiska waa la bedelay!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

router.delete('/promo-cards/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM promo_cards WHERE id = ?', [id]);
        res.json({ message: 'Xayaysiiska waa la tirtiray!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

// ==========================================
// 8. Dynamic Promotional Card Claims & Rewards
// ==========================================

router.get('/promo-claims', async (req, res) => {
    try {
        const [claims] = await db.execute(`
            SELECT c.id, c.user_id, c.promo_card_id, c.screenshot_url, c.status, c.claimed_at,
                   u.name as user_name, u.email as user_email, u.whatsapp_number as user_whatsapp,
                   p.title_en as promo_title_en, p.title_so as promo_title_so, p.reward_credits, p.reward_type
            FROM user_claimed_promos c
            JOIN users u ON c.user_id = u.id
            JOIN promo_cards p ON c.promo_card_id = p.id
            ORDER BY c.claimed_at DESC
        `);
        res.json(claims);
    } catch (error) {
        console.error('Error fetching promo claims:', error);
        res.status(500).json({ message: 'Lama helin dalabyada abaalmarinta' });
    }
});

router.post('/promo-claims/:id/approve', async (req, res) => {
    try {
        const claimId = req.params.id;

        // Fetch claim details
        const [claimRows] = await db.execute('SELECT * FROM user_claimed_promos WHERE id = ?', [claimId]);
        if (claimRows.length === 0) {
            return res.status(404).json({ message: 'Dalabkan lama helin' });
        }

        const claim = claimRows[0];
        if (claim.status === 'approved') {
            return res.status(400).json({ message: 'Dalabkan mar hore ayaa la ansixiyey' });
        }

        // Fetch promo details
        const [promoRows] = await db.execute('SELECT reward_credits, reward_type FROM promo_cards WHERE id = ?', [claim.promo_card_id]);
        if (promoRows.length === 0) {
            return res.status(404).json({ message: 'Xayaysiiskan asalka u ahaa lama helin' });
        }

        const promo = promoRows[0];

        // Award credits to user
        if (promo.reward_credits > 0) {
            if (promo.reward_type === 'standard') {
                const [walletRows] = await db.execute('SELECT * FROM user_wallet WHERE user_id = ?', [claim.user_id]);
                if (walletRows.length === 0) {
                    await db.execute('INSERT INTO user_wallet (user_id, balance) VALUES (?, ?)', [claim.user_id, promo.reward_credits]);
                } else {
                    await db.execute('UPDATE user_wallet SET balance = balance + ? WHERE user_id = ?', [promo.reward_credits, claim.user_id]);
                }
            } else if (promo.reward_type === 'shukaansi') {
                const [walletRows] = await db.execute('SELECT * FROM shukaansi_wallet WHERE user_id = ?', [claim.user_id]);
                if (walletRows.length === 0) {
                    await db.execute('INSERT INTO shukaansi_wallet (user_id, balance) VALUES (?, ?)', [claim.user_id, promo.reward_credits]);
                } else {
                    await db.execute('UPDATE shukaansi_wallet SET balance = balance + ? WHERE user_id = ?', [promo.reward_credits, claim.user_id]);
                }
            }
        }

        // Mark claim as approved
        await db.execute('UPDATE user_claimed_promos SET status = "approved" WHERE id = ?', [claimId]);

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            claim.user_id,
            `Abaalmarinta ${claim.promo_title_so || 'Xayaysiiska'}`,
            `Dalabkaaga abaalmarinta waa la ansixiyey! Waxaa lagugu shubay +${promo.reward_credits} Credits.`
        );

        res.json({ message: 'Dalabka si guul leh ayaa loo ansixiyey, abaalmarintiina waa la siiyey!' });

    } catch (error) {
        console.error('Error approving claim:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray ansixinta' });
    }
});

router.post('/promo-claims/:id/reject', async (req, res) => {
    try {
        const claimId = req.params.id;

        const [claimRows] = await db.execute(`
            SELECT c.*, p.title_so as promo_title_so 
            FROM user_claimed_promos c
            JOIN promo_cards p ON c.promo_card_id = p.id
            WHERE c.id = ?
        `, [claimId]);
        if (claimRows.length === 0) {
            return res.status(404).json({ message: 'Dalabkan lama helin' });
        }
        const claim = claimRows[0];

        // Delete from database to clear the state and allow retry
        await db.execute('DELETE FROM user_claimed_promos WHERE id = ?', [claimId]);

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            claim.user_id,
            'Dalabka Abaalmarinta',
            `Dalabkaaga abaalmarinta ee ${claim.promo_title_so || 'xayaysiiska'} waa la diiday. Fadlan dib u soo dir sawir ka duwan oo sax ah.`
        );

        res.json({ message: 'Dalabkii waa la diiday, waana la tirtiray si uu qofku dib ugu soo upload-gareeyo.' });
    } catch (error) {
        console.error('Error rejecting claim:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray diidmada' });
    }
});

module.exports = router;
