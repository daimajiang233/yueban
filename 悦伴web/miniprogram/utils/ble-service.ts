/**
 * 蓝牙服务 - 唯一入口
 *
 * 功能：
 * 1. connect()          扫描并连接目标设备，已连接则直接返回 true
 * 2. sendData(hex|num)  向设备发送数据，未连接时自动连接
 * 3. ensureConnected()  确保已连接，用于需要连接的操作前置
 * 4. 心跳检测           每 3 秒检测连接状态，断开后重连一次
 * 5. disconnect()       主动断开连接
 *
 * 重连策略：
 * - 心跳检测到断开 → 尝试重连一次（MAX_RECONNECT = 1）
 * - 重连成功后不立即归零计数器，由下一次心跳确认设备真正在线后归零
 * - 如果重连是"幽灵连接"（设备实际不在线），下次心跳检测到断开时计数器已为 1，阻止再次重连
 */

type StatusCallback = (status: BLEStatus) => void;

interface BLEStatus {
  isConnected: boolean;
  deviceId: string;
  serviceId: string;
  writeCharacteristicId: string;
  notifyCharacteristicId: string;
  statusText: string;
}

class BLEService {
  /* ========== 内部状态 ========== */
  private _connected = false;
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

  private _heartTimer: number | null = null;
  private _reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 1;
  private _connectPromise: Promise<boolean> | null = null;
  private _userInitiatedDisconnect = false;
  private _lastConnectionTime = 0;  // 记录建连时间戳，用于过滤过期断线事件

  private _writeListeners: (() => void)[] = [];
  private _writeQueue: Array<{ value: string | number; resolve: (v: boolean) => void; reject: (e: any) => void }> = [];
  private _writeBusy = false;

  /** BLE 写入成功时广播（供页面监听外部写入） */
  onBleWritten(cb: () => void): () => void {
    this._writeListeners.push(cb);
    return () => { this._writeListeners = this._writeListeners.filter(c => c !== cb); };
  }

  private _listeners: StatusCallback[] = [];

  /* ========== 公共属性 ========== */

  get status(): BLEStatus {
    return {
      isConnected: this._connected,
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      writeCharacteristicId: this._writeCharId,
      notifyCharacteristicId: this._notifyCharId,
      statusText: this._statusText,
    };
  }

  get isConnected() { return this._connected; }
  get deviceId() { return this._deviceId; }
  get serviceId() { return this._serviceId; }
  get writeCharacteristicId() { return this._writeCharId; }
  get notifyCharacteristicId() { return this._notifyCharId; }

