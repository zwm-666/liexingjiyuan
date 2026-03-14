(function (global) {
  const TERRAIN_HEIGHTS = { 0: 1, 1: 1, 2: 0, 3: 3, 4: 1.5, 5: 2 };

  function getTerrainDecoration(tileType, neighbors = {}, hash = 0) {
    const tileHeight = TERRAIN_HEIGHTS[tileType] ?? 1;
    const neighborTypes = [
      neighbors.north ?? 0,
      neighbors.south ?? 0,
      neighbors.east ?? 0,
      neighbors.west ?? 0,
    ];
    const neighborHeights = neighborTypes.map(
      (neighborType) => TERRAIN_HEIGHTS[neighborType] ?? 1,
    );
    const dropTotal = neighborHeights.reduce(
      (sum, neighborHeight) => sum + Math.max(0, tileHeight - neighborHeight),
      0,
    );
    const adjacentCliffs = neighborTypes.filter((neighborType) => neighborType === 3).length;
    const adjacentHighground = neighborTypes.filter((neighborType) => neighborType === 5).length;
    const hasCliffShadow =
      (tileType === 5 || tileType === 3) && dropTotal > 0;
    const hasDustOverlay =
      tileType === 1 && (adjacentCliffs > 0 || adjacentHighground > 0);

    return {
      hasCliffShadow,
      shadowOpacity: hasCliffShadow
        ? Math.min(0.36, 0.12 + dropTotal * 0.05 + hash * 0.06)
        : 0,
      ridgeStrength: Math.min(
        0.7,
        0.22 + dropTotal * 0.08 + hash * 0.08 + (tileType === 3 ? 0.08 : 0),
      ),
      hasDustOverlay,
      dustStrength: hasDustOverlay
        ? Math.min(
            0.34,
            0.12 + adjacentCliffs * 0.06 + adjacentHighground * 0.04 + hash * 0.08,
          )
        : 0,
      hasRockBands: tileType === 3 || tileType === 5,
      rockBandAlpha:
        tileType === 3 ? 0.18 + hash * 0.08 : tileType === 5 ? 0.12 + hash * 0.06 : 0,
    };
  }

  function createRenderSystem(options) {
    let G = null;
    const getGame = options.getGame;
    const ctx = options.ctx;
    const canvas = options.canvas || { width: 0, height: 0 };
    const TILE = options.TILE;
    const MAP_W = options.MAP_W || 128;
    const MAP_H = options.MAP_H || 128;
    const FOG_UNEXPLORED = options.FOG_UNEXPLORED ?? 0;
    const FOG_EXPLORED = options.FOG_EXPLORED ?? 1;
    const FOG_VISIBLE = options.FOG_VISIBLE ?? 2;
    const BUILDINGS = options.BUILDINGS;
    const FACTIONS = options.FACTIONS;
    const TECHS = options.TECHS || {};
    const UNIT_VISUAL = options.UNIT_VISUAL;
    const myOwner = options.myOwner;
    const opponentOwner = options.opponentOwner;
    const myFog = options.myFog || (() => []);
    const tileHash = options.tileHash || (() => 0);
    const drawTile = options.drawTile || (() => {});
    const externalDrawMinimap = options.drawMinimap || null;
    const miniCanvas = options.miniCanvas || null;
    const mctx = miniCanvas ? miniCanvas.getContext("2d") : null;
    const TILE_COLORS = options.TILE_COLORS || {
      0: "#2d5a27",
      1: "#7a6a4f",
      2: "#1a3a5c",
      3: "#444",
      4: "#1a4a1a",
      5: "#3a6a30",
    };
    const getUnitVisualKey = options.getUnitVisualKey;
    const getProductionTime =
      options.getProductionTime || ((item, owner) => 20);
    const RESOURCE_COLORS = options.RESOURCE_COLORS || {
      wood: "#4a8",
      food: "#aa4",
      gold: "#da0",
    };
    const SpriteLoader =
      options.spriteLoader ||
      (typeof window !== "undefined" ? window.RSESpriteLoader : null);

    function getSpriteOpaqueBounds(sprite) {
      const width = sprite?.naturalWidth || sprite?.width || 0;
      const height = sprite?.naturalHeight || sprite?.height || 0;
      const bbox = sprite?.__spriteMeta?.bbox;
      if (!bbox || width <= 0 || height <= 0) {
        return { left: 0, top: 0, right: width, bottom: height };
      }
      return {
        left: Math.max(0, Math.min(width, bbox.left ?? 0)),
        top: Math.max(0, Math.min(height, bbox.top ?? 0)),
        right: Math.max(0, Math.min(width, bbox.right ?? width)),
        bottom: Math.max(0, Math.min(height, bbox.bottom ?? height)),
      };
    }

    function getBuildingSpriteDrawRect(sprite, bx, by, size) {
      const width = sprite?.naturalWidth || sprite?.width || size;
      const height = sprite?.naturalHeight || sprite?.height || size;
      const bounds = getSpriteOpaqueBounds(sprite);
      const drawWidth = size;
      const drawHeight = size;
      const scaleX = drawWidth / width;
      const scaleY = drawHeight / height;
      const visibleCenterX = ((bounds.left + bounds.right) / 2) * scaleX;
      return {
        x: bx + drawWidth / 2 - visibleCenterX,
        y: by + drawHeight - bounds.bottom * scaleY,
        width: drawWidth,
        height: drawHeight,
      };
    }

    function getEntityFaction(e) {
      if (!G || !G.players) return null;
      const p = G.players[e.owner];
      return p ? p.faction : null;
    }

    function render() {
      if (!G || G.phase === "menu") return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cam = G.camera;
      const viewW = canvas.width / cam.zoom,
        viewH = canvas.height / cam.zoom;

      ctx.save();
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // Visible tile range
      const startTX = Math.max(0, Math.floor(cam.x / TILE) - 1);
      const startTY = Math.max(0, Math.floor(cam.y / TILE) - 1);
      const endTX = Math.min(MAP_W, Math.ceil((cam.x + viewW) / TILE) + 1);
      const endTY = Math.min(MAP_H, Math.ceil((cam.y + viewH) / TILE) + 1);

      // Draw tiles
      const activeFog = G.isMultiplayer ? myFog() : G.map.fogPlayer;
      for (let ty = startTY; ty < endTY; ty++) {
        for (let tx = startTX; tx < endTX; tx++) {
          const fog = activeFog[ty][tx];
          if (fog === FOG_UNEXPLORED) {
            ctx.fillStyle = "#080810";
            ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
            // Subtle noise texture for unexplored
            const nh = tileHash(tx, ty);
            if (nh > 0.85) {
              ctx.fillStyle = "rgba(20,20,30,0.8)";
              ctx.fillRect(tx * TILE + nh * 20, ty * TILE + nh * 12, 4, 3);
            }
            continue;
          }
          const tile = G.map.tiles[ty][tx];
          drawTile(tx, ty, tile, fog);
          // Fog overlay for explored but not visible
          if (fog === FOG_EXPLORED) {
            ctx.fillStyle = "rgba(5,5,15,0.45)";
            ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
          }
        }
      }

      // Draw resources (only visible ones for performance)
      for (const r of G.map.resources) {
        if (r.amount <= 0) continue;
        if (
          r.x < startTX - 1 ||
          r.x > endTX + 1 ||
          r.y < startTY - 1 ||
          r.y > endTY + 1
        )
          continue;
        const fog = activeFog[r.y]?.[r.x];
        if (!fog) continue;
        const rx = r.x * TILE + TILE / 2,
          ry = r.y * TILE + TILE / 2;
        const rh = tileHash(r.x, r.y);

        if (r.type === "wood") {
          // Wood on forest tiles: tree already drawn by drawTile, just show depletion
          if (G.map.tiles[r.y]?.[r.x] === 4) {
            const pct = r.amount / r.max;
            if (pct < 0.3) {
              // Fading tree: overlay darkening
              ctx.fillStyle = `rgba(40,30,20,${0.3 * (1 - pct / 0.3)})`;
              ctx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
            }
          } else {
            // Standalone wood resource (not on forest tile) — draw tree
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.beginPath();
            ctx.ellipse(rx + 2, ry + 10, 12, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#5a3a1a";
            ctx.fillRect(rx - 2, ry - 2, 5, 14);
            ctx.fillStyle = "#1a6a22";
            ctx.beginPath();
            ctx.moveTo(rx, ry - 16);
            ctx.lineTo(rx - 10, ry - 2);
            ctx.lineTo(rx + 10, ry - 2);
            ctx.fill();
            ctx.fillStyle = "#228a2a";
            ctx.beginPath();
            ctx.moveTo(rx, ry - 20);
            ctx.lineTo(rx - 8, ry - 8);
            ctx.lineTo(rx + 8, ry - 8);
            ctx.fill();
            ctx.fillStyle = "#2a9a32";
            ctx.beginPath();
            ctx.moveTo(rx, ry - 23);
            ctx.lineTo(rx - 6, ry - 14);
            ctx.lineTo(rx + 6, ry - 14);
            ctx.fill();
          }
        } else if (r.type === "food") {
          // Wheat patch
          ctx.fillStyle = "rgba(0,0,0,0.1)";
          ctx.beginPath();
          ctx.ellipse(rx, ry + 8, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          const stalks = [
            [-5, 0],
            [-2, 1],
            [1, -1],
            [4, 0],
            [7, 1],
          ];
          for (const [sx, sy] of stalks) {
            ctx.strokeStyle = "#b8952a";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(rx + sx, ry + 6 + sy);
            ctx.lineTo(rx + sx + rh * 2 - 1, ry - 10 + sy);
            ctx.stroke();
            ctx.fillStyle = "#dab030";
            ctx.beginPath();
            ctx.ellipse(
              rx + sx + rh * 2 - 1,
              ry - 12 + sy,
              2,
              4,
              0.2,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          ctx.lineWidth = 1;
        } else if (r.type === "gold") {
          // Rocky mound
          ctx.fillStyle = "rgba(0,0,0,0.15)";
          ctx.beginPath();
          ctx.ellipse(rx + 2, ry + 8, 14, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#666058";
          ctx.beginPath();
          ctx.moveTo(rx - 12, ry + 6);
          ctx.lineTo(rx - 6, ry - 8);
          ctx.lineTo(rx + 2, ry - 10);
          ctx.lineTo(rx + 8, ry - 6);
          ctx.lineTo(rx + 12, ry + 6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#eac020";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rx - 4, ry - 2);
          ctx.lineTo(rx + 2, ry - 6);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(rx + 1, ry + 1);
          ctx.lineTo(rx + 6, ry - 3);
          ctx.stroke();
          ctx.lineWidth = 1;
          const sp = Math.sin(G.time * 4 + rh * 10) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(255,220,50,${sp * 0.6})`;
          ctx.beginPath();
          ctx.arc(rx + rh * 8 - 4, ry - 4, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw entities
      const sortedEntities = [...G.entities].sort((a, b) => {
        const ay = a.y + (a.flying ? 2000 : 0) + (a.isBuilding ? -1 : 0);
        const by = b.y + (b.flying ? 2000 : 0) + (b.isBuilding ? -1 : 0);
        return ay - by;
      });
      for (const e of sortedEntities) {
        if (e.hp <= 0) continue;
        // Fog check for opponent entities
        const etx = Math.floor(e.x / TILE),
          ety = Math.floor(e.y / TILE);
        if (e.owner !== myOwner()) {
          const fogVal = activeFog[ety]?.[etx];
          if (fogVal !== FOG_VISIBLE) continue;
        }

        if (e.isBuilding) {
          drawBuilding(e);
        } else {
          drawUnit(e);
        }
      }

      // Draw projectiles (enhanced)
      for (const p of G.projectiles) {
        const pt = p.ptype || "pierce";
        if (pt === "magic" || pt === "siege") {
          // Glowing orb with trail
          const dx = p.x - (p.prevX || p.x),
            dy = p.y - (p.prevY || p.y);
          ctx.fillStyle = p.color + "44";
          ctx.beginPath();
          ctx.arc(p.x - dx * 0.3, p.y - dy * 0.3, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = p.color + "88";
          ctx.beginPath();
          ctx.arc(p.x - dx * 0.15, p.y - dy * 0.15, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pt === "siege" ? 4 : 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Arrow/bolt: rotated line
          const dx = p.x - (p.prevX || p.x),
            dy = p.y - (p.prevY || p.y);
          const angle = Math.atan2(dy, dx);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(angle);
          ctx.fillStyle = p.color;
          ctx.fillRect(-6, -1, 8, 2);
          ctx.fillStyle = "#ddd";
          ctx.beginPath();
          ctx.moveTo(2, -2);
          ctx.lineTo(5, 0);
          ctx.lineTo(2, 2);
          ctx.fill();
          ctx.restore();
        }
        p.prevX = p.x;
        p.prevY = p.y;
      }

      // Draw particles (enhanced)
      for (const p of G.particles) {
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, Math.PI * 2);
        ctx.fill();
        // Glow for larger particles
        if (p.size > 2) {
          ctx.fillStyle = p.color + "44";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Build mode preview
      if (G.buildMode) {
        const bd = BUILDINGS[G.buildMode.key];
        const bsize = bd.size * TILE;
        const mx = G.buildMode.worldX,
          my = G.buildMode.worldY;
        const tx = Math.floor(mx / TILE),
          ty = Math.floor(my / TILE);
        ctx.fillStyle = G.buildMode.valid
          ? "rgba(0,255,0,0.25)"
          : "rgba(255,0,0,0.25)";
        ctx.fillRect(tx * TILE, ty * TILE, bsize, bsize);
        ctx.strokeStyle = G.buildMode.valid ? "#0f0" : "#f00";
        ctx.lineWidth = 2;
        ctx.strokeRect(tx * TILE, ty * TILE, bsize, bsize);
        ctx.lineWidth = 1;
        ctx.font = "24px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(
          bd.icon || "🏗",
          tx * TILE + bsize / 2,
          ty * TILE + bsize / 2,
        );
      }

      // Draw move indicators
      for (const mi of G.moveIndicators) {
        const alpha = mi.life / mi.maxLife;
        const radius = 12 + (1 - alpha) * 8;
        ctx.strokeStyle = `rgba(0, 255, 100, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mi.x, mi.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        const cs = 6;
        ctx.beginPath();
        ctx.moveTo(mi.x - cs, mi.y);
        ctx.lineTo(mi.x + cs, mi.y);
        ctx.moveTo(mi.x, mi.y - cs);
        ctx.lineTo(mi.x, mi.y + cs);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.restore();

      // Draw minimap
      drawMinimapInternal();
    }

    function drawBuilding(e) {
      const bd = BUILDINGS[e.key] || {};
      const fc =
        e.owner === myOwner()
          ? FACTIONS[G.players[myOwner()].faction].color
          : FACTIONS[G.players[opponentOwner()].faction].color;
      const fcLight =
        e.owner === myOwner()
          ? FACTIONS[G.players[myOwner()].faction].lightColor
          : FACTIONS[G.players[opponentOwner()].faction].lightColor;
      const size = (e.size || 2) * TILE;
      const bx = e.x - size / 2,
        by = e.y - size / 2;
      const cx = e.x,
        cy = e.y;
      const alpha = e.isConstructing
        ? 0.5 + (e.buildProgress / e.buildTime) * 0.5
        : 1;
      const flash = e.flash > 0;

      ctx.globalAlpha = alpha;

      // Ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(
        cx + 4,
        cy + size / 2 + 2,
        size / 2 + 4,
        size / 4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Try sprite rendering first (only after all sprites are loaded to avoid inconsistent visuals)
      const faction = getEntityFaction(e);
      const sprite =
        SpriteLoader && SpriteLoader.isReady() && faction
          ? SpriteLoader.getBuildingSprite(faction, e.key)
          : null;
      if (sprite) {
        const drawRect = getBuildingSpriteDrawRect(sprite, bx, by, size);
        if (flash) {
          ctx.globalAlpha = alpha * 0.6;
          ctx.drawImage(
            sprite,
            drawRect.x,
            drawRect.y,
            drawRect.width,
            drawRect.height,
          );
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = "#fff";
          ctx.fillRect(drawRect.x, drawRect.y, drawRect.width, drawRect.height);
          ctx.globalAlpha = alpha;
        } else {
          ctx.drawImage(
            sprite,
            drawRect.x,
            drawRect.y,
            drawRect.width,
            drawRect.height,
          );
        }
      } else if (e.key === "base") {
        // Castle base
        ctx.fillStyle = flash ? "#fff" : "#5a5565";
        ctx.fillRect(bx + 4, by + 12, size - 8, size - 16);
        // Battlements
        ctx.fillStyle = flash ? "#eee" : "#6a6575";
        for (let i = 0; i < 5; i++)
          ctx.fillRect(
            bx + 4 + (i * (size - 8)) / 5,
            by + 6,
            (size - 8) / 5 - 3,
            10,
          );
        // Central tower
        ctx.fillStyle = flash ? "#eee" : "#7a7585";
        ctx.fillRect(cx - 6, by - 4, 12, 20);
        // Tower roof
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.moveTo(cx, by - 12);
        ctx.lineTo(cx - 8, by - 2);
        ctx.lineTo(cx + 8, by - 2);
        ctx.fill();
        // Gate
        ctx.fillStyle = "#2a2025";
        ctx.fillRect(cx - 5, by + size - 20, 10, 10);
        ctx.fillStyle = fc;
        ctx.fillRect(cx - 5, by + size - 20, 10, 2);
        // Banner
        ctx.fillStyle = fc;
        ctx.fillRect(cx + 12, by, 2, 18);
        ctx.fillRect(cx + 14, by + 2, 8, 6);
      } else if (e.key === "barracks") {
        // Wooden walls
        ctx.fillStyle = flash ? "#fff" : "#6a5030";
        ctx.fillRect(bx + 4, by + 10, size - 8, size - 14);
        // Plank lines
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(bx + 4, by + 16 + i * 8);
          ctx.lineTo(bx + size - 4, by + 16 + i * 8);
          ctx.stroke();
        }
        // Peaked roof
        ctx.fillStyle = flash ? "#eee" : "#8a3020";
        ctx.beginPath();
        ctx.moveTo(cx, by);
        ctx.lineTo(bx, by + 14);
        ctx.lineTo(bx + size, by + 14);
        ctx.fill();
        // Faction accent
        ctx.fillStyle = fc;
        ctx.fillRect(bx + 6, by + size - 8, size - 12, 3);
      } else if (e.key === "supply") {
        // Warehouse body
        ctx.fillStyle = flash ? "#fff" : "#7a6a50";
        ctx.fillRect(bx + 2, by + 8, size - 4, size - 12);
        // Sloped roof
        ctx.fillStyle = flash ? "#eee" : "#5a4a3a";
        ctx.beginPath();
        ctx.moveTo(bx - 2, by + 12);
        ctx.lineTo(cx, by);
        ctx.lineTo(bx + size + 2, by + 12);
        ctx.fill();
        // Crates
        ctx.fillStyle = "#8a7a50";
        ctx.fillRect(bx + 8, by + size - 16, 8, 8);
        ctx.fillStyle = "#9a8a60";
        ctx.fillRect(bx + 18, by + size - 14, 7, 7);
      } else if (e.key === "harvester") {
        // Circular stone base
        ctx.fillStyle = flash ? "#fff" : "#6a6560";
        ctx.beginPath();
        ctx.arc(cx, cy + 4, size / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        // Wheel/crane
        ctx.strokeStyle = "#5a4a30";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 8, cy - 20);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (e.key === "tower") {
        // Stone tower body (narrow tall)
        ctx.fillStyle = flash ? "#fff" : "#6a6a70";
        ctx.fillRect(cx - 8, by + 4, 16, size - 8);
        // Arrow slits
        ctx.fillStyle = "#1a1a20";
        ctx.fillRect(cx - 2, by + 14, 4, 8);
        ctx.fillRect(cx - 2, by + 28, 4, 8);
        // Pointed top
        ctx.fillStyle = flash ? "#eee" : "#555a60";
        ctx.beginPath();
        ctx.moveTo(cx, by - 8);
        ctx.lineTo(cx - 10, by + 6);
        ctx.lineTo(cx + 10, by + 6);
        ctx.fill();
        // Flag
        ctx.fillStyle = fc;
        ctx.fillRect(cx + 1, by - 14, 1, 10);
        ctx.beginPath();
        ctx.moveTo(cx + 2, by - 14);
        ctx.lineTo(cx + 10, by - 11);
        ctx.lineTo(cx + 2, by - 8);
        ctx.fill();
      } else if (e.key === "workshop") {
        // Wide rectangular body
        ctx.fillStyle = flash ? "#fff" : "#5a5560";
        ctx.fillRect(bx + 2, by + 10, size - 4, size - 14);
        // Chimney
        ctx.fillStyle = "#4a4550";
        ctx.fillRect(bx + size - 14, by - 4, 8, 18);
        // Smoke
        const sm = Math.sin(G.time * 2) * 3;
        ctx.fillStyle = "rgba(160,155,150,0.3)";
        ctx.beginPath();
        ctx.arc(bx + size - 10 + sm, by - 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(140,135,130,0.2)";
        ctx.beginPath();
        ctx.arc(bx + size - 8 + sm * 1.5, by - 18, 4, 0, Math.PI * 2);
        ctx.fill();
        // Roof
        ctx.fillStyle = flash ? "#eee" : "#6a4535";
        ctx.fillRect(bx, by + 6, size, 8);
        // Gear icon
        ctx.strokeStyle = fc;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx - 6, cy + 4, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (e.key === "magetower") {
        // Tall spire
        ctx.fillStyle = flash ? "#fff" : "#4a4065";
        ctx.fillRect(cx - 7, by + 8, 14, size - 12);
        // Arcane base circle
        ctx.strokeStyle = `${fc}66`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy + size / 2 - 8, 14, 0, Math.PI * 2);
        ctx.stroke();
        // Spire top
        ctx.fillStyle = flash ? "#eee" : "#5a4a80";
        ctx.beginPath();
        ctx.moveTo(cx, by - 10);
        ctx.lineTo(cx - 9, by + 10);
        ctx.lineTo(cx + 9, by + 10);
        ctx.fill();
        // Glowing orb
        const glow = 0.5 + Math.sin(G.time * 3) * 0.3;
        ctx.fillStyle = `rgba(160,120,255,${glow})`;
        ctx.beginPath();
        ctx.arc(cx, by - 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(200,180,255,${glow * 0.5})`;
        ctx.beginPath();
        ctx.arc(cx, by - 6, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.key === "researchlab") {
        // Rectangular lab body
        ctx.fillStyle = flash ? "#fff" : "#4a5560";
        ctx.fillRect(bx + 4, by + 10, size - 8, size - 14);
        // Dome top
        ctx.fillStyle = flash ? "#eee" : "#5a6a75";
        ctx.beginPath();
        ctx.arc(cx, by + 12, size / 2 - 6, Math.PI, 0);
        ctx.fill();
        // Lens/telescope
        ctx.fillStyle = "#88aacc";
        ctx.beginPath();
        ctx.arc(cx, by + 2, 5, 0, Math.PI * 2);
        ctx.fill();
        // Glowing vial
        const vg = 0.4 + Math.sin(G.time * 2.5 + 1) * 0.3;
        ctx.fillStyle = `rgba(80,220,160,${vg})`;
        ctx.fillRect(cx + 10, by + size - 16, 4, 8);
        ctx.fillStyle = `rgba(220,80,180,${vg})`;
        ctx.fillRect(cx - 14, by + size - 14, 4, 6);
      } else if (e.key === "airfield") {
        // Flat platform
        ctx.fillStyle = flash ? "#fff" : "#5a5a5a";
        ctx.beginPath();
        const pad = 4;
        ctx.moveTo(bx + pad + 8, by + pad);
        ctx.lineTo(bx + size - pad - 8, by + pad);
        ctx.lineTo(bx + size - pad, by + pad + 8);
        ctx.lineTo(bx + size - pad, by + size - pad - 8);
        ctx.lineTo(bx + size - pad - 8, by + size - pad);
        ctx.lineTo(bx + pad + 8, by + size - pad);
        ctx.lineTo(bx + pad, by + size - pad - 8);
        ctx.lineTo(bx + pad, by + pad + 8);
        ctx.closePath();
        ctx.fill();
        // Runway markings
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, by + 8);
        ctx.lineTo(cx, by + size - 8);
        ctx.stroke();
        ctx.setLineDash([]);
        // Landing circle
        ctx.strokeStyle = fc;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (e.key === "ultimate") {
        // Stepped pyramid
        ctx.fillStyle = flash ? "#fff" : "#5a5070";
        ctx.fillRect(bx + 2, by + size * 0.4, size - 4, size * 0.6);
        ctx.fillStyle = flash ? "#eee" : "#6a5a80";
        ctx.fillRect(bx + 8, by + size * 0.2, size - 16, size * 0.5);
        ctx.fillStyle = flash ? "#ddd" : "#7a6a90";
        ctx.fillRect(bx + 14, by + 4, size - 28, size * 0.35);
        // Central energy pillar
        const eg = 0.5 + Math.sin(G.time * 2) * 0.3;
        ctx.fillStyle = `rgba(${parseInt(fc.slice(1, 3), 16)},${parseInt(fc.slice(3, 5), 16)},${parseInt(fc.slice(5, 7), 16)},${eg})`;
        ctx.fillRect(cx - 3, by - 6, 6, size * 0.3 + 6);
        // Top glow
        ctx.fillStyle = `${fc}55`;
        ctx.beginPath();
        ctx.arc(cx, by - 4, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fallback generic
        ctx.fillStyle = flash ? "#fff" : "#555";
        ctx.fillRect(bx + 2, by + 2, size - 4, size - 4);
        ctx.strokeStyle = fc;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 2, by + 2, size - 4, size - 4);
        ctx.lineWidth = 1;
      }

      ctx.globalAlpha = 1;

      // Construction scaffolding
      if (e.isConstructing) {
        ctx.strokeStyle = "rgba(200,180,100,0.4)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < size; i += 8) {
          ctx.beginPath();
          ctx.moveTo(bx + i, by);
          ctx.lineTo(bx + i + size / 2, by + size);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        // Progress bar
        const pct = e.buildProgress / e.buildTime;
        ctx.fillStyle = "#28f";
        ctx.fillRect(bx, by - 12, size * pct, 3);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(bx + size * pct, by - 12, size * (1 - pct), 3);
      }

      // HP bar
      if (e.hp < e.maxHp || e.selected) {
        const hpW = size;
        const hpPct = e.hp / e.maxHp;
        ctx.fillStyle = "#222";
        ctx.fillRect(bx, by - 8, hpW, 5);
        ctx.fillStyle = hpPct > 0.5 ? "#4a4" : hpPct > 0.25 ? "#aa4" : "#a44";
        ctx.fillRect(bx, by - 8, hpW * hpPct, 5);
      }

      // Production progress
      if (!e.isConstructing && e.productionQueue.length > 0) {
        const bt = getProductionTime(e.productionQueue[0], e.owner);
        const pct = e.productionTimer / bt;
        ctx.fillStyle = "#0af";
        ctx.fillRect(bx, by + size + 2, size * pct, 3);
      }

      // Research progress overlay on lab
      if (!e.isConstructing && e.isResearchLab) {
        if (e.researchItem && TECHS[e.researchItem]) {
          const tech = TECHS[e.researchItem];
          const pct = Math.min(
            1,
            tech.time > 0 ? e.researchTimer / tech.time : 0,
          );
          const textPct = Math.floor(pct * 100);
          ctx.fillStyle = "#111a";
          ctx.fillRect(bx, by - 20, size, 6);
          ctx.fillStyle = "#3fd27f";
          ctx.fillRect(bx, by - 20, size * pct, 6);
          ctx.font = '10px "Segoe UI", sans-serif';
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = "#b6ffd5";
          ctx.fillText("研究 " + textPct + "%", cx, by - 22);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        } else {
          ctx.font = '10px "Segoe UI", sans-serif';
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = "#9aa9b7";
          ctx.fillText("待命", cx, by - 8);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }

      // Selection highlight
      if (e.selected) {
        ctx.strokeStyle = "#0f0";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 2, by - 2, size + 4, size + 4);
        ctx.lineWidth = 1;
        // Rally point
        if (e.rallyPoint && e.owner === myOwner()) {
          ctx.strokeStyle = "#ff0";
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(e.rallyPoint.x, e.rallyPoint.y);
          ctx.stroke();
          ctx.setLineDash([]);
          const rx = e.rallyPoint.x,
            ry = e.rallyPoint.y;
          ctx.fillStyle = "#ff0";
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx, ry - 18);
          ctx.lineTo(rx + 10, ry - 13);
          ctx.lineTo(rx, ry - 8);
          ctx.fill();
          ctx.strokeStyle = "#ff0";
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx, ry - 18);
          ctx.stroke();
        }
      }
    }

    // UNIT_VISUAL moved to js/game-data.js

    function drawUnit(e) {
      const fc =
        e.owner === myOwner()
          ? FACTIONS[G.players[myOwner()].faction].color
          : FACTIONS[G.players[opponentOwner()].faction].color;
      const fcDark = e.owner === myOwner() ? "#0a0" : "#a00";
      const r = 12;
      const fly = e.flying;
      const flyOff = fly ? 30 + Math.sin(G.time * 3 + e.id * 1.7) * 3 : 0;
      const drawY = e.y - flyOff;
      const vis = getUnitVisualKey(e, UNIT_VISUAL);
      const flash = e.flash > 0;
      const stealthAlpha = e.canStealth && e.owner !== myOwner() ? 0.45 : 1;

      ctx.globalAlpha = stealthAlpha;

      // Ground shadow
      if (fly) {
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 4, r * 1.2, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + r * 0.7, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      let ux = e.x,
        uy = drawY;

      // ---- Procedural animation offsets based on unit state ----
      const isMoving =
        e.state === "move" ||
        e.state === "chase" ||
        e.state === "attackMove" ||
        e.state === "moveToResource" ||
        e.state === "returning";
      if (isMoving && !fly) {
        uy += -Math.abs(Math.sin(G.time * 10 + e.id * 2.3)) * 3;
      } else if (e.state === "attack") {
        const atkTarget = G.entities.find((t) => t.id === e.targetId);
        if (atkTarget) {
          const adx = atkTarget.x - e.x,
            ady = atkTarget.y - e.y;
          const adist = Math.sqrt(adx * adx + ady * ady) || 1;
          const isMelee = !e.atkRange || e.atkRange < 80;
          ux += isMelee ? (adx / adist) * 3 : -(adx / adist) * 2;
          uy += isMelee ? (ady / adist) * 3 : -(ady / adist) * 2;
        }
      } else if (e.state === "gathering" || e.state === "buildAssist") {
        ux += Math.sin(G.time * 6 + e.id) * 2;
        uy += -Math.abs(Math.sin(G.time * 6 + e.id)) * 1.5;
      } else if (!fly) {
        uy += Math.sin(G.time * 2 + e.id * 0.7) * 1;
      }

      // Try sprite rendering first (only after all sprites are loaded to avoid inconsistent visuals)
      const faction = getEntityFaction(e);
      const unitKey = e.isWorker ? "worker" : e.key;
      const unitSprite =
        SpriteLoader && SpriteLoader.isReady() && faction
          ? SpriteLoader.getUnitSprite(faction, unitKey)
          : null;
      if (unitSprite) {
        const sw = unitSprite.naturalWidth || unitSprite.width;
        const sh = unitSprite.naturalHeight || unitSprite.height;
        const drawSize = Math.max(sw, sh, 24);
        if (flash) {
          ctx.globalAlpha = stealthAlpha * 0.6;
          ctx.drawImage(
            unitSprite,
            ux - drawSize / 2,
            uy - drawSize / 2,
            drawSize,
            drawSize,
          );
          ctx.globalAlpha = stealthAlpha * 0.4;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(ux, uy, drawSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = stealthAlpha;
        } else {
          ctx.drawImage(
            unitSprite,
            ux - drawSize / 2,
            uy - drawSize / 2,
            drawSize,
            drawSize,
          );
        }
      } else if (vis === "worker") {
        // Small humanoid
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy - 4, 5, 0, Math.PI * 2);
        ctx.fill(); // head
        ctx.fillRect(ux - 4, uy + 1, 8, 10); // body
        // Pickaxe
        ctx.strokeStyle = "#8a7a60";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ux + 5, uy + 2);
        ctx.lineTo(ux + 11, uy - 6);
        ctx.stroke();
        ctx.strokeStyle = "#aaa";
        ctx.beginPath();
        ctx.moveTo(ux + 10, uy - 7);
        ctx.lineTo(ux + 13, uy - 4);
        ctx.stroke();
        ctx.lineWidth = 1;
        // Carry indicator
        if (e.carrying > 0) {
          ctx.fillStyle = RESOURCE_COLORS[e.carryType] || "#ff0";
          ctx.fillRect(ux - 6, uy, 4, 6);
        }
      } else if (vis === "melee") {
        // Warrior body
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy - 6, 5, 0, Math.PI * 2);
        ctx.fill(); // head
        // Torso (trapezoid)
        ctx.beginPath();
        ctx.moveTo(ux - 6, uy);
        ctx.lineTo(ux + 6, uy);
        ctx.lineTo(ux + 7, uy + 10);
        ctx.lineTo(ux - 7, uy + 10);
        ctx.fill();
        // Shield (left)
        ctx.fillStyle = flash ? "#ddd" : "#6a6a7a";
        ctx.beginPath();
        ctx.arc(ux - 8, uy + 4, 5, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fill();
        // Sword (right)
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ux + 7, uy + 8);
        ctx.lineTo(ux + 12, uy - 4);
        ctx.stroke();
        ctx.lineWidth = 1;
        // Faction outline
        ctx.strokeStyle = fc;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ux, uy + 2, r - 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (vis === "ranged") {
        // Slim body
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy - 6, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(ux - 4, uy, 8, 10);
        // Bow/rifle
        ctx.strokeStyle = "#9a7a4a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ux + 8, uy + 2, 8, -0.8, 0.8);
        ctx.stroke();
        // Quiver
        ctx.fillStyle = "#7a6a4a";
        ctx.fillRect(ux - 7, uy - 2, 3, 10);
        ctx.lineWidth = 1;
      } else if (vis === "caster") {
        // Robed figure
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy - 8, 4.5, 0, Math.PI * 2);
        ctx.fill(); // head
        // Robe (triangle)
        ctx.beginPath();
        ctx.moveTo(ux - 8, uy + 11);
        ctx.lineTo(ux, uy - 2);
        ctx.lineTo(ux + 8, uy + 11);
        ctx.fill();
        // Hat
        ctx.beginPath();
        ctx.moveTo(ux, uy - 16);
        ctx.lineTo(ux - 5, uy - 6);
        ctx.lineTo(ux + 5, uy - 6);
        ctx.fill();
        // Staff
        ctx.strokeStyle = "#8a6a3a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ux + 8, uy + 10);
        ctx.lineTo(ux + 8, uy - 10);
        ctx.stroke();
        // Staff orb
        const og = 0.6 + Math.sin(G.time * 4 + e.id) * 0.3;
        ctx.fillStyle = `rgba(${parseInt(fc.slice(1, 3), 16)},${parseInt(fc.slice(3, 5), 16)},${parseInt(fc.slice(5, 7), 16)},${og})`;
        ctx.beginPath();
        ctx.arc(ux + 8, uy - 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
      } else if (vis === "heavy") {
        // Large armored body
        const hr = 15;
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        // Wide torso with armor plates
        ctx.fillRect(ux - 9, uy + 2, 18, 12);
        ctx.fillStyle = flash ? "#eee" : "#5a5a6a";
        ctx.fillRect(ux - 9, uy + 2, 18, 4); // armor plate
        ctx.fillStyle = flash ? "#ddd" : "#4a4a5a";
        ctx.fillRect(ux - 7, uy + 8, 14, 3); // lower plate
        // Weapon
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ux + 10, uy + 12);
        ctx.lineTo(ux + 14, uy - 6);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (vis === "cavalry") {
        // Horse body (oval)
        ctx.fillStyle = flash ? "#fff" : "#3a3040";
        ctx.beginPath();
        ctx.ellipse(ux, uy + 4, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rider
        ctx.fillStyle = flash ? "#eee" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy - 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(ux - 4, uy - 1, 8, 6);
        // Lance
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ux + 8, uy);
        ctx.lineTo(ux + 16, uy - 10);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (vis === "siege") {
        // Wheeled vehicle
        ctx.fillStyle = flash ? "#fff" : "#5a5055";
        ctx.fillRect(ux - 12, uy - 2, 24, 12);
        // Wheels
        ctx.fillStyle = "#3a3035";
        ctx.beginPath();
        ctx.arc(ux - 8, uy + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ux + 8, uy + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        // Cannon/catapult arm
        ctx.strokeStyle = fc;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux + 10, uy - 14);
        ctx.stroke();
        ctx.lineWidth = 1;
        // Faction stripe
        ctx.fillStyle = fc;
        ctx.fillRect(ux - 12, uy - 2, 24, 3);
      } else if (vis === "mechTank") {
        // Box tank with treads
        ctx.fillStyle = flash ? "#fff" : "#6a6a70";
        ctx.fillRect(ux - 12, uy - 4, 24, 14);
        // Treads
        ctx.fillStyle = "#3a3a40";
        ctx.fillRect(ux - 14, uy + 6, 28, 5);
        ctx.fillRect(ux - 14, uy - 5, 28, 4);
        // Turret
        ctx.fillStyle = fc;
        ctx.fillRect(ux - 6, uy - 6, 12, 8);
        // Cannon barrel
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ux + 6, uy - 2);
        ctx.lineTo(ux + 18, uy - 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (vis === "flyBat") {
        // Small body + wings
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux, uy, 5, 0, Math.PI * 2);
        ctx.fill();
        // Wings (flapping)
        const wingAngle = Math.sin(G.time * 8 + e.id * 2) * 0.4;
        ctx.save();
        ctx.translate(ux, uy);
        // Left wing
        ctx.fillStyle = flash ? "#eee" : fc;
        ctx.rotate(-0.3 + wingAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-16, -6);
        ctx.lineTo(-10, 3);
        ctx.fill();
        // Right wing
        ctx.rotate((0.3 - wingAngle) * 2 + 0.6 - wingAngle * 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(16, -6);
        ctx.lineTo(10, 3);
        ctx.fill();
        ctx.restore();
        // Eyes
        ctx.fillStyle = "#ff4";
        ctx.fillRect(ux - 3, uy - 2, 2, 2);
        ctx.fillRect(ux + 1, uy - 2, 2, 2);
      } else if (vis === "flyDragon") {
        // Large body
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.ellipse(ux, uy, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings (large, flapping)
        const wa = Math.sin(G.time * 5 + e.id * 1.5) * 0.35;
        ctx.save();
        ctx.translate(ux, uy);
        ctx.fillStyle = flash ? "#eee" : fc;
        ctx.globalAlpha = stealthAlpha * 0.85;
        ctx.rotate(-0.2 + wa);
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(-22, -10);
        ctx.lineTo(-14, 4);
        ctx.fill();
        ctx.rotate(0.4 - wa * 2);
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(22, -10);
        ctx.lineTo(14, 4);
        ctx.fill();
        ctx.globalAlpha = stealthAlpha;
        ctx.restore();
        // Head
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.beginPath();
        ctx.arc(ux + 8, uy - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.strokeStyle = fc;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ux - 8, uy);
        ctx.quadraticCurveTo(ux - 16, uy + 6, ux - 20, uy + 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        // Glow aura
        const ag = 0.15 + Math.sin(G.time * 2 + e.id) * 0.1;
        ctx.fillStyle = `${fc}${Math.floor(ag * 255)
          .toString(16)
          .padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(ux, uy, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (vis === "flyMech") {
        // Box body
        ctx.fillStyle = flash ? "#fff" : fc;
        ctx.fillRect(ux - 6, uy - 3, 12, 10);
        // Cockpit
        ctx.fillStyle = "#aaddff";
        ctx.fillRect(ux - 3, uy - 2, 6, 4);
        // Rotor (spinning)
        ctx.save();
        ctx.translate(ux, uy - 6);
        ctx.rotate(G.time * 15 + e.id);
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.restore();
        // Tail
        ctx.fillStyle = "#666";
        ctx.fillRect(ux - 1, uy + 5, 2, 8);
        ctx.lineWidth = 1;
      }

      // HP bar
      if (e.hp < e.maxHp || e.selected) {
        const hpW = 24;
        const hpPct = e.hp / e.maxHp;
        ctx.fillStyle = "#222";
        ctx.fillRect(ux - hpW / 2, uy - r - 8, hpW, 4);
        ctx.fillStyle = hpPct > 0.5 ? "#4a4" : hpPct > 0.25 ? "#aa4" : "#a44";
        ctx.fillRect(ux - hpW / 2, uy - r - 8, hpW * hpPct, 4);
      }

      // ---- Attack arc overlay (melee) ----
      if (e.state === "attack" && (!e.atkRange || e.atkRange < 80)) {
        const arcTarget = G.entities.find((t) => t.id === e.targetId);
        if (arcTarget) {
          const arcAngle = Math.atan2(arcTarget.y - e.y, arcTarget.x - e.x);
          const swingPhase = (e.atkCooldown || 0) / (e.atkSpeed || 1);
          const arcAlpha =
            swingPhase < 0.3
              ? swingPhase / 0.3
              : Math.max(0, 1 - (swingPhase - 0.3) / 0.4);
          if (arcAlpha > 0.01) {
            ctx.strokeStyle =
              "rgba(255,255,255," + (arcAlpha * 0.6).toFixed(2) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ux, uy, 16, arcAngle - 0.8, arcAngle + 0.8);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
        }
      }

      // ---- Gather particles ----
      if (
        e.state === "gathering" &&
        e.gatherTarget &&
        G.particles &&
        Math.random() < 0.05
      ) {
        const pColor =
          e.carryType === "wood"
            ? "#8B6914"
            : e.carryType === "gold"
              ? "#FFD700"
              : "#DAA520";
        G.particles.push({
          x: e.x + (Math.random() - 0.5) * 8,
          y: e.y - 5,
          vx: (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 20,
          life: 0.4 + Math.random() * 0.3,
          size: 1.5 + Math.random(),
          color: pColor,
        });
      }

      // ---- Build assist sparks ----
      if (e.state === "buildAssist" && G.particles && Math.random() < 0.04) {
        G.particles.push({
          x: e.x + (Math.random() - 0.5) * 10,
          y: e.y - 8,
          vx: (Math.random() - 0.5) * 20,
          vy: -15 - Math.random() * 15,
          life: 0.3 + Math.random() * 0.2,
          size: 1 + Math.random(),
          color: "#ccc",
        });
      }

      // Selection circle (at ground level)
      if (e.selected) {
        ctx.strokeStyle = "#0f0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(
          e.x,
          e.y + (fly ? 4 : r * 0.5),
          r + 2,
          (fly ? r * 0.4 : r * 0.5) + 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.globalAlpha = 1;
    }

    function drawMinimapInternal() {
      // If external callback is provided (HTML wiring), use it
      if (externalDrawMinimap) {
        externalDrawMinimap();
        return;
      }
      // Otherwise use built-in minimap renderer
      if (!mctx || !G) return;
      const mw = miniCanvas.width,
        mh = miniCanvas.height;
      if (mw === 0 || mh === 0) return;
      mctx.fillStyle = "#141a22";
      mctx.fillRect(0, 0, mw, mh);
      const scaleX = mw / MAP_W,
        scaleY = mh / MAP_H;

      // Fog source
      const mmFog = G.isMultiplayer ? myFog() : G.map.fogPlayer;
      if (!mmFog || !mmFog.length) return;

      // Tiles (sample every 2nd tile for performance)
      for (let ty = 0; ty < MAP_H; ty += 2) {
        for (let tx = 0; tx < MAP_W; tx += 2) {
          const fog = mmFog[ty]?.[tx];
          if (fog === FOG_UNEXPLORED) continue;
          const tile = G.map.tiles?.[ty]?.[tx] ?? 0;
          mctx.fillStyle =
            fog === FOG_VISIBLE ? TILE_COLORS[tile] || "#2d5a27" : "#2d3440";
          mctx.fillRect(tx * scaleX, ty * scaleY, 2 * scaleX, 2 * scaleY);
          if (fog === FOG_VISIBLE) {
            mctx.fillStyle = "rgba(180,255,210,0.08)";
            mctx.fillRect(tx * scaleX, ty * scaleY, 2 * scaleX, 2 * scaleY);
          }
        }
      }

      // Resources
      if (G.map.resources) {
        for (const r of G.map.resources) {
          if (r.amount <= 0) continue;
          if (r.type === "wood" && G.map.tiles?.[r.y]?.[r.x] === 4) continue;
          const fog = mmFog[r.y]?.[r.x];
          if (!fog) continue;
          mctx.fillStyle = RESOURCE_COLORS[r.type] || "#ff0";
          mctx.fillRect(r.x * scaleX - 1, r.y * scaleY - 1, 3, 3);
        }
      }

      // Entities
      for (const e of G.entities) {
        if (e.hp <= 0) continue;
        const etx = Math.floor(e.x / TILE),
          ety = Math.floor(e.y / TILE);
        if (e.owner !== myOwner() && mmFog[ety]?.[etx] !== FOG_VISIBLE)
          continue;
        mctx.fillStyle = e.owner === myOwner() ? "#0f0" : "#f00";
        const sz = e.isBuilding ? 3 : 2;
        mctx.fillRect(
          (e.x / TILE) * scaleX - sz / 2,
          (e.y / TILE) * scaleY - sz / 2,
          sz,
          sz,
        );
      }

      // Vision rings
      mctx.strokeStyle = "rgba(120,255,170,0.16)";
      mctx.lineWidth = 1;
      for (const e of G.entities) {
        if (e.hp <= 0 || e.owner !== myOwner()) continue;
        const sightTiles = e.isBuilding
          ? (e.size || 2) * 2 + 4
          : e.flying
            ? 10
            : 7;
        const cx = (e.x / TILE) * scaleX,
          cy = (e.y / TILE) * scaleY;
        const radius = sightTiles * ((scaleX + scaleY) / 2);
        mctx.beginPath();
        mctx.arc(cx, cy, radius, 0, Math.PI * 2);
        mctx.stroke();
      }

      // Camera viewport rectangle
      const cam = G.camera;
      const vw = (canvas.width / cam.zoom / TILE) * scaleX;
      const vh = (canvas.height / cam.zoom / TILE) * scaleY;
      const vx = (cam.x / TILE) * scaleX;
      const vy = (cam.y / TILE) * scaleY;
      mctx.strokeStyle = "#fff";
      mctx.lineWidth = 1;
      mctx.strokeRect(vx, vy, vw, vh);
    }

    return {
      render(...args) {
        G = getGame();
        return render(...args);
      },
      drawBuilding(...args) {
        G = getGame();
        return drawBuilding(...args);
      },
      drawUnit(...args) {
        G = getGame();
        return drawUnit(...args);
      },
    };
  }
  const exportsObj = { createRenderSystem, getTerrainDecoration };
  if (typeof module !== "undefined" && module.exports)
    module.exports = exportsObj;
  global.RSERender = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
