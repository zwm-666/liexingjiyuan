const assert = require('assert');
const { createInputSystem } = require('../js/input.js');

const G = {
  camera: { x: 0, y: 0, zoom: 1 },
  entities: [{ id: 1, x: 50, y: 50, hp: 10, owner: 'player', isBuilding: false }],
  selection: [],
};
const input = createInputSystem({
  getGame: () => G,
  TILE: 32,
  myOwner: () => 'player',
  opponentOwner: () => 'enemy',
  executeLocalCommand: () => {},
  notify: () => {},
  findNearestResource: () => null,
  findEntityNear: null,
});

const found = input.findEntityNear(52, 52, 'player');
assert.equal(found.id, 1, '应能找到附近实体');

const worldPos = input.touchToWorld({ clientX: 20, clientY: 30 });
assert.equal(worldPos.x, 20, '应转换触摸坐标');
assert.equal(worldPos.y, 30, '应转换触摸坐标');

console.log('input-system test passed');
