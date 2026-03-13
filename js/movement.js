(function (global) {
  function createMovementSystem(options) {
    let G = null;
    const getGame = options.getGame;
    const TILE = options.TILE;
    const isPassable = options.isPassable;
    const findPath = options.findPath;

function requestPath(entity, targetX, targetY) {
  entity.pathPending = true;
  G.pathQueue.push({ entity, targetX, targetY });
}

function getInteractionPoint(entity, targetX, targetY, targetSize = 1, padding = 0) {
  const radius = (targetSize * TILE) / 2 + padding;
  const dx = entity.x - targetX;
  const dy = entity.y - targetY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) {
    return { x: targetX + radius, y: targetY };
  }
  return {
    x: Math.round(targetX + (dx / dist) * radius),
    y: Math.round(targetY + (dy / dist) * radius),
  };
}

function processPathQueue() {
  let count = 0;
  while (G.pathQueue.length > 0 && count < 8) {
    const req = G.pathQueue.shift();
    const e = req.entity;
    if (e.hp <= 0) { e.pathPending = false; continue; }
    const path = findPath(e.x, e.y, req.targetX, req.targetY);
    e.path = path || []; // Empty array = no path found (prevents infinite repath)
    e.pathIndex = 0;
    e.pathPending = false;
    if (!path) e.pathFailTime = G.time; // Record failure time for cooldown
    count++;
  }
}

function moveDirectly(e, tx, ty, dt, arrivalRadius = 8) {
  const dx = tx - e.x, dy = ty - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < arrivalRadius) return true;
  const step = e.speed * dt;
  if (step >= dist) {
    const ftx = Math.floor(tx / TILE), fty = Math.floor(ty / TILE);
    if (isPassable(ftx, fty)) { e.x = tx; e.y = ty; return true; }
    return true; // Stuck but close enough
  }
  const nx = e.x + (dx / dist) * step;
  const ny = e.y + (dy / dist) * step;
  const ntx = Math.floor(nx / TILE), nty = Math.floor(ny / TILE);
  if (isPassable(ntx, nty)) { e.x = nx; e.y = ny; }
  else {
    const ntx2 = Math.floor((e.x + (dx / dist) * step) / TILE);
    if (isPassable(ntx2, Math.floor(e.y / TILE))) { e.x += (dx / dist) * step; }
    else {
      const nty2 = Math.floor((e.y + (dy / dist) * step) / TILE);
      if (isPassable(Math.floor(e.x / TILE), nty2)) { e.y += (dy / dist) * step; }
    }
  }
  return false;
}

function moveToward(e, tx, ty, dt, arrivalRadius = 8) {
  // Check if arrived
  const fdx = tx - e.x, fdy = ty - e.y;
  const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
  if (fdist < arrivalRadius) { e.path = null; return true; }

  // Flying units: straight line (no pathfinding needed)
  if (e.flying) {
    const step = e.speed * dt;
    if (step >= fdist || fdist < arrivalRadius) { e.x = tx; e.y = ty; return true; }
    e.x += (fdx / fdist) * step;
    e.y += (fdy / fdist) * step;
    return false;
  }

  // Check if we need a path or target changed (tile-level granularity)
  const targetKey = Math.floor(tx / TILE) + ',' + Math.floor(ty / TILE);
  if (!e.path || e.pathTarget !== targetKey) {
    if (!e.pathPending) {
      // Don't repath too often after failure (1 second cooldown)
      if (e.pathFailTime && G.time - e.pathFailTime < 1.0 && e.pathTarget === targetKey) {
        return moveDirectly(e, tx, ty, dt, arrivalRadius);
      }
      e.pathTarget = targetKey;
      e.path = null;
      e.pathIndex = 0;
      requestPath(e, tx, ty);
    }
    // While waiting, use direct movement
    return moveDirectly(e, tx, ty, dt, arrivalRadius);
  }

  // No path found — use direct movement as fallback
  if (e.path.length === 0) {
    return moveDirectly(e, tx, ty, dt, arrivalRadius);
  }

  // Follow waypoints
  if (e.pathIndex >= e.path.length) {
    e.path = null;
    return moveDirectly(e, tx, ty, dt, arrivalRadius);
  }
  const wp = e.path[e.pathIndex];
  const dx = wp.x - e.x, dy = wp.y - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = e.speed * dt;

  if (dist < step + 6) {
    // Reached waypoint
    e.pathIndex++;
    if (e.pathIndex >= e.path.length) {
      e.path = null;
      if (fdist < Math.max(arrivalRadius, step + 6)) { return true; }
      return false;
    }
    return false;
  }

  const nx = e.x + (dx / dist) * step;
  const ny = e.y + (dy / dist) * step;
  const ntx = Math.floor(nx / TILE), nty = Math.floor(ny / TILE);
  if (isPassable(ntx, nty)) {
    e.x = nx; e.y = ny;
  } else {
    // Path blocked (building placed since path was calculated), repath
    if (!e.pathPending) {
      e.path = null;
      requestPath(e, tx, ty);
    }
  }
  return false;
}

function updateUnitSeparation() {
  return;
}

function notify(msg, type) {
  G.notifications.push({ msg, type: type || 'info', time: 3 });
  const el = document.getElementById('notifications');
  const div = document.createElement('div');
  div.className = 'notification notif-' + (type || 'info');
  div.textContent = msg;
  el.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

// ---- RENDERING ----

    return {
      getInteractionPoint(...args) { G = getGame(); return getInteractionPoint(...args); },
      requestPath(...args) { G = getGame(); return requestPath(...args); },
      processPathQueue(...args) { G = getGame(); return processPathQueue(...args); },
      moveDirectly(...args) { G = getGame(); return moveDirectly(...args); },
      moveToward(...args) { G = getGame(); return moveToward(...args); },
      updateUnitSeparation(...args) { G = getGame(); return updateUnitSeparation(...args); }
    };
  }
  const exportsObj = { createMovementSystem };
  if (typeof module !== "undefined" && module.exports) module.exports = exportsObj;
  global.RSEMovement = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
