const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./auth');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { auth: {} }); // prepare for auth

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/rooms', async (req, res) => {
    try {
        // 1. Fetch persistent rooms from DB (JOIN to get creator name)
        const [rows] = await db.query(`
            SELECT rooms.*, users.username as creator_name 
            FROM rooms 
            LEFT JOIN users ON rooms.created_by = users.id 
            ORDER BY rooms.created_at DESC
        `);

        // 2. Attach real-time user count from Socket.IO
        const roomsWithStats = rows.map(room => {
            const socketRoom = io.sockets.adapter.rooms.get(room.name);
            const count = socketRoom ? socketRoom.size : 0;
            return {
                ...room,
                activeUsers: count
            };
        });

        res.json(roomsWithStats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Routes
app.use('/api', authRoutes);

// Store connected users: socket.id -> { username, room }
const users = {};

// Helper: active info
function getRoomUserCount(room) {
    const roomUsers = io.sockets.adapter.rooms.get(room);
    return roomUsers ? roomUsers.size : 0;
}

// Update Active Room Count in DB (optional, simplified for now)
// We won't strictly enforce DB "active_users" sync in real-time for this beginner scope, 
// but we handle socket rooms correctly.

io.on('connection', (socket) => {

    socket.on('join', (data) => {
        const { username, room } = data;

        socket.join(room);
        users[socket.id] = { username, room };

        // Notify room
        socket.to(room).emit('user-joined', {
            username: username,
            activeUsers: getRoomUserCount(room)
        });

        // Notify self
        socket.emit('user-joined', {
            username: username,
            activeUsers: getRoomUserCount(room)
        });

        io.to(room).emit('system-notification', `${username} joined the room.`);

        // Notify Lobby (Global)
        io.emit('update-lobby');

        // --- AUTO SYNC LOGIC ---
        // distinct from broadcasting 'user-joined', we need to fetch state
        const roomSockets = io.sockets.adapter.rooms.get(room);
        if (roomSockets && roomSockets.size > 1) {
            // There is someone else in the room. Ask the first peer for state.
            // We need to find a socket ID that is NOT the current socket.id
            for (const id of roomSockets) {
                if (id !== socket.id) {
                    io.to(id).emit('request-sync', socket.id); // Ask this user to send state to new guy
                    break; // Only ask one person
                }
            }
        }
    });

    // Handle Sync Response
    socket.on('sync-response', (data) => {
        // data = { targetId, videoId, time, state }
        io.to(data.targetId).emit('sync-state', data);
    });

    socket.on('play', (time) => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('play', time);
            io.to(user.room).emit('system-notification', `${user.username} played video.`);
        }
    });

    socket.on('pause', (time) => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('pause', time);
            io.to(user.room).emit('system-notification', `${user.username} paused video.`);
        }
    });

    socket.on('seek', (time) => {
        const user = users[socket.id];
        if (user) socket.to(user.room).emit('seek', time);
    });

    socket.on('load-video', (videoId) => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('load-video', videoId);
            io.to(user.room).emit('system-notification', `${user.username} changed video.`);
        }
    });

    socket.on('chat-message', (message) => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('chat-message', {
                username: user.username,
                message: message
            });
        }
    });

    // Leave Room (Back to Lobby)
    socket.on('leave-room', () => {
        const user = users[socket.id];
        if (user) {
            const { room, username } = user;
            socket.leave(room);
            delete users[socket.id]; // Remove from active watchers

            io.to(room).emit('user-left', {
                username: username,
                activeUsers: getRoomUserCount(room)
            });
            io.to(room).emit('system-notification', `${username} left the room.`);

            // Notify Lobby
            io.emit('update-lobby');
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            const { room, username } = user;
            delete users[socket.id];

            io.to(room).emit('user-left', {
                username: username,
                activeUsers: getRoomUserCount(room)
            });
            io.to(room).emit('system-notification', `${username} left the room.`);

            // Notify Lobby
            io.emit('update-lobby');
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
