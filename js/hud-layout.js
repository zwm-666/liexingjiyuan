(function (global) {
  function getHudLayout(viewport) {
    const width = viewport?.width || 1365;
    const mobile = width <= 900;
    return {
      bottomPanelBottom: mobile ? 10 : 14,
      bottomPanelHeight: mobile ? 110 : 160,
      minimapBottom: mobile ? 10 : 14,
      minimapHeight: mobile ? 110 : 160,
      cmdPanelPadding: mobile ? 6 : 8,
    };
  }

  const exportsObj = { getHudLayout };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEHudLayout = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
