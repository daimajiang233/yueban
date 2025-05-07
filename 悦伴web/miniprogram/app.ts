// app.ts
/// <reference path="./utils/globalData.ts" />

App<IAppOption>({
  globalData: {
    userInfo:{
        name: "AW31N_1YUE BAN",
        status: false,
        deviceId: "",
        serviceId: "",
        characteristicId: "",
    }
  },
  onLaunch() {
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