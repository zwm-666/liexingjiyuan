const assert = require('assert');
const { createRenderSystem } = require('../js/render.js');
const { FACTIONS, BUILDINGS, UNIT_VISUAL } = require('../js/game-data.js');

function makeCtx() {
  const fn = () => {};
  return new Proxy({}, { get: (_, key) => key === 'measureText' ? (() => ({ width: 10 })) : fn, set: () => true });
}

const G = { time: 0, players: { player: { faction: 'starfire' }, enemy: { faction: 'shadow' } } };
const render = createRenderSystem({
  getGame: () => G,
  ctx: makeCtx(),
  TILE: 32,
  BUILDINGS,
  FACTIONS,
  UNIT_VISUAL,
  myOwner: () => 'player',
  opponentOwner: () => 'enemy',
  getUnitVisualKey: (e, map) => e.isWorker ? 'worker' : (map[e.key] || 'melee'),
});

assert.equal(typeof render.drawBuilding, 'function', '应导出 drawBuilding');
assert.equal(typeof render.drawUnit, 'function', '应导出 drawUnit');
render.drawBuilding({ key: 'base', owner: 'player', x: 64, y: 64, size: 3, isConstructing: false, buildProgress: 0, buildTime: 1, flash: 0, productionQueue: [], rallyPoint: null, hp: 100, maxHp: 100, selected: false });
render.drawUnit({ key: 'warrior', owner: 'player', x: 64, y: 64, hp: 100, maxHp: 100, selected: false, flash: 0, isWorker: false, canStealth: false, stealthed: false });

console.log('render-system test passed');

