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

  lifetimes: {
    // 组件被创建时
    created() {

        
        },
        // 组件被添加到页面时
        attached() {
        // this.sendData(1) 测试
    
        },
        // 组件被移除时
        detached() {
        
    }
  },

  methods: {
    // 组件方法
    sendData(event:any){
        wx.navigateTo({
            url: '/pages/my-Model/my-Model', // 目标页面路径，可携带参数
            success: function(res) {
              console.log('跳转成功');
            },
            fail: function(err) {
              console.log('跳转失败', err);
            }
          });

        const app = getApp()
        // let state1 = app.globalData.userInfo
        const userInfo = app.getGlobalUserInfo()
        console.log(userInfo,'我是点击');
        // console.log(state1,'我是点击1');
        
        let state = userInfo.isScanning

        const value = event.currentTarget.dataset.value;
        console.log(state,"测试");

        console.log(value);
        // 首先要判断下蓝牙的连接状态
        if(state){
            // 判断蓝牙已连接 发送指令
            
            console.log(state.status);
            const decimalValue = parseInt(value, 16); // 将十六进制转换为十进制
            const buffer = new ArrayBuffer(2);
            const dataView = new DataView(buffer);
            dataView.setUint16(0, decimalValue, true); // 使用转换后的十进制值
            wx.writeBLECharacteristicValue({
                deviceId: userInfo.deviceId,
                serviceId: userInfo.serviceId,
                characteristicId: userInfo.writeCharacteristicId,
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