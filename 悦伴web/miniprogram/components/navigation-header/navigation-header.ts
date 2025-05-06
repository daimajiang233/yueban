interface IPageData {
    isScanning: boolean;
    status: string;
    deviceId: string;
    serviceId: string;
    characteristicId: string;
  }
  
  Component({
    data: {
      isScanning: false,
      status: '未开始扫描',
      deviceId: '',
      serviceId: '',
      characteristicId: ''
    } as IPageData,
  
    lifetimes: {
      // Use `attached` lifecycle instead of `onLoad`
      attached() {
        // Initialize Bluetooth adapter when component is added to the page
        this.initBluetooth();
        console.log('第一步加载初始化蓝牙');
      },
      detached() {
        // Stop scanning and close Bluetooth adapter when component is removed
        if (this.data.isScanning) {
          wx.stopBluetoothDevicesDiscovery();
        }
        wx.closeBluetoothAdapter();
      }
    },
  
    methods: {
      initBluetooth() {
        wx.openBluetoothAdapter({
          success: () => {
            this.setData({ status: '蓝牙适配器初始化成功' });
            console.log('蓝牙适配器初始化成功');
  
            // Start listening for device discovery
            wx.onBluetoothDeviceFound((res) => {
              res.devices.forEach((device) => {
                console.log(device.name);
  
                if (device.name === 'AW31N_1YUE BAN' || device.localName === 'AW31N_1YUE BAN') {
                  this.setData({ status: `发现设备: ${device.name}` });
                  console.log(`发现设备: ${device.name}`);
  
                  this.connectToDevice(device.deviceId);
                  wx.stopBluetoothDevicesDiscovery();
                  this.setData({ isScanning: false });
                }
              });
            });
          },
          fail: (res) => {
            console.error('Bluetooth adapter initialization failed:', res.errMsg);
            this.setData({ status: `蓝牙适配器初始化失败: ${res.errMsg}` });
          }
        });
      },
  
      toggleScan() {
        if (this.data.isScanning) {
          wx.stopBluetoothDevicesDiscovery({
            success: () => {
              this.setData({ isScanning: false, status: '已停止扫描' });
            },
            fail: (res) => {
              this.setData({ status: `停止扫描失败: ${res.errMsg}` });
            }
          });
        } else {
          wx.getBluetoothAdapterState({
            success: (res) => {
              if (res.available) {
                wx.startBluetoothDevicesDiscovery({
                  services: [], // Add specific service UUIDs if known
                  success: () => {
                    this.setData({ isScanning: true, status: '正在扫描设备...' });
                  },
                  fail: (res) => {
                    this.setData({ status: `启动扫描失败: ${res.errMsg}` });
                  }
                });
              } else {
                this.setData({ status: '蓝牙不可用，请检查蓝牙状态' });
              }
            },
            fail: (res) => {
              this.setData({ status: `获取蓝牙状态失败: ${res.errMsg}` });
            }
          });
        }
      },
  
      connectToDevice(deviceId: string) {
        wx.createBLEConnection({
          deviceId,
          success: () => {
            this.setData({ deviceId, status: '连接成功' });
            console.log('连接成功');
  
            this.getBLEServices();
          },
          fail: (res) => {
            this.setData({ status: `连接失败: ${res.errMsg}` });
          }
        });
      },
  
      getBLEServices() {
        wx.getBLEDeviceServices({
          deviceId: this.data.deviceId,
          success: (res) => {
            console.log('Services:', res.services); // Log for debugging
            for (const service of res.services) {
              this.setData({ serviceId: service.uuid });
              this.getBLECharacteristics();
              break; // Use the first service; modify if specific service is needed
            }
            if (!res.services.length) {
              this.setData({ status: '未找到服务' });
            }
          },
          fail: (res) => {
            this.setData({ status: `获取服务失败: ${res.errMsg}` });
          }
        });
      },
  
      getBLECharacteristics() {
        wx.getBLEDeviceCharacteristics({
          deviceId: this.data.deviceId,
          serviceId: this.data.serviceId,
          success: (res) => {
            console.log('Characteristics:', res.characteristics); // Log for debugging
            for (const char of res.characteristics) {
              if (char.properties.write || char.properties.writeNoResponse) {
                this.setData({ characteristicId: char.uuid });
                this.sendCommand();
                return;
              }
            }
            this.setData({ status: '未找到可写特征值' });
          },
          fail: (res) => {
            this.setData({ status: `获取特征值失败: ${res.errMsg}` });
          }
        });
      },
  
      sendCommand() {
        const buffer = new ArrayBuffer(2);
        const dataView = new DataView(buffer);
        dataView.setUint16(0, 0xfff, false); // Send 0xfff as 16-bit value, big-endian
        wx.writeBLECharacteristicValue({
          deviceId: this.data.deviceId,
          serviceId: this.data.serviceId,
          characteristicId: this.data.characteristicId,
          value: buffer,
          success: () => {
            this.setData({ status: '指令发送成功' });
            console.log('指令发送成功');
          },
          fail: (res) => {
            this.setData({ status: `指令发送失败: ${res.errMsg}` });
          }
        });
      }
    }
  });