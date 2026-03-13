(function (global) {
  function getUnitVisualKey(entity, unitVisualMap) {
    if (entity.isWorker) return 'worker';
    return unitVisualMap[entity.key] || 'melee';
  }

  function getEntityDisplayInfo(entity, faction, buildings) {
    if (entity.isBuilding) {
      const building = buildings[entity.key] || {};
      return { name: building.name || entity.key, icon: building.icon || '?' };
    }
    if (entity.isWorker) {
      return { name: faction.worker.name, icon: faction.worker.icon };
    }
    const unit = faction.units[entity.key] || {};
    return { name: unit.name || entity.key, icon: unit.icon || '?' };
  }

  function getHealthBarColor(hpPct) {
    if (hpPct > 50) return '#4a4';
    if (hpPct > 25) return '#aa4';
    return '#a44';
  }

  const exportsObj = {
    getUnitVisualKey,
    getEntityDisplayInfo,
    getHealthBarColor,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
  global.RSERenderLogic = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
