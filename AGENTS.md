# AGENTS.md

## 仓库概览

- 项目名：**裂星纪元 / Rift Star Era**。
- 技术栈：原生 JavaScript、HTML、Canvas、Node.js WebSocket 服务端。
- 仓库根目录下**没有** `package.json`、lockfile 等包管理文件。
- 未发现 Cursor 规则文件：`.cursor/rules/`、`.cursorrules`。
- 未发现 Copilot 规则文件：`.github/copilot-instructions.md`。
- 本文件面向在该仓库内工作的智能编码代理，要求其遵循当前代码库的真实约定，而不是套用通用模板。

## 顶层目录结构

- `index.html` —— 浏览器入口文件，包含大量内联样式、UI 结构和启动逻辑。
- `server.js` —— 使用 `ws` 的 Node WebSocket 联机服务器。
- `js/` —— 游戏模块源码与共享数据。
- `tests/` —— 使用 Node 直接运行的 `.test.cjs` 测试。
- `assets/` —— 精灵图与静态资源。
- `docs/plans/` —— 计划文档与实现草案。

## 运行模型

- 浏览器侧模块使用 **IIFE + 全局导出** 模式，而不是 ESM。
- 常见结构如下：
  - `(function (global) { ... })(typeof window !== "undefined" ? window : globalThis);`
  - 先定义内部函数
  - 通过 `exportsObj` 聚合导出
  - 若在 Node 环境下测试，则 `module.exports = exportsObj`
  - 浏览器环境下挂到 `global.RSE...`
- 常见工厂函数包括：`createUiSystem`、`createCombatSystem`、`createRenderSystem`、`createEntityFactory`。
- 模块依赖大多通过 `options` 对象注入，而不是直接 import。

## 命令说明

## 启动游戏

- 直接用浏览器打开根目录下的 `index.html`。
- 注意：`README.md` 中仍提到 `index_c5e9607a.html`，但当前仓库实际存在且应优先使用的是 `index.html`。

## 启动联机服务端

```bash
node server.js
```

- 默认端口是 `3000`。
- 可通过环境变量 `PORT` 覆盖。

## 运行全部测试

`README.md` 中记录的标准命令：

```bash
for f in tests/*.test.cjs; do node "$f"; done
```

如果是在 Windows 环境且不方便使用 bash 循环，可按需串行执行：

```bash
node tests/game-data.test.cjs && node tests/entity-factory.test.cjs && node tests/ai-logic.test.cjs
```

如果改动跨多个模块，结束前应尽量跑完整个测试集合。

## 运行单个测试

```bash
node tests/<name>.test.cjs
```

示例：

```bash
node tests/combat-system.test.cjs
node tests/hud-layout.test.cjs
node tests/network-system.test.cjs
```

## 构建 / Lint / 类型检查

- **构建：** 未配置。
- **Lint：** 未配置。
- **Formatter：** 未配置。
- **Typecheck：** 未配置。
- 不要凭空添加 npm script、pnpm 命令或构建流水线说明。

## 测试约定

- 测试文件是纯 Node 脚本，通常使用内置 `assert` 模块。
- 测试文件后缀统一为 `.test.cjs`。
- 测试通过 CommonJS `require(...)` 引入目标模块。
- 测试通常是：构造最小上下文 → 执行函数/系统 → 用断言验证 → 输出成功日志。
- 常见结束形式：
  - `console.log("combat-system test passed")`
  - `console.log('game-data test passed')`
- 未使用 Jest、Mocha、Vitest、Playwright 等测试框架。
- 测试应保持确定性，不要引入依赖复杂测试环境的新框架。

## 代码风格指南

## 总体原则

- 以**贴近现有文件风格**为第一优先级。
- 做**小而局部**的修改，避免顺手大重构。
- 保持当前架构：原生 JS、模块化系统、依赖注入、可变状态对象。
- 只有在逻辑不直观时才加注释，不要堆解释性废话。

## 导入与模块边界

- 浏览器模块不要改成 ESM `import` / `export`。
- `js/*.js` 中应继续沿用 IIFE + `exportsObj` + `global.RSE...` 的导出模式。
- Node 测试和 Node 侧文件继续使用 `require(...)` / `module.exports`。
- 不要在未整体迁移的前提下引入 bundler 专用语法。

## 格式化

- 保留分号；仓库内分号使用非常普遍。
- 缩进、换行、长对象换行方式以当前文件局部风格为准。
- 引号风格**不是全仓统一**：
  - 浏览器模块很多偏向双引号
  - 部分 Node 文件和测试偏向单引号
