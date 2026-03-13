(function (global) {
  function createInputSystem(options) {
    const getGame = options.getGame;
    const myOwner = options.myOwner;
    const TILE = options.TILE || 32;
    const executeLocalCommand = options.executeLocalCommand || (() => {});
    const BUILDINGS = options.BUILDINGS || {};

    const MAP_W = options.MAP_W || 128;
    const MAP_H = options.MAP_H || 128;
    const miniCanvas = options.miniCanvas || null;
    const canvas = options.canvas || null;

    function distance(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function findEntityNear(wx, wy, ownerFilter, maxDist) {
      const G = getGame();
      let nearest = null;
      let bestDistance = Infinity;
      const maxDistSq = maxDist ? maxDist * maxDist : Infinity;
      for (const entity of G.entities) {
        if (entity.hp <= 0) continue;
        if (ownerFilter && entity.owner !== ownerFilter) continue;
        const dx = entity.x - wx, dy = entity.y - wy;
        const distSq = dx * dx + dy * dy;
        // Use entity size for click radius: buildings have larger clickable area
        const clickRadius = entity.isBuilding ? ((entity.size || 2) * TILE / 2 + 10) : 25;
        if (distSq > clickRadius * clickRadius) continue;
        if (distSq < bestDistance && distSq <= maxDistSq) {
          bestDistance = distSq;
          nearest = entity;
        }
      }
      return nearest;
    }

    function touchToWorld(touch) {
      const G = getGame();
      return {
        x: (touch.clientX / G.camera.zoom) + G.camera.x,
        y: (touch.clientY / G.camera.zoom) + G.camera.y,
      };
    }

    function pinchDist(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function handleTap(wx, wy) {
      const G = getGame();
      // Try to find own entity first, then any entity
      const own = findEntityNear(wx, wy, myOwner());
      if (own) {
        G.selection.forEach(e => (e.selected = false));
        own.selected = true;
        G.selection = [own];
        return;
      }
      // Try enemy entity (for info display)
      const any = findEntityNear(wx, wy, null);
      if (any) {
        G.selection.forEach(e => (e.selected = false));
        any.selected = true;
        G.selection = [any];
        return;
      }
      // Click on empty space: deselect
      G.selection.forEach(e => (e.selected = false));
      G.selection = [];
    }

    function handleLeftClick(wx, wy) { handleTap(wx, wy); }

    function handleBoxSelect(x1, y1, x2, y2) {
      const G = getGame();
      G.selection.forEach(e => (e.selected = false));
      G.selection = [];
      const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
      const maxX = Math.max(x1, x2), maxY = Math.max(y1, y2);
      // First pass: select non-building owned units in box
      for (const e of G.entities) {
        if (e.hp <= 0 || e.owner !== myOwner() || e.isBuilding) continue;
        if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
          e.selected = true;
          G.selection.push(e);
        }
      }
      // If no units found, try selecting a building
      if (G.selection.length === 0) {
        for (const e of G.entities) {
          if (e.hp <= 0 || e.owner !== myOwner() || !e.isBuilding) continue;
          if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
            e.selected = true;
            G.selection.push(e);
            break; // Only select one building
          }
        }
      }
    }

    function handleRightClick(wx, wy) {
      const G = getGame();
      if (G.selection.length === 0) return;
      if (G.selection[0].owner !== myOwner()) return;

      // Check resource click
      for (let ri = 0; ri < G.map.resources.length; ri++) {
        const r = G.map.resources[ri];
        if (r.amount <= 0) continue;
        const rx = r.x * TILE + TILE / 2, ry = r.y * TILE + TILE / 2;
        if (Math.abs(rx - wx) < 20 && Math.abs(ry - wy) < 20) {
          const workerIds = G.selection.filter(e => e.isWorker).map(e => e.id);
          if (workerIds.length > 0)
            executeLocalCommand({ action: 'gather', unitIds: workerIds, resourceIndex: ri });
          return;
        }
      }

      // Check build-assist click
      for (const b of G.entities) {
        if (b.hp <= 0 || b.owner !== myOwner() || !b.isBuilding || !b.isConstructing) continue;
        const d = distance(b, { x: wx, y: wy });
        if (d < ((b.size || 2) * TILE) / 2 + 20) {
          executeLocalCommand({ action: 'buildAssist', unitIds: [], targetBuildingId: b.id });
          return;
        }
      }

      // Check enemy click (attack)
      for (const e of G.entities) {
        if (e.hp <= 0 || e.owner === myOwner()) continue;
        const d = distance(e, { x: wx, y: wy });
        if (d < (e.isBuilding ? ((e.size || 2) * TILE) / 2 + 10 : 20)) {
          const unitIds = G.selection.filter(u => !u.isBuilding).map(u => u.id);
          if (unitIds.length > 0)
            executeLocalCommand({ action: 'attack', unitIds, targetId: e.id });
          return;
        }
      }

      // Rally point for buildings
      for (const e of G.selection) {
        if (e.isBuilding && e.owner === myOwner() && !e.isConstructing) {
          const bd = BUILDINGS[e.key];
          if (bd && bd.produces && bd.produces.length > 0) {
            executeLocalCommand({ action: 'setRally', buildingId: e.id, x: wx, y: wy });
          }
        }
      }

      // Move command for units
      const unitIds = G.selection.filter(e => !e.isBuilding).map(e => e.id);
      if (unitIds.length > 0) {
        executeLocalCommand({ action: 'move', unitIds, x: wx, y: wy });
        if (G.moveIndicators) {
          G.moveIndicators.push({ x: wx, y: wy, life: 0.8, maxLife: 0.8 });
        }
      }
    }

    function handleMinimapClick(clientX, clientY) {
      const G = getGame();
      if (!G || !miniCanvas || !canvas) return;
      const rect = miniCanvas.getBoundingClientRect();
      const mx = clientX - rect.left, my = clientY - rect.top;
      const tx = (mx / rect.width) * MAP_W, ty = (my / rect.height) * MAP_H;
      G.camera.x = tx * TILE - canvas.width / 2 / G.camera.zoom;
      G.camera.y = ty * TILE - canvas.height / 2 / G.camera.zoom;
    }

    // Wire minimap events if canvas is available
    if (miniCanvas) {
      miniCanvas.addEventListener('mousedown', function (ev) {
        ev.stopPropagation();
        handleMinimapClick(ev.clientX, ev.clientY);
      });
      miniCanvas.addEventListener('touchstart', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (ev.touches.length > 0) handleMinimapClick(ev.touches[0].clientX, ev.touches[0].clientY);
      }, { passive: false });
      miniCanvas.addEventListener('touchmove', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (ev.touches.length > 0) handleMinimapClick(ev.touches[0].clientX, ev.touches[0].clientY);
      }, { passive: false });
    }

    return { findEntityNear, touchToWorld, pinchDist, handleTap, handleLeftClick, handleBoxSelect, handleRightClick, handleMinimapClick };
  }

  const exportsObj = { createInputSystem };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
  global.RSEInput = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
