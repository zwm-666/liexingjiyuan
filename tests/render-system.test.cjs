const assert = require("assert");
const { createRenderSystem, getTerrainDecoration } = require("../js/render.js");
const { FACTIONS, BUILDINGS, UNIT_VISUAL } = require("../js/game-data.js");

function makeCtx() {
  const drawImageCalls = [];
  const fn = () => {};
  const ctx = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === "measureText") return () => ({ width: 10 });
        if (key === "drawImage")
          return (...args) => {
            drawImageCalls.push(args);
          };
        if (key === "__drawImageCalls") return drawImageCalls;
        return fn;
      },
      set: () => true,
    },
  );
  return ctx;
}

const G = {
  time: 0,
  players: { player: { faction: "starfire" }, enemy: { faction: "shadow" } },
};

const plateauDecoration = getTerrainDecoration(5, {
  north: 5,
  south: 0,
  east: 5,
  west: 3,
});
assert.equal(plateauDecoration.hasCliffShadow, true, "高地贴近低地时应生成崖壁阴影");
assert.ok(plateauDecoration.ridgeStrength > 0.2, "高地应有明显岩脊强度");

const dirtDecoration = getTerrainDecoration(1, {
  north: 3,
  south: 1,
  east: 0,
  west: 5,
});
assert.equal(dirtDecoration.hasDustOverlay, true, "坡道/峡谷边的土路应带有尘土覆盖");

const ctx = makeCtx();
const sprite = {
  naturalWidth: 64,
  naturalHeight: 64,
  __spriteMeta: {
    bbox: { left: 0, top: 0, right: 64, bottom: 48 },
  },
};
const render = createRenderSystem({
  getGame: () => G,
  ctx,
  TILE: 32,
  BUILDINGS,
  FACTIONS,
  UNIT_VISUAL,
  myOwner: () => "player",
  opponentOwner: () => "enemy",
  getUnitVisualKey: (e, map) => (e.isWorker ? "worker" : map[e.key] || "melee"),
  spriteLoader: {
    isReady: () => true,
    getBuildingSprite: () => sprite,
    getUnitSprite: () => null,
  },
});

assert.equal(typeof render.drawBuilding, "function", "应导出 drawBuilding");
assert.equal(typeof render.drawUnit, "function", "应导出 drawUnit");
render.drawBuilding({
  key: "barracks",
  owner: "player",
  x: 64,
  y: 64,
  size: 2,
  isConstructing: false,
  buildProgress: 0,
  buildTime: 1,
  flash: 0,
  productionQueue: [],
  rallyPoint: null,
  hp: 100,
  maxHp: 100,
  selected: false,
});

assert.equal(ctx.__drawImageCalls.length, 1, "建筑精灵路径应调用 drawImage");
assert.equal(ctx.__drawImageCalls[0][3], 64, "建筑精灵应保持原占地宽度绘制");
assert.equal(
  ctx.__drawImageCalls[0][2],
  48,
  "建筑精灵应根据透明底边向下补偿，避免浮空",
);

render.drawUnit({
  key: "warrior",
  owner: "player",
  x: 64,
  y: 64,
  hp: 100,
  maxHp: 100,
  selected: false,
  flash: 0,
  isWorker: false,
  canStealth: false,
  stealthed: false,
});

console.log("render-system test passed");
