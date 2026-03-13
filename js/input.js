(function (global) {
  function createInputSystem(options) {
    const getGame = options.getGame;
    const myOwner = options.myOwner;

    function findEntityNear(wx, wy, ownerFilter) {
      const G = getGame();
      let nearest = null;
      let bestDistance = Infinity;
      for (const entity of G.entities) {
        if (entity.hp <= 0) continue;
        if (ownerFilter && entity.owner !== ownerFilter) continue;
        const dx = entity.x - wx, dy = entity.y - wy;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistance) {
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
      const entity = findEntityNear(wx, wy, myOwner());
      G.selection = entity ? [entity] : [];
    }

    function handleLeftClick(wx, wy) { handleTap(wx, wy); }
    function handleBoxSelect() {}
    function handleRightClick() {}

    return { findEntityNear, touchToWorld, pinchDist, handleTap, handleLeftClick, handleBoxSelect, handleRightClick };
  }

  const exportsObj = { createInputSystem };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
  global.RSEInput = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
