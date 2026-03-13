const assert = require('assert');
const { createAiSystem } = require('../js/ai.js');
const { FACTIONS, BUILDINGS, TECHS } = require('../js/game-data.js');

const G = {
  isMultiplayer: false,
  aiTimer: 0.5,
  aiState: { attackTimer: 0 },
  players: {
    enemy: { faction: 'starfire', resources: { wood: 1000, food: 1000, gold: 1000 }, pop: 0, popMax: 10, techs: {}, tier: 1 },
  },
  diffSettings: { resMult: 1, atkInterval: 999 },
  entities: [
    { id: 1, owner: 'enemy', isBuilding: true, hp: 100, isBase: true, x: 200, y: 200, productionQueue: [], key: 'base' },
  ],
  time: 0,
};

let spawned = null;
const ai = createAiSystem({
  getGame: () => G,
  TILE: 32,
  MAP_W: 128,
  MAP_H: 128,
  BUILDINGS,
  FACTIONS,
  TECHS,
  isPassable: () => true,
  spawnBuilding: (owner, key, tx, ty) => (spawned = { owner, key, tx, ty, isConstructing: true, maxHp: 10, buildTime: 5, hp: 1, buildProgress: 0 }),
  chooseResearchTech: () => null,
  getTrainableUnitKeys: () => [],
});

ai.aiBuildBuilding('supply', G.players.enemy, G.entities[0], 6);
assert.ok(spawned, '应能通过 aiBuildBuilding 生成建筑');

ai.updateAI(0.5);
assert.ok(G.entities[0].productionQueue.length >= 1, 'AI 应尝试在基地排工人');

console.log('ai-system test passed');
