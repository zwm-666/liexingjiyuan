(function (global) {
  function createUiSystem(options) {
    let G = null;
    const getGame = options.getGame;
    const document = options.document || global.document;
    const myOwner = options.myOwner;
    const FACTIONS = options.FACTIONS;
    const BUILDINGS = options.BUILDINGS;
    const TECHS = options.TECHS;
    const TILE = options.TILE;
    const getEntityDisplayInfo = options.getEntityDisplayInfo;
    const getHealthBarColor = options.getHealthBarColor;
    const notify = options.notify || (() => {});
    const executeLocalCommand = options.executeLocalCommand || (() => {});
    const updateCommandPanelCallback = options.updateCommandPanel || (() => {});

    function updateUI() {
      const p = G.players[myOwner()];
      document.getElementById("res-wood").textContent = Math.floor(
        p.resources.wood,
      );
      document.getElementById("res-food").textContent = Math.floor(
        p.resources.food,
      );
      document.getElementById("res-gold").textContent = Math.floor(
        p.resources.gold,
      );
      document.getElementById("pop-cur").textContent = p.pop;
      document.getElementById("pop-max").textContent = p.popMax;

      const mins = Math.floor(G.time / 60)
        .toString()
        .padStart(2, "0");
      const secs = Math.floor(G.time % 60)
        .toString()
        .padStart(2, "0");
      document.getElementById("game-timer").textContent = mins + ":" + secs;

      // Unit info updates every frame (no interactive elements, just text)
      updateUnitInfoPanel();

      // Multiplayer indicator
      const mpBar = document.getElementById("mp-indicator");
      if (G.isMultiplayer) {
        mpBar.classList.add("show");
        const tag = document.getElementById("mp-tag");
        const fData = FACTIONS[G.players[myOwner()].faction];
        tag.textContent =
          (G.mySlot === "player" ? "玩家1" : "玩家2") + " - " + fData.name;
        tag.style.background = fData.color + "44";
        tag.style.color = fData.color;
        tag.style.border = "1px solid " + fData.color;
        document.getElementById("mp-hint").textContent = "联机对战中";
      } else {
        mpBar.classList.remove("show");
      }

      // Command panel: only rebuild when selection/state changes to avoid destroying buttons mid-click
      const selConstState = G.selection
        .map(
          (e) =>
            (e.isConstructing ? "1" : "0") +
            (e.rallyPoint ? "r" : "") +
            (e.researchItem
              ? e.researchItem + Math.floor(e.researchTimer)
              : ""),
        )
        .join("");
      const selKey =
        G.selection.map((e) => e.id).join(",") +
        "|" +
        selConstState +
        "|" +
        (G.buildMode ? G.buildMode.key : "") +
        "|" +
        p.tier +
        "|" +
        Object.keys(p.techs).length;
      if (selKey !== updateUI._lastSelKey) {
        updateUI._lastSelKey = selKey;
        updateCommandPanelCallback();
      }
    }
    updateUI._lastSelKey = "";

    function updateUnitInfoPanel() {
      const panel = document.getElementById("unit-info");
      if (G.selection.length === 0) {
        panel.innerHTML =
          '<div style="color:#666;margin-top:40px;text-align:center;font-size:12px;">选择单位或建筑</div>';
        return;
      }
      const e = G.selection[0];
      const faction = FACTIONS[G.players[e.owner].faction];
      const displayInfo = getEntityDisplayInfo(e, faction, BUILDINGS);
      const name = displayInfo.name;
      const icon = displayInfo.icon;

      let queueHTML = "";
      if (e.isBuilding && e.productionQueue.length > 0) {
        const p = G.players[e.owner];
        const qi = e.productionQueue[0];
        const qud = qi.isWorker
          ? { pop: 1 }
          : faction.units[qi.key] || { pop: 2 };
        const stalled = p.pop + (qi.isWorker ? 1 : qud.pop || 2) > p.popMax;
        queueHTML =
          '<div style="margin-top:4px;font-size:10px;color:#aaa;">' +
          (stalled ? '<span style="color:#f44;">人口已满-暂停</span> ' : "") +
          "队列: " +
          e.productionQueue
            .map((q) => (q.isWorker ? "👷" : faction.units[q.key]?.icon || "?"))
            .join(" ") +
          "</div>";
      }

      let researchStatusHTML = "";
      if (e.isResearchLab) {
        const ownTech = e.researchItem ? TECHS[e.researchItem] : null;
        const activeLab = Array.isArray(G.entities)
          ? G.entities.find(
              (entity) =>
                entity.isResearchLab &&
                entity.owner === e.owner &&
                entity.researchItem,
            )
          : null;
        if (ownTech) {
          const ownPct = Math.floor((e.researchTimer / ownTech.time) * 100);
          researchStatusHTML =
            "<br>🔬当前工作: 研究 " + ownTech.name + " " + ownPct + "%";
        } else if (activeLab && TECHS[activeLab.researchItem]) {
          const activeTech = TECHS[activeLab.researchItem];
          const activePct = Math.floor(
            (activeLab.researchTimer / activeTech.time) * 100,
          );
          researchStatusHTML =
            "<br>🔬当前工作: 协同待命（" +
            activeTech.name +
            " " +
            activePct +
            "%）";
        } else {
          researchStatusHTML = "<br>🔬当前工作: 待命";
        }
      }

      const hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
      const hpColor = getHealthBarColor(hpPct);
      panel.innerHTML = `
    <div class="unit-portrait" style="border-color:${faction.color}">${icon}</div>
    <div class="unit-name" style="color:${faction.lightColor}">${name}</div>
    <div class="unit-hp-bar"><div class="unit-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
    <div class="unit-stats">
      HP: ${Math.floor(e.hp)}/${e.maxHp}<br>
      ${e.isBuilding ? "" : `攻击: ${e.atk} | 护甲: ${e.armor} | 速度: ${(e.speed / TILE).toFixed(1)}`}
      ${e.isBuilding && e.isConstructing ? "<br>建造中: " + Math.floor((e.buildProgress / e.buildTime) * 100) + "%" : ""}
      ${e.isResearchLab && e.researchItem && TECHS[e.researchItem] ? "<br>🔬研究: " + TECHS[e.researchItem].name + " " + Math.floor((e.researchTimer / TECHS[e.researchItem].time) * 100) + "%" : ""}
      ${researchStatusHTML}
      ${G.selection.length > 1 ? "<br>已选中 " + G.selection.length + " 个单位" : ""}
    </div>
    ${queueHTML}
  `;
    }

    function addCmdBtn(panel, icon, label, cost, onClick) {
      const btn = document.createElement("div");
      btn.className = "cmd-btn";
      btn.innerHTML = `<span class="btn-icon">${icon}</span><span class="btn-label">${label}</span>${cost ? '<span class="btn-cost">' + cost + "</span>" : ""}`;
      btn.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
      });
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onClick();
      });
      panel.appendChild(btn);
    }

    return {
      updateUI(...args) {
        G = getGame();
        return updateUI(...args);
      },
      updateUnitInfoPanel(...args) {
        G = getGame();
        return updateUnitInfoPanel(...args);
      },
      addCmdBtn(...args) {
        G = getGame();
        return addCmdBtn(...args);
      },
    };
  }
  const exportsObj = { createUiSystem };
  if (typeof module !== "undefined" && module.exports)
    module.exports = exportsObj;
  global.RSEUi = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
