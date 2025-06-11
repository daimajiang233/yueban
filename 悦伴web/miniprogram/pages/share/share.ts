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
        // -----------------------------测试数据----------------------------
        // connectedText:false
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

    // 初始化 WebSocket 连接
    connectWebSocket() {
        const that = this;
        wx.connectSocket({
            url: 'wss://www.nick9995403432.com.cn', // 替换为你的服务器地址，生产环境用 wss://
            success() {
                that.addLog('正在连接服务器...');
                console.log('正在连接服务器...');
                // that.setData({ connectedText: true });
                // 监听 WebSocket 事件
                wx.onSocketOpen(() => {
                    that.setData({ connected: true });
                    that.addLog('已连接到服务器');
                    console.log('已连接到服务器');
                });
            },
            fail(err) {
                that.addLog('连接失败: ' + JSON.stringify(err));
                // that.setData({ connectedText: false });
            },
        });

        wx.onSocketMessage((res) => {
            try {
                const data = JSON.parse(res.data);
                // 根据消息类型处理并显示 message 字段
                if (data.type === 'roomCreated') {
                    that.setData({ roomId: data.roomId })
                    that.setData({ creatStatus: true })
                    that.addLog(`${data.message}: ${data.roomId}`);
                    console.log(`${data.message}: ${data.roomId}`);

                } else if (data.type === 'joined') {
                    that.setData({ roomId: data.roomId })
                    that.setData({ creatStatus: false })
                    that.addLog(`${data.message}: ${data.roomId}`);
                    console.log(`${data.message}: ${data.roomId}`);
                    // that.sendMessage({buttons: that.data.buttons,startPause:that.data.startPause,join:true})

                } else if (data.type === 'userJoined') {
                    that.addLog(data.message);

                } else if (data.type === 'userLeft') {
                    that.addLog(data.message);
                } else if (data.type === 'data') {
                    if (data.payload.moduleStatus) {
                        that.setData({ buttons: data.payload.newButtons,startPause:data.payload.startPause });
                        if(data.payload.value){
                            that.sendData(data.payload.value)
                        }
                    }else {
                        console.log(data.payload.newButtons, "我是开关测试数据接收", data.payload.value);

                        that.setData({ buttons: data.payload.newButtons, startPause: data.payload.startPause });
                        if(data.payload.value){
                            that.sendData(data.payload.value)
                        }
                    }
                    console.log(data.payload, "我是接收数据");

                    that.addLog(`${data.message}: ${data.payload}我是接收数据`);
                }
                else if (data.type === 'error') {
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
        if (userInfo.isScanning) {
            if (!this.data.connected) {
                this.connectWebSocket();
                setTimeout(() => {

                    this.sendMessageToServer({ type: 'create' });
                }, 1000); // 延迟发送，确保连接建立
            } else {
                this.sendMessageToServer({ type: 'create' });
            }
        } else {
            wx.showToast({
                title: "蓝牙未连接",
                icon: "none",
                duration: 2000,
            });
        }

    },

    // 加入房间
    joinRoom() {
        const that = this
        const roomId = that.data.inputMessage;
        if (!roomId) {
            console.log('请输入房间ID');
            return;
        }
        // if (!that.data.connected) {
        that.connectWebSocket();
        setTimeout(() => {
            that.sendMessageToServer({ type: 'join', roomId });
        }, 1000);
  
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

    // 发送消息到服务器
    sendMessageToServer(data) {
        wx.sendSocketMessage({
            data: JSON.stringify(data),
            success() {
                
            },
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
        let data = { newButtons: newButtons, value: value, startPause: true, moduleStatus: true }
        let data1 = { newButtons: newButtons, value: null, startPause: true, moduleStatus: true }

        this.setData({ buttons: newButtons });

        console.log("选中按钮:", index, "值:", value);

        // this.sendData(value)
        if (this.data.creatStatus) {
            this.sendMessage(data1)
            this.sendData(value)
        } else {
            this.sendMessage(data)
        }

        // 切换 startPause 状态
        this.setData({
            startPause: true, // 切换 true/false
        });

        console.log(1);
    },

    startBtn(e: any) {
        wx.vibrateShort({ type: 'heavy' });
        let newButtons1 = this.data.buttons.map((item, i) => i === Number(0));
        console.log(newButtons1, '数据');
        // const value = e.currentTarget.dataset.value; // 获取 data-value="0xfB"
        // 修改发码参数
        const valueStart = "0xFB"
        const valueEnd = "0xFD"
        console.log(valueStart,valueEnd, '测试开关键数据');
        if (this.data.startPause) {
            console.log("我是暂停", !this.data.startPause);
            this.setData({
                startPause: false,
                buttons: Array(10).fill(null)
            });
            let data = { newButtons: Array(10).fill(null), value: valueEnd, startPause: false, moduleStatus: false }
            let data1 = { newButtons: Array(10).fill(null), value: null, startPause: false, moduleStatus: false }
            if (this.data.creatStatus) {
                this.sendData(valueEnd)
                this.sendMessage(data1)
            } else {
                this.sendMessage(data)
            }
        } else {
            console.log("我是开始", !this.data.startPause);
            this.setData({
                startPause: true, // 切换 true/false
                buttons: newButtons1
            });
            let data = { newButtons: newButtons1, value: valueStart, startPause: true, moduleStatus: false }
            let data1 = { newButtons: newButtons1, value: null, startPause: true, moduleStatus: false }

            if (this.data.creatStatus) {
                this.sendData(valueStart)
                this.sendMessage(data1)
            } else {
                this.sendMessage(data)
            }
        }
    },

    sendData(value: string) {
        const app = getApp()
        const userInfo = app.getGlobalUserInfo()
        console.log(value,"蓝牙已准备发送的数据");
        
        let state = userInfo.isScanning

        // 首先要判断下蓝牙的连接状态
        if (state) {
            // 判断蓝牙已连接 发送指令
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
                    console.log('远程指令发送成功');
                    // this.enableNotifications(); // 发送指令后启用通知
                },
                fail: (res) => {
                    console.log("远程指令发送失败");

                }
            });

        } else {
            wx.showToast({
                title: "蓝牙未连接",
                icon: "error",
                duration: 2000,
            });
        }
    },

    shareRoom() {
        // 微信在控制
    },

    // 页面初次渲染完成时
    onReady() {

    },
    // 页面加载时初始化并创建房间
    onLoad(options) {
        let param = options.param
        if (param) {
            const that = this
            that.setData({
                roomId: param, // 将参数存入 data
                creatStatus: false,
                inputMessage: param
            });
        }

    },

    // 页面卸载时关闭 WebSocket
    onUnload() {
      if (this.data.creatStatus) {
        setTimeout(() => {
                this.data.connected = false
                wx.closeSocket();
        }, 2000)
      }
        // if (this.data.connected) {
            // this.sendMessage({ buttons: Array(10).fill(null), startPause: false, value: '0xfB', join: true })
            // console.log("已经关闭websocket");
            // wx.showToast({
            //     title: "蓝牙未连接",
            //     icon: "error",
            //     duration: 2000,
            // });
            // setTimeout(() => {
            //     this.data.connected = false
            //     wx.closeSocket();
            // }, 2000)
        // }
    },
});