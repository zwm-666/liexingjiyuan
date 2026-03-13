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
      const tiles = [];
      const resources = [];
      const rng = G.rng;
      const W = MAP_W, H = MAP_H;

      // Helper: improved 2D noise (multi-octave)
      function fbm(x, y) {
        return noise2D(x, y) * 0.5 + noise2D(x * 2.1, y * 2.1) * 0.3 + noise2D(x * 4.3, y * 4.3) * 0.2;
      }

      // Terrain: 0=grass, 1=dirt, 2=water, 3=cliff, 4=forest, 5=highground
      for (let y = 0; y < H; y++) {
        tiles[y] = [];
        for (let x = 0; x < W; x++) tiles[y][x] = 0;
      }

      // Water: edges + river
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) { tiles[y][x] = 2; continue; }
          if (x < 4 || x >= W - 4 || y < 4 || y >= H - 4) {
            if (noise2D(x * 0.15, y * 0.15) > 0.35) tiles[y][x] = 2;
          }
        }

      // Central river (diagonal divider)
      const riverCx = W / 2, riverCy = H / 2;
      for (let y = 4; y < H - 4; y++)
        for (let x = 4; x < W - 4; x++) {
          const riverLine = x - riverCx + (y - riverCy) * 0.6;
          const riverWidth = 2.5 + noise2D(x * 0.05, y * 0.05) * 2;
          if (Math.abs(riverLine) < riverWidth && y > 20 && y < H - 20 && x > 15 && x < W - 15) {
            tiles[y][x] = 2;
          }
        }

      // River crossing bridges
      const bridgeY1 = Math.floor(H * 0.35), bridgeY2 = Math.floor(H * 0.65);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const bx1 = Math.floor(W / 2 - bridgeY1 * 0.3) + dx;
          if (bx1 > 3 && bx1 < W - 3) tiles[bridgeY1 + dy][bx1] = 1;
          const bx2 = Math.floor(W / 2 - (bridgeY2 - H) * 0.3 + H * 0.3) + dx;
          if (bx2 > 3 && bx2 < W - 3) tiles[bridgeY2 + dy][bx2] = 1;
        }

      // Small lakes
      const numLakes = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < numLakes; i++) {
        const lx = 15 + Math.floor(rng() * (W - 30));
        const ly = 15 + Math.floor(rng() * (H - 30));
        const lr = 3 + Math.floor(rng() * 4);
        if ((lx < 25 && ly < 25) || (lx > W - 25 && ly > H - 25)) continue;
        for (let dy = -lr; dy <= lr; dy++)
          for (let dx = -lr; dx <= lr; dx++) {
            if (dx * dx + dy * dy <= lr * lr + rng() * 4) {
              const ttx = lx + dx, tty = ly + dy;
              if (ttx > 3 && ttx < W - 3 && tty > 3 && tty < H - 3) tiles[tty][ttx] = 2;
            }
          }
      }

      // Cliff walls
      for (let y = 25; y < 45; y++) {
        for (let dx = 0; dx < 3; dx++) {
          const cx = Math.floor(W * 0.32) + dx + Math.floor(noise2D(y * 0.2, 1) * 2);
          if (cx > 3 && cx < W - 3 && tiles[y][cx] !== 2) tiles[y][cx] = 3;
        }
      }
      for (let y = H - 45; y < H - 25; y++) {
        for (let dx = 0; dx < 3; dx++) {
          const cx = Math.floor(W * 0.68) + dx + Math.floor(noise2D(y * 0.2, 2) * 2);
          if (cx > 3 && cx < W - 3 && tiles[y][cx] !== 2) tiles[y][cx] = 3;
        }
      }

      // High ground plateaus
      const hgAreas = [
        { cx: Math.floor(W * 0.35), cy: Math.floor(H * 0.35), rx: 8, ry: 6 },
        { cx: Math.floor(W * 0.65), cy: Math.floor(H * 0.65), rx: 8, ry: 6 },
        { cx: Math.floor(W * 0.5), cy: Math.floor(H * 0.5), rx: 5, ry: 5 },
      ];
      for (const hg of hgAreas) {
        for (let dy = -hg.ry; dy <= hg.ry; dy++)
          for (let dx = -hg.rx; dx <= hg.rx; dx++) {
            const dist = (dx * dx) / (hg.rx * hg.rx) + (dy * dy) / (hg.ry * hg.ry);
            if (dist < 0.9) {
              const ttx = hg.cx + dx, tty = hg.cy + dy;
              if (ttx > 3 && ttx < W - 3 && tty > 3 && tty < H - 3 && tiles[tty][ttx] === 0)
                tiles[tty][ttx] = 5;
            }
          }
      }

      // Dirt paths
      for (let i = 0; i < 200; i++) {
        const t = i / 200;
        const px = Math.floor(12 + t * (W - 24) + Math.sin(t * 6) * 8);
        const py = Math.floor(12 + t * (H - 24) + Math.cos(t * 5) * 6);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ttx = px + dx, tty = py + dy;
            if (ttx > 3 && ttx < W - 3 && tty > 3 && tty < H - 3 && tiles[tty][ttx] === 0)
              tiles[tty][ttx] = 1;
          }
      }

      // Base areas: clear space
      for (let dy = -10; dy <= 10; dy++)
        for (let dx = -10; dx <= 10; dx++) {
          const px = 10 + dx, py = 10 + dy;
          const ex = W - 11 + dx, ey = H - 11 + dy;
          if (px > 1 && px < W - 2 && py > 1 && py < H - 2) {
            if (tiles[py][px] !== 2)
              tiles[py][px] = dx * dx + dy * dy < 64 ? 0 : tiles[py][px] === 4 ? 4 : 0;
          }
          if (ex > 1 && ex < W - 2 && ey > 1 && ey < H - 2) {
            if (tiles[ey][ex] !== 2)
              tiles[ey][ex] = dx * dx + dy * dy < 64 ? 0 : tiles[ey][ex] === 4 ? 4 : 0;
          }
        }

      // Forest clusters
      for (let y = 4; y < H - 4; y++)
        for (let x = 4; x < W - 4; x++) {
          if (tiles[y][x] !== 0) continue;
          const n = fbm(x * 0.06, y * 0.06);
          if ((x < 18 && y < 18) || (x > W - 18 && y > H - 18)) continue;
          if (n > 0.52) tiles[y][x] = 4;
        }

      // Fog
      G.map.fogPlayer = Array.from({ length: H }, () => new Uint8Array(W).fill(FOG_UNEXPLORED));
      G.map.fogEnemy = Array.from({ length: H }, () => new Uint8Array(W).fill(FOG_UNEXPLORED));

      // Resources: every forest tile = harvestable wood
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (tiles[y][x] === 4)
            resources.push({ type: 'wood', x, y, amount: 120, max: 120, regen: 0.3 });
        }

      // Food patches (2x2 clusters)
      function placeFood(cx, cy) {
        const offsets = [[0,0],[1,0],[0,1],[1,1]];
        for (const [ddx, ddy] of offsets) {
          const fx = cx + ddx, fy = cy + ddy;
          if (fx > 2 && fx < W - 2 && fy > 2 && fy < H - 2 && tiles[fy][fx] !== 2 && tiles[fy][fx] !== 3) {
            tiles[fy][fx] = 0;
            resources.push({ type: 'food', x: fx, y: fy, amount: 1500, max: 1500, regen: 0.5 });
          }
        }
      }
      placeFood(14, 6); placeFood(6, 14);
      placeFood(W - 16, H - 8); placeFood(W - 8, H - 16);
      placeFood(Math.floor(W * 0.3), Math.floor(H * 0.2));
      placeFood(Math.floor(W * 0.7), Math.floor(H * 0.8));
      placeFood(Math.floor(W / 2) - 5, Math.floor(H / 2) - 1);
      placeFood(Math.floor(W / 2) + 4, Math.floor(H / 2) + 1);

      // Gold mines
      function placeGold(gx, gy, amt) {
        if (gx > 2 && gx < W - 2 && gy > 2 && gy < H - 2 && tiles[gy][gx] !== 2) {
          tiles[gy][gx] = 1;
          resources.push({ type: 'gold', x: gx, y: gy, amount: amt, max: amt, regen: 0.02 });
        }
      }
      placeGold(18, 12, 6000); placeGold(W - 19, H - 13, 6000);
      placeGold(Math.floor(W * 0.3) + 1, Math.floor(H * 0.25), 5000);
      placeGold(Math.floor(W * 0.7) - 1, Math.floor(H * 0.75), 5000);
      placeGold(Math.floor(W / 2), Math.floor(H / 2), 10000);
      placeGold(Math.floor(W * 0.2), Math.floor(H * 0.5), 4000);
      placeGold(Math.floor(W * 0.8), Math.floor(H * 0.5), 4000);

      G.map.tiles = tiles;
      G.map.resources = resources;
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
