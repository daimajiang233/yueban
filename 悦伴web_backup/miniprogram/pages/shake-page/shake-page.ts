// JS 文件：逻辑处理
Page({
  data: {
    vibrationLevel: 50, // 默认震动强度
    sendStatus:false
  },

  // 滑动条变化时触发
  onSliderChange(e) {
    const level = e.detail.value;
    this.setData({
      vibrationLevel: level
    });

    // 微信小程序震动 API（示例，实际需要设备支持）
    wx.vibrateShort({
      type: 'medium', // 震动类型
      success: () => {
        console.log('震动成功，强度：', level);
      },
      fail: () => {
        console.log('震动失败');
      }
    });

    this.sendData(this.data.vibrationLevel)
  },
  clickFn(e:any){
    wx.vibrateShort({ type: 'heavy' });
    const value = e.currentTarget.dataset.value;
    if(!this.data.sendStatus){
        this.sendData(this.data.vibrationLevel)
      console.log("点击会开始");
    }else{
      this.sendData(value)
        console.log("点击会暂停");
    }
  },
  sendData(value:any){
    console.log(this.data.vibrationLevel);
    const app = getApp()
    const userInfo = app.getGlobalUserInfo()
    const buffer = new ArrayBuffer(2);
    const dataView = new DataView(buffer);
    dataView.setUint16(0, value, true);
    console.log(userInfo);
    
    wx.writeBLECharacteristicValue({
        deviceId: userInfo.deviceId,
        serviceId: userInfo.serviceId,
        characteristicId: userInfo.writeCharacteristicId,
        value: buffer,
        success: () => {
            this.setData({sendStatus:true})
            console.log('指令发送成功暂停启动',this.data.sendStatus);
            // this.enableNotifications(); // 发送指令后启用通知
            if(value === "0xFC"){
              this.setData({sendStatus:false})
            }else{
              this.setData({sendStatus:true})
            }

        },
        fail: (res) => {
          wx.showToast({
            title: '蓝牙连接失败！', // 提示内容（必填）
            icon: 'error',   // 图标类型（可选：success / loading / none）
            duration: 1500,    // 显示时长（毫秒，默认 1500）
            mask: false,       // 是否显示透明蒙层（可选，默认 false）
          });
        }
    });
    
  },
//   sendData2(value:any){
//     console.log(this.data.vibrationLevel);
//     const app = getApp()
//     const userInfo = app.getGlobalUserInfo()

//     const decimalValue = parseInt(value, 16); // 将十六进制转换为十进制
//     const buffer = new ArrayBuffer(2);
//     const dataView = new DataView(buffer);
//     dataView.setUint16(0, decimalValue, true); // 使用转换后的十进制值
//     console.log(userInfo);
    
//     wx.writeBLECharacteristicValue({
//         deviceId: userInfo.deviceId,
//         serviceId: userInfo.serviceId,
//         characteristicId: userInfo.writeCharacteristicId,
//         value: buffer,
//         success: () => {
//             this.setData({sendStatus:true})
//             console.log('指令发送成功暂停启动',this.data.sendStatus);
//             // this.enableNotifications(); // 发送指令后启用通知
//             if(value === "0xFC"){
//               this.setData({sendStatus:false})
//             }else{
//               this.setData({sendStatus:true})
//             }

//         },
//         fail: (res) => {
//           wx.showToast({
//             title: '蓝牙连接失败！', // 提示内容（必填）
//             icon: 'error',   // 图标类型（可选：success / loading / none）
//             duration: 1500,    // 显示时长（毫秒，默认 1500）
//             mask: false,       // 是否显示透明蒙层（可选，默认 false）
//           });
//         }
//     });
    
//   },

  onLoad() {
    // 页面加载时的初始化逻辑
    this.sendData(this.data.vibrationLevel)
  },
  onUnload(){
    this.sendData('0xFC')
  }
});