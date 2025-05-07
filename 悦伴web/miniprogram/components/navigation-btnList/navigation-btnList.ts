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