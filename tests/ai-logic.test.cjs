const assert = require('assert');

const { getTechPriorities, chooseResearchTech, getTrainableUnitKeys } = require('../js/ai-logic.js');
const { FACTIONS, TECHS, BUILDINGS } = require('../js/game-data.js');

const shadowPriorities = getTechPriorities('shadow');
assert.equal(shadowPriorities[3], 'sh_siegetech', '暗影阵营应优先自己的攻城科技');
assert.ok(shadowPriorities.includes('sh_voidcurse'), '暗影阵营应包含终极科技优先级');

const ep = {
  faction: 'starfire',
  tier: 2,
  techs: { meleeUp1: true },
  resources: { wood: 200, food: 200, gold: 120 },
};
const researchKey = chooseResearchTech(ep, TECHS);
assert.equal(researchKey, 'rangedUp1', '应返回当前最先满足条件且尚未研究的科技');

const trainableT1 = getTrainableUnitKeys({
  unitKeys: Object.keys(FACTIONS.starfire.units),
  units: FACTIONS.starfire.units,
  resources: { wood: 1000, food: 1000, gold: 1000 },
  techs: {},
  maxTier: 1,
});
assert.ok(trainableT1.includes('warrior'), '应包含可生产的一阶单位');
assert.ok(!trainableT1.includes('tank'), '不应包含超出阶级的单位');

const workshopUnits = getTrainableUnitKeys({
  unitKeys: BUILDINGS.workshop.produces,
  units: FACTIONS.starfire.units,
  resources: { wood: 1000, food: 1000, gold: 1000 },
  techs: { sf_siegetech: true },
  exactTier: 2,
});
assert.ok(workshopUnits.includes('tank'), '工坊应能产出二阶近战单位');
assert.ok(workshopUnits.includes('catapult'), '满足科技后应能产出攻城单位');

console.log('ai-logic test passed');
