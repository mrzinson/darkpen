const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security Middleware (Configured to allow iframes but keep other protections)
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    frameguard: false,
}));

// Trust Render's proxy (needed for express-rate-limit behind load balancer)
app.set('trust proxy', 1);

// Rate Limiting (Ka hortagga DDOS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiiqo
    max: 200, // Limit each IP to 200 requests per windowMs
    message: "Fariimo badan ayaad soo dirtay, fadlan sug in yar."
});
app.use('/api', limiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`${req.method} ${req.url} ${res.statusCode}`);
    });
    next();
});
// Serve uploads folder statically with robust directory fallbacks
const uploadsPath = path.join(__dirname, 'uploads');
const rootUploadsPath = path.join(process.cwd(), 'uploads');
const nestedUploadsPath = path.join(process.cwd(), 'backend', 'uploads');

app.use('/uploads', express.static(uploadsPath));
app.use('/uploads', express.static(rootUploadsPath));
app.use('/uploads', express.static(nestedUploadsPath));

app.use('/api/uploads', express.static(uploadsPath));
app.use('/api/uploads', express.static(rootUploadsPath));
app.use('/api/uploads', express.static(nestedUploadsPath));

// Fallback to proxy/redirect missing uploads from production Render backend
const https = require('https');
const productionUploadsFallback = (req, res, next) => {
    if (req.path === '/' || req.path === '') {
        return next();
    }
    // Prevent infinite loop on the production Render server
    const host = req.headers.host || '';
    if (host.includes('onrender.com')) {
        return res.status(404).send('Cannot GET ' + req.originalUrl);
    }
    const productionUrl = `https://darkpen-backend.onrender.com/uploads${req.path}`;
    https.get(productionUrl, (proxyRes) => {
        if (proxyRes.statusCode === 200) {
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/octet-stream');
            if (proxyRes.headers['content-length']) {
                res.setHeader('Content-Length', proxyRes.headers['content-length']);
            }
            proxyRes.pipe(res);
        } else {
            res.status(404).send('Cannot GET ' + req.originalUrl);
        }
    }).on('error', (err) => {
        console.error('[Upload Fallback Proxy Error]:', err.message);
        next();
    });
};
app.use('/uploads', productionUploadsFallback);
app.use('/api/uploads', productionUploadsFallback);

// Routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const groupRoutes = require('./routes/groupRoutes');
const s3Service = require('./services/s3Service');

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupRoutes);

// Private S3 File Download Proxy/Redirect Endpoint
const handleDownload = async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).send('Fayl-ka lama helin (Key is required)');
        }
        
        // Generate pre-signed GET URL for S3 (expiring in 1 hour)
        const presignedUrl = await s3Service.getDownloadUrl(decodeURIComponent(key));
        if (presignedUrl) {
            return res.redirect(presignedUrl);
        }
        return res.status(404).send('Faylka lama helin ama adeegga kaydka ma shaqaynayo.');
    } catch (error) {
        console.error('[Download Redirect Error]:', error.message);
        return res.status(500).send('Cilad ayaa ku dhacday soo dejinta faylka.');
    }
};

app.get('/download', handleDownload);
app.get('/api/download', handleDownload);

// Tijaabinta API
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API-gu wuu shaqaynayaa!' });
});

