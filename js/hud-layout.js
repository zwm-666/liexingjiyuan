(function (global) {
  function getHudLayout(viewport) {
    var width = viewport && viewport.width || 1365;
    var height = viewport && viewport.height || 768;
    var mobile = width <= 900;

    if (mobile) {
      var compactMobile = height <= 640;
      return {
        bottomPanelHeight: compactMobile ? 102 : 110,
        minimapHeight: compactMobile ? 102 : 110,
        cmdPanelPadding: compactMobile ? 5 : 6,
      };
    }

    var compactDesktop = height <= 680;
    var shortDesktop = height <= 760;
    return {
      bottomPanelHeight: compactDesktop ? 138 : shortDesktop ? 150 : 160,
      minimapHeight: compactDesktop ? 138 : shortDesktop ? 150 : 160,
      cmdPanelPadding: compactDesktop ? 6 : 8,
    };
  }

  var exportsObj = { getHudLayout: getHudLayout };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEHudLayout = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
