const assert = require("assert");

const { createEntityFactory } = require("../js/entity-factory.js");
const { FACTIONS, BUILDINGS } = require("../js/game-data.js");

const state = {
  nextId: 1,
  entities: [],
  entityIndex: new Map(),
  isMultiplayer: false,
  players: {
    player: { faction: "starfire", techs: {}, pop: 0, popMax: 10 },
    enemy: { faction: "shadow", techs: {}, pop: 0, popMax: 10 },
  },
  stats: { buildingsBuilt: 0 },
};

const markedTiles = [];

const factory = createEntityFactory({
  state,
  tileSize: 32,
  gameData: { FACTIONS, BUILDINGS },
  myOwner: () => "player",
  markBuildingTiles: (tx, ty, size, value) =>
    markedTiles.push({ tx, ty, size, value }),
});

const worker = factory.spawnUnit("player", "worker", 100, 120, true);
assert.equal(worker.id, 1, "首个单位 id 应为 1");
assert.equal(state.players.player.pop, 1, "生产工人应增加人口");
assert.equal(factory.getEntityById(1), worker, "应能通过索引按 id 找到单位");

const base = factory.spawnBuilding("player", "base", 4, 5);
assert.equal(base.id, 2, "建筑 id 应递增");
assert.equal(base.size, BUILDINGS.base.size, "建筑尺寸应来自配置");
assert.equal(markedTiles.length, 1, "创建建筑时应标记占地");
assert.equal(factory.getEntityById(2), base, "应能通过索引按 id 找到建筑");

state.players.player.popMax = 145;
const cappedSupplyA = factory.spawnBuilding("player", "supply", 8, 8);
assert.equal(cappedSupplyA.popAdd, 5, "补给站人口加成应在 150 上限处截断");
assert.equal(state.players.player.popMax, 150, "人口上限应封顶为 150");

const cappedSupplyB = factory.spawnBuilding("player", "supply", 10, 8);
assert.equal(cappedSupplyB.popAdd, 0, "达到人口上限后新增补给站不再增加人口");
assert.equal(state.players.player.popMax, 150, "达到人口上限后应保持不变");

factory.removeEntity(worker);
assert.equal(state.players.player.pop, 0, "移除单位应回收人口");
assert.equal(factory.getEntityById(1), undefined, "移除后索引应同步删除");

factory.removeEntity(cappedSupplyA);
assert.equal(
  state.players.player.popMax,
  145,
  "移除有效补给站后应回退人口上限",
);
factory.removeEntity(cappedSupplyB);
assert.equal(
  state.players.player.popMax,
  145,
  "移除无效补给站不应继续降低人口上限",
);

console.log("entity-factory test passed");
