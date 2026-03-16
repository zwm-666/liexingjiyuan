const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};
const matchQueue = []; // Matchmaking queue: [{ ws, faction }]

function genRoomId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do { id = ''; for (let i = 0; i < 4; i++) id += c[Math.floor(Math.random() * c.length)]; } while (rooms[id]);
  return id;
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function removeFromQueue(ws) {
  const idx = matchQueue.findIndex(e => e.ws === ws);
  if (idx !== -1) matchQueue.splice(idx, 1);
}

function tryMatch() {
  while (matchQueue.length >= 2) {
    const p1 = matchQueue.shift();
    const p2 = matchQueue.shift();
    // Verify both still connected
    if (p1.ws.readyState !== WebSocket.OPEN) {
      if (p2.ws.readyState === WebSocket.OPEN) matchQueue.unshift(p2);
      continue;
    }
    if (p2.ws.readyState !== WebSocket.OPEN) {
      matchQueue.unshift(p1);
      continue;
    }
    // Create room and start game
    const roomId = genRoomId();
    const seed = Math.floor(Math.random() * 2147483647);
    rooms[roomId] = {
      players: [
        { ws: p1.ws, faction: p1.faction, slot: 'player', ready: true },
        { ws: p2.ws, faction: p2.faction, slot: 'enemy', ready: true }
      ],
      state: 'playing', seed, cmdSeq: 0
    };
    p1.ws._roomId = roomId;
    p1.ws._slot = 'player';
    p2.ws._roomId = roomId;
    p2.ws._slot = 'enemy';

    const startMsg = {
      type: 'match_found',
      roomId,
      seed,
      factions: { player: p1.faction, enemy: p2.faction }
    };
    send(p1.ws, { ...startMsg, slot: 'player' });
    send(p2.ws, { ...startMsg, slot: 'enemy' });
  }
}

wss.on('connection', ws => {
  ws._roomId = null;
  ws._slot = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // --- Matchmaking ---
    if (msg.type === 'match') {
      removeFromQueue(ws);
      matchQueue.push({ ws, faction: msg.faction });
      send(ws, { type: 'queued', position: matchQueue.length });
      tryMatch();
    }

    else if (msg.type === 'cancel_match') {
      removeFromQueue(ws);
      send(ws, { type: 'match_cancelled' });
    }

    // --- Legacy room system (keep for private matches) ---
    else if (msg.type === 'create') {
      const roomId = genRoomId();
      const seed = Math.floor(Math.random() * 2147483647);
      rooms[roomId] = {
        players: [{ ws, faction: msg.faction, slot: 'player', ready: false }],
        state: 'waiting', seed, cmdSeq: 0
      };
      ws._roomId = roomId;
      ws._slot = 'player';
      send(ws, { type: 'created', roomId, slot: 'player' });
    }

    else if (msg.type === 'join') {
      const rid = (msg.roomId || '').toUpperCase();
      const room = rooms[rid];
      if (!room || room.state !== 'waiting' || room.players.length >= 2) {
        send(ws, { type: 'error', msg: room ? '房间已满' : '房间不存在' });
        return;
      }
      room.players.push({ ws, faction: msg.faction, slot: 'enemy', ready: false });
      ws._roomId = rid;
      ws._slot = 'enemy';
      send(ws, { type: 'joined', slot: 'enemy', opponentFaction: room.players[0].faction });
      send(room.players[0].ws, { type: 'opponent_joined', opponentFaction: msg.faction });
    }

    else if (msg.type === 'ready') {
      const room = rooms[ws._roomId];
      if (!room) return;
      const p = room.players.find(p => p.ws === ws);
      if (p) p.ready = true;
      const other = room.players.find(p => p.ws !== ws);
      if (other) send(other.ws, { type: 'opponent_ready' });
      if (room.players.length === 2 && room.players.every(p => p.ready)) {
        room.state = 'playing';
        const startMsg = {
          type: 'start', seed: room.seed,
          factions: { player: room.players[0].faction, enemy: room.players[1].faction }
        };
        room.players.forEach(p => send(p.ws, startMsg));
      }
    }

    else if (msg.type === 'cmd') {
      const room = rooms[ws._roomId];
      if (!room || room.state !== 'playing') return;
      const seq = room.cmdSeq++;
      const relay = { type: 'cmd', cmd: msg.cmd, seq, from: ws._slot };
      room.players.forEach(p => send(p.ws, relay));
    }

    else if (msg.type === 'ping') {
      send(ws, { type: 'pong' });
    }
  });

  ws.on('close', () => {
    // Remove from matchmaking queue
    removeFromQueue(ws);
    // Handle room disconnect
    const rid = ws._roomId;
    if (!rid || !rooms[rid]) return;
    const room = rooms[rid];
    const other = room.players.find(p => p.ws !== ws);
    if (other && other.ws.readyState === WebSocket.OPEN) {
      send(other.ws, { type: 'opponent_disconnected' });
    }
    delete rooms[rid];
  });
});

console.log('Rift Star Era - WebSocket server running on port ' + PORT);
console.log('Matchmaking enabled');
