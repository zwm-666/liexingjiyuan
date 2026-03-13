(function (global) {
  const FACTION_TECH_PATHS = {
    starfire: ['sf_siegetech', 'sf_splashUp', 'sf_infernal', 'sf_phoenixfire'],
    shadow: ['sh_siegetech', 'sh_stealthUp', 'sh_deathknight', 'sh_voidcurse'],
    steel: ['st_siegetech', 'st_heavyplating', 'st_titan', 'st_overdrive'],
  };

  function getTechPriorities(faction) {
    const factionTechs = FACTION_TECH_PATHS[faction] || FACTION_TECH_PATHS.steel;
    return [
      'meleeUp1', 'rangedUp1', 'armorUp1',
      factionTechs[0],
      'meleeUp2', 'armorUp2', 'rangedUp2', 'workerLoad', 'buildingHp',
      factionTechs[1],
      factionTechs[2],
      factionTechs[3],
      'goldEfficiency',
    ];
  }

  function canAfford(resources, item) {
    return resources.wood >= (item.costW || 0) && resources.food >= (item.costF || 0) && resources.gold >= (item.costG || 0);
  }

  function chooseResearchTech(playerState, techs) {
    const priorities = getTechPriorities(playerState.faction);
    for (const techKey of priorities) {
      if (!techKey) continue;
      const tech = techs[techKey];
      if (!tech || playerState.techs[techKey]) continue;
      if (tech.faction && tech.faction !== playerState.faction) continue;
      if (tech.requires && !tech.requires.every(required => playerState.techs[required])) continue;
      if (tech.needsTier && tech.needsTier > playerState.tier) continue;
      if (!canAfford(playerState.resources, tech)) continue;
      return techKey;
    }
    return null;
  }

  function getTrainableUnitKeys(options) {
    const maxTier = options.maxTier;
    const exactTier = options.exactTier;
    return options.unitKeys.filter(unitKey => {
      const unit = options.units[unitKey];
      if (!unit) return false;
      if (typeof exactTier === 'number' && unit.tier !== exactTier) return false;
      if (typeof maxTier === 'number' && (unit.tier || 1) > maxTier) return false;
      if (unit.techRequires && !options.techs[unit.techRequires]) return false;
      return canAfford(options.resources, unit);
    });
  }

  const exportsObj = {
    getTechPriorities,
    chooseResearchTech,
    getTrainableUnitKeys,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEAiLogic = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
