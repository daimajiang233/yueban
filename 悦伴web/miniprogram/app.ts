// app.ts
// <reference path="./utils/globalData.ts" />

import bleService from './utils/ble-service';

App<IAppOption>({
  globalData: {
    userInfo: {
      name: "YUE BAN",
      status: false,
      isScanning: false,
      isConnected: false,
      deviceId: "",
      serviceId: "",
      notifyCharacteristicId: "",
      writeCharacteristicId: "",
      hasAutoConnected: false,
      bleWriteSeq: 0,
      modelInfo: {
        startPause: false,
        buttons: new Array(10).fill(false),
      },
    },
  },

  getGlobalUserInfo() {
    return this.globalData.userInfo;
  },

  setGlobalUserInfo(userInfo: any) {
    Object.assign(this.globalData.userInfo, userInfo);
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用支持云能力的微信小程序版本");
      return;
    }
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV });

    const logs = wx.getStorageSync("logs") || [];
    logs.unshift(Date.now());
    wx.setStorageSync("logs", logs);

    wx.login({
      success: res => {
        console.log(res.code);
      },
    });

    bleService.onStatusChange(status => {
      this.globalData.userInfo.status = status.isConnected;
      this.globalData.userInfo.isScanning = status.isConnected;
      this.globalData.userInfo.isConnected = status.isConnected;
      this.globalData.userInfo.deviceId = status.deviceId;
      this.globalData.userInfo.serviceId = status.serviceId;
      this.globalData.userInfo.writeCharacteristicId = status.writeCharacteristicId;
      this.globalData.userInfo.notifyCharacteristicId = status.notifyCharacteristicId;
    });
  },
});
