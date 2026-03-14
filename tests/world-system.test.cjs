const assert = require("assert");
const { createWorldSystem } = require("../js/world.js");

const G = {
  map: { blocked: Array.from({ length: 4 }, () => Array(4).fill(0)) },
};
const world = createWorldSystem({
  getGame: () => G,
  TILE: 32,
  MAP_W: 4,
  MAP_H: 4,
});

const rngA = world.seedRandom(42);
const rngB = world.seedRandom(42);
assert.equal(rngA(), rngB(), "同种子随机数应一致");

world.markBuildingTiles(1, 1, 2, 1);
assert.equal(G.map.blocked[1][1], 1, "应标记建筑占地");
assert.equal(world.isPassable(1, 1), false, "被占地块不可通行");

const bigGame = { map: {} };
const largeWorld = createWorldSystem({
  getGame: () => bigGame,
  TILE: 32,
  MAP_W: 128,
  MAP_H: 128,
  FOG_UNEXPLORED: 0,
});
bigGame.rng = largeWorld.seedRandom(12345);
largeWorld.generateMap();

const woodCount = bigGame.map.resources.filter((r) => r.type === "wood").length;
const foodCount = bigGame.map.resources.filter((r) => r.type === "food").length;
const goldCount = bigGame.map.resources.filter((r) => r.type === "gold").length;

assert.ok(woodCount < 180, `木材点应明显减少，当前为 ${woodCount}`);
assert.ok(foodCount > 0, "应保留食物资源");
assert.ok(goldCount > 0, "应保留金矿资源");

console.log("world-system test passed");
