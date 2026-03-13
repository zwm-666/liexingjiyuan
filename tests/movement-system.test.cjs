const assert = require('assert');
const { createMovementSystem } = require('../js/movement.js');

const G = { pathQueue: [], time: 0, entities: [] };
const movement = createMovementSystem({
  getGame: () => G,
  TILE: 32,
  isPassable: () => true,
  findPath: () => [{ x: 64, y: 64 }],
  requestPathHook: null,
});

const entity = { x: 0, y: 0, hp: 10, speed: 64, pathPending: false, path: null, pathIndex: 0, pathTarget: null, flying: false };
movement.requestPath(entity, 64, 64);
assert.equal(G.pathQueue.length, 1, 'requestPath 应入队');
assert.equal(entity.pathPending, true, 'requestPath 应标记等待中');
movement.processPathQueue();
assert.equal(entity.pathPending, false, 'processPathQueue 应清除等待标记');
assert.equal(entity.path.length, 1, '应写入路径结果');

const reached = movement.moveDirectly(entity, 32, 0, 1);
assert.equal(reached, true, '足够步长时应直接抵达');
assert.equal(entity.x, 32, '应更新 x 坐标');

const buildingEdge = movement.getInteractionPoint({ x: 32, y: 96 }, 96, 96, 2, 16);
assert.deepEqual(buildingEdge, { x: 48, y: 96 }, '应返回目标建筑边缘的交互点');

const resourceEdge = movement.getInteractionPoint({ x: 32, y: 32 }, 96, 32, 1, 4);
assert.deepEqual(resourceEdge, { x: 76, y: 32 }, '应返回资源边缘的交互点');

const blockedMovement = createMovementSystem({
  getGame: () => G,
  TILE: 32,
  isPassable: (tx, ty) => !(tx >= 2 && tx <= 3 && ty >= 2 && ty <= 3),
  findPath: () => null,
});

const worker = { x: 32, y: 96, hp: 10, speed: 32, pathPending: false, path: null, pathIndex: 0, pathTarget: null, flying: false };
let arrived = false;
for (let i = 0; i < 10; i++) {
  arrived = blockedMovement.moveToward(worker, 96, 96, 0.2, 40);
  if (arrived) break;
}
assert.equal(arrived, true, '目标点被建筑占用时，到达交互半径也应视为抵达');
assert.equal(Math.floor(worker.x / 32), 1, '单位不应走进被建筑占据的格子');

const overlappingA = { x: 50, y: 50, hp: 10, flying: false, isBuilding: false, state: 'idle' };
const overlappingB = { x: 58, y: 50, hp: 10, flying: false, isBuilding: false, state: 'idle' };
G.entities = [overlappingA, overlappingB];
movement.updateUnitSeparation();
assert.equal(overlappingA.x, 50, '单位之间应允许通行，不应再被强制推开');
assert.equal(overlappingB.x, 58, '单位之间应允许通行，不应再被强制推开');

console.log('movement-system test passed');
