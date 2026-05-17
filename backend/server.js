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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const groupRoutes = require('./routes/groupRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupRoutes);

// Tijaabinta API
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API-gu wuu shaqaynayaa!' });
});

// Socket.io Setup (Wada-sheekaysiga)
const io = new Server(server, {
    cors: {
        origin: "*", // Waxaan u oggolaanaynaa in app-ku ka soo xidhmo meel kasta
        methods: ["GET", "POST"]
    }
});

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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server-ku wuxuu ka shaqaynayaa PORT ${PORT}`);
});

// Global Error Handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
