// 蓝牙搜索接收广播数据
interface BluetoothDevice {
    name?: string;
    deviceId: string;
    RSSI?: number;
    advertisData?: ArrayBuffer;
    localName?: string;
    serviceData?: Record<string, ArrayBuffer>;
  }
  
  interface TargetDevice {
    name: string;
    deviceId: string;
    rssi?: number;
    advertisData?: string;
    foundTime: string;
  }
  
  // pages/bluetooth-scan.ts
  Page({
    data: {
      isScanning: false,
      targetDevice: null as TargetDevice | null,
      log: ''
    },
  
    // 开始/停止扫描
    toggleScan() {
      if (this.data.isScanning) {
        this.stopScanning();
      } else {
        this.startScanning();
      }
    },
  
    // 开始扫描
    startScanning() {
      this.addLog('正在初始化蓝牙适配器...');
      
      wx.openBluetoothAdapter({
        success: () => {
          this.addLog('蓝牙适配器初始化成功');
          this.startDiscovery();
        },
        fail: (res) => {
          this.addLog(`初始化失败: ${JSON.stringify(res)}`);
          wx.showToast({ 
            title: '请打开手机蓝牙并授权', 
            icon: 'none' 
          });
        }
      });
  
      this.setData({ isScanning: true, targetDevice: null });
    },
  
    // 开始设备发现
    startDiscovery() {
      this.addLog('开始扫描TTTTT设备...');
      
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false, // 不重复上报同一设备
        success: () => {
          this.addLog('扫描启动成功');
          this.listenForTargetDevice();
        },
        fail: (res) => {
          this.addLog(`扫描启动失败: ${JSON.stringify(res)}`);
          wx.showToast({ title: '扫描失败', icon: 'none' });
        }
      });
    },
  
    // 监听目标设备
    listenForTargetDevice() {
      const listener = (res: WechatMiniprogram.OnBluetoothDeviceFoundCallbackResult) => {
        res.devices.forEach((device: BluetoothDevice) => {
          if (!device.name) return;
          
          this.addLog(`发现设备: ${device.name}, RSSI: ${device.RSSI}`);
          
          // 检查是否为TTTTT设备
          if (device.name.toUpperCase() === "TTTTT") {
            this.addLog('>>>> 找到目标TTTTT设备 <<<<');
            console.log(device.advertisData);
            
            // 保存设备信息
            const target: TargetDevice = {
              name: device.name,
              deviceId: device.deviceId,
              rssi: device.RSSI,
              advertisData: device.advertisData ? this.ab2hex(device.advertisData) : '无广播数据',
              foundTime: new Date().toLocaleTimeString()
            };
            console.log(target);
            
            
            this.setData({ targetDevice: target });
            
            // 停止扫描
            this.stopScanning();
            
            // 移除监听
            wx.offBluetoothDeviceFound(listener);
            
            wx.showToast({
              title: '已找到TTTTT设备',
              icon: 'success'
            });
          }
        });
      };
      
      wx.onBluetoothDeviceFound(listener);
    },
  
    // 停止扫描
    stopScanning() {
      wx.stopBluetoothDevicesDiscovery({
        success: () => {
          this.addLog('已停止扫描');
        }
      });
      
      this.setData({ isScanning: false });
    },
  
    // ArrayBuffer转16进制
    ab2hex(buffer: ArrayBuffer): string {
      return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
    },
    
    // 添加日志
    addLog(msg: string) {
      console.log(msg);
      this.setData({
        log: `${this.data.log}\n${new Date().toLocaleTimeString()}: ${msg}`
      });
    },
  
    // 页面卸载时清理
    onUnload() {
      if (this.data.isScanning) {
        this.stopScanning();
      }
    }
  });