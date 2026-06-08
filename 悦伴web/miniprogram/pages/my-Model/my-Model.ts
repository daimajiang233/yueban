/**
 * 我的模式页面
 *
 * 归位触发：仅在 onShow 时 globalData.externalBleWrite 为 true → 归位
 * （不再因蓝牙断开/重连自动归位）
 */
import { sendBleHex } from "../../utils/ble-helper";

Page({
  data: {
    startPause: false,
    buttons: new Array(10).fill(false),
  },

  _lastTapTime: 0,

  onLoad() {
    const app = getApp<IAppOption>();
    const { modelInfo } = app.globalData.userInfo;
    this.setData({
      startPause: modelInfo.startPause,
      buttons: [...modelInfo.buttons],
    });
  },

  onShow() {
    const app = getApp<IAppOption>();

    if (app.globalData.userInfo.externalBleWrite) {
      console.log("[my-Model] onShow: 外部页面发送过蓝牙，归位按钮");
      app.globalData.userInfo.externalBleWrite = false;
      this._resetButtons();
    }
  },

  _resetButtons() {
    const app = getApp<IAppOption>();
    this.setData({ startPause: false, buttons: Array(10).fill(false) });
    app.globalData.userInfo.modelInfo.buttons = Array(10).fill(false);
    app.globalData.userInfo.modelInfo.startPause = false;
  },

  async handleButtonTap(e: any) {
    const index = e.detail.index;
    const value = e.detail.value;

    const newButtons = this.data.buttons.map((_, i) => i === Number(index));
    this.setData({ buttons: newButtons, startPause: true });

    const app = getApp<IAppOption>();
    app.globalData.userInfo.modelInfo.buttons = newButtons;
    app.globalData.userInfo.modelInfo.startPause = true;

    console.log("[my-Model] 模式按钮点击: index =", index, "value =", value);

    try {
      await sendBleHex(value);
    } catch (_) {
      // wx.showToast({ title: "发送失败", icon: "error" });
    }
  },

  async startBtn() {
    wx.vibrateShort({ type: "heavy" });

    const app = getApp<IAppOption>();
    const { modelInfo } = app.globalData.userInfo;
    const valueStart = "0xFB";
    const valueEnd = "0xFD";

    if (this.data.startPause) {
      console.log("[my-Model] 暂停, value =", valueEnd);
      this.setData({ startPause: false, buttons: Array(10).fill(null as any) });
      modelInfo.buttons = Array(10).fill(null);
      modelInfo.startPause = false;

      try {
        await sendBleHex(valueEnd);
      } catch (_) {}
    } else {
      console.log("[my-Model] 开启, value =", valueStart);
      const newButtons = new Array(10).fill(false).map((_, i) => i === 0);
      this.setData({ startPause: true, buttons: newButtons });
      modelInfo.buttons = newButtons;
      modelInfo.startPause = true;

      try {
        await sendBleHex(valueStart);
      } catch (_) {}
    }
  },
});
