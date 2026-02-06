const express = require('express');
const router = express.Router();
const db = require('./database');
const bcrypt = require('bcrypt');

// Register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
        res.status(201).json({ success: true, message: 'User created' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Username already exists' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            res.json({ success: true, username: user.username, userId: user.id });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Rooms - MOVED TO SERVER.JS for Socket Access
// router.get('/rooms', ...)

// Create Room
router.post('/rooms', async (req, res) => {
    const { name, created_by } = req.body;
    try {
        await db.query('INSERT INTO rooms (name, created_by) VALUES (?, ?)', [name, created_by || null]);
        res.status(201).json({ success: true });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('UNIQUE constraint failed')) res.status(409).json({ error: 'Room name exists' });
        else res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
