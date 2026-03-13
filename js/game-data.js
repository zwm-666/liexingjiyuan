(function (global) {
  const exportsObj = {};

// ---- FACTION DATA ----
const FACTIONS = {
  starfire: {
    name: '星火族', icon: '🔥', color: '#ff4400', lightColor: '#ff8844',
    gatherSpeed: { wood: 8, food: 7, gold: 5 }, workerLoad: 10,
    worker: { name: '炽焰工人', icon: '👷', hp: 200, atk: 5, atkSpeed: 1.5, armor: 0, armorType: 'light', range: 40, speed: 1.8, costW: 0, costF: 30, costG: 0, time: 12, pop: 1 },
    units: {
      warrior:   { name: '狂战士', icon: '⚔', hp: 450, atk: 18, atkSpeed: 1.0, armor: 2, armorType: 'heavy', range: 40, speed: 2.2, costW: 0, costF: 120, costG: 0, time: 18, pop: 2, type: 'melee' },
      archer:    { name: '投火手', icon: '🏹', hp: 280, atk: 16, atkSpeed: 1.2, armor: 0, armorType: 'medium', range: 160, speed: 1.8, costW: 20, costF: 80, costG: 0, time: 20, pop: 2, type: 'ranged', dmgType: 'pierce' },
      mage:      { name: '烈焰法师', icon: '🔮', hp: 240, atk: 25, atkSpeed: 1.5, armor: 0, armorType: 'light', range: 176, speed: 1.4, costW: 50, costF: 80, costG: 60, time: 30, pop: 3, type: 'ranged', dmgType: 'magic', tier: 2 },
      tank:      { name: '熔岩巨兽', icon: '🗿', hp: 800, atk: 35, atkSpeed: 2.0, armor: 6, armorType: 'heavy', range: 40, speed: 1.2, costW: 0, costF: 180, costG: 40, time: 35, pop: 4, type: 'melee', tier: 2, splash: 40 },
      firebat:   { name: '焚天蝠', icon: '🦇', hp: 320, atk: 14, atkSpeed: 0.9, armor: 1, armorType: 'light', range: 120, speed: 2.6, costW: 60, costF: 90, costG: 40, time: 25, pop: 3, type: 'ranged', dmgType: 'magic', tier: 2, flying: true },
      catapult:  { name: '烈焰投石车', icon: '💣', hp: 350, atk: 50, atkSpeed: 3.5, armor: 2, armorType: 'heavy', range: 256, speed: 0.8, costW: 150, costF: 100, costG: 30, time: 38, pop: 4, type: 'ranged', dmgType: 'siege', tier: 2, splash: 60, techRequires: 'sf_siegetech' },
      phoenix:   { name: '凤凰', icon: '🦅', hp: 600, atk: 45, atkSpeed: 1.5, armor: 2, armorType: 'medium', range: 160, speed: 2.8, costW: 150, costF: 150, costG: 150, time: 50, pop: 6, type: 'ranged', dmgType: 'magic', tier: 3, flying: true, splash: 50 },
      infernal:  { name: '炎魔领主', icon: '👹', hp: 1200, atk: 70, atkSpeed: 2.0, armor: 8, armorType: 'heavy', range: 40, speed: 1.4, costW: 200, costF: 250, costG: 200, time: 60, pop: 8, type: 'melee', dmgType: 'magic', tier: 3, splash: 60, magicResist: 0.3, techRequires: 'sf_infernal' },
    }
  },
  shadow: {
    name: '幽影族', icon: '🌑', color: '#8844cc', lightColor: '#aa66ee',
    gatherSpeed: { wood: 7, food: 8, gold: 5 }, workerLoad: 8,
    worker: { name: '暗影工人', icon: '👷', hp: 200, atk: 5, atkSpeed: 1.5, armor: 0, armorType: 'light', range: 40, speed: 1.8, costW: 0, costF: 30, costG: 0, time: 10, pop: 1 },
    units: {
      warrior:    { name: '潜行者', icon: '🗡', hp: 240, atk: 20, atkSpeed: 0.9, armor: 1, armorType: 'light', range: 40, speed: 2.6, costW: 0, costF: 90, costG: 0, time: 15, pop: 2, type: 'melee', canStealth: true },
      archer:     { name: '夜刃射手', icon: '🏹', hp: 260, atk: 18, atkSpeed: 1.1, armor: 0, armorType: 'medium', range: 176, speed: 1.8, costW: 30, costF: 70, costG: 0, time: 18, pop: 2, type: 'ranged', dmgType: 'pierce' },
      cavalry:    { name: '黑暗骑士', icon: '🐴', hp: 650, atk: 32, atkSpeed: 1.8, armor: 5, armorType: 'heavy', range: 40, speed: 2.4, costW: 50, costF: 180, costG: 60, time: 35, pop: 4, type: 'melee', tier: 2 },
      warlock:    { name: '虚空术士', icon: '🔮', hp: 220, atk: 22, atkSpeed: 1.4, armor: 0, armorType: 'light', range: 176, speed: 1.5, costW: 40, costF: 60, costG: 80, time: 28, pop: 3, type: 'ranged', dmgType: 'magic', tier: 2 },
      banshee:    { name: '怨灵女妖', icon: '👻', hp: 280, atk: 16, atkSpeed: 1.0, armor: 0, armorType: 'light', range: 140, speed: 2.4, costW: 40, costF: 80, costG: 50, time: 26, pop: 3, type: 'ranged', dmgType: 'magic', tier: 2, flying: true, canStealth: true },
      siege:      { name: '绞肉车', icon: '💀', hp: 350, atk: 40, atkSpeed: 3.0, armor: 2, armorType: 'heavy', range: 224, speed: 1.0, costW: 120, costF: 80, costG: 40, time: 40, pop: 4, type: 'ranged', dmgType: 'siege', tier: 2, techRequires: 'sh_siegetech' },
      voiddragon: { name: '虚空蝠龙', icon: '🐲', hp: 700, atk: 40, atkSpeed: 1.2, armor: 4, armorType: 'medium', range: 150, speed: 3.0, costW: 180, costF: 180, costG: 200, time: 55, pop: 7, type: 'ranged', dmgType: 'magic', tier: 3, flying: true, canStealth: true },
      deathknight:{ name: '死亡骑士', icon: '💀', hp: 1000, atk: 55, atkSpeed: 1.5, armor: 7, armorType: 'heavy', range: 40, speed: 2.2, costW: 150, costF: 200, costG: 250, time: 60, pop: 8, type: 'melee', dmgType: 'magic', tier: 3, splash: 40, magicResist: 0.2, techRequires: 'sh_deathknight' },
    }
  },
  steel: {
    name: '钢铁联军', icon: '⚙️', color: '#6699cc', lightColor: '#88bbee',
    gatherSpeed: { wood: 8, food: 7, gold: 5 }, workerLoad: 15,
    worker: { name: '机械工人', icon: '👷', hp: 200, atk: 5, atkSpeed: 1.5, armor: 0, armorType: 'light', range: 40, speed: 1.8, costW: 0, costF: 30, costG: 0, time: 15, pop: 1 },
    units: {
      warrior:   { name: '列兵', icon: '🛡', hp: 400, atk: 15, atkSpeed: 1.1, armor: 3, armorType: 'heavy', range: 40, speed: 1.8, costW: 0, costF: 100, costG: 0, time: 16, pop: 2, type: 'melee' },
      sniper:    { name: '狙击手', icon: '🎯', hp: 200, atk: 30, atkSpeed: 1.9, armor: 0, armorType: 'light', range: 192, speed: 1.2, costW: 20, costF: 70, costG: 20, time: 22, pop: 2, type: 'ranged', dmgType: 'pierce' },
      steamtank: { name: '蒸汽坦克', icon: '🚂', hp: 900, atk: 45, atkSpeed: 2.2, armor: 8, armorType: 'heavy', range: 40, speed: 1.0, costW: 150, costF: 150, costG: 50, time: 40, pop: 5, type: 'melee', dmgType: 'siege', tier: 2, magicResist: 0.25 },
      engineer:  { name: '战地工程师', icon: '🔧', hp: 300, atk: 12, atkSpeed: 1.3, armor: 2, armorType: 'medium', range: 140, speed: 1.6, costW: 60, costF: 80, costG: 40, time: 25, pop: 3, type: 'ranged', tier: 2 },
      copter:    { name: '旋翼机', icon: '🚁', hp: 300, atk: 18, atkSpeed: 1.0, armor: 2, armorType: 'medium', range: 160, speed: 3.0, costW: 80, costF: 100, costG: 30, time: 28, pop: 3, type: 'ranged', dmgType: 'pierce', tier: 2, flying: true },
      artillery: { name: '重型火炮', icon: '💣', hp: 400, atk: 60, atkSpeed: 3.5, armor: 3, armorType: 'heavy', range: 280, speed: 0.7, costW: 180, costF: 120, costG: 60, time: 42, pop: 5, type: 'ranged', dmgType: 'siege', tier: 2, splash: 70, techRequires: 'st_siegetech' },
      dragon:    { name: '钢铁巨龙', icon: '🐉', hp: 2000, atk: 80, atkSpeed: 2.0, armor: 12, armorType: 'heavy', range: 160, speed: 1.2, costW: 400, costF: 400, costG: 300, time: 80, pop: 10, type: 'ranged', dmgType: 'normal', tier: 3, flying: true, splash: 80 },
      titan:     { name: '泰坦战甲', icon: '🤖', hp: 1800, atk: 65, atkSpeed: 1.8, armor: 14, armorType: 'heavy', range: 80, speed: 1.0, costW: 300, costF: 300, costG: 250, time: 65, pop: 8, type: 'melee', dmgType: 'siege', tier: 3, magicResist: 0.35, splash: 50, techRequires: 'st_titan' },
    }
  }
};

// Buildings data (shared + faction-specific adjustments)
const BUILDINGS = {
  base:        { name: '主基地', icon: '🏰', hp: 2500, armor: 10, costW: 400, costF: 0, costG: 0, time: 60, tier: 1, size: 3, produces: ['worker'], detectRange: 256, popAdd: 0, isBase: true },
  barracks:    { name: '兵营', icon: '⚔', hp: 1200, armor: 5, costW: 150, costF: 0, costG: 0, time: 30, tier: 1, size: 2, produces: ['warrior', 'archer'], requires: ['base'] },
  supply:      { name: '补给站', icon: '🏠', hp: 600, armor: 0, costW: 80, costF: 0, costG: 0, time: 20, tier: 1, size: 1, popAdd: 10, requires: ['base'] },
  harvester:   { name: '采集场', icon: '⛏', hp: 800, armor: 0, costW: 100, costF: 0, costG: 0, time: 25, tier: 1, size: 2, requires: ['base'] },
  tower:       { name: '防御塔', icon: '🗼', hp: 1000, armor: 5, costW: 120, costF: 0, costG: 50, time: 35, tier: 1, size: 1, detectRange: 192, towerAtk: 20, towerRange: 176, towerSpeed: 1.5, requires: ['base'] },
  researchlab: { name: '研究室', icon: '🔬', hp: 1000, armor: 3, costW: 150, costF: 0, costG: 80, time: 35, tier: 1, size: 2, produces: [], requires: ['barracks'], isResearchLab: true },
  workshop:    { name: '工坊', icon: '🔧', hp: 1500, armor: 8, costW: 200, costF: 0, costG: 100, time: 40, tier: 2, size: 2, produces: ['tank', 'cavalry', 'steamtank', 'catapult', 'siege', 'artillery'], requires: ['barracks'], needsTier: 2 },
  magetower:   { name: '法师塔', icon: '🔮', hp: 1000, armor: 3, costW: 180, costF: 0, costG: 120, time: 40, tier: 2, size: 2, produces: ['mage', 'warlock', 'engineer'], requires: ['barracks'], needsTier: 2 },
  airfield:    { name: '机场', icon: '🛫', hp: 1200, armor: 4, costW: 180, costF: 0, costG: 80, time: 35, tier: 2, size: 2, produces: ['firebat', 'banshee', 'copter'], requires: ['barracks'], needsTier: 2 },
  ultimate:    { name: '终极建筑', icon: '💎', hp: 3000, armor: 15, costW: 500, costF: 0, costG: 500, time: 90, tier: 3, size: 3, produces: ['phoenix', 'infernal', 'voiddragon', 'deathknight', 'dragon', 'titan'], requires: ['workshop'], needsTier: 3 },
};

// Tech tree
const TECHS = {
  // Generic techs (all factions)
  meleeUp1: { name: '近战打磨 Lv1', icon: '⚔', costW: 50, costF: 50, costG: 0, time: 30, tier: 1, effect: { meleeAtk: 0.1 }, desc: '近战攻击+10%' },
  meleeUp2: { name: '近战打磨 Lv2', icon: '⚔', costW: 100, costF: 100, costG: 0, time: 40, tier: 1, effect: { meleeAtk: 0.1 }, requires: ['meleeUp1'], desc: '近战攻击+10%' },
  armorUp1: { name: '护甲加固 Lv1', icon: '🛡', costW: 75, costF: 75, costG: 0, time: 30, tier: 1, effect: { armorAdd: 2 }, desc: '护甲+2' },
  armorUp2: { name: '护甲加固 Lv2', icon: '🛡', costW: 150, costF: 150, costG: 0, time: 40, tier: 1, effect: { armorAdd: 2 }, requires: ['armorUp1'], desc: '护甲+2' },
  rangedUp1: { name: '箭矢改良 Lv1', icon: '🏹', costW: 75, costF: 0, costG: 50, time: 30, tier: 1, effect: { rangedAtk: 0.1 }, desc: '远程攻击+10%' },
  rangedUp2: { name: '箭矢改良 Lv2', icon: '🏹', costW: 150, costF: 0, costG: 100, time: 45, tier: 1, effect: { rangedAtk: 0.1 }, requires: ['rangedUp1'], desc: '远程攻击+10%' },
  buildingHp: { name: '建筑加固', icon: '🏗', costW: 200, costF: 0, costG: 100, time: 50, tier: 2, effect: { buildingHp: 0.2, buildingArmor: 2 }, needsTier: 2, desc: '建筑+20%血+2甲' },
  workerLoad: { name: '负载提升', icon: '📦', costW: 100, costF: 100, costG: 0, time: 30, tier: 2, effect: { workerLoad: 5 }, needsTier: 2, desc: '工人负载+5' },
  goldEfficiency: { name: '资源提炼', icon: '🪙', costW: 200, costF: 200, costG: 100, time: 60, tier: 3, effect: { goldGather: 0.15 }, needsTier: 3, desc: '金币采集+15%' },
  // Starfire faction techs
  sf_siegetech: { name: '烈焰攻城术', icon: '💣', costW: 150, costF: 100, costG: 100, time: 45, tier: 2, effect: {}, needsTier: 2, desc: '解锁烈焰投石车', faction: 'starfire' },
  sf_splashUp: { name: '烈焰扩散', icon: '🔥', costW: 100, costF: 100, costG: 80, time: 40, tier: 2, effect: { splashBonus: 15 }, needsTier: 2, desc: '溅射范围+15', faction: 'starfire' },
  sf_infernal: { name: '召唤炎魔', icon: '👹', costW: 250, costF: 200, costG: 250, time: 70, tier: 3, effect: {}, needsTier: 3, desc: '解锁炎魔领主', faction: 'starfire' },
  sf_phoenixfire: { name: '涅槃之焰', icon: '🦅', costW: 200, costF: 150, costG: 200, time: 55, tier: 3, effect: { splashBonus: 20 }, needsTier: 3, requires: ['sf_splashUp'], desc: '溅射范围再+20', faction: 'starfire' },
  // Shadow faction techs
  sh_siegetech: { name: '亡骸攻城术', icon: '💀', costW: 120, costF: 100, costG: 80, time: 45, tier: 2, effect: {}, needsTier: 2, desc: '解锁绞肉车', faction: 'shadow' },
  sh_stealthUp: { name: '深度潜行', icon: '🌑', costW: 80, costF: 80, costG: 100, time: 40, tier: 2, effect: { stealthSpeed: 0.2 }, needsTier: 2, desc: '隐形单位速度+20%', faction: 'shadow' },
  sh_deathknight: { name: '亡灵召唤', icon: '💀', costW: 200, costF: 200, costG: 300, time: 70, tier: 3, effect: {}, needsTier: 3, desc: '解锁死亡骑士', faction: 'shadow' },
  sh_voidcurse: { name: '虚空诅咒', icon: '🌀', costW: 150, costF: 150, costG: 200, time: 55, tier: 3, effect: { voidCurse: true }, needsTier: 3, requires: ['sh_stealthUp'], desc: '暗影攻击附带减速', faction: 'shadow' },
  // Steel faction techs
  st_siegetech: { name: '重炮研发', icon: '💣', costW: 180, costF: 100, costG: 120, time: 45, tier: 2, effect: {}, needsTier: 2, desc: '解锁重型火炮', faction: 'steel' },
  st_heavyplating: { name: '重型装甲板', icon: '🛡', costW: 150, costF: 0, costG: 150, time: 40, tier: 2, effect: { heavyArmorBonus: 3 }, needsTier: 2, desc: '重甲单位护甲+3', faction: 'steel' },
  st_titan: { name: '泰坦协议', icon: '🤖', costW: 300, costF: 200, costG: 300, time: 70, tier: 3, effect: {}, needsTier: 3, desc: '解锁泰坦战甲', faction: 'steel' },
  st_overdrive: { name: '超载引擎', icon: '⚡', costW: 200, costF: 150, costG: 200, time: 55, tier: 3, effect: { mechSpeedBonus: 0.2 }, needsTier: 3, requires: ['st_heavyplating'], desc: '机械单位速度+20%', faction: 'steel' },
};

const UNIT_VISUAL = {
  warrior:'melee', archer:'ranged', mage:'caster', tank:'heavy', firebat:'flyBat', catapult:'siege',
  phoenix:'flyDragon', infernal:'heavy', cavalry:'cavalry', warlock:'caster', banshee:'flyBat',
  siege:'siege', voiddragon:'flyDragon', deathknight:'heavy', sniper:'ranged', steamtank:'mechTank',
  engineer:'caster', copter:'flyMech', artillery:'siege', dragon:'flyDragon', titan:'heavy'
};

  exportsObj.FACTIONS = FACTIONS;
  exportsObj.BUILDINGS = BUILDINGS;
  exportsObj.TECHS = TECHS;
  exportsObj.UNIT_VISUAL = UNIT_VISUAL;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEGameData = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
