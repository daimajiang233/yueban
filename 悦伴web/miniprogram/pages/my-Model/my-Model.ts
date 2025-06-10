// pages/my-Model/my-Model.ts
Page({
    /**
     * 页面的初始数据
     */
    data: {
        startPause: false,
        buttons: new Array(10).fill(false) // 初始化 10 个按钮状态（false 表示未选中）
    },
    // 页面加载初始化获取全局数据
    dataInit(){
      const app = getApp()
      const userInfo = app.getGlobalUserInfo()
      this.setData({
        startPause:  userInfo.modelInfo.startPause,
        buttons:  userInfo.modelInfo.buttons // 初始化 10 个按钮状态（false 表示未选中）
      })
      console.log(this.data.startPause);
      

    },

    handleButtonTap(e: any) {
        const app = getApp()
        const userInfo = app.getGlobalUserInfo()
        const index = e.detail.index; // 从子组件传递的 index
        const value = e.detail.value; // 从子组件传递的 value

        // 更新 buttons 数组，确保只有一个按钮被选中
        const newButtons = this.data.buttons.map((item, i) => i === Number(index));
        this.setData({ buttons: newButtons });

        console.log("选中按钮:", index, "值:", value);

        this.sendData(value)

        // 切换 startPause 状态
        this.setData({
            startPause: true, // 切换 true/false
        });
        userInfo.modelInfo.buttons = newButtons
        userInfo.modelInfo.startPause = true
        console.log(1);
    },

    // 组件被添加到页面时
    sendData(value: string) {
        const app = getApp()
        const userInfo = app.getGlobalUserInfo()

        let state = userInfo.isScanning
            console.log("点击了",state,value);

        // let state = true

        // const value = event

        console.log(value, '发送指令');
        // 首先要判断下蓝牙的连接状态
        if (state) {
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

        } else {
            wx.showToast({
                title: "蓝牙未连接",
                icon: "none",
                duration: 2000,
            });
        }
    },

    // methods: {
    startBtn(e: any) {
      const app = getApp()
      const userInfo = app.getGlobalUserInfo()
        let newButtons1 = this.data.buttons.map((item, i) => i === Number(0));
        console.log(newButtons1,'数据');
        
        const value = e.currentTarget.dataset.value; // 获取 data-value="0xf0B"
        console.log(value,'测试开关键数据');
        
        if(this.data.startPause){
            console.log("我是暂停",!this.data.startPause);

            this.setData({
                startPause: false,
                buttons: Array(10).fill(null)
            });
            userInfo.modelInfo.buttons = Array(10).fill(null)
            userInfo.modelInfo.startPause = false
        }else{
            console.log("我是开始",!this.data.startPause);

            // this.setData({ buttons: newButtons });
            // 切换 startPause 状态
            this.setData({
                startPause: true, // 切换 true/false
                buttons: newButtons1
            });
            userInfo.modelInfo.buttons = newButtons1
            userInfo.modelInfo.startPause = true
        }

        console.log(value, "startBtn triggered");

        // 调用 sendData 发送蓝牙指令
        this.sendData(value);

    },
    // },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
      this.dataInit()
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