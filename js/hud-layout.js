(function (global) {
  function getHudLayout(viewport) {
    const width = viewport?.width || 1365;
    const height = viewport?.height || 768;
    const mobile = width <= 900;

    if (mobile) {
      const compactMobile = height <= 640;
      return {
        bottomPanelBottom: compactMobile ? 14 : 10,
        bottomPanelHeight: compactMobile ? 102 : 110,
        minimapBottom: compactMobile ? 14 : 10,
        minimapHeight: compactMobile ? 102 : 110,
        cmdPanelPadding: compactMobile ? 5 : 6,
      };
    }

    const compactDesktop = height <= 680;
    const shortDesktop = height <= 760;
    return {
      bottomPanelBottom: compactDesktop ? 42 : shortDesktop ? 28 : 14,
      bottomPanelHeight: compactDesktop ? 138 : shortDesktop ? 150 : 160,
      minimapBottom: compactDesktop ? 42 : shortDesktop ? 28 : 14,
      minimapHeight: compactDesktop ? 138 : shortDesktop ? 150 : 160,
      cmdPanelPadding: compactDesktop ? 6 : 8,
    };
  }

  const exportsObj = { getHudLayout };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEHudLayout = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
