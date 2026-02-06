// STATE
let currentUser = null;
let currentRoom = null;
let player = null;
let isRemoteChange = false;
let socket = null;

// COMMON: Auth Check & Persistence
const savedUser = localStorage.getItem('wt_user');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
}

// Global Toast
function showToast(msg, type = 'normal') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// === PAGE ROUTING LOGIC ===
const pageId = document.body.id;

// 1. LOGIN PAGE
if (pageId === 'page-login') {
    if (currentUser) window.location.href = 'lobby.html'; // Auto-redirect if logged in

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();
            if (!username || !password) return showToast('Fill all fields', 'error');

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('wt_user', JSON.stringify(data));
                    window.location.href = 'lobby.html';
                } else {
                    showToast(data.error || 'Login failed', 'error');
                }
            } catch (e) { console.error(e); showToast('Server error', 'error'); }
        });
    }
}

// 2. REGISTER PAGE
if (pageId === 'page-register') {
    if (currentUser) window.location.href = 'lobby.html';

    const btnReg = document.getElementById('btn-register');
    if (btnReg) {
        btnReg.addEventListener('click', async () => {
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            if (!username || !password) return showToast('Fill all fields', 'error');

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (res.ok) {
                    alert('Account created! Please Log In.');
                    window.location.href = 'login.html';
                } else {
                    showToast(data.error || 'Register failed', 'error');
                }
            } catch (e) { console.error(e); showToast('Server error', 'error'); }
        });
    }
}

// 3. LOBBY PAGE
if (pageId === 'page-lobby') {
    if (!currentUser) window.location.href = 'login.html'; // Auth Guard

    document.getElementById('lobby-username').innerText = currentUser?.username || 'Guest';

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('wt_user');
        window.location.href = 'login.html';
    });

    // Load Rooms
    loadRooms();

    // Create Room
    document.getElementById('btn-create-room').addEventListener('click', async () => {
        const name = document.getElementById('new-room-name').value.trim();
        if (!name) return;

        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, created_by: currentUser.userId })
        });

        if (res.ok) {
            document.getElementById('new-room-name').value = '';
            // loadRooms() called by socket event below
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to create room', 'error');
        }
    });

    // Real-time Lobby Updates
    const socket = io();
    socket.on('update-lobby', () => {
        loadRooms();
    });
}

// 4. ROOM PAGE
if (pageId === 'page-room') {
    if (!currentUser) window.location.href = 'login.html'; // Auth Guard

    // Get Room Name from URL params
    const params = new URLSearchParams(window.location.search);
    const roomName = params.get('room');

    if (!roomName) {
        window.location.href = 'lobby.html';
    } else {
        currentRoom = roomName;
        document.getElementById('current-room-name').innerText = roomName;
        // connectSocket() moved to onPlayerReady to prevent race condition
    }

    // Leave Room
    document.getElementById('btn-leave-room').addEventListener('click', () => {
        // Disconnect handled by page navigation, but let's be clean
        if (socket) socket.emit('leave-room');
        window.location.href = 'lobby.html';
    });

    // -- Room Logic (Video/Chat) moved inside here --

    // Chat Send
    document.getElementById('send-btn').addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        const msg = input.value.trim();
        if (msg && socket) {
            socket.emit('chat-message', msg);
            input.value = '';
        }
    });

    // Video Load
    document.getElementById('load-video-btn').addEventListener('click', () => {
        let input = document.getElementById('video-id-input').value.trim();
        const match = input.match(/v=([a-zA-Z0-9_-]{11})/) || input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        const id = match ? match[1] : input;

        if (id.length === 11 && socket) {
            player.loadVideoById(id);
            socket.emit('load-video', id);
        }
    });

    // Initialize Player
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}


// --- HELPER FUNCTIONS ---

