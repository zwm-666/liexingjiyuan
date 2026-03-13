const assert = require('assert');
const { createNetworkSystem } = require('../js/network.js');

const sent = [];
const NET = { ws: { readyState: 1, send(msg) { sent.push(JSON.parse(msg)); }, close() {} }, connected: true, _pingInterval: null };
const system = createNetworkSystem({
  getNet: () => NET,
  WebSocketImpl: { OPEN: 1 },
  handleNetMessage: msg => msg,
});

system.netSend({ type: 'ping' });
assert.equal(sent[0].type, 'ping', '应发送消息');

system.netDisconnect();
assert.equal(NET.connected, false, '断开后应重置连接状态');

console.log('network-system test passed');
