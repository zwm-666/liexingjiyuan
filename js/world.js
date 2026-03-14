(function (global) {
  function createWorldSystem(options) {
    const getGame = options.getGame;
    const TILE = options.TILE;
    const MAP_W = options.MAP_W;
    const MAP_H = options.MAP_H;
    const FOG_UNEXPLORED = options.FOG_UNEXPLORED ?? 0;

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
      // Check terrain type if tiles exist (2=water, 3=cliff are impassable)
      if (G.map.tiles) {
        const t = G.map.tiles[ty]?.[tx];
        if (t === 2 || t === 3) return false;
      }
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

    // ---- A* PATHFINDING ----
    // Binary min-heap for A* open set
    function createMinHeap() {
      const data = [];
      return {
        push(node) {
          data.push(node);
          let i = data.length - 1;
          while (i > 0) {
            const p = (i - 1) >> 1;
            if (data[p].f <= data[i].f) break;
            [data[p], data[i]] = [data[i], data[p]];
            i = p;
          }
        },
        pop() {
          const top = data[0];
          const last = data.pop();
          if (data.length > 0) {
            data[0] = last;
            let i = 0;
            while (true) {
              let s = i, l = 2 * i + 1, r = 2 * i + 2;
              if (l < data.length && data[l].f < data[s].f) s = l;
              if (r < data.length && data[r].f < data[s].f) s = r;
              if (s === i) break;
              [data[s], data[i]] = [data[i], data[s]];
              i = s;
            }
          }
          return top;
        },
        get length() { return data.length; }
      };
    }

    const PATH_DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    const PATH_COSTS = [1,1,1,1,1.41,1.41,1.41,1.41];

    function findPath(sx, sy, ex, ey) {
      let startTx = Math.floor(sx / TILE), startTy = Math.floor(sy / TILE);
      let endTx = Math.floor(ex / TILE), endTy = Math.floor(ey / TILE);
      // Clamp to map bounds
      startTx = Math.max(0, Math.min(MAP_W - 1, startTx));
      startTy = Math.max(0, Math.min(MAP_H - 1, startTy));
      endTx = Math.max(0, Math.min(MAP_W - 1, endTx));
      endTy = Math.max(0, Math.min(MAP_H - 1, endTy));
      if (startTx === endTx && startTy === endTy) return [];
      // If target is impassable, find nearest passable tile
      if (!isPassable(endTx, endTy)) {
        let found = false;
        for (let r = 1; r <= 8 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const nx = endTx + dx, ny = endTy + dy;
              if (isPassable(nx, ny)) {
                endTx = nx; endTy = ny; found = true;
              }
            }
          }
        }
        if (!found) return null;
      }
      // A* search
      const key = (tx, ty) => ty * MAP_W + tx;
      const open = createMinHeap();
      const gScore = new Map();
      const cameFrom = new Map();
      const startKey = key(startTx, startTy);
      const endKey = key(endTx, endTy);
      const h = (tx, ty) => Math.abs(tx - endTx) + Math.abs(ty - endTy);
      gScore.set(startKey, 0);
      open.push({ tx: startTx, ty: startTy, f: h(startTx, startTy) });
      let iterations = 0;
      while (open.length > 0 && iterations < 3000) {
        iterations++;
        const cur = open.pop();
        const ck = key(cur.tx, cur.ty);
        if (ck === endKey) {
          // Reconstruct path
          const path = [];
          let k = endKey;
          while (k !== startKey) {
            const pty = Math.floor(k / MAP_W), ptx = k % MAP_W;
            path.push({ x: ptx * TILE + TILE / 2, y: pty * TILE + TILE / 2 });
            k = cameFrom.get(k);
            if (k == null) break;
          }
          path.reverse();
          return path;
        }
        const curG = gScore.get(ck);
        for (let i = 0; i < 8; i++) {
          const nx = cur.tx + PATH_DIRS[i][0], ny = cur.ty + PATH_DIRS[i][1];
          if (!isPassable(nx, ny)) continue;
          // Diagonal: check both cardinal neighbors to prevent corner cutting
          if (i >= 4) {
            if (!isPassable(cur.tx + PATH_DIRS[i][0], cur.ty) ||
                !isPassable(cur.tx, cur.ty + PATH_DIRS[i][1])) continue;
          }
          const nk = key(nx, ny);
          const ng = curG + PATH_COSTS[i];
          if (!gScore.has(nk) || ng < gScore.get(nk)) {
            gScore.set(nk, ng);
            cameFrom.set(nk, ck);
            open.push({ tx: nx, ty: ny, f: ng + h(nx, ny) });
          }
        }
      }
      return null; // No path found
    }

    function tileHash(tx, ty) { return noise2D(tx * 0.17, ty * 0.31); }

    function getNeighborType(tx, ty) {
      const G = getGame();
      if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return 2;
      return G.map.tiles[ty][tx];
    }

    function drawTile(tx, ty, tileType, fog) {
      // Stub: actual drawing is done by the HTML entry point which injects
      // its own drawTile via options. This provides a no-op default for tests.
    }

    function generateMap() {
      const G = getGame();
      const W = MAP_W;
      const H = MAP_H;
      const tiles = Array.from({ length: H }, () => Array(W).fill(0));
      const resources = [];

      function inBounds(x, y) {
        return x >= 0 && x < W && y >= 0 && y < H;
      }

      function setTile(x, y, tile) {
        if (!inBounds(x, y)) return;
        tiles[y][x] = tile;
      }

      function paintCircle(cx, cy, radius, tile) {
        for (let y = cy - radius; y <= cy + radius; y++) {
          for (let x = cx - radius; x <= cx + radius; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy <= radius * radius) setTile(x, y, tile);
          }
        }
      }

      function paintEllipse(cx, cy, rx, ry, tile) {
        for (let y = cy - ry; y <= cy + ry; y++) {
          for (let x = cx - rx; x <= cx + rx; x++) {
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) setTile(x, y, tile);
          }
        }
      }

      function paintPath(points, radius, tile) {
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i];
          const b = points[i + 1];
          const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
          for (let step = 0; step <= steps; step++) {
            const t = steps === 0 ? 0 : step / steps;
            const x = Math.round(a.x + (b.x - a.x) * t);
            const y = Math.round(a.y + (b.y - a.y) * t);
            paintCircle(x, y, radius, tile);
          }
        }
      }

      function mirrorPoint(point) {
        return { x: W - 1 - point.x, y: H - 1 - point.y };
      }

      function carvePlatform(cx, cy, rx, ry) {
        paintEllipse(cx, cy, rx, ry, 0);
        paintEllipse(cx, cy, Math.max(2, rx - 3), Math.max(2, ry - 3), 0);
      }

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) {
            tiles[y][x] = 2;
          }
        }
      }

      paintEllipse(18, 108, 10, 12, 3);
      paintEllipse(W - 19, H - 109, 10, 12, 3);
      paintEllipse(42, 88, 10, 7, 3);
      paintEllipse(W - 43, H - 89, 10, 7, 3);
      paintEllipse(46, 34, 11, 7, 3);
      paintEllipse(W - 47, H - 35, 11, 7, 3);

      paintEllipse(64, 64, 18, 15, 3);
      paintEllipse(64, 64, 12, 10, 5);
      paintEllipse(50, 58, 5, 4, 5);
      paintEllipse(78, 70, 5, 4, 5);
      paintEllipse(24, 92, 5, 4, 5);
      paintEllipse(W - 25, H - 93, 5, 4, 5);

      const mainBase = { x: 12, y: 12 };
      const enemyBase = mirrorPoint(mainBase);
      const naturalA = { x: 28, y: 20 };
      const naturalB = mirrorPoint(naturalA);

      carvePlatform(mainBase.x, mainBase.y, 13, 11);
      carvePlatform(enemyBase.x, enemyBase.y, 13, 11);
      carvePlatform(naturalA.x, naturalA.y, 10, 8);
      carvePlatform(naturalB.x, naturalB.y, 10, 8);

      paintPath([
        { x: 12, y: 12 },
        { x: 20, y: 16 },
        { x: 28, y: 20 },
      ], 2, 1);
      paintPath([
        { x: 115, y: 115 },
        { x: 107, y: 111 },
        { x: 99, y: 107 },
      ], 2, 1);

      paintPath([
        { x: 28, y: 20 },
        { x: 40, y: 30 },
        { x: 54, y: 42 },
        { x: 60, y: 54 },
        { x: 64, y: 58 },
      ], 2, 1);
      paintPath([
        { x: 99, y: 107 },
        { x: 88, y: 96 },
        { x: 74, y: 85 },
        { x: 68, y: 74 },
        { x: 64, y: 70 },
      ], 2, 1);

      paintPath([
        { x: 28, y: 20 },
        { x: 34, y: 30 },
        { x: 38, y: 42 },
        { x: 42, y: 54 },
        { x: 50, y: 60 },
        { x: 58, y: 64 },
      ], 2, 1);
      paintPath([
        { x: 99, y: 107 },
        { x: 93, y: 98 },
        { x: 89, y: 86 },
        { x: 85, y: 74 },
        { x: 78, y: 68 },
        { x: 70, y: 64 },
      ], 2, 1);

      paintPath([
        { x: 24, y: 34 },
        { x: 30, y: 50 },
        { x: 40, y: 70 },
        { x: 54, y: 92 },
        { x: 72, y: 108 },
      ], 2, 1);
      paintPath([
        { x: 103, y: 93 },
        { x: 97, y: 77 },
        { x: 87, y: 57 },
        { x: 73, y: 35 },
        { x: 55, y: 19 },
      ], 2, 1);

      paintPath([
        { x: 34, y: 24 },
        { x: 48, y: 26 },
        { x: 68, y: 34 },
        { x: 92, y: 50 },
        { x: 108, y: 72 },
      ], 2, 1);
      paintPath([
        { x: 93, y: 103 },
        { x: 79, y: 101 },
        { x: 59, y: 93 },
        { x: 35, y: 77 },
        { x: 19, y: 55 },
      ], 2, 1);

      paintPath([
        { x: 58, y: 64 },
        { x: 64, y: 60 },
        { x: 70, y: 64 },
      ], 1, 5);
      paintPath([
        { x: 62, y: 56 },
        { x: 64, y: 64 },
        { x: 66, y: 72 },
      ], 1, 5);

      const goldNodes = [
        { x: 19, y: 14, amount: 6500 },
        { x: 30, y: 24, amount: 5000 },
        { x: 64, y: 58, amount: 3500 },
        { x: 20, y: 70, amount: 3000 },
      ];

      function placeGold(x, y, amount) {
        if (!inBounds(x, y)) return;
        if (tiles[y][x] === 2 || tiles[y][x] === 3) return;
        tiles[y][x] = 1;
        resources.push({ type: 'gold', x, y, amount, max: amount, regen: 0 });
      }

      for (const node of goldNodes) {
        placeGold(node.x, node.y, node.amount);
        const mirrored = mirrorPoint(node);
        if (mirrored.x !== node.x || mirrored.y !== node.y) {
          placeGold(mirrored.x, mirrored.y, node.amount);
        }
      }

      function placeFoodPatch(cx, cy) {
        const offsets = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ];
        for (const [dx, dy] of offsets) {
          const x = cx + dx;
          const y = cy + dy;
          if (!inBounds(x, y) || tiles[y][x] === 2 || tiles[y][x] === 3) continue;
          tiles[y][x] = 0;
          resources.push({ type: 'food', x, y, amount: 1500, max: 1500, regen: 0 });
        }
      }

      placeFoodPatch(14, 7);
      placeFoodPatch(7, 14);
      placeFoodPatch(25, 30);
      placeFoodPatch(30, 25);
      placeFoodPatch(62, 67);
      placeFoodPatch(67, 62);
      placeFoodPatch(W - 16, H - 9);
      placeFoodPatch(W - 9, H - 16);
      placeFoodPatch(W - 27, H - 31);
      placeFoodPatch(W - 32, H - 26);

      const woodPattern = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [-2, 0],
        [0, 2],
      ];
      const woodCenters = [
        { x: 8, y: 24 },
        { x: 24, y: 8 },
        { x: 36, y: 22 },
        { x: 24, y: 38 },
        { x: 52, y: 82 },
      ];

      function placeWoodCluster(cx, cy) {
        for (const [dx, dy] of woodPattern) {
          const x = cx + dx;
          const y = cy + dy;
          if (!inBounds(x, y)) continue;
          if (tiles[y][x] === 2 || tiles[y][x] === 3) continue;
          if (resources.some((resource) => resource.x === x && resource.y === y)) continue;
          tiles[y][x] = 4;
          resources.push({ type: 'wood', x, y, amount: 150, max: 150, regen: 0.1 });
        }
      }

      for (const center of woodCenters) {
        placeWoodCluster(center.x, center.y);
        const mirrored = mirrorPoint(center);
        placeWoodCluster(mirrored.x, mirrored.y);
      }

      G.map.tiles = tiles;
      G.map.resources = resources;
      G.map.fogPlayer = Array.from({ length: H }, () => new Uint8Array(W).fill(FOG_UNEXPLORED));
      G.map.fogEnemy = Array.from({ length: H }, () => new Uint8Array(W).fill(FOG_UNEXPLORED));
      G.map.blocked = Array.from({ length: H }, () => new Uint8Array(W));
      G.map.resourceBlocked = Array.from({ length: H }, () => new Uint8Array(W));
      for (const resource of resources) {
        if (resource.amount > 0) G.map.resourceBlocked[resource.y][resource.x] = 1;
      }
    }

    return { generateMap, noise2D, seedRandom, isPassable, markBuildingTiles, findPath, tileHash, getNeighborType, drawTile };
  }

  const exportsObj = { createWorldSystem };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
  global.RSEWorld = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
