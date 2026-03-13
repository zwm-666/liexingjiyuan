const assert = require("assert");
const { createUiSystem } = require("../js/ui.js");
const { FACTIONS, BUILDINGS, TECHS } = require("../js/game-data.js");

const elements = new Map();
function el(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      textContent: "",
      innerHTML: "",
      children: [],
      style: {},
      classList: { add() {}, remove() {} },
      appendChild(node) {
        this.children.push(node);
      },
      addEventListener() {},
    });
  }
  return elements.get(id);
}
const documentStub = {
  getElementById: el,
  createElement() {
    return {
      className: "",
      innerHTML: "",
      style: {},
      children: [],
      appendChild(node) {
        this.children.push(node);
      },
      addEventListener() {},
    };
  },
};

const G = {
  time: 125,
  buildMode: null,
  selection: [],
  players: {
    player: {
      faction: "starfire",
      resources: { wood: 123, food: 234, gold: 345 },
      pop: 4,
      popMax: 10,
      techs: {},
      tier: 1,
    },
  },
};

const ui = createUiSystem({
  getGame: () => G,
  document: documentStub,
  myOwner: () => "player",
  FACTIONS,
  BUILDINGS,
  TECHS,
  TILE: 32,
  getEntityDisplayInfo: () => ({ name: "测试", icon: "X" }),
  getHealthBarColor: () => "#4a4",
  notify: () => {},
  executeLocalCommand: () => {},
});

ui.updateUI();
assert.equal(el("res-wood").textContent, 123, "应更新木材");
assert.equal(el("game-timer").textContent, "02:05", "应更新时间");

const idleLab = {
  id: 10,
  owner: "player",
  key: "researchlab",
  isBuilding: true,
  isResearchLab: true,
  isConstructing: false,
  productionQueue: [],
  hp: 1000,
  maxHp: 1000,
  researchItem: null,
  researchTimer: 0,
};
const busyLab = {
  id: 11,
  owner: "player",
  key: "researchlab",
  isBuilding: true,
  isResearchLab: true,
  isConstructing: false,
  productionQueue: [],
  hp: 1000,
  maxHp: 1000,
  researchItem: "rangedUp1",
  researchTimer: 15,
};

G.entities = [idleLab, busyLab];
G.selection = [idleLab];
ui.updateUnitInfoPanel();
assert.ok(
  el("unit-info").innerHTML.includes("当前工作"),
  "研究室应显示当前工作状态",
);
assert.ok(
  el("unit-info").innerHTML.includes("箭矢改良"),
  "点击空闲研究室应显示当前研究内容",
);

G.selection = [busyLab];
ui.updateUnitInfoPanel();
assert.ok(
  el("unit-info").innerHTML.includes("研究"),
  "研究中的研究室应显示进度",
);

const panel = el("cmd-panel");
ui.addCmdBtn(panel, "X", "按钮", "10", () => {});
assert.equal(panel.children.length, 1, "应追加命令按钮");

console.log("ui-system test passed");
