const assert = require("assert");
const { getHudLayout } = require("../js/hud-layout.js");

const desktop = getHudLayout({ width: 1365, height: 768 });
assert.ok(
  desktop.bottomPanelBottom >= 12,
  "底栏应整体上移，留出底部安全边距",
);
assert.ok(
  desktop.minimapBottom >= desktop.bottomPanelBottom,
  "小地图底边不应低于底栏安全边距",
);
assert.ok(
  desktop.cmdPanelPadding >= 8,
  "桌面布局应保留足够操作边距",
);

const mobile = getHudLayout({ width: 800, height: 600 });
assert.ok(mobile.bottomPanelBottom >= 8, "小屏布局也应保留安全边距");
assert.ok(
  mobile.bottomPanelHeight <= desktop.bottomPanelHeight,
  "小屏底栏不应比桌面更高",
);

console.log("hud-layout test passed");
