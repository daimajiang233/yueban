// components/navigation-header/navigation-header.ts
Component({
  // 组件的属性列表
  properties: {},

  // 组件的初始数据
  data: {
    isConnected: false, // 蓝牙连接状态
    deviceId: '323', // 连接的设备ID
  },

  // 组件的方法
  methods: {
    // 初始化蓝牙并连接
    connectBluetooth() {
      const that = this;

      // 1. 初始化蓝牙适配器
      wx.openBluetoothAdapter({
        success() {
          console.log('蓝牙适配器初始化成功');
          that.startBluetoothDevicesDiscovery();
        },
        fail(res) {
          wx.showToast({
            title: '请打开蓝牙和位置服务',
            icon: 'none',
          });
          console.error('蓝牙适配器初始化失败', res);
        },
      });
    },

    // 2. 开始搜索蓝牙设备
    startBluetoothDevicesDiscovery() {
      const that = this;

      wx.startBluetoothDevicesDiscovery({
        success() {
          console.log('开始搜索蓝牙设备');
          that.onBluetoothDeviceFound();
        },
        fail(res) {
          console.error('搜索蓝牙设备失败', res);
        },
      });
    },

    // 3. 监听发现新设备
    onBluetoothDeviceFound() {
      const that = this;

      wx.onBluetoothDeviceFound((res) => {
        res.devices.forEach((device) => {
          // 找到目标设备（这里假设设备名称包含 "MyDevice"）
          if (device.name && device.name.includes('MyDevice')) {
            that.setData({
              deviceId: device.deviceId,
            });
            console.log('找到目标设备:', device.deviceId);
            that.connectDevice(device.deviceId);
            wx.stopBluetoothDevicesDiscovery(); // 停止搜索
          }
        });
      });
    },

    // 4. 连接设备
    connectDevice(deviceId: string) {
      const that = this;

      wx.createBLEConnection({
        deviceId,
        success() {
          console.log('蓝牙设备连接成功:', deviceId);
          that.setData({
            isConnected: true,
            deviceId,
          });
          wx.showToast({
            title: '蓝牙连接成功',
            icon: 'success',
          });

          // 监听蓝牙连接状态变化
          that.onBLEConnectionStateChange();
        },
        fail(res) {
          console.error('蓝牙设备连接失败:', res);
          that.setData({
            isConnected: false,
          });
          wx.showToast({
            title: '蓝牙连接失败',
            icon: 'none',
          });
        },
      });
    },

    // 5. 监听蓝牙连接状态变化
    onBLEConnectionStateChange() {
      const that = this;

      wx.onBLEConnectionStateChange((res) => {
        if (!res.connected) {
          console.log('蓝牙连接断开:', res.deviceId);
          that.setData({
            isConnected: false,
          });
          wx.showToast({
            title: '蓝牙已断开',
            icon: 'none',
          });
        }
      });
    },
  },

  // 组件生命周期
  lifetimes: {
    detached() {
      // 组件销毁时断开蓝牙连接
      if (this.data.isConnected) {
        wx.closeBLEConnection({
          deviceId: this.data.deviceId,
          success() {
            console.log('蓝牙连接已断开');
          },
        });
      }
      wx.closeBluetoothAdapter(); // 关闭蓝牙适配器
    },
  },
});