  onStatusChange(cb: StatusCallback): () => void {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(c => c !== cb); };
  }

  /* ========== 内部辅助 ========== */

  /** 当前可见页面是否为首页（用于决定是否显示 loading/Toast） */
  private get _isHomePage(): boolean {
    try {
      const pages = getCurrentPages();
      if (pages.length === 0) return false;
      const current = pages[pages.length - 1];
      return current.route === 'pages/index/index';
    } catch {
      return false;
    }
  }

  private _notify() {
    const s = this.status;
    this._listeners.forEach(cb => { try { cb(s); } catch (e) {} });
    this._syncGlobalData();
  }

  private _setStatus(t: string) {
    this._statusText = t;
    console.log("[BLE]", t);
    this._notify();
  }

  /** 同步状态到 app.globalData.userInfo */
  private _syncGlobalData() {
    try {
      const app = getApp<IAppOption>();
      const ui = app.globalData.userInfo;
      const wasConnected = ui.isConnected;
      ui.status = this._connected;
      ui.isScanning = this._connected;
      ui.isConnected = this._connected;
      ui.deviceId = this._deviceId;
      ui.serviceId = this._serviceId;
      ui.writeCharacteristicId = this._writeCharId;
      ui.notifyCharacteristicId = this._notifyCharId;
    } catch (e) {}
  }

  /* ========== 连接管理 ========== */

  /**
   * 扫描并连接目标设备，已连接则直接返回 true。
   * 已有连接进行中时，等待现有连接完成（避免 race condition）。
   * 用户主动连接优先：如有心跳重连进行中会将其中断。
   */
  async connect(): Promise<boolean> {
    this._userInitiatedDisconnect = false;
    if (this._connected) {
      console.log("[BLE] connect: 已连接，跳过");
      return true;
    }
    if (this._connecting && this._connectPromise) {
      console.log("[BLE] connect: 正在连接中，等待现有连接完成");
      return await this._connectPromise;
    }
    if (this._connecting) {
      console.log("[BLE] connect: 正在连接中，跳过重复调用");
      return false;
    }

    // 用户主动连接优先：中断心跳重连
    if (this._reconnecting) {
      console.log("[BLE] connect: 中断心跳重连，用户主动连接优先");
      this._stopHeartbeat();
      this._reconnecting = false;
      this._reconnectAttempts = 0;
      // 关闭适配器清除心跳重连的中间状态
      await this._closeAdapter().catch(() => {});
      this._connListenerAttached = false;
      this._connected = false;
    }

    this._connecting = true;
    this._connectPromise = (async (): Promise<boolean> => {
      // 仅在首页可见时显示 loading
      if (this._isHomePage) {
        wx.showLoading({ title: "连接蓝牙...", mask: true });
      }
      console.log("[BLE] 步骤1: 开始连接流程");

      try {
        console.log("[BLE] 步骤2: 初始化蓝牙适配器");
        await this._initAdapter();

        console.log("[BLE] 步骤3: 开始扫描设备");
        await this._stopDiscovery().catch(() => {});
        await this._startDiscovery();

        console.log("[BLE] 步骤4: 查找目标设备 YUE BAN");
        const deviceId = await this._findDevice();
        this._deviceId = deviceId;
        console.log("[BLE] 步骤5: 找到设备, deviceId =", deviceId);

        await this._stopDiscovery().catch(() => {});
        console.log("[BLE] 步骤6: 建立 BLE 连接");
        await this._createConn(deviceId);

        console.log("[BLE] 步骤7: 获取服务列表");
        await this._getServices(deviceId);
        console.log("[BLE] 步骤8: 获取特征值, serviceId =", this._serviceId);
        await this._getChars(deviceId, this._serviceId);
        console.log("[BLE] 步骤9: 注册连接状态监听");
        this._listenConnChange();

        this._connected = true;
        this._lastConnected = true;
        this._lastConnectionTime = Date.now();
        this._reconnectAttempts = 0;
        this._connecting = false;
        if (this._isHomePage) {
          wx.hideLoading();
          wx.showToast({ title: "连接成功", icon: "success", duration: 1500 });
        }
        console.log("[BLE] 步骤10: 连接完成, writeChar =", this._writeCharId, "notifyChar =", this._notifyCharId);
        this._setStatus("连接成功");
        this._startHeartbeat();
        return true;
      } catch (err) {
        console.error("[BLE] 连接失败:", err);
        this._connected = false;
        this._lastConnected = false;
        this._connecting = false;
        if (this._isHomePage) {
          wx.hideLoading();
          wx.showToast({ title: "连接失败", icon: "none", duration: 1500 });
        }
        this._setStatus("连接失败");
        this._closeAdapter().catch(() => {});
        return false;
      }
    })();

    const result = await this._connectPromise;
    this._connectPromise = null;
    return result;
  }

  /** 确保已连接，未连接时自动连接 */
  async ensureConnected(): Promise<boolean> {
    if (this._connected) return true;
    console.log("[BLE] ensureConnected: 未连接，触发自动连接");
    return await this.connect();
  }

  /** 主动断开并清理 */
  async disconnect() {
    console.log("[BLE] disconnect: 主动断开");
    this._userInitiatedDisconnect = true;
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
    this._connected = false;
    this._lastConnected = false;
    this._deviceId = "";
    this._serviceId = "";
    this._writeCharId = "";
    this._notifyCharId = "";
    this._adapterReady = false;
    this._connListenerAttached = false;
  }

  /* ========== 数据发送 ========== */

  /**
   * 向 BLE 设备发送数据（写入队列，串行执行）
   * @param value - 十六进制字符串（如 "0xF1"）或原始数字
   */
  async sendData(value: string | number): Promise<boolean> {
    if (!this._connected) {
      console.log("[BLE] sendData: 未连接，触发自动连接后发送 value =", value);
      const ok = await this.connect();
      if (!ok) {
        // wx.showToast({ title: "蓝牙未连接", icon: "none", duration: 2000 });
        throw new Error("蓝牙未连接");
      }
      console.log("[BLE] sendData: 自动连接成功，继续发送");
    }

    return new Promise<boolean>((resolve, reject) => {
      this._writeQueue.push({ value, resolve, reject });
      this._processWriteQueue();
    });
  }

  private _processWriteQueue() {
    if (this._writeBusy) return;
    if (this._writeQueue.length === 0) return;

    // 连接断开或写特征值丢失：清空队列，重置写忙标志
    if (!this._connected || !this._writeCharId) {
      this._writeBusy = false;
      const pending = this._writeQueue.splice(0);
      pending.forEach(p => p.reject(false));
      return;
    }

    const item = this._writeQueue.shift()!;
    this._writeBusy = true;

    const num = typeof item.value === "string" ? parseInt(item.value, 16) : item.value;
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, num, true);

    console.log("[BLE] sendData: 写入数据 value =", item.value, "num =", num);
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._writeCharId,
      value: buf,
      success: () => {
        console.log("[BLE] sendData: 写入成功");
        try {
          const app = getApp<IAppOption>();
          app.globalData.userInfo.bleWriteSeq++;
          console.log("[BLE] sendData: bleWriteSeq =", app.globalData.userInfo.bleWriteSeq);
        } catch(e) {}
        this._writeListeners.forEach(cb => { try { cb(); } catch(e) {} });
        item.resolve(true);
        this._writeBusy = false;
        this._processWriteQueue();
      },
      fail: (res) => {
        console.error("[BLE] sendData: 写入失败", res);
        this._connected = false;
        this._setStatus("写入失败");
        item.reject(false);
        this._writeBusy = false;
        // 写入失败时连接状态已坏，清空剩余队列
        const pending = this._writeQueue.splice(0);
        pending.forEach(p => p.reject(false));
      },
    });
  }

  /* ========== 心跳与重连 ========== */

  private _startHeartbeat() {
    this._stopHeartbeat();
    console.log("[BLE] 心跳: 启动 (每1.5秒)");

    this._heartTimer = setInterval(() => {
      if (!this._deviceId || !this._adapterReady) return;

      const checkServiceId = this._serviceId || this._targetServiceUuid;

      wx.getConnectedBluetoothDevices({
        services: [checkServiceId],
        success: (res) => {
          const found = res.devices.some(d => d.deviceId === this._deviceId);
          if (found) {
            // 仅当不在主动连接流程中时，心跳才标记为已连接
            // 否则让 connect() 完成整个流程后自行标记，避免写特征值未就绪
            if (!this._connected && !this._connecting) {
              console.log("[BLE] 心跳: 设备恢复在线");
              this._connected = true;
              this._lastConnected = true;
              this._reconnectAttempts = 0;
              this._setStatus("连接正常");
            }
          } else {
            if (this._lastConnected && !this._reconnecting) {
              console.log("[BLE] 心跳: 设备已断开");
              this._lastConnected = false;
              this._connected = false;
              this._startDisconnectRecovery();
            }
          }
        },
        fail: () => {
          if (this._lastConnected && !this._reconnecting) {
            console.log("[BLE] 心跳: getConnectedBluetoothDevices 调用失败");
            this._lastConnected = false;
            this._connected = false;
            this._startDisconnectRecovery();
          }
        },
      });
    }, 1500);
  }

  private _stopHeartbeat() {
    if (this._heartTimer) {
      console.log("[BLE] 心跳: 停止");
      clearInterval(this._heartTimer);
      this._heartTimer = null;
    }
  }

  private _startDisconnectRecovery() {
    console.log("[BLE] 断开恢复: 开始");
    if (this._userInitiatedDisconnect) {
      console.log("[BLE] 断开恢复: 用户主动断开，跳过重连");
      return;
    }
    this._setStatus("设备已断开，尝试重连...");
    this._stopHeartbeat();
    this._tryReconnectOnce();
  }

  /**
   * 断开后重连一次：先直连已知 deviceId，失败则重新扫描
   */
  private async _tryReconnectOnce() {
    if (this._reconnecting) {
      console.log("[BLE] 重连: 已有重连进行中，跳过");
      return;
    }
    if (this._reconnectAttempts >= this.MAX_RECONNECT) {
      console.log("[BLE] 重连: 已达最大次数 (", this.MAX_RECONNECT, ")，放弃");
      this._setStatus("重连失败，请手动连接");
      return;
    }

    // 如果已有 connect() 在进行中（如用户点击按钮触发），等待它完成
    if (this._connecting && this._connectPromise) {
      console.log("[BLE] 重连: connect 已在执行，等待完成");
      this._reconnecting = true;
      const connectResult = await this._connectPromise;
      this._reconnecting = false;
      if (connectResult) {
        // connect 成功了，无需重连
        return;
      }
      // connect 失败了，继续执行重连逻辑
      console.log("[BLE] 重连: connect 失败，继续尝试重连");
      // 注意：不 return，接续往下执行重连流程
    }

    // 再次确认：如果此时已经 connected（用户 connect() 在上面的检查窗口之后恢复了连接），
    // 则跳过重连，避免重复建连
    if (this._connected) {
      console.log("[BLE] 重连: 设备已恢复连接，跳过重连");
      this._reconnecting = false;
      this._reconnectAttempts = 0;
      return;
    }

    this._reconnecting = true;
    this._reconnectAttempts++;
    // 仅在首页可见时显示 loading
    if (this._isHomePage) {
      wx.showLoading({ title: "重新连接...", mask: true });
    }
    console.log("[BLE] 重连: 第", this._reconnectAttempts, "次尝试");
    this._setStatus("正在重连...");

    const savedDeviceId = this._deviceId;

    try {
      console.log("[BLE] 重连: 关闭旧适配器");
      await this._closeAdapter().catch(() => {});
      this._connListenerAttached = false;
      this._connected = false;
      await new Promise(r => setTimeout(r, 500));
      console.log("[BLE] 重连: 重新初始化适配器");
      await this._initAdapter();
      await new Promise(r => setTimeout(r, 300));

      // 尝试直连已知设备
      let connected = false;
      try {
        console.log("[BLE] 重连: 尝试直连 deviceId =", savedDeviceId);
        await this._createConn(savedDeviceId);
        // 等待 BLE 服务发现完成（避免 Android GATT 缓存返回不完整数据）
        await new Promise(r => setTimeout(r, 300));
        this._deviceId = savedDeviceId;
        await this._getServices(savedDeviceId);
        await this._getChars(savedDeviceId, this._serviceId);
        // 验证写特征值确实获取到了（直连可能走缓存导致属性不全）
        if (!this._writeCharId) {
          throw new Error("直连后写特征值为空，回退扫描");
        }
        connected = true;
        console.log("[BLE] 重连: 直连成功");
      } catch (_directErr) {
        console.warn("[BLE] 重连: 直连失败，回退到扫描模式", _directErr);
      }

      // 直连失败则扫描重连
      if (!connected) {
        console.log("[BLE] 重连: 开始扫描");
        await this._stopDiscovery().catch(() => {});
        await this._startDiscovery();
        const deviceId = await this._findDevice();
        this._deviceId = deviceId;
        await this._stopDiscovery().catch(() => {});
        console.log("[BLE] 重连: 扫描找到设备, deviceId =", deviceId);
        await this._createConn(deviceId);
        await this._getServices(deviceId);
        await this._getChars(deviceId, this._serviceId);
        console.log("[BLE] 重连: 扫描重连成功");
      }

      this._listenConnChange();
      this._connected = true;
      this._lastConnected = true;
      this._lastConnectionTime = Date.now();
      this._reconnecting = false;
      if (this._isHomePage) {
        wx.hideLoading();
        wx.showToast({ title: "重连成功", icon: "success", duration: 1500 });
      }
      console.log("[BLE] 重连: 完成");
      this._setStatus("重连成功");
      this._startHeartbeat();
    } catch (err) {
      console.error("[BLE] 重连: 失败", err);
      this._connected = false;
      this._lastConnected = false;
      this._reconnecting = false;
      if (this._isHomePage) {
        wx.hideLoading();
      }
      this._setStatus("重连失败，请手动连接");
      this._closeAdapter().catch(() => {});
    }
  }

  /* ========== 底层 wx API 封装 ========== */

  private _initAdapter(): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: () => { this._adapterReady = true; console.log("[BLE] 适配器初始化成功"); resolve(); },
        fail: (err) => {
          this._adapterReady = false;
          console.error("[BLE] 适配器初始化失败:", err);
          wx.showModal({ title: "提示", content: "请开启蓝牙功能", showCancel: false });
          reject(err);
        },
      });
    });
  }

  private _closeAdapter(): Promise<void> {
    // 适配器关闭后所有在途写入失效，重置写状态防止死锁
    this._writeBusy = false;
    if (this._writeQueue.length > 0) {
      const pending = this._writeQueue.splice(0);
      pending.forEach(p => p.reject(false));
    }
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
        success: () => { console.log("[BLE] 扫描已启动"); resolve(); },
        fail: err => { console.error("[BLE] 扫描启动失败:", err); reject(err); },
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
        console.warn("[BLE] 扫描超时 (10s)");
        reject(new Error("扫描超时"));
      }, 10000);

      wx.onBluetoothDeviceFound(res => {
        for (const d of res.devices) {
          const name = d.name || d.localName || "";
          if (name === this._targetName) {
            clearTimeout(timer);
            wx.offBluetoothDeviceFound();
            console.log("[BLE] 发现目标设备:", name, "RSSI:", d.RSSI);
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
          // 打印所有服务
          console.log("[BLE] getServices: 发现", res.services.length, "个服务");
          res.services.forEach(s => {
            console.log("[BLE] getServices:   uuid =", s.uuid, s.isPrimary ? "(Primary)" : "");
          });
          if (res.services.length === 0) { reject(new Error("无服务")); return; }
          const p = res.services.find(s => s.isPrimary) || res.services[0];
          this._serviceId = p.uuid;
          console.log("[BLE] getServices: 选用 serviceId =", this._serviceId);
          resolve();
        },
        fail: err => reject(err),
      });
    });
  }

  private _getChars(deviceId: string, serviceId: string): Promise<void> {
    // 先清空旧值，防止上一次连接的 UUID 泄漏到本次
    this._writeCharId = "";
    this._notifyCharId = "";

    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: res => {
          // 打印所有特征值及其属性
          console.log("[BLE] getChars: 发现", res.characteristics.length, "个特征值 (serviceId =", serviceId, ")");
          res.characteristics.forEach(c => {
            const flags: string[] = [];
            if (c.properties.read) flags.push("read");
            if (c.properties.write) flags.push("write");
            if (c.properties.notify) flags.push("notify");
            if (c.properties.indicate) flags.push("indicate");
            if (c.properties.writeWithoutResponse) flags.push("writeNoRsp");
            console.log("[BLE] getChars:   uuid =", c.uuid, "[", flags.join(", "), "]");
          });

          const notify = res.characteristics.find(c => c.properties.notify);
          const write = res.characteristics.find(c => c.properties.write && c.properties.read);
          if (notify) {
            this._notifyCharId = notify.uuid;
            console.log("[BLE] getChars: 选用 notifyCharId =", this._notifyCharId);
          } else {
            console.log("[BLE] getChars: ⚠️ 未找到 notify 特征值");
          }
          if (write) {
            this._writeCharId = write.uuid;
            console.log("[BLE] getChars: 选用 writeCharId =", this._writeCharId);
          } else {
            console.log("[BLE] getChars: ⚠️ 未找到 write+read 特征值");
          }
          if (!notify && !write) { reject(new Error("无合适特征值")); return; }
          resolve();
        },
        fail: err => reject(err),
      });
    });
  }

  /**
   * 监听 BLE 连接状态变化
   * 重连期间不重置 _reconnectAttempts，防止幽灵连接绕过 MAX_RECONNECT 守卫
   */
  private _listenConnChange() {
    if (this._connListenerAttached) return;
    this._connListenerAttached = true;

    wx.onBLEConnectionStateChange(res => {
      if (res.deviceId !== this._deviceId) return;
      if (res.connected) {
        console.log("[BLE] 连接事件: 已连接");
        // 不在此设 _connected —— BLE 物理连接建立 ≠ 写特征值就绪
        // _connected 由 connect() / _tryReconnectOnce() 走完完整流程后自行设置
      } else {
        console.log("[BLE] 连接事件: 已断开");
        // 过滤过期断线事件：如果刚刚建连成功（3秒内），
        // 说明这是设备重启时产生的延迟事件，实际已经重连成功
        const justConnected = this._lastConnectionTime > 0 && (Date.now() - this._lastConnectionTime < 3000);
        if (justConnected) {
          console.log("[BLE] 连接事件: 忽略过期断线事件（刚连接", Date.now() - this._lastConnectionTime, "ms");
          return;
        }
        this._connected = false;
        this._lastConnected = false;
        this._setStatus("设备已断开");
        if (!this._userInitiatedDisconnect) {
          this._startDisconnectRecovery();
        }
      }
    });
  }
}

const bleService = new BLEService();
export default bleService;
export type { BLEStatus };


