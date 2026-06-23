const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};
const achievements = {
  first_kill: { name: 'Первая кровь', desc: 'Убейте первого бота', icon: '🗡️' },
  kill_10: { name: 'Охотник', desc: 'Совершите 10 убийств', icon: '🎯' },
  case_opened: { name: 'Коллекционер', desc: 'Откройте первый кейс', icon: '📦' },
  gold_skin: { name: 'Золотая удача', desc: 'Получите золотой скин', icon: '🌟' }
};
const playerAchievements = {};

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    socket.roomName = roomName;
    if (!rooms[roomName]) rooms[roomName] = { players: {} };
    rooms[roomName].players[socket.id] = {
      id: socket.id,
      position: { x: 0, y: 1.7, z: 5 },
      rotation: { yaw: 0, pitch: 0 },
      health: 100,
      nickname: socket.handshake.query.nickname || 'Player',
      weapon: 'ak47',
      skin: null,
      kills: 0,
      deaths: 0
    };
    if (!playerAchievements[socket.id]) {
      playerAchievements[socket.id] = {};
    }
    socket.emit('currentState', {
      room: rooms[roomName],
      myAchievements: playerAchievements[socket.id]
    });
    socket.to(roomName).emit('playerJoined', rooms[roomName].players[socket.id]);
  });

  socket.on('playerUpdate', (data) => {
    if (!socket.roomName || !rooms[socket.roomName]) return;
    const player = rooms[socket.roomName].players[socket.id];
    if (player) {
      Object.assign(player, data);
      socket.to(socket.roomName).emit('playerUpdate', { id: socket.id, ...data });
    }
  });

  socket.on('playerShoot', () => {
    socket.to(socket.roomName).emit('playerShoot', { id: socket.id });
  });

  socket.on('achievement', (achId) => {
    if (!playerAchievements[socket.id]) playerAchievements[socket.id] = {};
    if (!playerAchievements[socket.id][achId]) {
      playerAchievements[socket.id][achId] = true;
      socket.emit('achievementUnlocked', achievements[achId]);
    }
  });

  socket.on('botKilled', () => {
    const player = rooms[socket.roomName]?.players[socket.id];
    if (player) player.kills = (player.kills || 0) + 1;
    io.to(socket.roomName).emit('botKilled', { playerId: socket.id, kills: player?.kills });
  });

  socket.on('playerDied', () => {
    const player = rooms[socket.roomName]?.players[socket.id];
    if (player) player.deaths = (player.deaths || 0) + 1;
    io.to(socket.roomName).emit('playerDied', { id: socket.id, deaths: player?.deaths });
  });

  socket.on('disconnect', () => {
    console.log('Игрок вышел:', socket.id);
    if (socket.roomName && rooms[socket.roomName]) {
      delete rooms[socket.roomName].players[socket.id];
      io.to(socket.roomName).emit('playerLeft', socket.id);
      if (Object.keys(rooms[socket.roomName].players).length === 0) {
        delete rooms[socket.roomName];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});