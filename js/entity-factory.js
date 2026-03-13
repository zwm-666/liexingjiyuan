(function (global) {
  function createEntityFactory(options) {
    const state = options.state;
    const TILE = options.tileSize || 32;
    const MAX_POP_CAP = options.maxPopCap || 150;
    const gameData = options.gameData || global.RSEGameData || {};
    const FACTIONS = gameData.FACTIONS || {};
    const BUILDINGS = gameData.BUILDINGS || {};
    const myOwner = options.myOwner || (() => "player");
    const markBuildingTiles = options.markBuildingTiles || (() => {});
    const createDeathParticles = options.createDeathParticles || (() => {});

    if (!state.entityIndex) state.entityIndex = new Map();

    function addEntityToIndex(entity) {
      state.entityIndex.set(entity.id, entity);
    }

    function removeEntityFromIndex(entity) {
      state.entityIndex.delete(entity.id);
    }

    function createEntity(owner, type, key, x, y, extraData) {
      const id = state.nextId++;
      const entity = {
        id,
        owner,
        type,
        key,
        x,
        y,
        targetX: x,
        targetY: y,
        hp: 0,
        maxHp: 0,
        armor: 0,
        armorType: "medium",
        atk: 0,
        atkSpeed: 1.0,
        range: 0,
        speed: 0,
        state: "idle",
        stateTimer: 0,
        targetId: null,
        atkCooldown: 0,
        isBuilding: type === "building",
        buildProgress: 0,
        buildTime: 0,
        isConstructing: false,
        productionQueue: [],
        productionTimer: 0,
        rallyPoint: null,
        isWorker: false,
        carrying: 0,
        carryType: null,
        gatherTarget: null,
        flash: 0,
        selected: false,
        visible: true,
        flying: false,
        canStealth: false,
        stealthed: false,
        detectRange: 0,
        popCost: 0,
        tier: 1,
        dmgType: "normal",
        magicResist: 0,
        splash: 0,
        size: 1,
        path: null,
        pathIndex: 0,
        pathPending: false,
        pathTarget: null,
        ...extraData,
      };
      state.entities.push(entity);
      addEntityToIndex(entity);
      return entity;
    }

    function spawnBuilding(owner, key, tx, ty) {
      const bd = BUILDINGS[key];
      if (!bd) return null;
      const x = tx * TILE + (bd.size * TILE) / 2;
      const y = ty * TILE + (bd.size * TILE) / 2;
      const playerData = state.players[owner];
      const techHpMult = playerData.techs.buildingHp ? 1.2 : 1;
      const techArmorAdd = playerData.techs.buildingArmor ? 2 : 0;
      const isAI = !state.isMultiplayer && owner === "enemy";
      const rawPopAdd = bd.popAdd || 0;
      const availablePopRoom = Math.max(0, MAX_POP_CAP - playerData.popMax);
      const appliedPopAdd = Math.min(rawPopAdd, availablePopRoom);
      const entity = createEntity(owner, "building", key, x, y, {
        maxHp: Math.floor(bd.hp * techHpMult),
        hp: isAI ? Math.floor(bd.hp * techHpMult) : 1,
        armor: bd.armor + techArmorAdd,
        armorType: "building",
        buildTime: bd.time,
        buildProgress: isAI ? bd.time : 0,
        isConstructing: !isAI,
        detectRange: bd.detectRange || 0,
        towerAtk: bd.towerAtk || 0,
        towerRange: bd.towerRange || 0,
        towerSpeed: bd.towerSpeed || 0,
        popAdd: appliedPopAdd,
        size: bd.size,
        isBase: bd.isBase || false,
        isResearchLab: bd.isResearchLab || false,
        researchItem: null,
        researchTimer: 0,
      });
      if (entity.popAdd)
        playerData.popMax = Math.min(
          MAX_POP_CAP,
          playerData.popMax + entity.popAdd,
        );
      if (owner === myOwner() && state.stats) state.stats.buildingsBuilt++;
      markBuildingTiles(tx, ty, bd.size, 1);
      entity._tileX = tx;
      entity._tileY = ty;
      return entity;
    }

    function spawnUnit(owner, key, x, y, isWorker) {
      const playerData = state.players[owner];
      const faction = FACTIONS[playerData.faction];
      let data;
      if (isWorker) {
        data = faction.worker;
      } else {
        data = faction.units[key];
        if (!data) return null;
      }
      const meleeBonus = playerData.techs.meleeAtk || 0;
      const rangedBonus = playerData.techs.rangedAtk || 0;
      const armorBonus = playerData.techs.armorAdd || 0;
      const splashBonus = playerData.techs.splashBonus || 0;
      const heavyArmorBonus =
        data.armorType === "heavy" ? playerData.techs.heavyArmorBonus || 0 : 0;
      const stealthSpeedBonus = data.canStealth
        ? playerData.techs.stealthSpeed || 0
        : 0;
      const mechSpeedBonus =
        !data.flying && (data.tier || 1) >= 2
          ? playerData.techs.mechSpeedBonus || 0
          : 0;
      const isRanged = data.type === "ranged";
      const atkMult = isRanged
        ? 1 + rangedBonus
        : data.range <= 40
          ? 1 + meleeBonus
          : 1;
      const speedMult = 1 + stealthSpeedBonus + mechSpeedBonus;

      const entity = createEntity(owner, "unit", key, x, y, {
        maxHp: data.hp,
        hp: data.hp,
        atk: Math.floor(data.atk * atkMult),
        atkSpeed: data.atkSpeed,
        armor: data.armor + armorBonus + heavyArmorBonus,
        armorType: data.armorType,
        range: data.range,
        speed: data.speed * TILE * speedMult,
        isWorker,
        carrying: 0,
        carryType: null,
        popCost: data.pop || 2,
        flying: data.flying || false,
        canStealth: data.canStealth || false,
        dmgType: data.dmgType || "normal",
        magicResist: data.magicResist || 0,
        splash: (data.splash || 0) + (data.splash ? splashBonus : 0),
        tier: data.tier || 1,
      });
      playerData.pop += entity.popCost;
      return entity;
    }

    function getProductionTime(item, ownerKey) {
      const faction = FACTIONS[state.players[ownerKey].faction];
      if (item.isWorker) return faction.worker.time;
      const unitData = faction.units[item.key];
      return unitData ? unitData.time : 20;
    }

    function getEntityById(id) {
      return state.entityIndex.get(id);
    }

    function removeEntity(entity) {
      if (entity.type === "unit") {
        state.players[entity.owner].pop -= entity.popCost;
      }
      if (entity.isBuilding && entity.popAdd) {
        state.players[entity.owner].popMax = Math.max(
          10,
          state.players[entity.owner].popMax - entity.popAdd,
        );
      }
      if (entity.isBuilding && entity._tileX != null) {
        markBuildingTiles(entity._tileX, entity._tileY, entity.size, 0);
      }
      createDeathParticles(entity);
      const index = state.entities.indexOf(entity);
      if (index >= 0) state.entities.splice(index, 1);
      removeEntityFromIndex(entity);
    }

    return {
      createEntity,
      spawnBuilding,
      spawnUnit,
      getProductionTime,
      getEntityById,
      removeEntity,
      addEntityToIndex,
      removeEntityFromIndex,
    };
  }

  const exportsObj = { createEntityFactory };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEEntityFactory = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
