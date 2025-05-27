Page({
  data: {
    roomIdInput: '', // 输入的房间ID
    roomId:'',
    creatStatus: true, //区分被远程角色
    inputMessage: '', // 输入的消息
    logs: [], // 消息日志
    ws: null, // WebSocket 实例
    connected: false, // 连接状态
    buttons: new Array(10).fill(false), // 初始化 10 个按钮状态（false 表示未选中）
    startPause: false,
  },
  onInput(e:any){
    this.setData({ inputMessage: e.detail.value }); 
    console.log(this.data.inputMessage);
    
  },

  // 输入房间ID
  onRoomIdInput(e) {
    this.setData({ roomIdInput: e.detail.value });
  },

  // 输入消息
  onMessageInput(e) {
    this.setData({ messageInput: e.detail.value });
  },

  // 添加日志
  addLog(message) {
    const logs = this.data.logs;
    logs.push(message);
    this.setData({ logs });
  },

  // 初始化 WebSocket 连接
  connectWebSocket() {
    const that = this;
    wx.connectSocket({
      url: 'ws://114.55.39.240:3000', // 替换为你的服务器地址，生产环境用 wss://
      success() {
        that.addLog('正在连接服务器...');
        console.log('正在连接服务器...');
      },
      fail(err) {
        that.addLog('连接失败: ' + JSON.stringify(err));
      },
    });

    // 监听 WebSocket 事件
    wx.onSocketOpen(() => {
      that.setData({ connected: true });
      that.addLog('已连接到服务器');
      console.log('已连接到服务器');
    });

    wx.onSocketMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        // 根据消息类型处理并显示 message 字段
        if (data.type === 'roomCreated') {
          that.setData({roomId:data.roomId})
          that.setData({creatStatus:true})
          that.addLog(`${data.message}: ${data.roomId}`);
          console.log(`${data.message}: ${data.roomId}`);
          
        } else if (data.type === 'joined') {
            that.setData({roomId:data.roomId})
            that.setData({creatStatus:false})
          that.addLog(`${data.message}: ${data.roomId}`);
          console.log(`${data.message}: ${data.roomId}`);

        } else if (data.type === 'userJoined') {
          that.addLog(data.message);
        } else if (data.type === 'userLeft') {
          that.addLog(data.message);
        } else if (data.type === 'data') {
            if(data.payload.moduleStatus){
                this.setData({ buttons: data.payload.newButtons});

            }else{
                this.setData({ buttons: data.payload.newButtons1,startPause: data.payload.startPause});
            }
            console.log(data.payload,"我是接收数据");
            
          that.addLog(`${data.message}: ${data.payload}我是接收数据`);
        } else if (data.type === 'error') {
          that.addLog(`错误: ${data.message}`);
        } else {
          that.addLog('未知消息: ' + JSON.stringify(data));
        }
      } catch (e) {
        that.addLog('消息解析错误');
      }
    });

    wx.onSocketClose(() => {
      that.setData({ connected: false });
      that.addLog('与服务器断开连接');
    });

    wx.onSocketError((err) => {
      that.addLog('WebSocket 错误: ' + JSON.stringify(err));
    });
  },

  // 创建房间
  createRoom() {
    const app = getApp();
    const userInfo = app.getGlobalUserInfo();
    if(userInfo.isScanning){
        if (!this.data.connected) {
            this.connectWebSocket();
            setTimeout(() => {
              this.sendMessageToServer({ type: 'create' });
            }, 500); // 延迟发送，确保连接建立
          } else {
            this.sendMessageToServer({ type: 'create' });
          }
    }else{
        wx.showToast({
            title: "蓝牙未连接",
            icon: "none",
            duration: 2000,
        });
    }
   
  },

  // 加入房间
  joinRoom() {
    const roomId = this.data.inputMessage;
    if (!roomId) {
      console.log('请输入房间ID');
      return;
    }
    if (!this.data.connected) {
      this.connectWebSocket();
      setTimeout(() => {
        this.sendMessageToServer({ type: 'join', roomId });

      }, 500);
    } else {
      this.sendMessageToServer({ type: 'join', roomId });
    }
  },

  // 发送消息
  sendMessage(value:any) {
    // const message = this.data.messageInput;
    // if (!message) {
    //   console.log('请输入消息');
    //   return;
    // }
    if (!this.data.connected) {
      console.log('未连接到服务器');
      return;
    }
    this.sendMessageToServer({ type: 'data', payload: value });
    this.addLog(`发送消息: ${value}`);
    this.setData({ messageInput: '' });
  },

  // 发送消息到服务器
  sendMessageToServer(data) {
    wx.sendSocketMessage({
      data: JSON.stringify(data),
      success() {},
      fail(err) {
        this.addLog('发送失败: ' + JSON.stringify(err));
      },
    });
  },

  handleButtonTap(e: any) {
    const index = e.detail.index; // 从子组件传递的 index
    const value = e.detail.value; // 从子组件传递的 value

    // 更新 buttons 数组，确保只有一个按钮被选中
    const newButtons = this.data.buttons.map((item, i) => i === Number(index));
    let data = {newButtons:newButtons,value:value,moduleStatus:true}
    this.setData({ buttons: newButtons });

    console.log("选中按钮:", index, "值:", value);

    // this.sendData(value)
    this.sendMessage(data)

    // 切换 startPause 状态
    this.setData({
        startPause: true, // 切换 true/false
    });

    console.log(1);
  },

  startBtn(e: any) {
    let newButtons1 = this.data.buttons.map((item, i) => i === Number(0));
    console.log(newButtons1,'数据');
    
    const value = e.currentTarget.dataset.value; // 获取 data-value="0xf0B"
    if(this.data.startPause){
      console.log("我是暂停",!this.data.startPause);

      this.setData({
          startPause: !this.data.startPause,
          buttons: Array(10).fill(null)
      });
    let data = {newButtons:newButtons1,value:value,startPause:!this.data.startPause,moduleStatus:false}
    this.sendMessage(data)
  }else{
      console.log("我是开始",!this.data.startPause);
      this.setData({
        startPause: !this.data.startPause, // 切换 true/false
        buttons: newButtons1
    });
    let data = {newButtons:newButtons1,value:value,startPause:!this.data.startPause,moduleStatus:false}
    this.sendMessage(data)
  }
  },

  // 页面加载时初始化并创建房间
  onLoad() {
    // this.connectWebSocket();
    // setTimeout(() => {
    //   this.createRoom();
    // }, 500); // 延迟调用 createRoom，确保 WebSocket 连接建立
  },

  // 页面卸载时关闭 WebSocket
  onUnload() {
    if (this.data.connected) {
      wx.closeSocket();
    }
  },
});