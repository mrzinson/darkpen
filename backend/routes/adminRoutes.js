const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
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
        const [users] = await db.execute('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin users-ka' });
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

        res.json({ message: 'Lacag-bixinta waa la oggolaaday, xogta user-ka waa la cusboonaysiiyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday approval-ka' });
    }
});

router.post('/payments/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE payments SET status = "rejected" WHERE id = ?', [id]);
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

module.exports = router;
