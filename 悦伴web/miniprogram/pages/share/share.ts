/**
 * 分享/远程遥控页面
 * WebSocket 房间管理 + 远程蓝牙控制
 */
import { sendBleHex } from "../../utils/ble-helper";
import bleService from "../../utils/ble-service";

/** 标记本次 BLE 写入来自外部页面 */
function markExternal() {
  getApp<IAppOption>().globalData.userInfo.externalBleWrite = true;
}

Page({
  data: {
    roomIdInput: "",
    roomId: "",
    creatStatus: true,
    inputMessage: "",
    logs: [] as string[],
    connected: false,
    buttons: new Array(10).fill(false),
    startPause: false,
  },

  onLoad(options: any) {
    const param = options.param;
    if (param) {
      this.setData({ roomId: param, creatStatus: false, inputMessage: param });
    }
  },

  onUnload() {
    if (this.data.creatStatus && this.data.connected) {
      sendBleHex("0xFD").catch(() => {});
      wx.closeSocket();
    }
  },

  onShareAppMessage() {
    return { title: "分享遥控房间", path: `/pages/share/share?param=${this.data.roomId}` };
  },

  onInput(e: any) {
    this.setData({ inputMessage: e.detail.value });
  },

  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const that = this;
      wx.connectSocket({
        url: "wss://wss.nick9995403432.com.cn",
        success() {
          that.addLog("正在连接服务器...");
          wx.onSocketOpen(() => {
            that.setData({ connected: true });
            that.addLog("已连接到服务器");
            resolve();
          });
        },
        fail(err) { that.addLog("连接失败: " + JSON.stringify(err)); reject(err); },
      });
      wx.onSocketMessage((res) => {
        try {
          const data = JSON.parse(res.data as string);
          if (data.type === "roomCreated") { that.setData({ roomId: data.roomId, creatStatus: true }); that.addLog(data.message + ": " + data.roomId); }
          else if (data.type === "joined") { that.setData({ roomId: data.roomId, creatStatus: false }); that.addLog(data.message + ": " + data.roomId); }
          else if (data.type === "userJoined") that.addLog(data.message);
          else if (data.type === "userLeft") that.addLog(data.message);
          else if (data.type === "data") {
            that.setData({ buttons: data.payload.newButtons, startPause: data.payload.startPause });
            if (data.payload.value && that.data.creatStatus) { markExternal(); sendBleHex(data.payload.value).catch(() => {}); }
            that.addLog(data.message + ": " + JSON.stringify(data.payload));
          } else if (data.type === "error") {
            that.addLog("错误: " + data.message);
            wx.showToast({ title: "房间号错误", icon: "error", duration: 2000 });
            that.setData({ connected: false, inputMessage: "" });
          } else that.addLog("未知消息: " + JSON.stringify(data));
        } catch (e) { that.addLog("消息解析错误"); }
      });
      wx.onSocketClose(() => { that.setData({ connected: false }); that.addLog("与服务器断开连接"); });
      wx.onSocketError((err) => { that.addLog("WebSocket 错误: " + JSON.stringify(err)); });
    });
  },

  sendMessageToServer(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.sendSocketMessage({
        data: JSON.stringify(data),
        success: () => resolve(),
        fail: (err) => { this.addLog("发送失败: " + JSON.stringify(err)); reject(err); },
      });
    });
  },

  async createRoom() {
    console.log("[share] createRoom: 开始创建房间");
    if (!bleService.isConnected) {
      // 无感连接，不显示 loading（非首页）
      const ok = await bleService.connect();
      if (!ok) { wx.showToast({ title: "蓝牙连接失败", icon: "none", duration: 2000 }); return; }
    }
    try {
      wx.closeSocket();
      if (!this.data.connected) {
        await new Promise<void>((r) => { wx.closeSocket({ success: () => r(), fail: () => r() }); });
        await this.connectWebSocket();
      }
      await this.sendMessageToServer({ type: "create" });
    } catch (err) { console.error("[share] createRoom 失败:", err); }
  },

  async joinRoom() {
    const roomId = this.data.inputMessage;
    if (!roomId) return;
    console.log("[share] joinRoom:", roomId);
    try {
      wx.closeSocket();
      await this.connectWebSocket();
      await this.sendMessageToServer({ type: "join", roomId });
    } catch (err) { console.error("[share] joinRoom 失败:", err); }
  },

  async handleButtonTap(e: any) {
    const index = e.detail.index;
    const value = e.detail.value;
    console.log("[share] handleButtonTap: index =", index, "value =", value);
    const newButtons = this.data.buttons.map((_, i) => i === Number(index));
    this.setData({ buttons: newButtons });
    try {
      if (this.data.creatStatus) {
        await this.sendMessageToServer({ type: "data", payload: { newButtons, value: null, startPause: true, moduleStatus: true } });
        markExternal();
        await sendBleHex(value);
      } else {
        await this.sendMessageToServer({ type: "data", payload: { newButtons, value, startPause: true, moduleStatus: true } });
      }
      this.setData({ startPause: true });
    } catch (err) { console.error("[share] handleButtonTap 失败:", err); }
  },

  async startBtn() {
    wx.vibrateShort({ type: "heavy" });
    console.log("[share] startBtn: startPause =", this.data.startPause);
    const valueStart = "0xFB", valueEnd = "0xFD";
    try {
      if (this.data.startPause) {
        const empty = Array(10).fill(null);
        this.setData({ startPause: false, buttons: empty });
        if (this.data.creatStatus) {
          await this.sendMessageToServer({ type: "data", payload: { newButtons: empty, value: null, startPause: false, moduleStatus: false } });
          markExternal();
          await sendBleHex(valueEnd);
        } else {
          await this.sendMessageToServer({ type: "data", payload: { newButtons: empty, value: valueEnd, startPause: false, moduleStatus: false } });
        }
      } else {
        const btns = this.data.buttons.map((_, i) => i === 0);
        this.setData({ startPause: true, buttons: btns });
        if (this.data.creatStatus) {
          await this.sendMessageToServer({ type: "data", payload: { newButtons: btns, value: null, startPause: true, moduleStatus: false } });
          markExternal();
          await sendBleHex(valueStart);
        } else {
          await this.sendMessageToServer({ type: "data", payload: { newButtons: btns, value: valueStart, startPause: true, moduleStatus: false } });
        }
      }
    } catch (err) { console.error("[share] startBtn 失败:", err); }
  },

  addLog(message: string) {
    const logs = [...this.data.logs, message];
    this.setData({ logs });
  },
});
