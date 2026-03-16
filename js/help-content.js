(function (global) {
  /**
   * 帮助内容模块 — 供首次弹窗（简版）、主菜单帮助、游戏内 F1 共用。
   */

  /** 简版：首次打开时的快速入门 */
  function getQuickGuideHTML() {
    return (
      '<h2>欢迎来到裂星纪元！</h2>' +
      '<p style="color:#aaa;font-size:13px;margin-bottom:12px;">快速了解基本操作，即刻投入战斗</p>' +
      '<table>' +
      '<tr><td class="key">左键点击</td><td>选择单位或建筑</td></tr>' +
      '<tr><td class="key">左键拖拽</td><td>框选多个单位</td></tr>' +
      '<tr><td class="key">右键点击</td><td>移动 / 采集 / 攻击</td></tr>' +
      '<tr><td class="key">滚轮</td><td>缩放视角</td></tr>' +
      '<tr><td class="key">Space</td><td>回到主基地</td></tr>' +
      '</table>' +
      '<div style="color:#888;font-size:11px;margin-top:12px;line-height:1.6;">' +
      '选中工人 → 右下角出现建筑列表<br>' +
      '选中建筑 → 可生产单位或研发科技<br>' +
      '升级主基地 → 解锁高级建筑与兵种' +
      '</div>'
    );
  }

  /** 详版：完整操作指南（主菜单帮助 & 游戏内 F1） */
  function getFullGuideHTML(isMobile) {
    var html =
      '<h2>操作指南</h2>' +
      '<table>' +
      '<tr><td class="key">左键</td><td>选择单位/建筑</td></tr>' +
      '<tr><td class="key">左键拖拽</td><td>框选多个单位</td></tr>' +
      '<tr><td class="key">右键</td><td>移动/采集/攻击</td></tr>' +
      '<tr><td class="key">滚轮</td><td>缩放视角</td></tr>' +
      '<tr><td class="key">方向键</td><td>移动摄像机</td></tr>' +
      '<tr><td class="key">Space</td><td>跳转到主基地</td></tr>' +
      '<tr><td class="key">S</td><td>停止所选单位</td></tr>' +
      '<tr><td class="key">Esc</td><td>取消选择/建造/暂停</td></tr>' +
      '<tr><td class="key">F1</td><td>显示此帮助</td></tr>';

    if (isMobile) {
      html +=
        '<tr><td colspan="2" style="padding-top:10px;color:#6af;font-size:11px;font-weight:bold;">触屏操作:</td></tr>' +
        '<tr><td class="key">单指点击</td><td>选择/移动/攻击</td></tr>' +
        '<tr><td class="key">长按拖拽</td><td>框选多个单位</td></tr>' +
        '<tr><td class="key">双击单位</td><td>选中同类单位</td></tr>' +
        '<tr><td class="key">双指拖拽</td><td>移动摄像机</td></tr>' +
        '<tr><td class="key">双指捏合</td><td>缩放视角</td></tr>';
    }

    html +=
      '<tr><td colspan="2" style="padding-top:10px;color:#888;font-size:11px;">' +
      '选中工人后,右下方会出现可建造的建筑列表。<br>' +
      '选中建筑后,可生产单位或研发科技。<br>' +
      '右键点击资源点可命令工人采集。<br>' +
      '升级主基地解锁更高级建筑与单位。' +
      '</td></tr>';

    html +=
      '<tr><td colspan="2" style="padding-top:10px;color:#6af;font-size:11px;font-weight:bold;">游戏流程:</td></tr>' +
      '<tr><td colspan="2" style="color:#aaa;font-size:11px;line-height:1.7;">' +
      '1. 生产工人采集 <span style="color:#6c6">木材</span>、<span style="color:#da6">食物</span>、<span style="color:#fd0">金币</span><br>' +
      '2. 建造补给站提高人口上限<br>' +
      '3. 兵营生产战士和射手<br>' +
      '4. 升级主基地解锁工坊、法师塔、机场<br>' +
      '5. 建造研究室研发科技<br>' +
      '6. 集结部队摧毁敌方主基地即可获胜' +
      '</td></tr>';

    html += '</table>';
    return html;
  }

  var exportsObj = {
    getQuickGuideHTML: getQuickGuideHTML,
    getFullGuideHTML: getFullGuideHTML,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }
  global.RSEHelpContent = exportsObj;
})(typeof window !== "undefined" ? window : globalThis);
