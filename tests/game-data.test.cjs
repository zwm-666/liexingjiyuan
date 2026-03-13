const assert = require('assert');

const gameData = require('../js/game-data.js');

assert.ok(gameData.FACTIONS, '应导出 FACTIONS');
assert.ok(gameData.BUILDINGS, '应导出 BUILDINGS');
assert.ok(gameData.TECHS, '应导出 TECHS');
assert.ok(gameData.UNIT_VISUAL, '应导出 UNIT_VISUAL');
assert.ok(gameData.FACTIONS.starfire, '应包含 starfire 阵营');
assert.ok(gameData.BUILDINGS.base, '应包含 base 建筑');

console.log('game-data test passed');