// WhatsApp Bot QR Code endpoint - scan this in the browser to connect the bot
app.get('/api/whatsapp/qr', (req, res) => {
    const whatsappBot = require('./services/whatsappBot');
    const status = whatsappBot.getBotStatus();
    const qrDataURL = whatsappBot.getQRCode();

    if (status === 'connected') {
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>WhatsApp Bot - Darkpen</title>
        <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;margin:0;}
        .box{background:#1a1a1a;padding:40px;border-radius:16px;text-align:center;border:2px solid #25d366;}
        h2{color:#25d366;} p{color:#aaa;}</style></head>
        <body><div class="box"><h2>✅ WhatsApp Bot Wuu Xidhmay!</h2>
        <p>Bot-ku wuu shaqaynayaa oo uu farriimahaaga u jawaabayaa.</p>
        <p style="color:#555;font-size:12px;">Status: connected</p></div></body></html>`);
    }

    if (status === 'qr_ready' && qrDataURL) {
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <meta http-equiv="refresh" content="30">
        <title>WhatsApp Bot QR - Darkpen</title>
        <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;margin:0;}
        .box{background:#1a1a1a;padding:40px;border-radius:16px;text-align:center;border:2px solid #25d366;max-width:500px;}
        h2{color:#25d366;margin-bottom:8px;} p{color:#aaa;margin-bottom:20px;} img{border-radius:8px;background:#fff;padding:10px;}
        .timer{color:#555;font-size:12px;margin-top:16px;}</style></head>
        <body><div class="box">
        <h2>📱 WhatsApp Scan QR Code</h2>
        <p>WhatsApp app-kaaga fur → Linked Devices → Link a Device → QR-kan sawir</p>
        <img src="${qrDataURL}" alt="QR Code" width="300" height="300">
        <p class="timer">⏱️ Boggan 30 ilbiriqsi kasta ayuu is-cusbooneysiin doonaa.</p>
        </div></body></html>`);
    }

    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <meta http-equiv="refresh" content="5">
    <title>WhatsApp Bot - Darkpen</title>
    <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;margin:0;}
    .box{background:#1a1a1a;padding:40px;border-radius:16px;text-align:center;border:2px solid #555;}
    h2{color:#fff;} p{color:#aaa;} .spin{font-size:40px;animation:spin 1s linear infinite;}
    @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}</style></head>
    <body><div class="box"><div class="spin">⏳</div>
    <h2>Bot wuu kici jirayaa...</h2>
    <p>Status: <strong>${status}</strong></p>
    <p>Boggan 5 ilbiriqsi kasta ayuu is-cusbooneysiin doonaa. Sug...</p>
    </div></body></html>`);
});

// WhatsApp Bot status JSON endpoint
app.get('/api/whatsapp/status', (req, res) => {
    const whatsappBot = require('./services/whatsappBot');
    res.json({ status: whatsappBot.getBotStatus() });
});

// WhatsApp Cloud API Webhook verification (GET) and receipt (POST)
const whatsappCloudBot = require('./services/whatsappCloudBot');
app.get('/api/whatsapp/webhook', whatsappCloudBot.handleWebhookVerify);
app.post('/api/whatsapp/webhook', whatsappCloudBot.handleWebhookPost);


app.get('/api/db-test', async (req, res) => {
    const db = require('./config/db');
    try {
        const [result] = await db.execute('SELECT 1 + 1 AS result');
        res.json({ status: 'success', message: 'Database connection successful!', data: result });
    } catch (error) {
        console.error('Database connection test failed:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Database connection failed!', 
            error: error.message,
            code: error.code,
            errno: error.errno
        });
    }
});

app.get('/api/env-check', (req, res) => {
    res.json({
        DB_HOST: process.env.DB_HOST,
        DB_USER: process.env.DB_USER,
        DB_NAME: process.env.DB_NAME,
        DB_PASSWORD_LENGTH: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0,
        DB_PASSWORD_FIRST_CHAR: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.charAt(0) : 'none',
        DB_PASSWORD_LAST_CHAR: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.charAt(process.env.DB_PASSWORD.length - 1) : 'none',
    });
});

// Socket.io Setup (Wada-sheekaysiga)
const io = new Server(server, {
    cors: {
        origin: "*", // Waxaan u oggolaanaynaa in app-ku ka soo xidhmo meel kasta
        methods: ["GET", "POST"]
    }
});
app.set('socketio', io);

io.on('connection', (socket) => {
    console.log(`Qof ayaa soo xidhmay: ${socket.id}`);

    // Marka ardaygu galo qolkiisa (Group Chat)
    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`Ardaygu wuxuu ku biiray qolka: ${room}`);
    });

    // Marka fariin cusub lasoo diro
    socket.on('send_message', (data) => {
        // Waxaan dib ugu diraynaa fariinta dadka kale ee qolka ku jira
        socket.to(data.room).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log(`Qof baa ka baxay: ${socket.id}`);
    });
});

// Tijaabinta Push Notifications
app.post('/api/test-push', async (req, res) => {
    try {
        const { userId, title, body } = req.body;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        const pushService = require('./services/pushNotificationService');
        await pushService.sendPushNotification(
            userId,
            title || 'Tijaabo Notification',
            body || 'Haddii aad aragto farriintan, push notification-ku wuu shaqaynayaa! 🚀'
        );
        res.json({ message: 'Push notification triggered successfully!' });
    } catch (error) {
        console.error('Error triggering test push:', error);
        res.status(500).json({ message: 'Error triggering push', error: error.message });
    }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server-ku wuxuu ka shaqaynayaa PORT ${PORT}`);
    // Run AI group presence check
    const groupController = require('./controllers/groupController');
    groupController.ensureAIPresenceInAllGroups().catch(console.error);

    // Run WhatsApp Bot if enabled in environment
    if (process.env.ENABLE_WHATSAPP_BOT === 'true') {
        try {
            const whatsappBot = require('./services/whatsappBot');
            whatsappBot.initialize();
        } catch (err) {
            console.error('[WHATSAPP BOT LOAD ERROR]:', err.message);
        }
    }
});


// Global Error Handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
