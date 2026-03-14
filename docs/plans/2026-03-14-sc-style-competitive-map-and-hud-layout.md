# 星际争霸风格竞技地图与 HUD 上移 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前简陋的平面地图升级为星际争霸风格的 1v1 对角对称竞技图，并把小地图与底部建造/命令面板整体上移，避免在当前分辨率下卡出屏幕。

**Architecture:** 地图部分继续沿用 `js/world.js` 的程序化生成，但从“噪声地形 + 少量高地”改为“对角出生、自然扩张、中心高地、两翼绕后、中等卡口”的明确竞技骨架，再叠加荒野峡谷/岩石高地装饰。HUD 部分保持现有 DOM 结构不变，通过新增一个纯函数布局模块输出安全边距和面板尺寸，HTML 入口按该结果设置样式，从而让布局可测试、可维护。

**Tech Stack:** 原生 HTML Canvas、浏览器单文件入口、`js/` 模块化逻辑、Node.js `assert` 测试。

---

### Task 1: 为 HUD 布局建立可测试的安全边距计算

**Files:**
- Create: `js/hud-layout.js`
- Modify: `index_c5e9607a.html`
- Create: `tests/hud-layout.test.cjs`

**Step 1: Write the failing test**

```javascript
const assert = require('assert');
const { getHudLayout } = require('../js/hud-layout.js');

const desktop = getHudLayout({ width: 1365, height: 768 });
assert.ok(desktop.bottomPanelBottom >= 12, '底栏应整体上移，留出底部安全边距');
assert.ok(desktop.minimapBottom >= desktop.bottomPanelBottom, '小地图底边不应低于底栏安全边距');
assert.ok(desktop.cmdPanelPadding >= 8, '桌面布局应保留足够操作边距');
```

**Step 2: Run test to verify it fails**

Run: `node tests/hud-layout.test.cjs`

Expected: 因模块不存在而失败。

**Step 3: Write minimal implementation**

```javascript
function getHudLayout(viewport) {
  const mobile = viewport.width <= 900;
  return {
    bottomPanelBottom: mobile ? 10 : 14,
    bottomPanelHeight: mobile ? 110 : 160,
    minimapBottom: mobile ? 10 : 14,
    minimapHeight: mobile ? 110 : 160,
    cmdPanelPadding: mobile ? 6 : 8,
  };
}
```

- 在 `index_c5e9607a.html` 中引入 `js/hud-layout.js`
- 用 `getHudLayout(window.innerWidth, window.innerHeight)` 的结果驱动 `#bottom-panel`、`#minimap-container`、`#cmd-panel` 的 `bottom`、`height`、`padding`
- 保留现有 DOM，不重写 UI 结构

**Step 4: Run test to verify it passes**

Run: `node tests/hud-layout.test.cjs`

Expected: PASS。

**Step 5: Commit**

```bash
git add js/hud-layout.js index_c5e9607a.html tests/hud-layout.test.cjs
git commit -m "feat: add safe HUD layout positioning"
```

---

### Task 2: 用 TDD 重写竞技地图骨架

**Files:**
- Modify: `js/world.js`
- Modify: `index_c5e9607a.html`
- Modify: `tests/world-system.test.cjs`

**Step 1: Write the failing test**

在 `tests/world-system.test.cjs` 追加固定种子下的竞技图断言：

```javascript
const startA = { x: 10, y: 10 };
const startB = { x: 117, y: 117 };
assert.equal(bigGame.map.tiles[startA.y][startA.x], 0, '玩家主基地出生区应为空地');
assert.equal(bigGame.map.tiles[startB.y][startB.x], 0, '敌方主基地出生区应为空地');

const centerHighground = bigGame.map.tiles[64][64];
assert.equal(centerHighground, 5, '地图中心应是高地争夺区');

const naturalGolds = bigGame.map.resources.filter((r) => r.type === 'gold' && r.amount >= 4500);
assert.ok(naturalGolds.length >= 4, '主矿/自然矿应清晰存在');
```

再补对称性与通路检查：

```javascript
const leftRamp = bigGame.map.tiles[42][54];
const rightRamp = bigGame.map.tiles[85][74];
assert.equal(leftRamp, 1, '坡道/主路应可通行');
assert.equal(rightRamp, 1, '镜像坡道/主路应可通行');
```

**Step 2: Run test to verify it fails**

Run: `node tests/world-system.test.cjs`

Expected: 现有随机图骨架不能稳定满足竞技图断言而失败。

**Step 3: Write minimal implementation**

- 把 `generateMap()` 重构成清晰的阶段：
  1. 清空地图与边界水域
  2. 雕刻主基地平台与自然扩张平台
  3. 放置中心高地、两翼绕路、卡口与坡道
  4. 再铺设荒野峡谷/碎石/岩壁装饰层
- 用明确坐标骨架代替当前大量依赖噪声的主地形结构
- 保留程序化扰动只用于“边缘自然化”，不要再让它决定核心竞技布局
- 同步更新 `index_c5e9607a.html` 中的内联 `generateMap()`，确保网页实际运行逻辑一致

**Step 4: Run test to verify it passes**

Run: `node tests/world-system.test.cjs`

Expected: PASS。

**Step 5: Commit**

