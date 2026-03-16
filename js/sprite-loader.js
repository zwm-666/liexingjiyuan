(function (global) {
  /**
   * Sprite Loader for Rift Star Era
   * Loads and caches sprite images for buildings and units.
   * Falls back to procedural rendering if sprites fail to load.
   */
  const SPRITE_BASE = "assets/sprites";

  // Sprite definitions: faction -> category -> key -> filename
  const SPRITE_MANIFEST = {
    starfire: {
      buildings: {
        base: "buildings/base.png",
        barracks: "buildings/barracks.png",
        supply: "buildings/supply.png",
        harvester: "buildings/harvester.png",
        tower: "buildings/tower.png",
        researchlab: "buildings/researchlab.png",
        workshop: "buildings/workshop.png",
        magetower: "buildings/magetower.png",
        airfield: "buildings/airfield.png",
        ultimate: "buildings/ultimate.png",
      },
      units: {
        worker: "units/worker.png",
        warrior: "units/warrior.png",
        archer: "units/archer.png",
        mage: "units/mage.png",
        tank: "units/tank.png",
        firebat: "units/firebat.png",
        catapult: "units/catapult.png",
        phoenix: "units/phoenix.png",
        infernal: "units/infernal.png",
      },
    },
    shadow: {
      buildings: {
        base: "shadow/buildings/base.png",
        barracks: "shadow/buildings/barracks.png",
        supply: "shadow/buildings/supply.png",
        harvester: "shadow/buildings/harvester.png",
        tower: "shadow/buildings/tower.png",
        researchlab: "shadow/buildings/researchlab.png",
        workshop: "shadow/buildings/workshop.png",
        magetower: "shadow/buildings/magetower.png",
        airfield: "shadow/buildings/airfield.png",
        ultimate: "shadow/buildings/ultimate.png",
      },
      units: {
        worker: "shadow/units/worker.png",
        warrior: "shadow/units/warrior.png",
        archer: "shadow/units/archer.png",
        cavalry: "shadow/units/cavalry.png",
        warlock: "shadow/units/warlock.png",
        banshee: "shadow/units/banshee.png",
        siege: "shadow/units/siege.png",
        voiddragon: "shadow/units/voiddragon.png",
        deathknight: "shadow/units/deathknight.png",
      },
    },
    steel: {
      buildings: {
        base: "steel/buildings/base.png",
        barracks: "steel/buildings/barracks.png",
        supply: "steel/buildings/supply.png",
        harvester: "steel/buildings/harvester.png",
        tower: "steel/buildings/tower.png",
        researchlab: "steel/buildings/researchlab.png",
        workshop: "steel/buildings/workshop.png",
        magetower: "steel/buildings/magetower.png",
        airfield: "steel/buildings/airfield.png",
        ultimate: "steel/buildings/ultimate.png",
      },
      units: {
        worker: "steel/units/worker.png",
        warrior: "steel/units/warrior.png",
        sniper: "steel/units/sniper.png",
        steamtank: "steel/units/steamtank.png",
        engineer: "steel/units/engineer.png",
        copter: "steel/units/copter.png",
        artillery: "steel/units/artillery.png",
        dragon: "steel/units/dragon.png",
        titan: "steel/units/titan.png",
      },
    },
  };

  const spriteCache = {};
  let loadedCount = 0;
  let totalCount = 0;
  let allLoaded = false;

  function shouldPreloadSprites(protocol) {
    return true;
  }

  function computeSpriteMeta(img) {
    if (
      typeof document === "undefined" ||
      !img ||
      !(img.naturalWidth || img.width) ||
      !(img.naturalHeight || img.height)
    ) {
      return null;
    }
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    var pixels;
    try {
      pixels = ctx.getImageData(0, 0, width, height).data;
    } catch (e) {
      // file:// 协议下 getImageData 可能因 CORS 限制失败，返回整图边界
      return { bbox: { left: 0, top: 0, right: width, bottom: height } };
    }
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = pixels[(y * width + x) * 4 + 3];
        if (alpha <= 0) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < left || bottom < top) {
      return {
        bbox: { left: 0, top: 0, right: width, bottom: height },
      };
    }
    return {
      bbox: {
        left,
        top,
        right: right + 1,
        bottom: bottom + 1,
      },
    };
  }

  function getSpriteKey(faction, category, key) {
    return `${faction}:${category}:${key}`;
  }

  function loadAllSprites(onProgress, onComplete) {
    // Count total sprites
    totalCount = 0;
    loadedCount = 0;
    for (const faction in SPRITE_MANIFEST) {
      for (const category in SPRITE_MANIFEST[faction]) {
        for (const key in SPRITE_MANIFEST[faction][category]) {
          totalCount++;
        }
      }
    }

    if (totalCount === 0) {
      allLoaded = true;
      if (onComplete) onComplete();
      return;
    }

    for (const faction in SPRITE_MANIFEST) {
      for (const category in SPRITE_MANIFEST[faction]) {
        for (const key in SPRITE_MANIFEST[faction][category]) {
          const path = SPRITE_MANIFEST[faction][category][key];
          const cacheKey = getSpriteKey(faction, category, key);
          const img = new Image();
          img.onload = function () {
            img.__spriteMeta = computeSpriteMeta(img);
            spriteCache[cacheKey] = img;
            loadedCount++;
            if (onProgress) onProgress(loadedCount, totalCount);
            if (loadedCount >= totalCount) {
              allLoaded = true;
              if (onComplete) onComplete();
            }
          };
          img.onerror = function () {
            console.warn(`Failed to load sprite: ${path}`);
            spriteCache[cacheKey] = null; // Mark as failed
            loadedCount++;
            if (onProgress) onProgress(loadedCount, totalCount);
            if (loadedCount >= totalCount) {
              allLoaded = true;
              if (onComplete) onComplete();
            }
          };
          img.src = `${SPRITE_BASE}/${path}`;
        }
      }
    }
  }

  function getSprite(faction, category, key) {
    const cacheKey = getSpriteKey(faction, category, key);
    return spriteCache[cacheKey] || null;
  }

  function getBuildingSprite(faction, buildingKey) {
    return getSprite(faction, "buildings", buildingKey);
  }

  function getUnitSprite(faction, unitKey) {
    return getSprite(faction, "units", unitKey);
  }

  function isReady() {
    return allLoaded;
  }

  function getProgress() {
    return totalCount > 0 ? loadedCount / totalCount : 1;
  }

  const exportsObj = {
    SPRITE_MANIFEST,
    shouldPreloadSprites,
    loadAllSprites,
    getSprite,
    getBuildingSprite,
    getUnitSprite,
    isReady,
    getProgress,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }
  global.RSESpriteLoader = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
