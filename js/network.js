(function (global) {
  function createNetworkSystem(options) {
    const getNet = options.getNet;
    const WebSocketImpl = options.WebSocketImpl || global.WebSocket;
    const handleNetMessage = options.handleNetMessage || (() => {});

    function netSend(msg) {
      const NET = getNet();
      if (NET.ws && NET.ws.readyState === WebSocketImpl.OPEN) {
        NET.ws.send(JSON.stringify(msg));
      }
    }

    function netDisconnect() {
      const NET = getNet();
      if (NET.ws) { NET.ws.close(); NET.ws = null; }
      NET.connected = false;
      NET.roomId = null;
      NET.mySlot = null;
      NET.opponentSlot = null;
      clearInterval(NET._pingInterval);
    }

    function netConnect(url) {
      const NET = getNet();
      return new Promise((resolve, reject) => {
        try { NET.ws = new WebSocketImpl(url); } catch (error) { return reject(error); }
        NET.ws.onopen = () => { NET.connected = true; resolve(); };
        NET.ws.onmessage = ev => { try { handleNetMessage(JSON.parse(ev.data)); } catch (error) {} };
        NET.ws.onclose = () => { NET.connected = false; };
        NET.ws.onerror = () => reject(new Error('连接失败'));
      });
    }

    function sendCommand(cmd) { netSend({ type: 'cmd', cmd }); }

    return { netSend, netDisconnect, netConnect, sendCommand, handleNetMessage };
  }

  const exportsObj = { createNetworkSystem };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
  global.RSENetwork = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
