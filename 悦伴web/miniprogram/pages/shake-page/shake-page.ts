/**
 * 摇一摇页面
 * 震动强度滑块 + 蓝牙数据发送
 */
import { sendBleHex, sendBleValue } from "../../utils/ble-helper";
import bleService from "../../utils/ble-service";

/** 标记本次 BLE 写入来自外部页面 */
function markExternal() {
  getApp<IAppOption>().globalData.userInfo.externalBleWrite = true;
}

Page({
  data: {
    vibrationLevel: 50,
    sendStatus: false,
  },

  onLoad() {
    console.log("[shake] 页面加载, 发送初始震动值:", this.data.vibrationLevel);
    markExternal();
    sendBleValue(this.data.vibrationLevel)
      .then(() => { this.setData({ sendStatus: true }); })
      .catch(() => {});

    (this as any)._unsubBle = bleService.onStatusChange((status) => {
      if (!status.isConnected && this.data.sendStatus) {
        console.log("[shake] 蓝牙已断开，重置状态");
        this.setData({ sendStatus: false });
      }
    });
  },

  onUnload() {
    console.log("[shake] 页面卸载, 发送停止指令");
    if ((this as any)._unsubBle) (this as any)._unsubBle();
    markExternal();
    sendBleHex("0xFC").catch(() => {});
  },

  onSliderChange(e: any) {
    const level = e.detail.value;
    this.setData({ vibrationLevel: level, sendStatus: true});
    wx.vibrateShort({ type: "medium" });
    console.log("[shake] slider 变化:", level);
    markExternal();
    sendBleValue(level).catch(() => {});
  },

  async clickFn(e: any) {
    wx.vibrateShort({ type: "heavy" });
    const value = e.currentTarget.dataset.value as string;

    if (!this.data.sendStatus) {
      console.log("[shake] 开启, 发送震动值:", this.data.vibrationLevel);
      markExternal();
      this.setData({ sendStatus: true });
      try {
        await sendBleValue(this.data.vibrationLevel);
      } catch (_) {
        this.setData({ sendStatus: false });
      }
    } else {
      console.log("[shake] 暂停, 发送停止指令:", value);
      markExternal();
      this.setData({ sendStatus: false });
      try {
        await sendBleHex(value);
      } catch (_) {
        this.setData({ sendStatus: true });
      }
    }
  },
});
