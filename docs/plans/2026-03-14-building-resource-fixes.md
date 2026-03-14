# 建筑贴地与资源耗尽修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复建筑精灵浮空、资源点采尽后残留占地/状态、以及地图木材资源过密的问题，并保持模块源码与页面入口行为一致。

**Architecture:** 渲染层通过读取建筑精灵的透明边界来自动做底部对齐，避免不同阵营/建筑写死偏移。资源层在采集耗尽时统一执行“销毁”收尾：解除占地、清理地块表现、标记耗尽状态；地图层则通过缩减木材簇半径/数量降低总木材量。

**Tech Stack:** 原生 HTML Canvas、浏览器内联入口、`js/` 模块、Node.js 内置 `assert` 测试。

---

### Task 1: 为建筑精灵加入可测试的贴地对齐

**Files:**
- Modify: `js/sprite-loader.js`
- Modify: `js/render.js`
- Test: `tests/render-system.test.cjs`

**Step 1: Write the failing test**
- 为精灵渲染路径添加测试，断言带有底部透明留白的建筑 sprite 在 `drawImage` 时会向下补偿，使可见部分底边贴到建筑占地底边。

**Step 2: Run test to verify it fails**
- Run: `node tests/render-system.test.cjs`
- Expected: 现有实现因直接使用 `bx/by` 绘制整张图而失败。

**Step 3: Write minimal implementation**
- 在 sprite 加载后记录 alpha bbox 元数据。
- 在 `drawBuilding` 的 sprite 分支基于 bbox 计算 drawX/drawY，让可见内容居中且底部贴地。
- 允许测试注入假的 sprite loader。

**Step 4: Run test to verify it passes**
- Run: `node tests/render-system.test.cjs`
- Expected: PASS。

### Task 2: 资源耗尽时执行统一销毁收尾

**Files:**
- Modify: `js/combat.js`
- Modify: `index_c5e9607a.html`
- Test: `tests/combat-system.test.cjs`

**Step 1: Write the failing test**
- 断言资源耗尽后会清空 `resourceBlocked`、标记资源已销毁，并把木材地块从森林改成普通地块。

**Step 2: Run test to verify it fails**
- Run: `node tests/combat-system.test.cjs`
- Expected: 现有实现不会完整清理资源状态而失败。

**Step 3: Write minimal implementation**
- 增加统一的资源销毁辅助逻辑，并在玩家/AI 工人采集分支复用。
- 同步修复页面入口里的内联 worker 逻辑，保证真实游戏行为一致。

**Step 4: Run test to verify it passes**
- Run: `node tests/combat-system.test.cjs`
- Expected: PASS。

### Task 3: 缩减地图木材资源密度

**Files:**
- Modify: `js/world.js`
- Modify: `index_c5e9607a.html`
- Test: `tests/world-system.test.cjs`

**Step 1: Write the failing test**
- 固定种子生成地图，断言木材资源数量明显低于当前基线，并保持食物/金矿仍存在。

**Step 2: Run test to verify it fails**
- Run: `node tests/world-system.test.cjs`
- Expected: 现有木材数量超出新阈值而失败。

**Step 3: Write minimal implementation**
- 把木材簇配置改成更稀疏的布局（更少簇、更小半径），优先砍掉外围富余木区，保留主基地与关键争夺点资源。
- 同步更新页面入口中的内联 `generateMap`。

**Step 4: Run test to verify it passes**
- Run: `node tests/world-system.test.cjs`
- Expected: PASS。

### Task 4: 全量回归验证

**Files:**
- Modify: `index_c5e9607a.html`
- Verify: `tests/*.test.cjs`

**Step 1: Run targeted tests**
- Run:
  - `node tests/render-system.test.cjs`
  - `node tests/combat-system.test.cjs`
  - `node tests/world-system.test.cjs`

**Step 2: Run full suite**
- Run: `Get-ChildItem tests/*.test.cjs | ForEach-Object { node $_.FullName }`
- Expected: 全部 PASS。
