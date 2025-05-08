Component({
  properties: {
    zhTitle: {
      type: String,
      value: ''
    },
    enTitle: {
      type: String,
      value: ''
    },
    iconUrl: {
      type: String,
      value: ''
    },
    bluetoothData: {
        type: String,
        value: ''
      },
  },
  data: {
    // 组件内部数据
  },
  methods: {
    // 组件方法
    sendData(event:any){
        const app = getApp()
        let state = app.globalData.userInfo
        const value = event.currentTarget.dataset.value;
        console.log(value);
        // 首先要判断下蓝牙的连接状态
        if(!state.status){
            // 判断蓝牙已连接 发送指令
            
            console.log(state.status);
            const buffer = new ArrayBuffer(2);
            const dataView = new DataView(buffer);
            dataView.setUint16(0, state.status, false); // 发送 指令 作为 16 位值，大端序
            wx.writeBLECharacteristicValue({
                deviceId: app.globalData.deviceId,
                serviceId: app.globalData.serviceId,
                characteristicId: app.globalData.characteristicId,
                value: buffer,
                success: () => {
                    this.setData({ status: ' distinguir指令发送成功' });
                    console.log('指令发送成功');
                    // this.enableNotifications(); // 发送指令后启用通知
                },
                fail: (res) => {
                    this.setData({ status: `指令发送失败: ${res.errMsg}` });
                }
            });

        }else{
            wx.showToast({
                title: "蓝牙未连接",
                icon: "none",
                duration: 2000,
              });
        }
    }
  }
})