- 因此：**不要统一改引号**，应保持目标文件原有风格。
- 多行对象/数组里如果已有尾随逗号，就继续保持。

## 命名约定

- 函数名、变量名：`camelCase`。
- 工厂/系统构造函数常见命名：`createXSystem`、`createEntityFactory`、`getHudLayout`。
- 共享数据常量：全大写标识符，例如 `FACTIONS`、`BUILDINGS`、`TECHS`、`UNIT_VISUAL`。
- 浏览器全局命名空间以 `RSE...` 为前缀，例如 `RSEGameData`、`RSECombat`、`RSERender`。
- 普通对象属性通常也使用 `camelCase`。

## 类型与数据结构

- 本仓库是纯 JavaScript，没有 TypeScript。
- 不要加入 TS 语法、伪类型层或类型体操。
- 修改时要保持既有实体结构与状态结构兼容。
- 实体对象字段很多且是可变的，例如：`hp`、`maxHp`、`state`、`targetId`、`productionQueue`、`researchItem` 等。
- 如果新增一个应被广泛持有的字段，优先放到中心创建路径里，例如实体工厂。

## 状态管理

- 状态主要集中在 `G`、`state`、`NET`、`players` 等对象上。
- 当前代码大量直接修改嵌套状态，这是既有模式，应默认遵守。
- 很多系统通过 `getGame()` 惰性获取 `G`，然后在返回的方法中读写状态。
- 不要引入 Redux、MobX、响应式状态库等额外抽象。

## 函数与组织方式

- 主要逻辑优先使用 `function` 声明。
- 箭头函数主要用于简短回调、默认空实现、局部闭包。
- `options` 对象注入依赖是强约定，新代码应继续使用。
- 模块的公开 API 通常返回一个普通对象，其属性是方法函数。

## 错误处理

- 当前仓库的错误处理偏轻量。
- 常见模式是返回 `null`、`false`、提前 `return`，而不是大量抛异常。
- 网络或启动逻辑里存在简短 `try/catch`，不要无故扩展成厚重框架。
- 修改行为时应优先保证游戏主循环与对局流程不中断。
- 测试里优先用明确断言信息，而不是写很多防御性分支。

## UI 文案与文本

- 用户可见文本以**中文**为主。
- 新增按钮文案、提示、通知、断言消息时，应尽量沿用仓库现有中文术语。
- 若周围上下文是英文专用测试或内部辅助代码，可局部保持英文。

## HTML / CSS / Canvas 相关约定

- `index.html` 很大，包含内联 CSS 和启动逻辑；修改时避免整文件重排版。
- 样式以手写 CSS 为主，不要引入 CSS-in-JS、Tailwind、Sass 等新体系。
- Canvas 渲染逻辑集中在 `js/render.js` 等模块，尽量沿用现有绘制风格与计算方式。
- UI 调整优先参考已有布局函数和 DOM 更新方式，而不是另起一套组件机制。

## Node / 服务端约定

- `server.js` 使用 CommonJS。
- 联机协议是当前多人模式的一部分，改消息格式时必须注意与前端联动兼容。
- 不要在未确认依赖存在的情况下引入新的服务端库或中间件。

## 测试修改要求

- 如果修改了 `js/<module>.js`，先检查 `tests/` 下是否已有对应测试文件。
- 行为变更优先补充对应已有测试，而不是新建复杂测试基础设施。
- 测试夹具应尽量小、就地构造、易读。
- 测试断言文案最好清晰说明业务预期。

## 代理执行时的 Do / Don’t

- 要先遵守现有模式，再考虑引入新模式。
- 要保持浏览器模块既能挂全局对象，也能被 Node 测试 `require`。
- 要保持可变状态语义，不要偷偷改成不可变数据流。
- 要确保多人/服务端改动与现有消息协议兼容。
- 不要在没有包管理文件时写 npm 工作流说明。
- 不要顺手引入 TypeScript、ESM 全量迁移或构建工具。
- 不要因为碰到一小段代码就把整个文件重格式化。
- 不要把简单 `assert` 测试替换成另一个测试框架。

## 推荐的默认工作流程

1. 先阅读目标模块和对应测试文件。
2. 确认该文件局部使用的是单引号还是双引号，并保持一致。
3. 保持导出方式兼容浏览器全局和 Node 测试。
4. 优先运行最小相关测试，例如：`node tests/<name>.test.cjs`。
5. 若改动跨多个系统，结束前运行全部测试。

## 已确认不存在的规则文件

以下文件/目录在当前仓库中**未发现**：

- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`

如果未来这些文件被添加，应把它们的约束合并到本文件中，并优先遵守更贴近仓库的规则。
