/**
 * 首页
 * 首次进入时自动连接蓝牙一次。
 * 蓝牙断开/重连时归位我的模式按钮（仅当首页可见时）。
 */
import bleService from "../../utils/ble-service";

Page({
  data: {},

  onLoad() {
    (this as any)._unsubBle = bleService.onStatusChange((status) => {
      // 仅当首页可见时才归位按钮
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      if (!current || current.route !== "pages/index/index") return;

      if (!status.isConnected) {
        const app = getApp<IAppOption>();
        const { modelInfo } = app.globalData.userInfo;
        if (modelInfo.startPause || modelInfo.buttons.some(b => b)) {
          console.log("[index] 蓝牙断开，归位我的模式按钮");
          modelInfo.buttons = Array(10).fill(false);
          modelInfo.startPause = false;
        }
      }
    });
  },

  onShow() {
    const app = getApp<IAppOption>();
    if (!app.globalData.userInfo.hasAutoConnected) {
      app.globalData.userInfo.hasAutoConnected = true;
      if (!bleService.isConnected) {
        this._tryAutoConnect();
      }
    }
  },

  onUnload() {
    if ((this as any)._unsubBle) (this as any)._unsubBle();
  },

  async _tryAutoConnect() {
    // loading 由 bleService 内部处理（首页自动显示）
    await bleService.connect();
  },
});
