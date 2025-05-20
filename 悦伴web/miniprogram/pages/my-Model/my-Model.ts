// pages/my-Model/my-Model.ts
Page({
  /**
   * 页面的初始数据
   */
  data: {
    startPause: false,
    buttons: Array(10).fill(false) // 初始化 10 个按钮，未选中
  },
  handleButtonTap(e:any) {
    console.log(e.currentTarget,1234);
    
    const index = Number(e.currentTarget.dataset.index); // 获取点击按钮的索引
    const newButtons = Array(10).fill(false); // 重置所有按钮
    newButtons[index] = true; // 设置当前按钮为选中
    console.log(index);
    this.sendData(e.currentTarget.dataset.value)
    // 更新数据
    this.setData({
      buttons: newButtons
    });
        
    // 切换 startPause 状态
    this.setData({
        startPause: true, // 切换 true/false
    });
    // 触发自定义事件，传递 index 和 data-value
    // this.triggerEvent('buttonTap', { 
    //   index, 
    //   value: e.currentTarget.dataset.value 
    // });
    console.log(1);
  },

// 组件被添加到页面时
sendData(value:string){
        

            const app = getApp()
            const userInfo = app.getGlobalUserInfo()
            
            let state = userInfo.isScanning
            // let state = true
    
            // const value = event
    
            console.log(value,'发送指令');
            // 首先要判断下蓝牙的连接状态
            if(state){
                // 判断蓝牙已连接 发送指令
                // console.log(state.status);
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
                    
                        console.log('指令发送成功暂停启动');
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
},

// methods: {
    startBtn(e:any){
        const value = e.currentTarget.dataset.value; // 获取 data-value="0xf0B"
        console.log(value, "startBtn triggered");

        // 调用 sendData 发送蓝牙指令
        this.sendData(value);
            
        // 切换 startPause 状态
        this.setData({
            startPause: !this.data.startPause, // 切换 true/false
        });
        
    },
// },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})