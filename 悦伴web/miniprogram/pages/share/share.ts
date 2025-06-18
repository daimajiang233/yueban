Page({
    data: {
        roomIdInput: '', // 输入的房间ID
        roomId: '',
        creatStatus: true, //区分被远程角色
        inputMessage: '', // 输入的消息
        logs: [], // 消息日志
        ws: null, // WebSocket 实例
        connected: false, // 连接状态
        buttons: new Array(10).fill(false), // 初始化 10 个按钮状态（false 表示未选中）
        startPause: false,
    },

    onShareAppMessage(res) {
        const customParam = this.data.roomId;
        return {
            title: '分享遥控房间',
            path: `/pages/share/share?param=${customParam}`,
            success(res) {
                console.log('分享成功', res);
            },
            fail(res) {
                console.log('分享失败', res);
            }
        };
    },

    onInput(e: any) {
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

    // 初始化 WebSocket 连接 (返回 Promise)
    connectWebSocket() {
        return new Promise((resolve, reject) => {
            const that = this;
            wx.connectSocket({
                url: 'wss://wss.nick9995403432.com.cn',
                success() {
                    that.addLog('正在连接服务器...');
                    console.log('正在连接服务器...');
                    
                    // 监听 WebSocket 事件
                    wx.onSocketOpen(() => {
                        that.setData({ connected: true });
                        that.addLog('已连接到服务器');
                        console.log('已连接到服务器');
                        resolve();
                    });
                },
                fail(err) {
                    that.addLog('连接失败: ' + JSON.stringify(err));
                    reject(err);
                },
            });

            wx.onSocketMessage((res) => {
                try {
                    console.log(res);
                    
                    const data = JSON.parse(res.data);
                    if (data.type === 'roomCreated') {
                        that.setData({ roomId: data.roomId, creatStatus: true });
                        that.addLog(`${data.message}: ${data.roomId}`);
                    } else if (data.type === 'joined') {
                        that.setData({ roomId: data.roomId, creatStatus: false });
                        that.addLog(`${data.message}: ${data.roomId}`);
                    } else if (data.type === 'userJoined') {
                        that.addLog(data.message);
                    } else if (data.type === 'userLeft') {
                        that.addLog(data.message);
                    } else if (data.type === 'data') {
                        console.log(JSON.stringify(data));
                        
                        if (data.payload.moduleStatus) {
                            that.setData({ 
                                buttons: data.payload.newButtons,
                                startPause: data.payload.startPause 
                            });
                            if(data.payload.value && that.data.creatStatus){
                                console.log(data.payload,"已接收的数据");
                                
                                that.sendData(data.payload.value);
                            }
                        } else {
                            that.setData({ 
                                buttons: data.payload.newButtons, 
                                startPause: data.payload.startPause 
                            });
                            if(data.payload.value && that.data.creatStatus){
                                that.sendData(data.payload.value);
                            }
                        }
                        that.addLog(`${data.message}: ${data.payload}我是接收数据`);
                    } else if (data.type === 'error') {
                        that.addLog(`错误: ${data.message}`);
                        console.log(JSON.stringify(data));
                        wx.showToast({
                            title: "房间号错误",
                            icon: "error",
                            duration: 2000,
                        });
                        this.setData({
                          connected:false,
                          inputMessage:''
                        })
                        
                    } else {
                        that.addLog('未知消息: ' + JSON.stringify(data));
                        console.log(JSON.stringify(data));
                        
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
        });
    },

    // 创建房间 (使用 async/await)
    async createRoom() {
        const app = getApp();
        const userInfo = app.getGlobalUserInfo();
        if (!userInfo.isScanning) {
            wx.showToast({
                title: "蓝牙未连接",
                icon: "none",
                duration: 2000,
            });
            return;
        }
        wx.closeSocket()
        try {
            if (this.data.connected) {
                // 如果已经连接，直接发送创建房间的消息
                await this.sendMessageToServer({ type: 'create' });
            } else {
                // 如果未连接，先关闭旧的 WebSocket（确保无残留连接）
                await new Promise((resolve) => {
                    wx.closeSocket({
                        success: () => resolve(),
                        fail: () => resolve(), // 即使关闭失败也继续
                    });
                });
                // 建立新连接并等待完成
                await this.connectWebSocket();
                // 连接成功后发送创建房间的消息
                await this.sendMessageToServer({ type: 'create' });
            }
        } catch (err) {
            console.error('创建房间失败:', err);
            this.addLog('创建房间失败: ' + JSON.stringify(err));
        }
    },

    // 加入房间 (使用 async/await)
    async joinRoom() {
        const roomId = this.data.inputMessage;
        if (!roomId) {
            console.log('请输入房间ID');
            return;
        }
        wx.closeSocket()
        try {
            // wx.closeSocket();
            await this.connectWebSocket();
            this.sendMessageToServer({ type: 'join', roomId });
        } catch (err) {
            console.error('加入房间失败:', err);
        }
    },

    // 发送消息
    sendMessage(value: any) {
        if (!this.data.connected) {
            console.log('未连接到服务器');
            return;
        }
        this.sendMessageToServer({ type: 'data', payload: value });
        this.addLog(`发送消息: ${value}`);
        this.setData({ messageInput: '' });
    },

    // 发送消息到服务器 (返回 Promise)
    sendMessageToServer(data) {
        return new Promise((resolve, reject) => {
            wx.sendSocketMessage({
                data: JSON.stringify(data),
                success() {
                    console.log("发送数据成功"+data);
                    
                    resolve();
                },
                fail(err) {
                    this.addLog('发送失败: ' + JSON.stringify(err));
                    reject(err);
                },
            });
        });
    },

    // 按钮点击处理
    async handleButtonTap(e: any) {
        const index = e.detail.index;
        const value = e.detail.value;

        const newButtons = this.data.buttons.map((item, i) => i === Number(index));
        let data = { newButtons: newButtons, value: value, startPause: true, moduleStatus: true };
        let data1 = { newButtons: newButtons, value: null, startPause: true, moduleStatus: true };

        this.setData({ buttons: newButtons });

        try {
            if (this.data.creatStatus) {
                await this.sendMessage(data1);
                await this.sendData(value);
                console.log("我是发送数据1");
                
            } else {
                await this.sendMessage(data);
                console.log("我是发送数据2");
            }
            this.setData({ startPause: true });
        } catch (err) {
            console.error('按钮操作失败:', err);
        }
    },

    // 开始/暂停按钮 (使用 async/await)
    async startBtn(e: any) {
        wx.vibrateShort({ type: 'heavy' });
        let newButtons1 = this.data.buttons.map((item, i) => i === Number(0));
        const valueStart = "0xFB";
        const valueEnd = "0xFD";

        try {
            if (this.data.startPause) {
                this.setData({
                    startPause: false,
                    buttons: Array(10).fill(null)
                });
                let data = { newButtons: Array(10).fill(null), value: valueEnd, startPause: false, moduleStatus: false };
                let data1 = { newButtons: Array(10).fill(null), value: null, startPause: false, moduleStatus: false };
                
                if (this.data.creatStatus) {
                    await this.sendMessage(data1);
                    await this.sendData(valueEnd);
                } else {
                    await this.sendMessage(data);
                }
            } else {
                this.setData({
                    startPause: true,
                    buttons: newButtons1
                });
                let data = { newButtons: newButtons1, value: valueStart, startPause: true, moduleStatus: false };
                let data1 = { newButtons: newButtons1, value: null, startPause: true, moduleStatus: false };

                if (this.data.creatStatus) {
                  await this.sendMessage(data1);
                  await this.sendData(valueStart);
                } else {
                    await this.sendMessage(data);
                }
            }
        } catch (err) {
            console.error('开始/暂停操作失败:', err);
        }
    },

    // 发送数据到蓝牙 (返回 Promise)
    sendData(value: string) {
        return new Promise((resolve, reject) => {
            const app = getApp();
            const userInfo = app.getGlobalUserInfo();
            
            if (userInfo.isScanning) {
                const decimalValue = parseInt(value, 16);
                const buffer = new ArrayBuffer(2);
                const dataView = new DataView(buffer);
                dataView.setUint16(0, decimalValue, true);
                
                wx.writeBLECharacteristicValue({
                    deviceId: userInfo.deviceId,
                    serviceId: userInfo.serviceId,
                    characteristicId: userInfo.writeCharacteristicId,
                    value: buffer,
                    success: () => {
                        console.log('远程指令发送成功');
                        resolve();
                    },
                    fail: (res) => {
                        console.log("远程指令发送失败");
                        reject(res);
                    }
                });
            } else {
                wx.showToast({
                    title: "蓝牙未连接",
                    icon: "error",
                    duration: 2000,
                });
                reject(new Error('蓝牙未连接'));
            }
        });
    },

    shareRoom() {
        // 微信在控制
    },

    onReady() {
        // 页面初次渲染完成时
    },

    onLoad(options) {
        let param = options.param;
        if (param) {
            this.setData({
                roomId: param,
                creatStatus: false,
                inputMessage: param
            });
        }
    },

    async onUnload() {
          if (this.data.creatStatus && this.data.connected) {
              try {
                  // await new Promise(resolve => setTimeout(resolve, 2000));
                  this.setData({ connected: false }); // 更新状态（如果页面还在）
                  wx.closeSocket();
                  console.log('关闭连接成功:');
                  
              } catch (err) {
                  console.error('关闭连接失败:', err);
              }
          }
      },

    // 异步因为用户操作太快会导致延迟执行，同步操作能确保资源立即释放
    // async onUnload() {
    //     if (this.data.creatStatus && this.data.connected) {
    //         try {
    //             await new Promise(resolve => setTimeout(resolve, 2000));
    //             this.data.connected = false;
    //             wx.closeSocket();
    //             console.log('关闭连接成功:');
                
    //         } catch (err) {
    //             console.error('关闭连接失败:', err);
    //         }
    //     }
    // },
});