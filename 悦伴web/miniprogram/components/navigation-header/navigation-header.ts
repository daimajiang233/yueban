interface BluetoothDevice {
    name?: string;
    deviceId: string;
    RSSI?: number;
    advertisData?: ArrayBuffer;
    localName?: string;
    serviceData?: Record<string, ArrayBuffer>;
    advertisServiceUUIDs?: string[];
  }
  
  interface TargetDevice {
    name: string;
    deviceId: string;
    uuid: string;
    rssi?: number;
    advertisData?: string;
    foundTime: string;
    sentData?: string;
    serviceId?: string;
    characteristicId?: string;
  }
  
  Page({
    data: {
      isScanning: false,
      targetDevice: null as TargetDevice | null,
      log: '',
      status: 'idle' as 'idle' | 'scanning' | 'connected' | 'sending',
    },
  
    toggleScan() {
      if (this.data.status === 'scanning') {
        this.stopScanning();
      } else {
        this.startScanning();
      }
    },
  
    startScanning() {
      this.addLog('正在检查蓝牙权限...');
      wx.authorize({
        scope: 'scope.bluetooth',
        success: () => {
          this.addLog('蓝牙权限已授权');
          wx.getBluetoothAdapterState({
            success: (res: WechatMiniprogram.GetBluetoothAdapterStateSuccessCallbackResult) => {
              if (res.available) {
                this.addLog('蓝牙可用，初始化适配器...');
                wx.openBluetoothAdapter({
                  success: () => {
                    this.addLog('蓝牙适配器初始化成功');
                    this.setData({ status: 'scanning', isScanning: true, targetDevice: null });
                    this.startDiscovery();
                  },
                  fail: (res: WechatMiniprogram.GeneralCallbackResult) => {
                    this.handleError('初始化失败', res);
                    this.setData({ status: 'idle', isScanning: false });
                  },
                });
              } else {
                this.handleError('蓝牙不可用，请开启蓝牙', {});
                this.setData({ status: 'idle', isScanning: false });
              }
            },
            fail: (res: WechatMiniprogram.GeneralCallbackResult) => {
              this.handleError('检查蓝牙状态失败', res);
              this.setData({ status: 'idle', isScanning: false });
            },
          });
        },
        fail: () => {
          this.handleError('蓝牙权限未授权', {});
          wx.showModal({
            title: '提示',
            content: '请授权蓝牙权限以使用此功能',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            },
          });
          this.setData({ status: 'idle', isScanning: false });
        },
      });
    },
  
    startDiscovery() {
      this.addLog('开始扫描XHTKJ设备...');
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        success: () => {
          this.addLog('扫描启动成功');
          this.listenForTargetDevice();
        },
        fail: (res: WechatMiniprogram.GeneralCallbackResult) => {
          this.handleError('扫描启动失败', res);
          this.setData({ status: 'idle', isScanning: false });
        },
      });
    },
  
    listenForTargetDevice() {
      const listener = (res: WechatMiniprogram.OnBluetoothDeviceFoundCallbackResult) => {
        res.devices.forEach((device: BluetoothDevice) => {
          if (!device.name) return;
  
          this.addLog(`发现设备: ${device.name}, RSSI: ${device.RSSI}`, { deviceId: device.deviceId });
  
          if (device.name.toUpperCase() === 'XHTKJ') {
            this.addLog('>>>> 找到目标XHTKJ设备 <<<<', { deviceId: device.deviceId });
  
            const target: TargetDevice = {
              name: device.name,
              deviceId: device.deviceId,
              uuid: device.advertisServiceUUIDs?.[0] || '',
              rssi: device.RSSI,
              advertisData: device.advertisData ? this.ab2hex(device.advertisData) : '无广播数据',
              foundTime: new Date().toLocaleTimeString(),
              sentData: '58 58 AA BB',
            };
  
            if (!target.uuid) {
              this.addLog('目标设备无服务UUID，跳到广播数据处理', { deviceId: device.deviceId });
              this.stopScanning();
              wx.offBluetoothDeviceFound(listener);
              this.handleBroadcastData(target.advertisData);
              return;
            }
  
            this.setData({ targetDevice: target });
            this.stopScanning();
            wx.offBluetoothDeviceFound(listener);
  
            wx.showToast({ title: '已找到XHTKJ设备', icon: 'success' });
  
            this.connectToDevice(device.deviceId, target);
          }
        });
      };
  
      wx.onBluetoothDeviceFound(listener);
    },
  
    async connectToDevice(deviceId: string, target: TargetDevice) {
      try {
        this.addLog('尝试连接设备', { deviceId });
        await new Promise<void>((resolve, reject) => {
          wx.createBLEConnection({
            deviceId,
            success: () => resolve(),
            fail: (res) => reject(res),
          });
        });
        this.addLog('设备连接成功', { deviceId });
        console.log('设备连接成功', { deviceId });
        
        this.setData({ status: 'connected' });
  
        const servicesRes = await new Promise<WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult>(
          (resolve, reject) => {
            wx.getBLEDeviceServices({
              deviceId,
              success: resolve,
              fail: reject,
            });
          }
        );
        this.addLog('服务列表', { services: servicesRes.services });
  
        const service = servicesRes.services.find((s) => s.uuid.toUpperCase() === target.uuid.toUpperCase()) || servicesRes.services[0];
        if (!service) {
          throw new Error('未找到匹配的服务');
        }
        const serviceId = service.uuid;
        console.log(service.uuid,"service.uuid已获取");
        
        this.addLog('选择服务', { serviceId });
  
        const charRes = await new Promise<WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult>(
          (resolve, reject) => {
            wx.getBLEDeviceCharacteristics({
              deviceId,
              serviceId,
              success: resolve,
              fail: reject,
            });
          }
        );
        this.addLog('特征值列表', { characteristics: charRes.characteristics });
        console.log(charRes.characteristics,'特征值列表');
        
  
        const characteristic = charRes.characteristics.find(
          (c: WechatMiniprogram.BLECharacteristic) =>
            c.properties.write || c.properties.writeNoResponse || c.properties.notify
        );
        if (!characteristic) {
          throw new Error('未找到可写特征值');
        }
        this.addLog('找到可写特征值', { characteristicId: characteristic.uuid });
        console.log('找到可写特征值',characteristic.uuid);
        
  
        // 更新 targetDevice 数据并发送
        this.setData({
          targetDevice: {
            ...this.data.targetDevice!,
            serviceId,
            characteristicId: characteristic.uuid,
          },
        });
        await this.sendData(deviceId, serviceId, characteristic.uuid, target.sentData!);
      } catch (err) {
        this.handleError('连接或发送失败', err, { deviceId, targetUuid: target.uuid });
        this.handleBroadcastData(target.advertisData);
      }
    },
  
    async sendData(deviceId: string, serviceId: string, characteristicId: string, hexData: string) {
      try {
        this.setData({ status: 'sending' });
        const buffer = this.hexToArrayBuffer(hexData.replace(/\s/g, ''));
        const maxPacketSize = 20; // 微信小程序单次写入最大字节数
        const uint8Array = new Uint8Array(buffer);
        let offset = 0;
  
        // 检查特征值是否支持 notify
        const charRes = await new Promise<WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult>(
          (resolve, reject) => {
            wx.getBLEDeviceCharacteristics({
              deviceId,
              serviceId,
              success: resolve,
              fail: reject,
            });
          }
        );
        const characteristic = charRes.characteristics.find((c) => c.uuid === characteristicId);
        if (characteristic?.properties.notify) {
          await new Promise<void>((resolve, reject) => {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId,
              state: true,
              success: () => resolve(),
              fail: (res) => reject(res),
            });
          });
          this.addLog('启用通知成功', { characteristicId });
        }
  
        // 分包发送数据
        const sendPacket = async () => {
          const packetSize = Math.min(maxPacketSize, uint8Array.length - offset);
          if (packetSize <= 0) {
            this.addLog('数据发送完成', { hexData });
            wx.showToast({ title: '数据发送成功', icon: 'success' });
            this.setData({ status: 'connected' });
            return;
          }
  
          const packet = buffer.slice(offset, offset + packetSize);
          await new Promise<void>((resolve, reject) => {
            wx.writeBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId,
              value: packet,
              success: () => resolve(),
              fail: (res) => reject(res),
            });
          });
          offset += packetSize;
          await sendPacket();
        };
  
        await sendPacket();
      } catch (err) {
        this.handleError('数据发送失败', err, { deviceId, serviceId, characteristicId });
        this.setData({ status: 'connected' });
      }
    },
  
    handleBroadcastData(advertisData?: ArrayBuffer | string) {
      if (typeof advertisData === 'string') {
        this.addLog(`收到广播数据: ${advertisData}`);
      } else if (advertisData) {
        const receivedHex = this.ab2hex(advertisData);
        this.addLog(`收到广播数据: ${receivedHex}`);
        const uint8Array = new Uint8Array(advertisData);
        if (uint8Array.length >= 2 && uint8Array[0] === 0xFF) {
          const manufacturerData = receivedHex.slice(6);
          this.addLog(`厂商数据: ${manufacturerData}`);
        }
      } else {
        this.addLog('无广播数据');
      }
  
      const hexData = '5858AABB';
      const buffer = this.hexToArrayBuffer(hexData);
      const sentHex = this.ab2hex(buffer);
      this.addLog(`模拟发送数据: ${sentHex}`);
  
      if (this.data.targetDevice) {
        this.setData({
          targetDevice: { ...this.data.targetDevice, sentData: sentHex },
        });
      }
  
      wx.showModal({
        title: '发送准备完成',
        content: `已准备发送数据: ${sentHex}\n注：当前设备可能不支持连接，数据仅为模拟发送。`,
        showCancel: false,
        confirmText: '确定',
      });
  
      wx.setStorageSync('lastSentData', {
        data: sentHex,
        time: new Date().toLocaleString(),
      });
  
      this.setData({ status: 'idle' });
    },
  
    hexToArrayBuffer(hex: string): ArrayBuffer {
      const bytes = hex
        .replace(/\s/g, '')
        .match(/.{1,2}/g)
        ?.map((byte) => parseInt(byte, 16)) || [];
      const buffer = new ArrayBuffer(bytes.length);
      const uint8Array = new Uint8Array(buffer);
      uint8Array.set(bytes);
      return buffer;
    },
  
    stopScanning() {
      wx.stopBluetoothDevicesDiscovery({
        success: () => {
          this.addLog('已停止扫描');
        },
      });
      this.setData({ isScanning: false, status: 'idle' });
    },
  
    ab2hex(buffer: ArrayBuffer): string {
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
    },
  
    addLog(msg: string, context?: Record<string, any>) {
      const logMsg = context ? `${msg} [${JSON.stringify(context)}]` : msg;
      console.log(logMsg);
      this.setData({
        log: `${this.data.log}\n${new Date().toLocaleTimeString()}: ${logMsg}`,
      });
    },
  
    handleError(msg: string, err: WechatMiniprogram.GeneralCallbackResult | Error, context?: Record<string, any>) {
      const errorMsg = `${msg}: errCode=${(err as any).errCode || '未知'}, errMsg=${(err as any).errMsg || err.message || JSON.stringify(err)}`;
      this.addLog(errorMsg, context);
      wx.showToast({ title: msg, icon: 'none' });
    },
  
    onUnload() {
      if (this.data.isScanning) {
        this.stopScanning();
      }
      wx.closeBluetoothAdapter();
    },
  });