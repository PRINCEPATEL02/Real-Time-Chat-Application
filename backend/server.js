/**
 * Real-Time Chat Application - Main Server File
 * Node.js + Express.js + MongoDB + Socket.io
 * Optimized for performance
 */

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Security & Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(compression({
    level: 6,
    threshold: 1024
}));

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp';
mongoose.connect(MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
}).then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// Socket.io - Optimized
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:4200',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    perMessageDeflate: { threshold: 1024 }
});

// Track online users
const onlineUsers = new Map();

// Socket Events
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    socket.on('authenticate', (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        io.emit('user_online', { userId });
    });

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
    });

    socket.on('send_message', (data) => {
        io.to(data.roomId).emit('receive_message', {
            ...data,
            timestamp: Date.now(),
            status: 'delivered'
        });
    });

    socket.on('typing', (data) => socket.to(data.roomId).emit('user_typing', data));
    socket.on('stop_typing', (data) => socket.to(data.roomId).emit('user_stop_typing', data));
    socket.on('mark_read', (data) => socket.to(data.roomId).emit('message_read', data));

    socket.on('disconnect', () => {
        if (socket.userId) {
            onlineUsers.delete(socket.userId);
            io.emit('user_offline', { userId: socket.userId });
        }
    });
});

// User Model
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserSchema.index({ email: 1, username: 1, isActive: 1 });

// Chat Model
const ChatSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, maxlength: 1000 },
    roomId: { type: String, required: true, index: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

ChatSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
ChatSchema.index({ roomId: 1, createdAt: -1 });
ChatSchema.index({ receiver: 1, isRead: 1 });

const User = mongoose.model('User', UserSchema);
const Chat = mongoose.model('Chat', ChatSchema);

// Auth Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if email already exists
        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }

        // Check if username already exists
        const usernameExists = await User.findOne({ username: username });
        if (usernameExists) {
            return res.status(400).json({ error: 'This username is already taken' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({ username, email: email.toLowerCase(), password: hashedPassword });
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        res.json({ success: true, data: { user: { id: user._id, username: user.username, email: user.email, role: user.role }, token } });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        res.json({ success: true, data: { user: { id: user._id, username: user.username, email: user.email, role: user.role }, token } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

app.get('/api/users', auth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/chats/:userId', auth, async (req, res) => {
    try {
        const chats = await Chat.find({
            $or: [
                { sender: req.user._id, receiver: req.params.userId },
                { sender: req.params.userId, receiver: req.user._id }
            ]
        }).sort({ createdAt: -1 }).limit(50);

        res.json({ success: true, data: chats.reverse() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chats/:userId', auth, async (req, res) => {
    try {
        const { message } = req.body;
        const userIds = [req.user._id.toString(), req.params.userId].sort();
        const roomId = userIds[0] + '_' + userIds[1];

        const chat = await Chat.create({
            sender: req.user._id,
            receiver: req.params.userId,
            message,
            roomId
        });

        const populatedChat = await Chat.findById(chat._id)
            .populate('sender', 'username')
            .populate('receiver', 'username');

        res.json({ success: true, data: populatedChat });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/conversations', auth, async (req, res) => {
    try {
        const chats = await Chat.aggregate([
            { $match: { $or: [{ sender: req.user._id }, { receiver: req.user._id }] } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: {
                        $cond: [{ $eq: ['$sender', req.user._id] }, '$receiver', '$sender']
                    },
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$receiver', req.user._id] }, { $eq: ['$isRead', false] }] }, 1, 0] } }
                }
            },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: { 'user.password': 0 } }
        ]);

        res.json({ success: true, data: chats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/chats/read/:userId', auth, async (req, res) => {
    try {
        await Chat.updateMany(
            { sender: req.params.userId, receiver: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, io };
