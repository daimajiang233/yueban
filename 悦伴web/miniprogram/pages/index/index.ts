/**
 * 首页
 * 首次进入时自动尝试连接一次。
 * 蓝牙断开/重连时归位我的模式按钮（仅首页可见时）。
 * 每次 onShow 时若未连接则触发 connect（自动复用进行中的连接）。
 */
import bleService from "../../utils/ble-service";

Page({
  data: {},

  onLoad() {
    (this as any)._unsubBle = bleService.onStatusChange((status) => {
      // 仅在首页可见时才归位按钮
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
    }
    // 每次回到首页，若蓝牙未连接则触发 connect
    // connect() 内部：已连接直接返回 true；正在连接则复用 promise + 显示 loading
    if (!bleService.isConnected) {
      bleService.connect();
    }
  },

  onUnload() {
    if ((this as any)._unsubBle) (this as any)._unsubBle();
  },
});