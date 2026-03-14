const assert = require("assert");
const {
  createCombatSystem,
  pickBuilderWorker,
  findNearbyResourceForWorker,
  resumeWorkerTask,
  cleanupDepletedResource,
} = require("../js/combat.js");

const G = {
  time: 0,
  entities: [],
  projectiles: [],
  particles: [],
  moveIndicators: [],
  map: {
    fogPlayer: Array.from({ length: 20 }, () => Array(20).fill(0)),
    fogEnemy: Array.from({ length: 20 }, () => Array(20).fill(0)),
  },
  players: { player: { faction: "starfire" }, enemy: { faction: "shadow" } },
  stats: { unitsKilled: 0, unitsLost: 0 },
};

let removed = null;
const combat = createCombatSystem({
  getGame: () => G,
  DMG_MULT: {
    normal: { light: 1, medium: 1, heavy: 1, building: 1 },
    magic: { light: 1.25, medium: 1.25, heavy: 2, building: 0.3 },
  },
  FACTIONS: { starfire: { units: { warrior: { pop: 2 } } } },
  TECHS: {},
  TILE: 32,
  myOwner: () => "player",
  getEntityById: (id) => G.entities.find((e) => e.id === id),
  removeEntity: (e) => {
    removed = e;
  },
  spawnUnit: () => ({ targetX: 0, targetY: 0, state: "idle" }),
  getProductionTime: () => 1,
  notify: () => {},
  findNearestEnemy: () => null,
  dealDamageHook: null,
});

const dmg = combat.calcDamage(
  { atk: 10, dmgType: "magic" },
  { armor: 0, armorType: "heavy", magicResist: 0 },
);
assert.equal(dmg, 20, "应正确计算伤害倍率");

const target = {
  id: 1,
  owner: "enemy",
  hp: 5,
  flash: 0,
  armor: 0,
  armorType: "light",
  isBase: false,
};
combat.dealDamage(
  { id: 99, owner: "player", atk: 10, dmgType: "normal", splash: 0 },
  target,
  5,
);
assert.equal(removed, target, "致死时应移除目标");

G.map.fogPlayer[19][19] = 2;
G.entities.push({
  id: 2,
  owner: "player",
  hp: 10,
  isBuilding: false,
  flying: false,
  x: 32,
  y: 32,
});

combat.updateFog();

assert.equal(G.map.fogPlayer[0][0], 2, "单位视野内应保持可见");
assert.equal(G.map.fogPlayer[19][19], 1, "旧可见区域应降级为已探索");

const chosenIdleBuilder = pickBuilderWorker(
  [
    { id: 1, x: 10, y: 10, hp: 10, state: "gathering", isBuilding: false },
    { id: 2, x: 60, y: 60, hp: 10, state: "idle", isBuilding: false },
    { id: 3, x: 30, y: 30, hp: 10, state: "idle", isBuilding: false },
  ],
  { x: 40, y: 40 },
);
assert.equal(chosenIdleBuilder.id, 3, "有空闲工人时应优先选择最近的空闲工人");

const chosenFallbackBuilder = pickBuilderWorker(
  [
    { id: 4, x: 10, y: 10, hp: 10, state: "returning", isBuilding: false },
    { id: 5, x: 25, y: 25, hp: 10, state: "moveToResource", isBuilding: false },
    { id: 6, x: 15, y: 15, hp: 10, state: "buildAssist", isBuilding: false },
  ],
  { x: 40, y: 40 },
);
assert.equal(chosenFallbackBuilder.id, 5, "无空闲工人时应选择最近的非建造工人");

const nearbyResource = findNearbyResourceForWorker(
  { x: 64, y: 64 },
  [
    { x: 20, y: 20, amount: 100, type: "wood" },
    { x: 4, y: 3, amount: 100, type: "wood" },
    { x: 2, y: 2, amount: 0, type: "wood" },
  ],
  32,
  4,
);
assert.equal(nearbyResource.x, 4, "空闲工人应搜索附近 4 格范围内的资源");

const workerToResume = {
  state: "buildAssist",
  targetId: 99,
  prevState: "gathering",
  prevGatherTarget: { x: 8, y: 8, amount: 20, type: "wood" },
  gatherTarget: null,
};
resumeWorkerTask(workerToResume, () => null);
assert.equal(
  workerToResume.state,
  "moveToResource",
  "建造完成后应恢复之前的采集任务",
);
assert.equal(
  workerToResume.gatherTarget.x,
  8,
  "建造完成后应恢复原来的资源目标",
);

const map = {
  tiles: [[4]],
  resourceBlocked: [[1]],
};
const depletedWood = {
  x: 0,
  y: 0,
  type: "wood",
  amount: 0,
  _beingGathered: true,
};
cleanupDepletedResource(map, depletedWood);
assert.equal(map.resourceBlocked[0][0], 0, "资源采尽后应释放占地");
assert.equal(map.tiles[0][0], 1, "木材采尽后应把森林地块清成普通地块");
assert.equal(depletedWood.destroyed, true, "资源采尽后应标记为已销毁");
assert.equal(
  depletedWood._beingGathered,
  false,
  "资源销毁后不应继续处于采集中",
);

console.log("combat-system test passed");
