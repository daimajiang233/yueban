// app.ts
/// <reference path="./utils/globalData.ts" />

App<IAppOption>({
  globalData: {
    userInfo:{
        name: "YUE BAN",
        status: false,
        isScanning: false, //全局蓝牙连接状态，默认false，测试时可设为true
        deviceId: "",
        serviceId: "",
        notifyCharacteristicId: "",
        writeCharacteristicId: ""
    }
  },
  getGlobalUserInfo() {
    return this.globalData.userInfo;
  },
  setGlobalUserInfo(userInfo:any) {
    this.globalData.userInfo = userInfo;
  },
  onLaunch() {
    // 初始化晕哈数
    if (!wx.cloud) {
        console.error('请使用支持云能力的微信小程序版本');
        return;
      }
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV, // 替换为实际环境ID，或使用 cloud.DYNAMIC_CURRENT_ENV
      })
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })
  },
})