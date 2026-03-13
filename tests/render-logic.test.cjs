const assert = require('assert');

const { getUnitVisualKey, getEntityDisplayInfo, getHealthBarColor } = require('../js/render-logic.js');
const { FACTIONS, BUILDINGS, UNIT_VISUAL } = require('../js/game-data.js');

const faction = FACTIONS.starfire;

assert.equal(getUnitVisualKey({ isWorker: true, key: 'worker' }, UNIT_VISUAL), 'worker', '工人应使用 worker 视觉类型');
assert.equal(getUnitVisualKey({ isWorker: false, key: 'tank' }, UNIT_VISUAL), 'heavy', '坦克应映射为 heavy 视觉类型');
assert.equal(getUnitVisualKey({ isWorker: false, key: 'unknown' }, UNIT_VISUAL), 'melee', '未知单位应回退到 melee');

const buildingInfo = getEntityDisplayInfo({ isBuilding: true, key: 'base' }, faction, BUILDINGS);
assert.equal(buildingInfo.name, BUILDINGS.base.name, '建筑显示名应来自 BUILDINGS');

const workerInfo = getEntityDisplayInfo({ isBuilding: false, isWorker: true, key: 'worker' }, faction, BUILDINGS);
assert.equal(workerInfo.name, faction.worker.name, '工人显示名应来自阵营工人定义');

const unitInfo = getEntityDisplayInfo({ isBuilding: false, isWorker: false, key: 'archer' }, faction, BUILDINGS);
assert.equal(unitInfo.icon, faction.units.archer.icon, '普通单位图标应来自阵营单位定义');

assert.equal(getHealthBarColor(80), '#4a4', '高血量应显示绿色');
assert.equal(getHealthBarColor(40), '#aa4', '中血量应显示黄色');
assert.equal(getHealthBarColor(10), '#a44', '低血量应显示红色');

console.log('render-logic test passed');
