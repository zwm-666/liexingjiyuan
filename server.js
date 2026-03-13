const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

function genRoomId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do { id = ''; for (let i = 0; i < 4; i++) id += c[Math.floor(Math.random() * c.length)]; } while (rooms[id]);
  return id;
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', ws => {
  ws._roomId = null;
  ws._slot = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create') {
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
      // Notify the other player
      const other = room.players.find(p => p.ws !== ws);
      if (other) send(other.ws, { type: 'opponent_ready' });
      // Start if both ready
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
