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
      pageSrc: {
        type: String,
        value: ''
      }
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
        

        const app = getApp()
        // let state1 = app.globalData.userInfo
        const userInfo = app.getGlobalUserInfo()
        console.log(userInfo,'我是点击');
        // console.log(state1,'我是点击1');
        
        let state = userInfo.isScanning
        // let state = true

        const value = event.currentTarget.dataset.value;
        const pageSrc = event.currentTarget.dataset.pagesrc;
        console.log(pageSrc,"测试");

        console.log(value);
        // 首先要判断下蓝牙的连接状态
        if(state){
            // 判断蓝牙已连接 发送指令
            wx.navigateTo({
              url: `/pages/${pageSrc}`, // 目标页面路径，可携带参数
              success: function(res) {
                console.log('跳转成功');
              },
              fail: function(err) {
                wx.showToast({
                    title: '未连接蓝牙！',
                    icon: 'error',
                    duration: 1500 // 提示显示 1.5 秒
                  });
                console.log('跳转失败', err);
              }
            });

        }else{
            wx.showToast({
                title: '未连接蓝牙！',
                icon: 'error',
                duration: 1500 // 提示显示 1.5 秒
              });
        }
    }

  }
})