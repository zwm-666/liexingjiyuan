(function (global) {
  function createWorldSystem(options) {
    const getGame = options.getGame;
    const TILE = options.TILE;
    const MAP_W = options.MAP_W;
    const MAP_H = options.MAP_H;

    function seedRandom(seed) {
      let state = seed >>> 0;
      return function () {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function noise2D(x, y) {
      const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return value - Math.floor(value);
    }

    function isPassable(tx, ty) {
      const G = getGame();
      if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return false;
      return !G.map.blocked[ty][tx];
    }

    function markBuildingTiles(tx, ty, size, val) {
      const G = getGame();
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const x = tx + dx, y = ty + dy;
          if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
            G.map.blocked[y][x] = val;
          }
        }
      }
    }

    function findPath(sx, sy, ex, ey) {
      const startTx = Math.floor(sx / TILE), startTy = Math.floor(sy / TILE);
      const endTx = Math.floor(ex / TILE), endTy = Math.floor(ey / TILE);
      if (startTx === endTx && startTy === endTy) return [];
      if (!isPassable(endTx, endTy)) return null;
      return [{ x: endTx * TILE + TILE / 2, y: endTy * TILE + TILE / 2 }];
    }

    function tileHash(tx, ty) { return noise2D(tx * 0.17, ty * 0.31); }
    function getNeighborType() { return 0; }
    function drawTile() {}
    function generateMap() {}

    return { generateMap, noise2D, seedRandom, isPassable, markBuildingTiles, findPath, tileHash, getNeighborType, drawTile };
  }

  const exportsObj = { createWorldSystem };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
  global.RSEWorld = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
