/**
 * 蓝牙服务单例 — 唯一蓝牙入口
 *
 * 功能：
 * 1. connect()         — 扫描并连接目标设备（已连接则直接返回 true）
 * 2. sendData(hex)     — 发送蓝牙数据，未连接时自动触发连接
 * 3. ensureConnected() — 确保已连接（用于创建房间等场景）
 * 4. 心跳检测          — 每 3 秒检测连接状态，断开后仅重连一次
 * 5. disconnect()      — 主动断开并清理
 */

interface BLEStatus {
  isConnected: boolean;
  deviceId: string;
  serviceId: string;
  writeCharacteristicId: string;
  notifyCharacteristicId: string;
  statusText: string;
}

type StatusCallback = (status: BLEStatus) => void;

class BLEService {
  private _isConnected = false;
  private _deviceId = "";
  private _serviceId = "";
  private _writeCharId = "";
  private _notifyCharId = "";
  private _statusText = "未连接";
  private _adapterReady = false;
  private _connecting = false;
  private _lastConnected = false;
  private _reconnecting = false;
  private _connListenerAttached = false;

  private _targetName = "YUE BAN";
  private _targetServiceUuid = "0000AF30-0000-1000-8000-00805F9B34FB";

  private _heartTimer: any = null;
  private _reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 1;

  private _listeners: StatusCallback[] = [];

  // ========== 公开属性 ==========

  get status(): BLEStatus {
    return {
      isConnected: this._isConnected,
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      writeCharacteristicId: this._writeCharId,
      notifyCharacteristicId: this._notifyCharId,
      statusText: this._statusText,
    };
  }

  get isConnected() { return this._isConnected; }
  get deviceId() { return this._deviceId; }
  get serviceId() { return this._serviceId; }
  get writeCharacteristicId() { return this._writeCharId; }
  get notifyCharacteristicId() { return this._notifyCharId; }

