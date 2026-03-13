# Core Game Modularization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前单文件 RTS 原型拆成可维护的多文件 JavaScript 结构，同时保持现有玩法和页面入口不变。

**Architecture:** 保留 `index_c5e9607a.html` 作为唯一页面入口，把纯数据与纯逻辑优先抽到 `js/` 目录中的独立模块，通过浏览器全局对象和 Node `module.exports` 双兼容暴露 API。首期优先拆分游戏静态数据、实体工厂与查找索引，避免一次性重写 UI、渲染和输入系统。

**Tech Stack:** 原生 HTML Canvas、浏览器脚本、Node.js 内置 `assert` 测试。

---

### Task 1: 抽离静态游戏数据

**Files:**
- Create: `js/game-data.js`
- Modify: `index_c5e9607a.html`
- Test: `tests/game-data.test.cjs`

**Step 1: Write the failing test**
- 断言模块可加载，并暴露 `FACTIONS`、`BUILDINGS`、`TECHS`、`UNIT_VISUAL`。

**Step 2: Run test to verify it fails**
- Run: `node tests/game-data.test.cjs`
- Expected: 因模块不存在或导出缺失而失败。

**Step 3: Write minimal implementation**
- 在 `js/game-data.js` 中复制纯数据定义，封装导出。

**Step 4: Run test to verify it passes**
- Run: `node tests/game-data.test.cjs`
- Expected: PASS。

### Task 2: 抽离实体工厂与索引

**Files:**
- Create: `js/entity-factory.js`
- Modify: `index_c5e9607a.html`
- Test: `tests/entity-factory.test.cjs`

**Step 1: Write the failing test**
- 断言 `createEntity`、`spawnUnit`、`spawnBuilding`、`getEntityById` 使用共享状态和索引工作正常。

**Step 2: Run test to verify it fails**
- Run: `node tests/entity-factory.test.cjs`
- Expected: 因模块不存在或行为未实现而失败。

**Step 3: Write minimal implementation**
- 把实体创建和查找逻辑移入独立模块，并增加 `entityIndex` 加速按 id 查找。

**Step 4: Run test to verify it passes**
- Run: `node tests/entity-factory.test.cjs`
- Expected: PASS。

### Task 3: 接回浏览器入口

**Files:**
- Modify: `index_c5e9607a.html`

**Step 1: 引入外部脚本**
- 在主内联脚本前引入 `js/game-data.js` 和 `js/entity-factory.js`。

**Step 2: 替换原有重复定义**
- 删除或委托已有数据定义和实体工厂定义，改为读取模块暴露对象。

**Step 3: 手动验证**
- 确认页面能加载，选择阵营后可正常开始游戏。

### Task 4: 总结一期收益与后续拆分点

**Files:**
- Modify: `docs/plans/2026-03-10-modularize-core-game-code.md`

**Step 1: 记录已拆部分**
- 数据、实体工厂、索引优化。

**Step 2: 记录下一批候选模块**
- `ai`、`render`、`input`、`ui`、`pathfinding`。

---

## Completion Status

### Completed Modules
- `js/game-data.js`
- `js/entity-factory.js`
- `js/ai-logic.js`
- `js/ai.js`
- `js/render-logic.js`
- `js/render.js`
- `js/movement.js`
- `js/ui.js`
- `js/combat.js`
- `js/world.js`
- `js/network.js`
- `js/input.js`

### Verification
- `node tests/game-data.test.cjs`
- `node tests/entity-factory.test.cjs`
- `node tests/ai-logic.test.cjs`
- `node tests/ai-system.test.cjs`
- `node tests/render-logic.test.cjs`
- `node tests/render-system.test.cjs`
- `node tests/movement-system.test.cjs`
- `node tests/ui-system.test.cjs`
- `node tests/combat-system.test.cjs`
- `node tests/world-system.test.cjs`
- `node tests/network-system.test.cjs`
- `node tests/input-system.test.cjs`
- Inline script syntax check for `index_c5e9607a.html`

### Remaining Entry Responsibilities
- HTML / CSS shell
- Module bootstrapping and composition
- Some outer event orchestration and startup flow

### Notes
- The workspace is not a Git repository, so branch/merge cleanup workflow is not applicable here.
