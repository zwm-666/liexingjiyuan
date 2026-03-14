(function (global) {
  function defaultDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pickBuilderWorker(workers, target, distance = defaultDistance) {
    const availableWorkers = workers.filter(
      (worker) => worker && worker.hp > 0 && !worker.isBuilding,
    );
    const idleWorkers = availableWorkers.filter(
      (worker) => worker.state === "idle",
    );
    const candidates =
      idleWorkers.length > 0
        ? idleWorkers
        : availableWorkers.filter((worker) => worker.state !== "buildAssist");
    if (candidates.length === 0) return null;

    let nearest = candidates[0];
    let nearestDistance = distance(candidates[0], target);
    for (let index = 1; index < candidates.length; index++) {
      const candidate = candidates[index];
      const candidateDistance = distance(candidate, target);
      if (candidateDistance < nearestDistance) {
        nearest = candidate;
        nearestDistance = candidateDistance;
      }
    }
    return nearest;
  }

  function findNearbyResourceForWorker(
    worker,
    resources,
    tileSize,
    tileRange = 4,
  ) {
    const workerTileX = Math.floor(worker.x / tileSize);
    const workerTileY = Math.floor(worker.y / tileSize);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const resource of resources) {
      if (!resource || resource.amount <= 0) continue;
      const deltaX = Math.abs(resource.x - workerTileX);
      const deltaY = Math.abs(resource.y - workerTileY);
      if (deltaX > tileRange || deltaY > tileRange) continue;
      const dx = worker.x - (resource.x * tileSize + tileSize / 2);
      const dy = worker.y - (resource.y * tileSize + tileSize / 2);
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      if (currentDistance < nearestDistance) {
        nearest = resource;
        nearestDistance = currentDistance;
      }
    }
    return nearest;
  }

  function resumeWorkerTask(worker, findNearestResource) {
    if (
      worker.prevState === "moveToResource" ||
      worker.prevState === "gathering" ||
      worker.prevState === "returning"
    ) {
      if (worker.prevGatherTarget && worker.prevGatherTarget.amount > 0) {
        worker.gatherTarget = worker.prevGatherTarget;
        worker.state = "moveToResource";
      } else {
        const resourceType = worker.prevGatherTarget
          ? worker.prevGatherTarget.type
          : null;
        const nextResource = resourceType
          ? findNearestResource(worker, resourceType)
          : null;
        if (nextResource) {
          worker.gatherTarget = nextResource;
          worker.state = "moveToResource";
        } else {
          worker.gatherTarget = null;
          worker.state = "idle";
        }
      }
    } else {
      worker.state = "idle";
    }
    worker.targetId = null;
    worker.prevState = null;
    worker.prevGatherTarget = null;
  }

  function cleanupDepletedResource(map, resource) {
    if (!resource || resource.amount > 0 || resource.destroyed) return false;
    resource.amount = 0;
    resource.destroyed = true;
    resource._beingGathered = false;
    if (map?.resourceBlocked?.[resource.y]) {
      map.resourceBlocked[resource.y][resource.x] = 0;
    }
    if (
      resource.type === "wood" &&
      map?.tiles?.[resource.y] &&
      map.tiles[resource.y][resource.x] === 4
    ) {
      map.tiles[resource.y][resource.x] = 1;
    }
    return true;
  }

  function createCombatSystem(options) {
    let G = null;
    const getGame = options.getGame;
    const DMG_MULT = options.DMG_MULT;
    const FACTIONS = options.FACTIONS;
    const TECHS = options.TECHS;
    const TILE = options.TILE;
    const MAP_W = options.MAP_W;
    const MAP_H = options.MAP_H;
    const FOG_EXPLORED = options.FOG_EXPLORED ?? 1;
    const FOG_VISIBLE = options.FOG_VISIBLE ?? 2;
    const myOwner = options.myOwner;
    const getEntityById = options.getEntityById;
    const removeEntity = options.removeEntity;
    const spawnUnit = options.spawnUnit;
    const getProductionTime = options.getProductionTime;
    const notify = options.notify || (() => {});
    const findNearestEnemy = options.findNearestEnemy || (() => null);
    const getInteractionPoint =
      options.getInteractionPoint ||
      ((entity, targetX, targetY) => ({ x: targetX, y: targetY }));
    function calcDamage(attacker, target) {
      const dmgType = attacker.dmgType || "normal";
      const armorType = target.armorType || "medium";
      const mult = (DMG_MULT[dmgType] && DMG_MULT[dmgType][armorType]) || 1.0;
      const armorReduction = (target.armor * 0.05) / (1 + target.armor * 0.05);
      let dmg = attacker.atk * mult * (1 - armorReduction);
      if (target.magicResist && dmgType === "magic")
        dmg *= 1 - target.magicResist;
      return Math.max(1, Math.floor(dmg));
    }

    function dealDamage(attacker, target, dmg) {
      target.hp -= dmg;
      target.flash = 0.15;
      target.lastDamageTime = G.time; // Track for out-of-combat regen

      // Void Curse: shadow attacks slow the target
      if (
        attacker.owner &&
        G.players[attacker.owner]?.techs?.voidCurse &&
        !target.isBuilding
      ) {
        target.slowUntil = G.time + 2.5; // 2.5 second slow
        target.slowFactor = 0.5; // 50% speed reduction
      }

      // Splash
      if (attacker.splash > 0) {
        for (const e of G.entities) {
          if (e === target || e.owner === attacker.owner || e.hp <= 0) continue;
          const dx = e.x - target.x,
            dy = e.y - target.y;
          if (Math.sqrt(dx * dx + dy * dy) < attacker.splash) {
            e.hp -= Math.floor(dmg * 0.5);
            e.flash = 0.1;
            e.lastDamageTime = G.time;
          }
        }
      }
      if (target.hp <= 0) {
        if (target.owner !== myOwner()) G.stats.unitsKilled++;
        else if (target.owner === myOwner()) G.stats.unitsLost++;
        removeEntity(target);
        // Win condition check
        if (target.isBase) {
          G.phase = target.owner === myOwner() ? "lose" : "win";
        }
      }
      // Alert nearby friendly units (StarCraft-style threat response)
      // Idle or non-engaged units within 250px will move to attack the aggressor
      if (target.hp > 0 && attacker.id) {
        const alertRange = 250;
        for (const e of G.entities) {
          if (
            e === target ||
            e.owner !== target.owner ||
            e.hp <= 0 ||
            e.isBuilding ||
            e.isWorker
          )
            continue;
          if (e.state !== "idle") continue;
          const dx = e.x - target.x,
            dy = e.y - target.y;
          if (Math.sqrt(dx * dx + dy * dy) < alertRange) {
            e.targetId = attacker.id;
            e.state = "chase";
          }
        }
      }
    }

    // ---- UNIT AI / FSM ----
    function updateUnit(e, dt) {
      if (e.flash > 0) e.flash -= dt;
      if (e.hp <= 0) return;

      // Stealth logic: units with canStealth cloak when idle/moving, uncloak when attacking
      if (e.canStealth) {
        if (e.state === "attack" || e.state === "chase") {
          e.stealthed = false;
        } else if (!e.stealthed && (e.state === "idle" || e.state === "move")) {
          // Re-cloak after 3 seconds out of combat
          if (!e.lastDamageTime || G.time - e.lastDamageTime >= 3) {
            e.stealthed = true;
          }
        }
      }

      // Out-of-combat HP regeneration: units regen 1 HP/s after 10s without damage
      if (e.hp > 0 && e.hp < e.maxHp && !e.isConstructing) {
        const lastDmg = e.lastDamageTime || 0;
        if (G.time - lastDmg >= 10) {
          e.hp = Math.min(e.maxHp, e.hp + 1 * dt);
        }
      }

      if (e.isWorker && e.owner === "player") {
        updateWorker(e, dt);
        return;
      }
      if (e.isWorker && e.owner === "enemy") {
        if (G.isMultiplayer) updateWorker(e, dt);
        else updateEnemyWorker(e, dt);
        return;
      }

      // Attack cooldown
      if (e.atkCooldown > 0) e.atkCooldown -= dt;

      switch (e.state) {
        case "idle":
          // Find nearest enemy in sight range
          const sightRange = e.range > 40 ? e.range + 100 : 300;
          const enemy = findNearestEnemy(e, sightRange);
          if (enemy) {
            e.targetId = enemy.id;
            e.state = "chase";
          }
          break;
        case "move":
          if (moveToward(e, e.targetX, e.targetY, dt)) {
            e.state = "idle";
          }
          break;
        case "chase":
          const tgt = getEntityById(e.targetId);
          if (!tgt || tgt.hp <= 0) {
            e.state = "idle";
            e.targetId = null;
            break;
          }
          const dist = distance(e, tgt);
          if (dist <= e.range + 16) {
            e.state = "attack";
          } else {
            moveToward(e, tgt.x, tgt.y, dt);
          }
          break;
        case "attack":
          const atgt = getEntityById(e.targetId);
          if (!atgt || atgt.hp <= 0) {
            e.state = "idle";
            e.targetId = null;
            break;
          }
          const adist = distance(e, atgt);
          if (adist > e.range + 40) {
            e.state = "chase";
            break;
          }
          if (e.atkCooldown <= 0) {
            const dmg = calcDamage(e, atgt);
            if (e.range > 100) {
              // Ranged: spawn projectile
              G.projectiles.push({
                x: e.x,
                y: e.y - (e.flying ? 30 : 0),
                targetId: atgt.id,
                speed: 400,
                dmg,
                owner: e.owner,
                color: e.owner === myOwner() ? "#ff0" : "#f00",
                ptype: e.dmgType || "pierce",
                prevX: e.x,
                prevY: e.y - (e.flying ? 30 : 0),
              });
            } else {
              dealDamage(e, atgt, dmg);
            }
            e.atkCooldown = e.atkSpeed;
          }
          break;
        case "attackMove":
          const amEnemy = findNearestEnemy(
            e,
            e.range > 40 ? e.range + 100 : 300,
          );
          if (amEnemy) {
            e.targetId = amEnemy.id;
            e.state = "chase";
          } else if (moveToward(e, e.targetX, e.targetY, dt)) {
            e.state = "idle";
          }
          break;
      }
    }

    function updateWorker(e, dt) {
      if (e.atkCooldown > 0) e.atkCooldown -= dt;
      if (e.state !== "idle") e.idleAlerted = false;
      const faction = FACTIONS[G.players[e.owner].faction];
      const loadBonus = G.players[e.owner].techs.workerLoad || 0;
      const maxLoad = faction.workerLoad + loadBonus;

      switch (e.state) {
        case "idle":
          const nearbyRes = findNearbyResourceForWorker(
            e,
            G.map.resources || [],
            TILE,
            4,
          );
          if (nearbyRes) {
            e.gatherTarget = nearbyRes;
            e.state = "moveToResource";
            e.idleAlerted = false;
          }
          break;
        case "move":
          if (moveToward(e, e.targetX, e.targetY, dt)) {
            // Auto-find nearest resource at destination
            const moveRes = findNearestResource(e, null);
            if (moveRes) {
              const mrd = Math.sqrt(
                (e.x - (moveRes.x * TILE + TILE / 2)) ** 2 +
                  (e.y - (moveRes.y * TILE + TILE / 2)) ** 2,
              );
              if (mrd < 200) {
                e.gatherTarget = moveRes;
                e.state = "moveToResource";
                break;
              }
            }
            e.state = "idle";
          }
          break;
        case "moveToResource":
          if (!e.gatherTarget) {
            e.state = "idle";
            break;
          }
          const res = e.gatherTarget;
          const resourceTarget = getInteractionPoint(
            e,
            res.x * TILE + TILE / 2,
            res.y * TILE + TILE / 2,
            1,
            4,
          );
          if (moveToward(e, resourceTarget.x, resourceTarget.y, dt, 10)) {
            e.state = "gathering";
            e.stateTimer = 0;
            if (e.gatherTarget) e.gatherTarget._beingGathered = true;
          }
          break;
        case "gathering":
          if (!e.gatherTarget || e.gatherTarget.amount <= 0) {
            // Resource depleted — find nearest resource of same type
            if (e.gatherTarget) e.gatherTarget._beingGathered = false;
            const depletedType = e.gatherTarget ? e.gatherTarget.type : null;
            const nextRes = depletedType
              ? findNearestResource(e, depletedType)
              : null;
            if (nextRes) {
              e.gatherTarget = nextRes;
              e.state = "moveToResource";
            } else {
              e.state = "idle";
              e.gatherTarget = null;
            }
            break;
          }
          e.stateTimer += dt;
          const gatherTime = 1.0;
          if (e.stateTimer >= gatherTime) {
            e.stateTimer = 0;
            const resType = e.gatherTarget.type;
            const speed = faction.gatherSpeed[resType] || 5;
            const goldBonus =
              resType === "gold" && G.players[e.owner].techs.goldGather
                ? G.players[e.owner].techs.goldGather
                : 0;
            const gatherAmt = Math.min(
              speed * (1 + goldBonus),
              e.gatherTarget.amount,
              maxLoad - e.carrying,
            );
            e.carrying += gatherAmt;
            e.carryType = resType;
            e.gatherTarget.amount -= gatherAmt;
            cleanupDepletedResource(G.map, e.gatherTarget);
            if (e.carrying >= maxLoad || e.gatherTarget.amount <= 0) {
              if (e.gatherTarget) e.gatherTarget._beingGathered = false;
              e.state = "returning";
            }
          }
          break;
        case "returning":
          const dropoff = findNearestDropoff(e);
          if (!dropoff) {
            e.state = "idle";
            break;
          }
          const dropoffTarget = getInteractionPoint(
            e,
            dropoff.x,
            dropoff.y,
            dropoff.size || 2,
            4,
          );
          if (moveToward(e, dropoffTarget.x, dropoffTarget.y, dt, 6)) {
            if (e.carryType && e.carrying > 0) {
              G.players[e.owner].resources[e.carryType] += e.carrying;
              G.stats.resourcesGathered += e.carrying;
              e.carrying = 0;
            }
            if (e.gatherTarget && e.gatherTarget.amount > 0) {
              // If current resource is nearly depleted, look for a richer one nearby
              if (e.gatherTarget.amount < e.gatherTarget.max * 0.15) {
                const richerRes = findNearestResource(
                  e,
                  e.gatherTarget.type,
                  e.gatherTarget.max * 0.3,
                );
                if (richerRes && richerRes !== e.gatherTarget) {
                  // Only switch if the richer resource isn't much farther away
                  const curDist = Math.sqrt(
                    (e.x - (e.gatherTarget.x * TILE + TILE / 2)) ** 2 +
                      (e.y - (e.gatherTarget.y * TILE + TILE / 2)) ** 2,
                  );
                  const richDist = Math.sqrt(
                    (e.x - (richerRes.x * TILE + TILE / 2)) ** 2 +
                      (e.y - (richerRes.y * TILE + TILE / 2)) ** 2,
                  );
                  if (richDist < curDist * 2.5) {
                    e.gatherTarget = richerRes;
                  }
                }
              }
              e.state = "moveToResource";
            } else {
              // Old resource depleted — find nearest of same type
              const oldType = e.gatherTarget ? e.gatherTarget.type : null;
              const nextRes = oldType ? findNearestResource(e, oldType) : null;
              if (nextRes) {
                e.gatherTarget = nextRes;
                e.state = "moveToResource";
              } else {
                e.state = "idle";
                e.gatherTarget = null;
              }
            }
          }
          break;
        case "buildAssist":
          const bldg = getEntityById(e.targetId);
          if (!bldg || !bldg.isConstructing) {
            resumeWorkerTask(e, findNearestResource);
            break;
          }
          if (distance(e, bldg) > 60) {
            moveToward(e, bldg.x, bldg.y, dt);
          } else {
            bldg.buildProgress += dt;
            const pct = bldg.buildProgress / bldg.buildTime;
            bldg.hp = Math.floor(pct * bldg.maxHp);
            if (bldg.buildProgress >= bldg.buildTime) {
              bldg.isConstructing = false;
              bldg.hp = bldg.maxHp;
              bldg.buildProgress = bldg.buildTime;
              resumeWorkerTask(e, findNearestResource);
              if (e.owner === myOwner())
                notify("建造完成: " + BUILDINGS[bldg.key].name, "info");
            }
          }
          break;
      }
    }

    function updateEnemyWorker(e, dt) {
      // Simple AI: auto-gather nearest resource
      const faction = FACTIONS[G.players[e.owner].faction];
      const loadBonus = G.players[e.owner].techs.workerLoad || 0;
      const maxLoad = faction.workerLoad + loadBonus;

      switch (e.state) {
        case "idle":
          // Find nearest resource
          let nearest = null,
            nearDist = Infinity;
          for (const r of G.map.resources) {
            if (r.amount <= 0) continue;
            const d = Math.abs(r.x * TILE - e.x) + Math.abs(r.y * TILE - e.y);
            if (d < nearDist) {
              nearDist = d;
              nearest = r;
            }
          }
          if (nearest) {
            e.gatherTarget = nearest;
            e.state = "moveToResource";
          }
          break;
        case "moveToResource":
          if (!e.gatherTarget || e.gatherTarget.amount <= 0) {
            e.state = "idle";
            break;
          }
          const enemyResourceTarget = getInteractionPoint(
            e,
            e.gatherTarget.x * TILE + TILE / 2,
            e.gatherTarget.y * TILE + TILE / 2,
            1,
            4,
          );
          if (
            moveToward(e, enemyResourceTarget.x, enemyResourceTarget.y, dt, 10)
          ) {
            e.state = "gathering";
            e.stateTimer = 0;
            if (e.gatherTarget) e.gatherTarget._beingGathered = true;
          }
          break;
        case "gathering":
          if (!e.gatherTarget || e.gatherTarget.amount <= 0) {
            if (e.gatherTarget) e.gatherTarget._beingGathered = false;
            const dt2 = e.gatherTarget ? e.gatherTarget.type : null;
            const nr = dt2
              ? findNearestResource(e, dt2)
              : findNearestResource(e, null);
            if (nr) {
              e.gatherTarget = nr;
              e.state = "moveToResource";
            } else {
              e.state = "idle";
              e.gatherTarget = null;
            }
            break;
          }
          e.stateTimer += dt;
          if (e.stateTimer >= 1.0) {
            e.stateTimer = 0;
            const resType = e.gatherTarget.type;
            const speed = faction.gatherSpeed[resType] || 5;
            const goldBonus =
              resType === "gold" && G.players[e.owner].techs.goldGather
                ? G.players[e.owner].techs.goldGather
                : 0;
            const amt = Math.min(
              speed * (1 + goldBonus),
              e.gatherTarget.amount,
              maxLoad - e.carrying,
            );
            e.carrying += amt;
            e.carryType = resType;
            e.gatherTarget.amount -= amt;
            cleanupDepletedResource(G.map, e.gatherTarget);
            if (e.carrying >= maxLoad || e.gatherTarget.amount <= 0) {
              if (e.gatherTarget) e.gatherTarget._beingGathered = false;
              e.state = "returning";
            }
          }
          break;
        case "returning":
          const edropoff = findNearestDropoff(e);
          if (!edropoff) {
            e.state = "idle";
            break;
          }
          const enemyDropoffTarget = getInteractionPoint(
            e,
            edropoff.x,
            edropoff.y,
            edropoff.size || 2,
            4,
          );
          if (
            moveToward(e, enemyDropoffTarget.x, enemyDropoffTarget.y, dt, 6)
          ) {
            if (e.carryType && e.carrying > 0) {
              G.players[e.owner].resources[e.carryType] =
                (G.players[e.owner].resources[e.carryType] || 0) + e.carrying;
              e.carrying = 0;
            }
            if (e.gatherTarget && e.gatherTarget.amount > 0) {
              if (e.gatherTarget.amount < e.gatherTarget.max * 0.15) {
                const richerRes2 = findNearestResource(
                  e,
                  e.gatherTarget.type,
                  e.gatherTarget.max * 0.3,
                );
                if (richerRes2 && richerRes2 !== e.gatherTarget) {
                  const curDist2 = Math.sqrt(
                    (e.x - (e.gatherTarget.x * TILE + TILE / 2)) ** 2 +
                      (e.y - (e.gatherTarget.y * TILE + TILE / 2)) ** 2,
                  );
                  const richDist2 = Math.sqrt(
                    (e.x - (richerRes2.x * TILE + TILE / 2)) ** 2 +
                      (e.y - (richerRes2.y * TILE + TILE / 2)) ** 2,
                  );
                  if (richDist2 < curDist2 * 2.5) {
                    e.gatherTarget = richerRes2;
                  }
                }
              }
              e.state = "moveToResource";
            } else {
              const ot = e.gatherTarget ? e.gatherTarget.type : null;
              const nr = ot
                ? findNearestResource(e, ot)
                : findNearestResource(e, null);
              if (nr) {
                e.gatherTarget = nr;
                e.state = "moveToResource";
              } else {
                e.state = "idle";
                e.gatherTarget = null;
              }
            }
          }
          break;
        case "move":
          if (moveToward(e, e.targetX, e.targetY, dt)) e.state = "idle";
          break;
        case "buildAssist":
          const bldg2 = getEntityById(e.targetId);
          if (!bldg2 || !bldg2.isConstructing) {
            resumeWorkerTask(e, findNearestResource);
            break;
          }
          if (distance(e, bldg2) > 60) {
            moveToward(e, bldg2.x, bldg2.y, dt);
          } else {
            bldg2.buildProgress += dt * 2; // enemy builds faster
            bldg2.hp = Math.floor(
              (bldg2.buildProgress / bldg2.buildTime) * bldg2.maxHp,
            );
            if (bldg2.buildProgress >= bldg2.buildTime) {
              bldg2.isConstructing = false;
              bldg2.hp = bldg2.maxHp;
              resumeWorkerTask(e, findNearestResource);
            }
          }
          break;
      }
    }

    // ---- BUILDING UPDATE ----
    function updateBuilding(e, dt) {
      if (e.flash > 0) e.flash -= dt;
      if (e.hp <= 0) return;
      if (e.isConstructing) return; // under construction

      // Out-of-combat HP regeneration for buildings: 2 HP/s after 30s
      if (e.hp < e.maxHp) {
        const lastDmg = e.lastDamageTime || 0;
        if (G.time - lastDmg >= 30) {
          e.hp = Math.min(e.maxHp, e.hp + 2 * dt);
        }
      }

      // Tower attack
      if (e.towerAtk > 0) {
        if (e.atkCooldown > 0) e.atkCooldown -= dt;
        if (e.atkCooldown <= 0) {
          const enemy = findNearestEnemy(e, e.towerRange);
          if (enemy) {
            // Create a pseudo-attacker for calcDamage using tower stats
            const towerAttacker = {
              atk: e.towerAtk,
              dmgType: e.towerDmgType || "pierce",
              splash: 0,
            };
            const dmg = calcDamage(towerAttacker, enemy);
            G.projectiles.push({
              x: e.x,
              y: e.y,
              targetId: enemy.id,
              speed: 350,
              dmg,
              owner: e.owner,
              color: e.owner === myOwner() ? "#fa0" : "#f55",
              ptype: towerAttacker.dmgType,
              prevX: e.x,
              prevY: e.y,
            });
            e.atkCooldown = e.towerSpeed;
          }
        }
      }

      // Production queue
      if (e.productionQueue.length > 0) {
        const item = e.productionQueue[0];
        const buildTime = getProductionTime(item, e.owner);
        const popCost = item.isWorker
          ? 1
          : FACTIONS[G.players[e.owner].faction].units[item.key]?.pop || 2;
        const ownerData = G.players[e.owner];
        // Only advance timer if we have population room
        if (ownerData.pop + popCost <= ownerData.popMax) {
          e.productionTimer += dt;
        }
        if (e.productionTimer >= buildTime) {
          // Double-check pop before spawning
          if (ownerData.pop + popCost > ownerData.popMax) {
            // Stall: wait for population room
            e.productionTimer = buildTime;
          } else {
            e.productionTimer = 0;
            e.productionQueue.shift();
            // Spawn unit at valid position
            const spawnDist = (e.size || 2) * TILE + 20;
            let sx,
              sy,
              spawnAttempts = 0;
            do {
              const angle = G.rng() * Math.PI * 2;
              sx = e.x + Math.cos(angle) * spawnDist;
              sy = e.y + Math.sin(angle) * spawnDist;
              spawnAttempts++;
            } while (
              !isPassable(Math.floor(sx / TILE), Math.floor(sy / TILE)) &&
              spawnAttempts < 12
            );
            const newUnit = spawnUnit(e.owner, item.key, sx, sy, item.isWorker);
            // Rally point: send unit to rally location
            if (newUnit && e.rallyPoint) {
              newUnit.targetX = e.rallyPoint.x;
              newUnit.targetY = e.rallyPoint.y;
              newUnit.state = "move";
            }
            if (e.owner === myOwner())
              notify(
                (item.isWorker
                  ? "工人"
                  : FACTIONS[G.players[e.owner].faction].units[item.key]
                      ?.name || item.key) + " 生产完成",
                "info",
              );
          }
        }
      }

      // Research lab processing
      if (e.isResearchLab && e.researchItem) {
        e.researchTimer += dt;
        const tech = TECHS[e.researchItem];
        if (tech && e.researchTimer >= tech.time) {
          const p = G.players[e.owner];
          for (const ek in tech.effect)
            p.techs[ek] = (p.techs[ek] || 0) + tech.effect[ek];
          p.techs[e.researchItem] = true;
          if (e.owner === myOwner()) notify("研发完成: " + tech.name, "info");
          e.researchItem = null;
          e.researchTimer = 0;
        }
      }
    }

    // ---- PROJECTILES ----
    function updateProjectiles(dt) {
      for (let i = G.projectiles.length - 1; i >= 0; i--) {
        const p = G.projectiles[i];
        const tgt = getEntityById(p.targetId);
        if (!tgt || tgt.hp <= 0) {
          G.projectiles.splice(i, 1);
          continue;
        }
        const dx = tgt.x - p.x,
          dy = tgt.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) {
          dealDamage(
            { dmgType: "normal", splash: 0, atk: p.dmg, owner: p.owner },
            tgt,
            p.dmg,
          );
          G.projectiles.splice(i, 1);
        } else {
          const spd = p.speed * dt;
          p.x += (dx / dist) * spd;
          p.y += (dy / dist) * spd;
        }
      }
    }

    // ---- PARTICLES ----
    function updateParticles(dt) {
      for (let i = G.particles.length - 1; i >= 0; i--) {
        const p = G.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) G.particles.splice(i, 1);
      }
      // Update move indicators
      for (let i = G.moveIndicators.length - 1; i >= 0; i--) {
        G.moveIndicators[i].life -= dt;
        if (G.moveIndicators[i].life <= 0) G.moveIndicators.splice(i, 1);
      }
    }

    // ---- FOG OF WAR ----
    function updateFog() {
      const fogPlayer = G.map?.fogPlayer;
      const fogEnemy = G.map?.fogEnemy;
      if (!fogPlayer || !fogEnemy) return;

      const mapHeight = MAP_H || fogPlayer.length;
      const mapWidth = MAP_W || fogPlayer[0]?.length || 0;

      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          if (fogPlayer[y]?.[x] === FOG_VISIBLE) fogPlayer[y][x] = FOG_EXPLORED;
          if (fogEnemy[y]?.[x] === FOG_VISIBLE) fogEnemy[y][x] = FOG_EXPLORED;
        }
      }

      for (const e of G.entities) {
        if (e.hp <= 0) continue;
        const fog = e.owner === "player" ? fogPlayer : fogEnemy;
        const sightTiles = e.isBuilding ? e.size * 2 + 4 : e.flying ? 10 : 7;
        const entityTileX = Math.floor(e.x / TILE);
        const entityTileY = Math.floor(e.y / TILE);

        for (let dy = -sightTiles; dy <= sightTiles; dy++) {
          for (let dx = -sightTiles; dx <= sightTiles; dx++) {
            if (dx * dx + dy * dy > sightTiles * sightTiles) continue;
            const tileX = entityTileX + dx;
            const tileY = entityTileY + dy;
            if (
              tileX >= 0 &&
              tileX < mapWidth &&
              tileY >= 0 &&
              tileY < mapHeight
            ) {
              fog[tileY][tileX] = FOG_VISIBLE;
            }
          }
        }
      }
    }

    return {
      calcDamage(...args) {
        G = getGame();
        return calcDamage(...args);
      },
      dealDamage(...args) {
        G = getGame();
        return dealDamage(...args);
      },
      updateBuilding(...args) {
        G = getGame();
        return updateBuilding(...args);
      },
      updateProjectiles(...args) {
        G = getGame();
        return updateProjectiles(...args);
      },
      updateParticles(...args) {
        G = getGame();
        return updateParticles(...args);
      },
      updateFog(...args) {
        G = getGame();
        return updateFog(...args);
      },
    };
  }
  const exportsObj = {
    createCombatSystem,
    pickBuilderWorker,
    findNearbyResourceForWorker,
    resumeWorkerTask,
    cleanupDepletedResource,
  };
  if (typeof module !== "undefined" && module.exports)
    module.exports = exportsObj;
  global.RSECombat = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