  onStatusChange(cb: StatusCallback): () => void {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(c => c !== cb); };
  }

  private _notify() {
    const s = this.status;
    this._listeners.forEach(cb => { try { cb(s); } catch (e) {} });
    this._syncGlobalData();
  }

  private _setStatus(t: string) {
    this._statusText = t;
    this._notify();
  }

  private _syncGlobalData() {
    try {
      const app = getApp();
      if (app?.globalData?.userInfo) {
        app.globalData.userInfo.status = this._isConnected;
        app.globalData.userInfo.isScanning = this._isConnected;
        app.globalData.userInfo.deviceId = this._deviceId;
        app.globalData.userInfo.serviceId = this._serviceId;
        app.globalData.userInfo.writeCharacteristicId = this._writeCharId;
        app.globalData.userInfo.notifyCharacteristicId = this._notifyCharId;
      }
    } catch (e) {}
  }

  // ========== 连接 ==========

  /**
   * 扫描并连接目标设备（已连接直接返回 true）
   */
  async connect(): Promise<boolean> {
    if (this._isConnected) return true;
    if (this._connecting) return false;

    this._connecting = true;
    this._setStatus("正在连接...");

    try {
      await this._initAdapter();
      await this._stopDiscovery().catch(() => {});
      await this._startDiscovery();
      const deviceId = await this._findDevice();
      this._deviceId = deviceId;
      await this._stopDiscovery().catch(() => {});
      await this._createConn(deviceId);
      await this._getServices(deviceId);
      await this._getChars(deviceId, this._serviceId);
      this._listenConnChange();

      this._isConnected = true;
      this._lastConnected = true;
      this._reconnectAttempts = 0;
      this._connecting = false;
      this._setStatus("连接成功");
      this._startHeartbeat();
      wx.showToast({ title: "连接成功", icon: "success", duration: 1500 });
      return true;
    } catch (err) {
      console.error("BLE connect failed:", err);
      this._isConnected = false;
      this._lastConnected = false;
      this._connecting = false;
      this._setStatus("连接失败");
      this._closeAdapter().catch(() => {});
      wx.showToast({ title: "连接失败", icon: "none", duration: 1500 });
      return false;
    }
  }

  async ensureConnected(): Promise<boolean> {
    if (this._isConnected) return true;
    this._setStatus("未连接，正在自动连接...");
    return await this.connect();
  }

  async disconnect() {
    this._stopHeartbeat();
    this._reconnecting = false;
    this._reconnectAttempts = 0;
    if (!this._deviceId) {
      this._reset();
      this._setStatus("已断开连接");
      return;
    }
    try {
      await new Promise<void>(r => {
        wx.closeBLEConnection({ deviceId: this._deviceId, success: () => r(), fail: () => r() });
      });
    } catch (e) {}
    this._reset();
    this._closeAdapter().catch(() => {});
    this._setStatus("已断开连接");
  }

  private _reset() {
    this._isConnected = false;
    this._lastConnected = false;
    this._deviceId = "";
    this._serviceId = "";
    this._writeCharId = "";
    this._notifyCharId = "";
    this._adapterReady = false;
    this._connListenerAttached = false;
  }

  // ========== 发送数据 ==========

  async sendData(hexValue: string): Promise<boolean> {
    if (!this._isConnected) {
      this._setStatus("未连接，正在自动连接...");
      const ok = await this.connect();
      if (!ok) {
        wx.showToast({ title: "蓝牙未连接", icon: "none", duration: 2000 });
        throw new Error("蓝牙未连接");
      }
    }

    return new Promise<boolean>((resolve, reject) => {
      const val = parseInt(hexValue, 16);
      const buf = new ArrayBuffer(2);
      new DataView(buf).setUint16(0, val, true);

      wx.writeBLECharacteristicValue({
        deviceId: this._deviceId,
        serviceId: this._serviceId,
        characteristicId: this._writeCharId,
        value: buf,
        success: () => { console.log("BLE send OK:", hexValue); resolve(true); },
        fail: (res) => {
          console.error("BLE send fail:", res);
          this._isConnected = false;
          this._setStatus("发送失败");
          this._notify();
          reject(false);
        },
      });
    });
  }

  // ========== 心跳（断连后仅重连一次）==========

  private _startHeartbeat() {
    this._stopHeartbeat();
    this._reconnectAttempts = 0;

    this._heartTimer = setInterval(() => {
      if (!this._deviceId || !this._adapterReady) return;

      wx.getConnectedBluetoothDevices({
        services: [this._targetServiceUuid],
        success: (res) => {
          const found = res.devices.some(d => d.deviceId === this._deviceId);
          if (found) {
            if (!this._isConnected) {
              this._isConnected = true;
              this._lastConnected = true;
              this._reconnectAttempts = 0;
              this._setStatus("连接正常");
            }
          } else {
            if (this._lastConnected) {
              this._lastConnected = false;
              this._isConnected = false;
              this._setStatus("连接已断开，正在重连...");
              this._notify();
              this._stopHeartbeat();
              this._tryReconnectOnce();
            }
          }
        },
        fail: () => {
          if (this._lastConnected) {
            this._lastConnected = false;
            this._isConnected = false;
            this._setStatus("蓝牙异常断开");
            this._notify();
            this._stopHeartbeat();
            this._tryReconnectOnce();
          }
        },
      });
    }, 3000);
  }

  private _stopHeartbeat() {
    if (this._heartTimer) {
      clearInterval(this._heartTimer);
      this._heartTimer = null;
    }
  }

  /**
   * 断连后重连一次：先尝试直接重连已知 deviceId，失败了再走扫描
   */
  private async _tryReconnectOnce() {
    if (this._reconnecting) return;
    if (this._reconnectAttempts >= this.MAX_RECONNECT) {
      this._setStatus("重连失败，请手动连接");
      this._notify();
      return;
    }

    this._reconnecting = true;
    this._reconnectAttempts++;
    this._setStatus("正在重连...");

    const savedDeviceId = this._deviceId;

    try {
      // 第一步：关闭旧连接，重新初始化适配器
      await this._closeAdapter().catch(() => {});
      this._connListenerAttached = false;
      this._isConnected = false;
      await new Promise(r => setTimeout(r, 500));
      await this._initAdapter();
      await new Promise(r => setTimeout(r, 300));

      // 第二步：尝试直接重连已知设备（跳过扫描，最快路径）
      let connected = false;
      try {
        await this._createConn(savedDeviceId);
        this._deviceId = savedDeviceId;
        await this._getServices(savedDeviceId);
        await this._getChars(savedDeviceId, this._serviceId);
        connected = true;
        console.log("BLE direct reconnect OK");
      } catch (directErr) {
        console.warn("BLE direct reconnect failed, falling back to scan:", directErr);
      }

      // 第三步：直接重连失败，走扫描流程
      if (!connected) {
        await this._stopDiscovery().catch(() => {});
        await this._startDiscovery();
        const deviceId = await this._findDevice();
        this._deviceId = deviceId;
        await this._stopDiscovery().catch(() => {});
        await this._createConn(deviceId);
        await this._getServices(deviceId);
        await this._getChars(deviceId, this._serviceId);
        console.log("BLE scan reconnect OK");
      }

      this._listenConnChange();
      this._isConnected = true;
      this._lastConnected = true;
      this._reconnecting = false;
      this._reconnectAttempts = 0;
      this._setStatus("重连成功");
      this._notify();
      this._startHeartbeat();
      wx.showToast({ title: "重连成功", icon: "success", duration: 1500 });
    } catch (err) {
      console.error("BLE reconnect failed:", err);
      this._isConnected = false;
      this._lastConnected = false;
      this._reconnecting = false;
      this._setStatus("重连失败，请手动连接");
      this._notify();
      this._closeAdapter().catch(() => {});
    }
  }

  // ========== 底层 wx 封装 ==========

  private _initAdapter(): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: () => { this._adapterReady = true; resolve(); },
        fail: (err) => {
          this._adapterReady = false;
          wx.showModal({ title: "提示", content: "请开启蓝牙功能", showCancel: false });
          reject(err);
        },
      });
    });
  }

  private _closeAdapter(): Promise<void> {
    return new Promise(resolve => {
      wx.closeBluetoothAdapter({
        success: () => { this._adapterReady = false; resolve(); },
        fail: () => resolve(),
      });
    });
  }

  private _startDiscovery(): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.startBluetoothDevicesDiscovery({
        services: [this._targetServiceUuid],
        allowDuplicatesKey: false,
        success: () => resolve(),
        fail: err => reject(err),
      });
    });
  }

  private _stopDiscovery(): Promise<void> {
    return new Promise(resolve => {
      wx.stopBluetoothDevicesDiscovery({ success: () => resolve(), fail: () => resolve() });
    });
  }

  private _findDevice(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        wx.offBluetoothDeviceFound();
        reject(new Error("扫描超时"));
      }, 10000);

      wx.onBluetoothDeviceFound(res => {
        for (const d of res.devices) {
          const name = d.name || d.localName || "";
          if (name === this._targetName) {
            clearTimeout(timer);
            wx.offBluetoothDeviceFound();
            resolve(d.deviceId);
            return;
          }
        }
      });
    });
  }

  private _createConn(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({ deviceId, timeout: 10000, success: () => resolve(), fail: err => reject(err) });
    });
  }

  private _getServices(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId,
        success: res => {
          if (res.services.length === 0) { reject(new Error("无服务")); return; }
          const p = res.services.find(s => s.isPrimary) || res.services[0];
          this._serviceId = p.uuid;
          resolve();
        },
        fail: err => reject(err),
      });
    });
  }

  private _getChars(deviceId: string, serviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: res => {
          const notify = res.characteristics.find(c => c.properties.notify);
          const write = res.characteristics.find(c => c.properties.write && c.properties.read);
          if (notify) this._notifyCharId = notify.uuid;
          if (write) this._writeCharId = write.uuid;
          if (!notify && !write) { reject(new Error("无特征值")); return; }
          resolve();
        },
        fail: err => reject(err),
      });
    });
  }

  private _listenConnChange() {
    if (this._connListenerAttached) return;
    this._connListenerAttached = true;

    wx.onBLEConnectionStateChange(res => {
      if (res.deviceId !== this._deviceId) return;
      if (res.connected) {
        this._isConnected = true;
        this._lastConnected = true;
        this._reconnectAttempts = 0;
        this._setStatus("连接正常");
      } else {
        this._isConnected = false;
        this._setStatus("连接已断开");
        this._notify();
      }
    });
  }
}

const bleService = new BLEService();
export default bleService;