```bash
git add js/world.js index_c5e9607a.html tests/world-system.test.cjs
git commit -m "feat: generate sc-style competitive map skeleton"
```

---

### Task 3: 提升地图视觉层次到荒野峡谷 / 岩石高地风格

**Files:**
- Modify: `index_c5e9607a.html`
- Modify: `js/render.js`
- Modify: `tests/render-system.test.cjs`

**Step 1: Write the failing test**

增加对地表渲染辅助行为的断言，确保中心高地、悬崖边缘和碎石装饰路径存在：

```javascript
const calls = [];
const ctx = new Proxy({}, { get: () => (...args) => calls.push(args), set: () => true });
const render = createRenderSystem({ ... });
render.render();
assert.ok(calls.length > 0, '地图渲染应输出地表层和装饰层');
```

如果现有测试不便精确断言画笔细节，则至少新增一个纯函数，例如：
- `getTerrainDecoration(tileType, neighbors)`
- 或 `getCliffEdgeProfile(tx, ty, map)`

并对它写单测：

```javascript
assert.deepEqual(getTerrainDecoration(5, { south: 0 }).hasCliffShadow, true);
assert.deepEqual(getTerrainDecoration(1, { north: 3 }).hasDustOverlay, true);
```

**Step 2: Run test to verify it fails**

Run: `node tests/render-system.test.cjs`

Expected: 现有渲染没有这些地表层级辅助而失败。

**Step 3: Write minimal implementation**

- 在 `render.js` 中抽出地形装饰辅助逻辑，给高地、悬崖、坡道、碎石荒地增加稳定的层次绘制
- 在 `index_c5e9607a.html` 的 `drawTile` 里同步接入相同表现或直接委托模块实现
- 风格重点：
  - 高地边缘更像岩石平台
  - 低地带有碎石和尘土
  - 峡谷/山壁有更明显的阴影和明暗分层
  - 保持 RTS 可读性，避免过度装饰影响走位判断

**Step 4: Run test to verify it passes**

Run: `node tests/render-system.test.cjs`

Expected: PASS。

**Step 5: Commit**

```bash
git add js/render.js index_c5e9607a.html tests/render-system.test.cjs
git commit -m "feat: add canyon highground terrain visuals"
```

---

### Task 4: 整理资源布局与地图节奏

**Files:**
- Modify: `js/world.js`
- Modify: `index_c5e9607a.html`
- Modify: `tests/world-system.test.cjs`

**Step 1: Write the failing test**

补充资源节奏断言：

```javascript
const playerSideGold = bigGame.map.resources.filter((r) => r.type === 'gold' && r.x < 40 && r.y < 40);
const enemySideGold = bigGame.map.resources.filter((r) => r.type === 'gold' && r.x > 88 && r.y > 88);
const centerGold = bigGame.map.resources.filter((r) => r.type === 'gold' && Math.abs(r.x - 64) < 8 && Math.abs(r.y - 64) < 8);
assert.ok(playerSideGold.length >= 1, '玩家主区/自然应有金矿');
assert.ok(enemySideGold.length >= 1, '敌方主区/自然应有金矿');
assert.ok(centerGold.length >= 1, '中心高风险区应有奖励资源');
```

再限制木材不要重新泛滥：

```javascript
const woodCount = bigGame.map.resources.filter((r) => r.type === 'wood').length;
assert.ok(woodCount >= 80 && woodCount <= 150, `木材应控制在合理范围，当前 ${woodCount}`);
```

**Step 2: Run test to verify it fails**

Run: `node tests/world-system.test.cjs`

Expected: 现有资源布局不匹配新竞技节奏而失败。

**Step 3: Write minimal implementation**

- 调整主矿/自然矿/中心奖励矿位置
- 把木材分成“主区基础木 / 自然扩张木 / 两翼少量战术木”
- 保证中心资源能吸引交战，但不直接破坏前期平衡
- 同步更新 HTML 入口中的内联资源生成逻辑

**Step 4: Run test to verify it passes**

Run: `node tests/world-system.test.cjs`

Expected: PASS。

**Step 5: Commit**

```bash
git add js/world.js index_c5e9607a.html tests/world-system.test.cjs
git commit -m "feat: rebalance resources for competitive map flow"
```

---

### Task 5: 回归验证与页面布局检查

**Files:**
- Verify: `tests/*.test.cjs`
- Verify: `index_c5e9607a.html`

**Step 1: Run targeted tests**

Run:

```bash
node tests/hud-layout.test.cjs
node tests/world-system.test.cjs
node tests/render-system.test.cjs
```

Expected: 全部 PASS。

**Step 2: Run full suite**

Run:

```powershell
Get-ChildItem tests/*.test.cjs | ForEach-Object { node $_.FullName }
```

Expected: 全部 PASS。

**Step 3: Verify inline HTML script syntax**

Run:

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('index_c5e9607a.html','utf8'); const blocks=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]); new Function(blocks.join('\n\n')); console.log('inline ok')"
```

Expected: 输出 `inline ok`。

**Step 4: Manual verification checklist**

- 进入游戏后，小地图底边不贴屏幕底部
- 建造/命令区不会越出底部
- 出生点为左上 / 右下对角对称
- 中央高地、坡道、两翼绕路一眼可见
- 地图整体风格从“平面草地”升级为“荒野峡谷 / 岩石高地”

---
