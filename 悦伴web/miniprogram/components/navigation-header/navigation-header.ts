import BluetoothManager from '../../utils/bluetooth';

Component({
  // 组件的属性列表
  properties: {
    // 示例：是否自动初始化蓝牙
    autoInit: {
      type: Boolean,
      value: true
    }
  },

  // 组件的初始数据
  data: {
    status: '',
    isScanning: false,
    deviceList: [],
    deviceId: '',
    serviceId: '',
    characteristicId: '',
    receivedData: ''
  },

  // 组件的生命周期
  lifetimes: {
    // 组件被创建时
    created() {
      // 初始化 BluetoothManager
      this.bluetoothManager = new BluetoothManager(this.setData.bind(this));
    },
    // 组件被添加到页面时
    attached() {
      if (this.data.autoInit && this.bluetoothManager) {
        // 自动初始化蓝牙适配器
        this.bluetoothManager.initBluetoothAdapter();

      }
    //   if(this.data.characteristicId){
        // this.getGlobalUserInfo()
    //   }
    },
    // 组件被移除时
    detached() {
      if (this.bluetoothManager) {
        // 关闭蓝牙连接
        this.bluetoothManager.closeBLEConnection();
        // 关闭蓝牙适配器
        this.bluetoothManager.closeBluetoothAdapter();
      }
    }
  },

  // 组件的内部方法
  methods: {
    // 切换扫描状态
    toggleScan() {
      if (this.bluetoothManager) {
        this.bluetoothManager.toggleScan();
      }
      setTimeout(() => {
        this.sendData(0xF6) 
    }, 2000)
    },

    // 传递全局数据
    // getGlobalUserInfo() {
    //     const app = getApp();
    //     const userInfo = app.getGlobalUserInfo();
    //     console.log('Global userInfo:', userInfo);
    //     const newUserInfo: UserInfo = {
    //         name: userInfo.name,
    //         status: true,
    //         isScanning: true,
    //         deviceId: this.data.deviceId,
    //         serviceId: this.data.serviceId,
    //         characteristicId: this.data.characteristicId
    //     };
    //     app.setGlobalUserInfo(newUserInfo);

    //     const updatedUserInfo = app.getGlobalUserInfo();
    //     console.log('Updated global userInfo:', updatedUserInfo);
        
    //   },

    // 处理连接设备事件
    handleConnectDevice(e: WechatMiniprogram.TouchEvent) {
      if (this.bluetoothManager) {
        this.bluetoothManager.handleConnectDevice(e);
      }
    },

    // 手动初始化蓝牙（供外部调用）
    initBluetooth() {
      if (this.bluetoothManager) {
        this.bluetoothManager.initBluetoothAdapter();
      }
    },

    // 示例：发送数据（供外部调用）
    sendData(value: string) {
      if (this.bluetoothManager && this.data.deviceId && this.data.serviceId && this.data.characteristicId) {
        this.bluetoothManager.writeBLECharacteristicValue(
          this.data.deviceId,
          this.data.serviceId,
          this.data.characteristicId,
          value
        );
      }
    }
  },

  // 组件的内部属性
  bluetoothManager: null as BluetoothManager | null
});