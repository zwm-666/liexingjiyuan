(function (global) {
  function createAiSystem(options) {
    let G = null;
    const getGame = options.getGame;
    const TILE = options.TILE;
    const MAP_W = options.MAP_W;
    const MAP_H = options.MAP_H;
    const FOG_VISIBLE = options.FOG_VISIBLE;
    const BUILDINGS = options.BUILDINGS;
    const FACTIONS = options.FACTIONS;
    const TECHS = options.TECHS;
    const isPassable = options.isPassable;
    const canPlaceBuildingAt =
      options.canPlaceBuildingAt || ((_, tx, ty) => isPassable(tx, ty));
    const MAX_POP_CAP = options.maxPopCap || 150;
    const TOP_TIER_LIMIT_PER_TYPE = options.topTierPerType || 1;
    const spawnBuilding = options.spawnBuilding;
    const chooseResearchTech = options.chooseResearchTech;
    const getTrainableUnitKeys = options.getTrainableUnitKeys;
    const notify = options.notify || (() => {});
    const distance =
      options.distance ||
      ((a, b) => {
        const dx = a.x - b.x,
          dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
      });

    function aiBuildBuilding(key, ep, enemyBase, radiusTiles) {
      const bd = BUILDINGS[key];
      if (key === "supply" && ep.popMax >= MAX_POP_CAP) return;
      if (
        ep.resources.wood < bd.costW ||
        ep.resources.food < (bd.costF || 0) ||
        ep.resources.gold < (bd.costG || 0)
      )
        return;
      // Try a few random positions
      for (let attempt = 0; attempt < 5; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const tx = Math.floor(
          enemyBase.x / TILE + Math.cos(angle) * radiusTiles,
        );
        const ty = Math.floor(
          enemyBase.y / TILE + Math.sin(angle) * radiusTiles,
        );
        const margin = bd.size + 1;
        if (tx <= 0 || tx >= MAP_W - margin || ty <= 0 || ty >= MAP_H - margin)
          continue;
        const valid = canPlaceBuildingAt(key, tx, ty);
        if (!valid) continue;
        const b = spawnBuilding("enemy", key, tx, ty);
        if (b) {
          b.isConstructing = false;
          b.hp = b.maxHp;
          b.buildProgress = b.buildTime;
          ep.resources.wood -= bd.costW;
          ep.resources.food -= bd.costF || 0;
          ep.resources.gold -= bd.costG || 0;
        }
        return;
      }
    }

    function updateAI(dt) {
      if (G.isMultiplayer) return;
      G.aiTimer += dt;
      if (G.aiTimer < 0.5) return; // Run every 0.5s
      G.aiTimer = 0;

      const ai = G.aiState;
      const ep = G.players.enemy;
      ep.popMax = Math.min(ep.popMax, MAX_POP_CAP);
      const diff = G.diffSettings;
      // Resource bonus
      ep.resources.wood += diff.resMult > 1 ? (diff.resMult - 1) * 30 : 0;
      ep.resources.food += diff.resMult > 1 ? (diff.resMult - 1) * 30 : 0;
      ep.resources.gold += diff.resMult > 1 ? (diff.resMult - 1) * 10 : 0;

      const enemyBuildings = G.entities.filter(
        (e) => e.owner === "enemy" && e.isBuilding && e.hp > 0,
      );
      const enemyUnits = G.entities.filter(
        (e) => e.owner === "enemy" && !e.isBuilding && e.hp > 0,
      );
      const enemyWorkers = enemyUnits.filter((e) => e.isWorker);
      const enemyCombat = enemyUnits.filter((e) => !e.isWorker);
      const enemyBase = enemyBuildings.find((b) => b.isBase);

      if (!enemyBase) return;
      const faction = FACTIONS[ep.faction];

      function countEnemyUnitIncludingQueue(unitKey) {
        let count = 0;
        for (const entity of G.entities) {
          if (entity.owner !== "enemy" || entity.hp <= 0) continue;
          if (!entity.isBuilding && entity.key === unitKey) count++;
          if (
            entity.isBuilding &&
            entity.productionQueue &&
            entity.productionQueue.length > 0
          ) {
            for (const item of entity.productionQueue) {
              if (!item.isWorker && item.key === unitKey) count++;
            }
          }
        }
        return count;
      }

      function canQueueEnemyUnit(unitKey) {
        const unitData = faction.units[unitKey];
        if (!unitData) return false;
        const popNeed = unitData.pop || 2;
        if (ep.pop + popNeed > ep.popMax) return false;
        if (
          (unitData.tier || 1) >= 3 &&
          countEnemyUnitIncludingQueue(unitKey) >= TOP_TIER_LIMIT_PER_TYPE
        ) {
          return false;
        }
        return true;
      }

      // Build workers (up to 12)
      if (
        enemyWorkers.length < 12 &&
        ep.resources.food >= FACTIONS[ep.faction].worker.costF &&
        ep.pop < ep.popMax
      ) {
        const base = enemyBuildings.find(
          (b) => b.isBase && b.productionQueue.length < 3,
        );
        if (base) {
          base.productionQueue.push({ key: "worker", isWorker: true });
          ep.resources.food -= FACTIONS[ep.faction].worker.costF;
          ep.pop += 1;
        }
      }

      // Build supply if near pop cap
      if (
        ep.pop >= ep.popMax - 3 &&
        enemyBuildings.filter((b) => b.key === "supply").length < 6
      ) {
        aiBuildBuilding("supply", ep, enemyBase, 6);
      }

      // Build barracks
      const barracks = enemyBuildings.filter((b) => b.key === "barracks");
      if (barracks.length < 2) {
        aiBuildBuilding("barracks", ep, enemyBase, 5);
      }

      // Upgrade tier
      if (G.time > 180 && ep.tier < 2) ep.tier = 2;
      if (G.time > 360 && ep.tier < 3) ep.tier = 3;

      // Build workshop at T2
      if (ep.tier >= 2 && !enemyBuildings.find((b) => b.key === "workshop")) {
        aiBuildBuilding("workshop", ep, enemyBase, 7);
      }

      // Build research lab (after barracks)
      if (
        !enemyBuildings.find((b) => b.key === "researchlab") &&
        barracks.length > 0
      ) {
        aiBuildBuilding("researchlab", ep, enemyBase, 6);
      }

      // Build magetower at T2
      if (ep.tier >= 2 && !enemyBuildings.find((b) => b.key === "magetower")) {
        aiBuildBuilding("magetower", ep, enemyBase, 7);
      }

      // Build airfield at T2
      if (ep.tier >= 2 && !enemyBuildings.find((b) => b.key === "airfield")) {
        aiBuildBuilding("airfield", ep, enemyBase, 7);
      }

      // Build ultimate at T3
      if (
        ep.tier >= 3 &&
        !enemyBuildings.find((b) => b.key === "ultimate") &&
        enemyBuildings.find((b) => b.key === "workshop")
      ) {
        aiBuildBuilding("ultimate", ep, enemyBase, 8);
      }

      // AI Tech research from research lab
      const researchLab = enemyBuildings.find(
        (b) => b.key === "researchlab" && !b.isConstructing && !b.researchItem,
      );
      if (researchLab) {
        const techKey = chooseResearchTech(ep, TECHS);
        if (techKey) {
          const tech = TECHS[techKey];
          ep.resources.wood -= tech.costW;
          ep.resources.food -= tech.costF;
          ep.resources.gold -= tech.costG;
          researchLab.researchItem = techKey;
          researchLab.researchTimer = 0;
        }
      }

      // Produce combat units from barracks (T1 only)
      for (const bk of barracks) {
        if (bk.productionQueue.length < 3 && ep.pop < ep.popMax) {
          const unitKeys = getTrainableUnitKeys({
            unitKeys: Object.keys(faction.units),
            units: faction.units,
            resources: ep.resources,
            techs: ep.techs,
            maxTier: 1,
          });
          const queueableKeys = unitKeys.filter(canQueueEnemyUnit);
          if (queueableKeys.length > 0) {
            const key =
              queueableKeys[
                Math.floor(Math.random() * Math.min(queueableKeys.length, 2))
              ];
            const u = faction.units[key];
            bk.productionQueue.push({ key, isWorker: false });
            ep.resources.wood -= u.costW || 0;
            ep.resources.food -= u.costF || 0;
            ep.resources.gold -= u.costG || 0;
          }
        }
      }

      // T2 units from workshop
      const workshop = enemyBuildings.find((b) => b.key === "workshop");
      if (
        workshop &&
        workshop.productionQueue.length < 2 &&
        ep.pop < ep.popMax
      ) {
        const unitKeys = getTrainableUnitKeys({
          unitKeys: BUILDINGS.workshop.produces,
          units: faction.units,
          resources: ep.resources,
          techs: ep.techs,
          exactTier: 2,
        });
        const queueableKeys = unitKeys.filter(canQueueEnemyUnit);
        if (queueableKeys.length > 0) {
          const key =
            queueableKeys[Math.floor(Math.random() * queueableKeys.length)];
          const u = faction.units[key];
          workshop.productionQueue.push({ key, isWorker: false });
          ep.resources.wood -= u.costW || 0;
          ep.resources.food -= u.costF || 0;
          ep.resources.gold -= u.costG || 0;
        }
      }

      // T2 units from magetower
      const magetower = enemyBuildings.find((b) => b.key === "magetower");
      if (
        magetower &&
        magetower.productionQueue.length < 2 &&
        ep.pop < ep.popMax
      ) {
        const unitKeys = getTrainableUnitKeys({
          unitKeys: BUILDINGS.magetower.produces,
          units: faction.units,
          resources: ep.resources,
          techs: ep.techs,
        });
        const queueableKeys = unitKeys.filter(canQueueEnemyUnit);
        if (queueableKeys.length > 0) {
          const key =
            queueableKeys[Math.floor(Math.random() * queueableKeys.length)];
          const u = faction.units[key];
          magetower.productionQueue.push({ key, isWorker: false });
          ep.resources.wood -= u.costW || 0;
          ep.resources.food -= u.costF || 0;
          ep.resources.gold -= u.costG || 0;
        }
      }

      // Flying units from airfield
      const airfield = enemyBuildings.find((b) => b.key === "airfield");
      if (
        airfield &&
        airfield.productionQueue.length < 2 &&
        ep.pop < ep.popMax
      ) {
        const unitKeys = getTrainableUnitKeys({
          unitKeys: BUILDINGS.airfield.produces,
          units: faction.units,
          resources: ep.resources,
          techs: ep.techs,
        });
        const queueableKeys = unitKeys.filter(canQueueEnemyUnit);
        if (queueableKeys.length > 0) {
          const key =
            queueableKeys[Math.floor(Math.random() * queueableKeys.length)];
          const u = faction.units[key];
          airfield.productionQueue.push({ key, isWorker: false });
          ep.resources.wood -= u.costW || 0;
          ep.resources.food -= u.costF || 0;
          ep.resources.gold -= u.costG || 0;
        }
      }

      // T3 units from ultimate
      const ultimate = enemyBuildings.find((b) => b.key === "ultimate");
      if (
        ultimate &&
        ultimate.productionQueue.length < 1 &&
        ep.pop + 6 <= ep.popMax
      ) {
        const unitKeys = getTrainableUnitKeys({
          unitKeys: BUILDINGS.ultimate.produces,
          units: faction.units,
          resources: ep.resources,
          techs: ep.techs,
          exactTier: 3,
        });
        const queueableKeys = unitKeys.filter(canQueueEnemyUnit);
        if (queueableKeys.length > 0) {
          const key =
            queueableKeys[Math.floor(Math.random() * queueableKeys.length)];
          const u = faction.units[key];
          ultimate.productionQueue.push({ key, isWorker: false });
          ep.resources.wood -= u.costW || 0;
          ep.resources.food -= u.costF || 0;
          ep.resources.gold -= u.costG || 0;
        }
      }

      // Attack logic
      ai.attackTimer += 0.5;
      if (ai.attackTimer >= diff.atkInterval && enemyCombat.length >= 5) {
        ai.attackTimer = 0;
        // Find player base
        const playerBase = G.entities.find(
          (e) => e.owner === "player" && e.isBase && e.hp > 0,
        );
        if (playerBase) {
          for (const u of enemyCombat) {
            if (u.state === "idle" || u.state === "move") {
              u.targetX = playerBase.x + (Math.random() - 0.5) * 100;
              u.targetY = playerBase.y + (Math.random() - 0.5) * 100;
              u.state = "attackMove";
            }
          }
          if (
            G.map.fogPlayer[Math.floor(playerBase.y / TILE)]?.[
              Math.floor(playerBase.x / TILE)
            ] === FOG_VISIBLE
          ) {
            notify("敌军来袭!", "warn");
          }
        }
      }

      // Defense: idle combat units near base should defend
      for (const u of enemyCombat) {
        if (u.state === "idle" && distance(u, enemyBase) > 400) {
          u.targetX = enemyBase.x + (Math.random() - 0.5) * 200;
          u.targetY = enemyBase.y + (Math.random() - 0.5) * 200;
          u.state = "move";
        }
      }

      // Build defense tower
      if (enemyBuildings.filter((b) => b.key === "tower").length < 2) {
        aiBuildBuilding("tower", ep, enemyBase, 8);
      }
    }

    return {
      aiBuildBuilding(...args) {
        G = getGame();
        return aiBuildBuilding(...args);
      },
      updateAI(...args) {
        G = getGame();
        return updateAI(...args);
      },
    };
  }
  const exportsObj = { createAiSystem };
  if (typeof module !== "undefined" && module.exports)
    module.exports = exportsObj;
  global.RSEAi = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