async function loadRooms() {
    const container = document.getElementById('room-list');
    if (!container) return;

    container.innerHTML = '<div class="room-card loading">Loading...</div>';

    try {
        const res = await fetch('/api/rooms');
        const rooms = await res.json();

        container.innerHTML = '';
        if (rooms.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: gray;">No rooms found. Create one!</div>';
            return;
        }

        rooms.forEach(room => {
            const card = document.createElement('div');
            card.className = 'room-card';

            const isActive = room.activeUsers > 0;
            const statusHtml = isActive
                ? `<span class="status-bulb active"></span> <span class="active-text">${room.activeUsers} Active</span>`
                : `<span class="status-bulb"></span> <span class="inactive-text">Empty</span>`;

            card.innerHTML = `
                <div class="room-header">
                    <h3>${room.name}</h3>
                    <div class="room-status">${statusHtml}</div>
                </div>
                <p class="room-creator">By ${room.creator_name || 'Unknown'}</p>
            `;
            // Navigate to room.html with query param
            card.onclick = () => {
                window.location.href = `room.html?room=${encodeURIComponent(room.name)}`;
            };
            container.appendChild(card);
        });
    } catch (e) {
        showToast('Failed to load rooms', 'error');
    }
}

function connectSocket() {
    socket = io();

    // Auto-join on connect
    socket.emit('join', { username: currentUser.username, room: currentRoom });

    socket.on('user-joined', (data) => {
        const countEl = document.getElementById('user-count-num');
        if (countEl) countEl.innerText = data.activeUsers;
        appendMessage(`${data.username} joined`, 'system');
    });

    socket.on('user-left', (data) => {
        const countEl = document.getElementById('user-count-num');
        if (countEl) countEl.innerText = data.activeUsers;
        appendMessage(`${data.username} left`, 'system');
    });

    socket.on('chat-message', (data) => appendMessage(data, 'chat'));
    socket.on('system-notification', (msg) => appendMessage(msg, 'system'));

    socket.on('play', (time) => {
        isRemoteChange = true;
        if (Math.abs(player.getCurrentTime() - time) > 0.5) player.seekTo(time, true);
        player.playVideo();
        setTimeout(() => isRemoteChange = false, 500);
    });

    socket.on('pause', (time) => {
        isRemoteChange = true;
        player.seekTo(time, true);
        player.pauseVideo();
        setTimeout(() => isRemoteChange = false, 500);
    });

    socket.on('load-video', (id) => {
        isRemoteChange = true;
        player.loadVideoById(id);
        const input = document.getElementById('video-id-input');
        if (input) input.value = id;
        setTimeout(() => isRemoteChange = false, 1000);
    });

    // --- AUTO SYNC LISTENERS ---
    socket.on('request-sync', (targetId) => {
        // I am the host/peer. Send my state to the server for 'targetId'
        if (player && player.getVideoData) {
            const data = {
                targetId: targetId,
                videoId: player.getVideoData().video_id,
                time: player.getCurrentTime(),
                state: player.getPlayerState()
            };
            socket.emit('sync-response', data);
        }
    });

    socket.on('sync-state', (data) => {
        // I am the new joiner. Apply the received state.
        if (!player) return;
        isRemoteChange = true;

        // Load video if different
        const currentId = player.getVideoData().video_id;
        if (currentId !== data.videoId) {
            player.loadVideoById(data.videoId, data.time);
            const input = document.getElementById('video-id-input');
            if (input) input.value = data.videoId;
        } else {
            // Same video, just seek
            player.seekTo(data.time, true);
        }

        // Play or Pause based on host state
        // State 1 = PLAYING, State 2 = PAUSED
        if (data.state === 1) {
            player.playVideo();
        } else {
            player.pauseVideo();
        }

        setTimeout(() => isRemoteChange = false, 1000);
        showToast('Synced with room!', 'success');
    });
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        videoId: 'dQw4w9WgXcQ',
        playerVars: { 'playsinline': 1, 'rel': 0 },
        events: {
            'onStateChange': onPlayerStateChange,
            'onReady': onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    // Player is ready, now we can connect and handle sync events safely
    connectSocket();
}

function onPlayerStateChange(event) {
    if (isRemoteChange || !socket) return;
    if (event.data === YT.PlayerState.PLAYING) socket.emit('play', player.getCurrentTime());
    else if (event.data === YT.PlayerState.PAUSED) socket.emit('pause', player.getCurrentTime());
}

function appendMessage(data, type) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    if (type === 'system') {
        div.className = 'message system';
        div.innerText = data;
    } else {
        div.className = `message ${data.username === currentUser.username ? 'mine' : 'others'}`;
        div.innerHTML = `<span class="message-username">${data.username === currentUser.username ? 'You' : data.username}</span>${data.message}`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
