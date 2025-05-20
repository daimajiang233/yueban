// 定义页面数据的接口
interface PageData {
    isShaking: boolean; // 是否正在摇晃
    randomNumber: number | null; // 生成的随机数，可能为 null
  }
  
  // 页面注册函数
  Page({
    // 初始化页面数据
    data: {
      isShaking: false, // 初始状态为未摇晃
      randomNumber: null // 初始随机数为 null
    } as PageData,
  
    // 页面加载时调用
    onLoad() {
      this.startShakeDetection(); // 启动摇晃检测
    },
  
    // 启动加速度计监听以检测摇晃
    startShakeDetection() {
      // 监听加速度计数据变化
      wx.onAccelerometerChange((res: WechatMiniprogram.AccelerometerChangeCallbackResult) => {
        const { x, y, z } = res; // 获取 x, y, z 轴加速度
        const acceleration = Math.sqrt(x * x + y * y + z * z); // 计算总加速度
        if (acceleration > 1.5) { // 如果加速度超过阈值（可调整）
          if (!this.data.isShaking) { // 确保不重复触发
            this.setData({ isShaking: true }); // 设置摇晃状态
            // 触发短促的强烈振动
            wx.vibrateShort({ type: 'heavy' });
            this.generateRandomNumber(); // 生成随机数
            // 1秒后停止摇晃动画
            setTimeout(() => {
              this.setData({ isShaking: false });
            }, 1000);
          }
        }
      });
    },
  
    // 生成 20 到 100 之间的随机数
    generateRandomNumber() {
      const min: number = 20; // 最小值
      const max: number = 100; // 最大值
      // 使用 Math.floor 确保生成 20 到 100 之间的随机整数
    const randomNum: number = Math.floor(Math.random() * (max - min + 1)) + min;
      this.setData({ randomNumber: randomNum }); // 更新页面数据
      this.sendData(randomNum)
    },

    // 组件被添加到页面时
    sendData(value:any){
            

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
                    this.setData({ 
                        // status: ' distinguir指令发送成功',
                        startPause:true
                    });
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
    },
  
    // 页面卸载时调用
    onUnload() {
      wx.offAccelerometerChange(); // 停止监听加速度计
    }
  });