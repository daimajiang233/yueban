Component({









  // 组件的初始数据
  data: {
    name: 'YUE BAN', // 目标设备名称
    isScanning: false, // 扫描状态
    deviceId: '', // 设备ID
    serviceId: '', // 服务ID
    characteristicId: '', // 特征值ID
    timerId: null, // 定时器ID，初始化为null
    connected: false, // 连接状态
    adapterState: false, // 蓝牙适配器状态
    status: '未连接', // 状态提示
  },

  // 组件的生命周期
  lifetimes: {

    created() {
      console.log('组件创建');

    },

    attached() {
      this.startBluetoothProcess(); // 页面加载时自动启动蓝牙流程







    },

    detached() {
      this.stopBluetoothProcess(); // 停止蓝牙流程
      this.closeBluetooth(); // 关闭蓝牙适配器




    }
  },

  // 组件的内部方法
  methods: {
    // 初始化蓝牙适配器
    initBluetooth() {
      return new Promise((resolve, reject) => {
        wx.openBluetoothAdapter({
          success: (res) => {
            console.log('蓝牙适配器初始化成功:', res);
            this.setData({ adapterState: true, status: '蓝牙适配器初始化成功' });
            resolve(true);
          },
          fail: (err) => {
            console.error('蓝牙适配器初始化失败:', err);
            this.setData({ adapterState: false, status: '蓝牙适配器初始化失败' });
            reject(err);
          }
        });
      });
    },

    // 开始扫描蓝牙设备
    startScan() {
      if (!this.data.adapterState) {
        console.error('蓝牙适配器未初始化');
        this.setData({ status: '蓝牙适配器未初始化' });
        return Promise.reject('适配器未初始化');
      }
      if (this.data.isScanning) {
        console.log('已在扫描中');
        this.setData({ status: '已在扫描中' });
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        wx.startBluetoothDevicesDiscovery({
          services: [], // 空数组表示扫描所有设备
          allowDuplicatesKey: false,
          success: (res) => {
            console.log('开始设备扫描:', res);
            this.setData({ isScanning: true, status: '正在扫描设备...' });
            resolve(true);
          },
          fail: (err) => {
            console.error('设备扫描失败:', err);
            this.setData({ isScanning: false, status: '设备扫描失败' });
            reject(err);
          }
        });
      });
    },

    // 停止扫描设备
    stopScan() {
      return new Promise((resolve, reject) => {
        wx.stopBluetoothDevicesDiscovery({
          success: (res) => {
            console.log('停止设备扫描:', res);
            this.setData({ isScanning: false, status: '停止扫描' });
            resolve(true);
          },
          fail: (err) => {
            console.error('停止扫描失败:', err);
            this.setData({ status: '停止扫描失败' });
            reject(err);
          }
        });
      });
    },

    // 根据名称查找设备并获取其ID
    findDevice(targetName) {
      const app = getApp();
      const userInfo = app.getGlobalUserInfo();
      return new Promise((resolve, reject) => {
        wx.getBluetoothDevices({
          success: (res) => {
            const devices = res.devices;
            const targetDevice = devices.find(device => device.name === targetName || device.localName === targetName);
            if (targetDevice) {
              this.setData({ deviceId: targetDevice.deviceId, status: `找到设备: ${targetName}` });
              userInfo.deviceId = targetDevice.deviceId;
              console.log(`找到目标设备: ${targetName}, ID: ${this.data.deviceId}`);
              resolve(targetDevice.deviceId);
            } else {
              console.log(`未找到目标设备 ${targetName}`);
              this.setData({ status: `未找到设备 ${targetName}` });
              reject('设备未找到');
            }
          },
          fail: (err) => {
            console.error('获取设备列表失败:', err);
            this.setData({ status: '获取设备列表失败' });
            reject(err);
          }
        });
      });
    },

    // 连接到目标设备
    connectToDevice(deviceId) {
      const app = getApp();
      const userInfo = app.getGlobalUserInfo();
      if (!deviceId && !this.data.deviceId) {
        console.error('未提供设备ID');
        this.setData({ status: '无设备ID' });
        return Promise.reject('无设备ID');
      }
      const id = deviceId || this.data.deviceId;

      return new Promise((resolve, reject) => {
        wx.createBLEConnection({
          deviceId: id,
          success: (res) => {
            userInfo.isScanning = true;
            console.log(`成功连接到设备: ${id}`, res);
            this.setData({ connected: true, status: `已连接到设备 ${id}` });

            // 连接成功后启动定时器，每秒发送0xFF检测连接状态
            this.startConnectionCheckTimer();

            resolve(true);
          },
          fail: (err) => {
            console.error(`连接设备 ${id} 失败:`, err);
            this.setData({ connected: false, status: `连接设备 ${id} 失败` });
            reject(err);
          }
        });
      });
    },

    // 获取设备的服务
    getBLEDeviceServices() {
      const app = getApp();
      const userInfo = app.getGlobalUserInfo();
      if (!this.data.deviceId) {
        console.error('无设备ID，无法获取服务');
        this.setData({ status: '无设备ID' });
        return Promise.reject('无设备ID');
      }

      return new Promise((resolve, reject) => {
        wx.getBLEDeviceServices({
          deviceId: this.data.deviceId,
          success: (res) => {
            const services = res.services;
            console.log('设备服务列表:', services);
            if (services.length > 0) {
              this.setData({ serviceId: services[0].uuid, status: `获取服务成功: ${services[0].uuid}` });
              userInfo.serviceId = services[0].uuid;
              console.log(`选择服务ID: ${this.data.serviceId}`);
              resolve(services[0].uuid);
            } else {
              this.setData({ status: '无可用服务' });
              reject('无可用服务');
            }
          },
          fail: (err) => {
            console.error('获取服务失败:', err);
            this.setData({ status: '获取服务失败' });
            reject(err);
          }
        });
      });
    },

    // 获取服务的特征值
    getBLEDeviceCharacteristics() {
      const app = getApp();
      const userInfo = app.getGlobalUserInfo();
      if (!this.data.deviceId || !this.data.serviceId) {
        console.error('设备ID或服务ID缺失');
        this.setData({ status: '设备ID或服务ID缺失' });
        return Promise.reject('设备ID或服务ID缺失');

      }



      return new Promise((resolve, reject) => {
        wx.getBLEDeviceCharacteristics({
          deviceId: this.data.deviceId,
          serviceId: this.data.serviceId,
          success: (res) => {
            const characteristics = res.characteristics;
            console.log('特征值列表:', characteristics);
            const targetCharacteristic = characteristics.find(char => char.properties.write && char.properties.read);
            if (targetCharacteristic) {
              this.setData({ characteristicId: targetCharacteristic.uuid, status: `获取特征值成功: ${targetCharacteristic.uuid}` });
              userInfo.writeCharacteristicId = targetCharacteristic.uuid;
              console.log(`选择特征值ID: ${this.data.characteristicId}`);
              resolve(targetCharacteristic.uuid);
            } else {
              this.setData({ status: '无可用特征值' });
              reject('无可用特征值');
            }
          },
          fail: (err) => {
            console.error('获取特征值失败:', err);
            this.setData({ status: '获取特征值失败' });
            reject(err);
          }
        });
      });
    },

    // 检查连接状态
    checkConnectionStatus() {
    const app = getApp();
    const userInfo = app.getGlobalUserInfo();
      if (!this.data.deviceId) {
        console.log('无设备ID，无法检查连接状态');
        this.setData({ status: '无设备ID，无法检查连接状态' });
        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        wx.getBLEDeviceServices({
          deviceId: this.data.deviceId,
          success: () => {
            console.log(`设备 ${this.data.deviceId} 已连接`);
            this.setData({ connected: true, status: `设备 ${this.data.deviceId} 已连接` });
            userInfo.isScanning= true

            resolve(true);
          },
          fail: () => {
            console.log(`设备 ${this.data.deviceId} 未连接`);
            this.setData({ connected: false, status: `设备 ${this.data.deviceId} 未连接` });
            userInfo.isScanning= false

            resolve(false);
          }
        });
      });
    },
    // 新增方法：启动连接状态检测定时器
    startConnectionCheckTimer() {
      const app = getApp();
      const userInfo = app.getGlobalUserInfo();
      
      // 如果已有定时器，先清除
      if (this.data.timerId) {
        clearInterval(this.data.timerId);
      }
    
      // 每秒检查一次连接状态
      const timerId = setInterval(() => {
        const app = getApp();
        const userInfo = app.getGlobalUserInfo();
        if (!this.data.connected || !this.data.deviceId) {
          // 如果未连接或缺少必要信息，清除定时器
          clearInterval(timerId);
          this.setData({ timerId: null, connected: false, status: '连接已断开或缺少必要信息' });
          console.log('连接已断开或缺少必要信息，停止定时器');
          return;
        }
    
        // 获取已连接的蓝牙设备（必须传入 services，如果不需要可以传空数组 []）
        wx.getConnectedBluetoothDevices({
          services: [this.data.serviceId], // 如果不需要特定服务，传空数组；否则传入你的服务 UUID 列表
          success: (res) => {
              console.log(res.devices,this.data.deviceId,this.data.name,"aoe");
              
            // 检查目标设备是否在已连接设备列表中
            const isConnected = res.devices.some(device => 
              device.deviceId === this.data.deviceId && device.name === this.data.name
            );
            
            if (isConnected) {
              console.log('设备仍然连接:', this.data.name);
              this.setData({ status: '连接正常' });
              userInfo.isScanning= true

            } else {
              console.log('设备已断开连接:', this.data.name);
              this.setData({ connected: false, status: '连接已断开' });
            //   userInfo.isScanning= false

              // 清除定时器
              clearInterval(timerId);
              this.setData({ timerId: null });
              
              // 更新全局状态
              userInfo.isScanning = false;
              
              // 更新本地状态
              this.setData({ 
                connected: false, 
                deviceId: '', 
                serviceId: '', 
                characteristicId: '', 
                status: '已断开设备连接' 
              });
            }
          },
          fail: (err) => {
            console.error('获取已连接设备失败:', err);
            // 假设获取失败就是断开连接
            this.setData({ connected: false, status: '连接已断开' });
            clearInterval(timerId);
            this.setData({ timerId: null });
            userInfo.isScanning = true;
            this.setData({ 
              connected: false, 
              deviceId: '', 
              serviceId: '', 
              characteristicId: '', 
              status: '已断开设备连接' 
            });
          }
        });
      }, 1000); // 每1000ms检查一次
    
      // 保存定时器ID
      this.setData({ timerId });
      console.log('已启动连接状态检测定时器');
    },

    // 主函数，处理蓝牙搜索和连接（单次执行）
    startBluetoothProcess() {
      wx.showLoading({
        title: '连接中...', // 提示内容
        mask: true,        // 是否显示透明蒙层，防止触摸穿透（可选）
      });
      const tryConnect = async () => {
        try {
          // 如果已连接，跳过流程
          if (this.data.connected) {
            console.log('已连接，跳过流程');
            this.setData({ status: '已连接，跳过流程' });
            return;
          }

          // 确保蓝牙适配器已初始化
          if (!this.data.adapterState) {
            await this.initBluetooth();
          }

          // 如果未在扫描中，开始扫描
          if (!this.data.isScanning) {
            await this.startScan();
          }

          // 等待片刻以便发现设备
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 尝试查找、连接设备并获取服务和特征值
          try {
            await this.findDevice(this.data.name);
            await this.stopScan(); // 找到设备后停止扫描
            await this.connectToDevice(); // 连接设备
            await this.getBLEDeviceServices(); // 获取服务
            await this.getBLEDeviceCharacteristics(); // 获取特征值
            wx.hideLoading();
            wx.showToast({
              title: '连接成功！', // 提示内容（必填）
              icon: 'success',   // 图标类型（可选：success / loading / none）
              duration: 1500,    // 显示时长（毫秒，默认 1500）
              mask: false,       // 是否显示透明蒙层（可选，默认 false）
            });
          } catch (err) {
            console.log('未找到设备或连接失败');
            this.setData({ status: '未找到设备或连接失败' });
            wx.showToast({
              title: '连接失败！', // 提示内容（必填）
              icon: 'error',   // 图标类型（可选：success / loading / none）
              duration: 1500,    // 显示时长（毫秒，默认 1500）
              mask: false,       // 是否显示透明蒙层（可选，默认 false）
            });
          }

          // 检查连接状态
          await this.checkConnectionStatus();
        } catch (err) {
          console.error('蓝牙处理过程出错:', err);
          this.setData({ status: `蓝牙处理出错: ${err}` });
        }
      };

      // 执行单次蓝牙流程
      tryConnect();
    },

    // 停止蓝牙处理过程
    stopBluetoothProcess() {
      const app = getApp();
      const userInfo = app.getGlobalUserInfo();
      // 清除定时器
      if (this.data.timerId) {
        clearInterval(this.data.timerId);
        this.setData({ timerId: null });
        console.log('已停止连接状态检测定时器');
      }

      return this.stopScan().then(() => {
        if (this.data.connected) {
          return new Promise((resolve, reject) => {
            wx.closeBLEConnection({
              deviceId: this.data.deviceId,
              success: () => {
                console.log('已断开设备连接');
                userInfo.isScanning = false
                this.setData({ connected: false, deviceId: '', serviceId: '', characteristicId: '', status: '已断开设备连接' });
                resolve(true);
              },
              fail: (err) => {
                console.error('断开连接失败:', err);
                this.setData({ status: '断开连接失败' });
                reject(err);
              }
            });
          });
        }
      });
    },

    // 关闭蓝牙适配器
    closeBluetooth() {
      // 确保定时器被清除
      if (this.data.timerId) {
        clearInterval(this.data.timerId);
        this.setData({ timerId: null });
        console.log('已停止连接状态检测定时器');
      }

      return new Promise((resolve, reject) => {
        wx.closeBluetoothAdapter({
          success: (res) => {
            console.log('蓝牙适配器已关闭:', res);
            this.setData({
              adapterState: false,
              connected: false,
              deviceId: '',
              serviceId: '',
              characteristicId: '',
              isScanning: false,
              timerId: null,
              status: '蓝牙适配器已关闭'
            });
            resolve(true);
          },
          fail: (err) => {
            console.error('关闭蓝牙适配器失败:', err);
            this.setData({ status: '关闭蓝牙适配器失败' });
            reject(err);
          }
        });
      });
    },

    // 按钮点击触发重新搜索和连接
    toggleScan() {
      wx.vibrateShort({ type: 'heavy' });
      if (this.data.connected) {
        this.stopBluetoothProcess()
        // // 如果已连接，断开连接并重置状态
        // this.stopBluetoothProcess().then(() => {
        //   this.startBluetoothProcess(); // 重新启动蓝牙流程
        // });
        console.log('已经关闭',this.data.connected);
        
      } else {
        // 如果未连接，直接启动蓝牙流程
        this.startBluetoothProcess();
        console.log('已经打开',this.data.connected);

      }
    }
  }
});