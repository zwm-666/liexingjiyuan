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
      // Check terrain type if tiles exist (2=water, 3=cliff, 4=forest are impassable)
      if (G.map.tiles) {
        const t = G.map.tiles[ty]?.[tx];
        if (t === 2 || t === 3 || t === 4) return false;
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

      function rotatePoint(point, times) {
        let x = point.x;
        let y = point.y;
        const turns = ((times % 4) + 4) % 4;
        for (let i = 0; i < turns; i++) {
          const nextX = W - 1 - y;
          const nextY = x;
          x = nextX;
          y = nextY;
        }
        return { x, y };
      }

      function paintRotationalEllipse(cx, cy, rx, ry, tile) {
        for (let i = 0; i < 4; i++) {
          const point = rotatePoint({ x: cx, y: cy }, i);
          const swapAxes = i % 2 === 1;
          paintEllipse(point.x, point.y, swapAxes ? ry : rx, swapAxes ? rx : ry, tile);
        }
      }

      function paintRotationalCircle(cx, cy, radius, tile) {
        for (let i = 0; i < 4; i++) {
          const point = rotatePoint({ x: cx, y: cy }, i);
          paintCircle(point.x, point.y, radius, tile);
        }
      }

      function paintRotationalPath(points, radius, tile) {
        for (let i = 0; i < 4; i++) {
          const rotated = points.map((point) => rotatePoint(point, i));
          paintPath(rotated, radius, tile);
        }
      }

      function reserveRotationalOpenArea(cx, cy, radius) {
        for (let i = 0; i < 4; i++) {
          const point = rotatePoint({ x: cx, y: cy }, i);
          reserveOpenArea(point.x, point.y, radius);
        }
      }

      function placeRotationalGold(point, amount) {
        for (let i = 0; i < 4; i++) {
          const rotated = rotatePoint(point, i);
          placeGold(rotated.x, rotated.y, amount);
        }
      }

      function placeRotationalFood(point) {
        for (let i = 0; i < 4; i++) {
          const rotated = rotatePoint(point, i);
          placeFoodPatch(rotated.x, rotated.y);
        }
      }

      function placeRotationalWood(point, pattern) {
        for (let i = 0; i < 4; i++) {
          const rotated = rotatePoint(point, i);
          placeWoodCluster(rotated.x, rotated.y, pattern);
        }
      }

      function carvePlatform(cx, cy, rx, ry) {
        paintEllipse(cx, cy, rx, ry, 0);
        paintEllipse(cx, cy, Math.max(2, rx - 3), Math.max(2, ry - 3), 0);
      }

      function paintMirroredEllipse(cx, cy, rx, ry, tile) {
        paintEllipse(cx, cy, rx, ry, tile);
        const mirrored = mirrorPoint({ x: cx, y: cy });
        paintEllipse(mirrored.x, mirrored.y, rx, ry, tile);
      }

      function paintMirroredCircle(cx, cy, radius, tile) {
        paintCircle(cx, cy, radius, tile);
        const mirrored = mirrorPoint({ x: cx, y: cy });
        paintCircle(mirrored.x, mirrored.y, radius, tile);
      }

      function paintMirroredPath(points, radius, tile) {
        paintPath(points, radius, tile);
        const mirroredPoints = points
          .map((point) => mirrorPoint(point))
          .reverse();
        paintPath(mirroredPoints, radius, tile);
      }

      function reserveOpenArea(cx, cy, radius) {
        for (let y = cy - radius; y <= cy + radius; y++) {
          for (let x = cx - radius; x <= cx + radius; x++) {
            if (!inBounds(x, y)) continue;
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy <= radius * radius && (tiles[y][x] === 2 || tiles[y][x] === 3 || tiles[y][x] === 4)) {
              tiles[y][x] = 0;
            }
          }
        }
      }

      function enforceTerrainSymmetry() {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const mirrored = mirrorPoint({ x, y });
            if (y > mirrored.y || (y === mirrored.y && x > mirrored.x)) continue;
            tiles[mirrored.y][mirrored.x] = tiles[y][x];
          }
        }
      }

      function isResourceTile(x, y) {
        return resources.some((resource) => resource.x === x && resource.y === y);
      }

      function placeGold(x, y, amount) {
        if (!inBounds(x, y)) return;
        if (tiles[y][x] === 2 || tiles[y][x] === 3) return;
        if (isResourceTile(x, y)) return;
        tiles[y][x] = 1;
        resources.push({ type: "gold", x, y, amount, max: amount, regen: 0 });
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
          if (!inBounds(x, y)) continue;
          if (tiles[y][x] === 2 || tiles[y][x] === 3) continue;
          if (isResourceTile(x, y)) continue;
          tiles[y][x] = 0;
          resources.push({ type: "food", x, y, amount: 1500, max: 1500, regen: 0 });
        }
      }

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

      const smallWoodPattern = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, 1],
        [1, 1],
      ];

      function placeWoodCluster(cx, cy, pattern) {
        const activePattern = pattern || woodPattern;
        for (const [dx, dy] of activePattern) {
          const x = cx + dx;
          const y = cy + dy;
          if (!inBounds(x, y)) continue;
          if (tiles[y][x] === 2 || tiles[y][x] === 3) continue;
          if (isResourceTile(x, y)) continue;
          tiles[y][x] = 4;
          resources.push({ type: "wood", x, y, amount: 150, max: 150, regen: 0.1 });
        }
      }

      function placeMirroredGold(point, amount) {
        placeGold(point.x, point.y, amount);
        const mirrored = mirrorPoint(point);
        placeGold(mirrored.x, mirrored.y, amount);
      }

      function placeMirroredFood(point) {
        placeFoodPatch(point.x, point.y);
        const mirrored = mirrorPoint(point);
        placeFoodPatch(mirrored.x - 1, mirrored.y - 1);
      }

      function placeMirroredWood(point) {
        for (const [dx, dy] of woodPattern) {
          const x = point.x + dx;
          const y = point.y + dy;
          const mirrored = mirrorPoint({ x, y });
          if (!inBounds(x, y) || !inBounds(mirrored.x, mirrored.y)) continue;
          if (tiles[y][x] === 2 || tiles[y][x] === 3) continue;
          if (tiles[mirrored.y][mirrored.x] === 2 || tiles[mirrored.y][mirrored.x] === 3) continue;
          if (isResourceTile(x, y) || isResourceTile(mirrored.x, mirrored.y)) continue;
          tiles[y][x] = 4;
          tiles[mirrored.y][mirrored.x] = 4;
          resources.push({ type: "wood", x, y, amount: 150, max: 150, regen: 0.1 });
          if (mirrored.x !== x || mirrored.y !== y) {
            resources.push({ type: "wood", x: mirrored.x, y: mirrored.y, amount: 150, max: 150, regen: 0.1 });
          }
        }
      }

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) {
            tiles[y][x] = 2;
          }
        }
      }

      const center = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
      const topSpawn = { x: center.x, y: 16 };
      const topMainMine = { x: center.x, y: 25 };
      const topExpansion = { x: center.x - 18, y: 12 };
      const topNearWoodLeft = { x: center.x - 14, y: 20 };
      const topNearWoodRight = { x: center.x + 14, y: 20 };
      const topFoodLeft = { x: center.x - 10, y: 21 };
      const topFoodRight = { x: center.x + 6, y: 21 };
      const topBuildPocket = { x: center.x, y: 20 };

      const mainRoad = [
        { x: topSpawn.x, y: topSpawn.y + 8 },
        { x: topSpawn.x, y: 26 },
        { x: center.x - 2, y: 40 },
        { x: center.x, y: 52 },
      ];
      const expansionRoad = [
        { x: topSpawn.x - 6, y: 20 },
        { x: topSpawn.x - 10, y: 16 },
        { x: topExpansion.x + 5, y: 13 },
        { x: topExpansion.x, y: topExpansion.y + 3 },
      ];
      const flankRoadWest = [
        { x: center.x - 9, y: 44 },
        { x: center.x - 18, y: 51 },
        { x: center.x - 22, y: 60 },
        { x: center.x - 18, y: 70 },
        { x: center.x - 8, y: 78 },
      ];
      const flankRoadEast = [
        { x: center.x + 9, y: 45 },
        { x: center.x + 17, y: 51 },
        { x: center.x + 21, y: 61 },
        { x: center.x + 17, y: 71 },
        { x: center.x + 8, y: 79 },
      ];
      const centerCrossRoad = [
        { x: center.x - 16, y: center.y },
        { x: center.x - 7, y: center.y + 1 },
        { x: center.x, y: center.y },
        { x: center.x + 7, y: center.y - 1 },
        { x: center.x + 16, y: center.y },
      ];

      // Central battlefield: broad open plain with slight strategic high ground core
      paintEllipse(center.x, center.y, 20, 17, 0);
      paintEllipse(center.x, center.y, 15, 13, 0);
      paintEllipse(center.x, center.y - 3, 10, 6, 0);
      paintEllipse(center.x, center.y + 3, 10, 6, 0);
      paintEllipse(center.x, center.y, 7, 7, 5);
      paintEllipse(center.x - 7, center.y, 4, 3, 5);
      paintEllipse(center.x + 7, center.y, 4, 3, 5);
      paintEllipse(center.x, center.y - 7, 3, 4, 5);
      paintEllipse(center.x, center.y + 7, 3, 4, 5);

      // Four start zones and safe building areas between spawn and inner main mine
      paintRotationalEllipse(topSpawn.x, topSpawn.y, 13, 11, 0);
      paintRotationalEllipse(topSpawn.x, topSpawn.y + 9, 14, 10, 0);
      paintRotationalEllipse(topBuildPocket.x, topBuildPocket.y, 9, 6, 0);
      paintRotationalEllipse(topMainMine.x, topMainMine.y, 7, 6, 0);
      paintRotationalEllipse(topMainMine.x, topMainMine.y - 6, 10, 7, 0);

      // Main roads from each start to center
      paintRotationalPath(mainRoad, 3, 1);
      paintPath(centerCrossRoad, 3, 1);

      // Outer expansion branch roads
      paintRotationalPath(expansionRoad, 2, 1);

      // Side paths for flanking around the center
      paintRotationalPath(flankRoadWest, 2, 1);
      paintRotationalPath(flankRoadEast, 2, 1);
      paintRotationalPath([
        { x: center.x - 25, y: 30 },
        { x: center.x - 20, y: 39 },
        { x: center.x - 15, y: 46 },
      ], 2, 1);

      // Large forests around each spawn and along side lanes
      paintRotationalEllipse(center.x - 20, 13, 10, 5, 4);
      paintRotationalEllipse(center.x - 25, 34, 8, 6, 4);
      paintRotationalEllipse(center.x - 30, 58, 6, 9, 4);
      paintRotationalEllipse(center.x - 18, 84, 7, 5, 4);
      paintRotationalEllipse(center.x - 10, 25, 4, 3, 4);
      paintRotationalEllipse(center.x + 10, 25, 4, 3, 4);

      // Cliffs / rocky blockers creating choke points without full dead ends
      paintRotationalEllipse(center.x - 13, 42, 5, 3, 3);
      paintRotationalEllipse(center.x + 13, 42, 5, 3, 3);
      paintRotationalEllipse(center.x - 28, 63, 4, 8, 3);
      paintRotationalEllipse(center.x + 28, 63, 4, 8, 3);
      paintRotationalEllipse(center.x - 17, 88, 6, 3, 3);
      paintRotationalEllipse(center.x + 17, 88, 6, 3, 3);
      paintRotationalEllipse(center.x, 98, 5, 3, 2);
      paintRotationalEllipse(center.x - 22, 46, 3, 2, 3);
      paintRotationalEllipse(center.x + 22, 46, 3, 2, 3);

      paintRotationalPath(mainRoad, 3, 1);
      paintRotationalPath(expansionRoad, 2, 1);
      paintRotationalPath(flankRoadWest, 2, 1);
      paintRotationalPath(flankRoadEast, 2, 1);
      paintPath(centerCrossRoad, 3, 1);

      // Keep routes open near bases, mines, expansions, and central fight zone
      reserveRotationalOpenArea(topSpawn.x, topSpawn.y, 15);
      reserveRotationalOpenArea(topMainMine.x, topMainMine.y, 10);
      reserveRotationalOpenArea(topExpansion.x, topExpansion.y, 9);
      reserveRotationalOpenArea(center.x, center.y, 18);
      reserveRotationalOpenArea(topBuildPocket.x, topBuildPocket.y, 7);
      reserveRotationalOpenArea(center.x - 24, 25, 4);
      reserveRotationalOpenArea(center.x - 28, 46, 4);
      reserveRotationalOpenArea(center.x - 20, 73, 4);

      setTile(center.x, center.y, 5);
      setTile(center.x, topSpawn.y, 0);
      setTile(topMainMine.x, topMainMine.y, 1);

      // Key mines: one main mine per base and one outer expansion per side
      placeRotationalGold(topMainMine, 6500);
      placeRotationalGold(topExpansion, 4200);

      // Keep food for game compatibility, but place it as low-profile side economy patches
      placeRotationalFood(topFoodLeft);
      placeRotationalFood(topFoodRight);

      // Dense lumber lines around each side
      placeRotationalWood(topNearWoodLeft, smallWoodPattern);
      placeRotationalWood(topNearWoodRight, smallWoodPattern);
      placeRotationalWood({ x: center.x - 26, y: 34 });
      placeRotationalWood({ x: center.x - 30, y: 60 });

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
