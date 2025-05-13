// 定义设备接口
interface Device {
    deviceId: string; // 设备ID
    name: string; // 设备名称
    RSSI: number; // 信号强度
}

// 定义内部数据状态接口
interface DataState {
    status: string; // 当前状态描述
    isScanning: boolean; // 是否正在扫描
    deviceList: Device[]; // 设备列表
    deviceId: string; // 连接的设备ID
    serviceId: string; // 服务ID
    characteristicId: string; // 特征值ID
    receivedData: string; // 接收到的数据
}

// 定义微信蓝牙服务接口
interface WeChatBLEService {
    uuid: string; // 服务UUID
    isPrimary: boolean; // 是否主服务
}

// 定义微信蓝牙特征值接口
interface WeChatBLECharacteristic {
    uuid: string; // 特征值UUID
    properties: {
        read?: boolean; // 是否可读
        write?: boolean; // 是否可写
        notify?: boolean; // 是否支持通知
        indicate?: boolean; // 是否支持指示
    };
}

// 定义微信蓝牙设备接口
interface WeChatBLEDevice {
    deviceId: string; // 设备ID
    name?: string; // 设备名称
    localName?: string; // 本地名称
    RSSI?: number; // 信号强度
}

// 定义全局 userInfo 接口
interface UserInfo {
    name: string; // 设备名称
    status: boolean; // 连接状态（成功/失败）
    isScanning: boolean; // 是否正在扫描
    deviceId: string; // 设备ID
    serviceId: string; // 服务ID
    characteristicId: string; // 特征值ID
}

// 蓝牙管理类
class BluetoothManager {
    private data: DataState; // 内部状态
    private setData: (data: Partial<UserInfo>) => void; // 更新全局 userInfo 的函数
    private targetDeviceName: string = "YUE BAN"; // 目标设备名称

    // 构造函数，初始化数据
    constructor(setData: (data: Partial<UserInfo>) => void) {
        this.data = {
            status: '',
            isScanning: false,
            deviceList: [],
            deviceId: '',
            serviceId: '',
            characteristicId: '',
            receivedData: ''
        };
        this.setData = setData;
        // 初始化 userInfo
        this.setData({
            name: this.targetDeviceName,
            status: false,
            isScanning: false,
            deviceId: '',
            serviceId: '',
            characteristicId: ''
        });
    }

    // 初始化蓝牙适配器
    initBluetoothAdapter(): void {
        wx.openBluetoothAdapter({
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('初始化蓝牙适配器成功', res);
                this.data.status = '蓝牙适配器初始化成功';
                this.setData({ status: true });
                this.getBluetoothAdapterState();
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('初始化蓝牙适配器失败', err);
                this.data.status = '蓝牙适配器初始化失败';
                this.setData({ status: false });
                wx.showModal({
                    title: '提示',
                    content: '请开启蓝牙功能',
                    showCancel: false
                });
            }
        });
    }

    // 获取蓝牙适配器状态
    private getBluetoothAdapterState(): void {
        wx.getBluetoothAdapterState({
            success: (res: WechatMiniprogram.GetBluetoothAdapterStateSuccessCallbackResult) => {
                console.log('蓝牙适配器状态', res);
                if (!res.available) {
                    this.data.status = '蓝牙不可用';
                    console.log("适配器状态+",this.data.status);
                    
                    this.setData({ status: false });
                }
            }
        });
    }

    // 开始搜索蓝牙设备
    startBluetoothDevicesDiscovery(): void {
        if (this.data.isScanning) return;

        wx.showLoading({
            title: '搜索设备中',
            mask: true
        });

        wx.startBluetoothDevicesDiscovery({
            services: [],
            allowDuplicatesKey: false,
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('开始搜索蓝牙设备', res);
                this.data.isScanning = true;
                this.data.status = '正在搜索蓝牙设备';
                this.setData({ isScanning: true, status: true });
                this.onBluetoothDeviceFound();

                setTimeout(() => {
                    wx.hideLoading();
                }, 2000);
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('搜索蓝牙设备失败', err);
                this.data.status = '搜索蓝牙设备失败';
                this.setData({ status: false });
                wx.hideLoading();
            }
        });
    }

    // 监听发现新蓝牙设备事件
    private onBluetoothDeviceFound(): void {
        wx.onBluetoothDeviceFound((res: WechatMiniprogram.OnBluetoothDeviceFoundCallbackResult) => {
            const devices: WeChatBLEDevice[] = res.devices;
            // 只保留名称为 targetDeviceName 的设备
            const filteredDevices = devices.filter(
                device => (device.name || device.localName) === this.targetDeviceName
            );

            if (filteredDevices.length > 0) {
                console.log('发现目标蓝牙设备', filteredDevices);
                this.updateDeviceList(filteredDevices);
                // 自动连接第一个匹配的设备
                this.connectDevice(filteredDevices[0].deviceId);
            }
        });
    }

    // 更新设备列表
    private updateDeviceList(newDevices: WeChatBLEDevice[]): void {
        const deviceList: Device[] = [...this.data.deviceList];

        newDevices.forEach(newDevice => {
            const index = deviceList.findIndex(device => device.deviceId === newDevice.deviceId);

            if (index === -1) {
                deviceList.push({
                    deviceId: newDevice.deviceId,
                    name: newDevice.name || newDevice.localName || '',
                    RSSI: newDevice.RSSI || 0
                });
            } else {
                deviceList[index].RSSI = newDevice.RSSI || 0;
            }
        });

        deviceList.sort((a, b) => b.RSSI - a.RSSI);
        this.data.deviceList = deviceList;
    }

    // 停止搜索蓝牙设备
    stopBluetoothDevicesDiscovery(): void {
        if (!this.data.isScanning) return;

        wx.stopBluetoothDevicesDiscovery({
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('停止搜索蓝牙设备', res);
                this.data.isScanning = false;
                this.data.status = '已停止搜索蓝牙设备';
                this.setData({ isScanning: false, status: true });
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('停止搜索失败', err);
                this.data.status = '停止搜索失败';
                this.setData({ status: false });
            }
        });
    }

    // 连接蓝牙设备
    connectDevice(deviceId: string): void {
        wx.showLoading({
            title: '连接中',
            mask: true
        });

        wx.createBLEConnection({
            deviceId,
            timeout: 10000,
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('连接蓝牙设备成功', res);
                this.data.deviceId = deviceId;
                this.data.status = '蓝牙设备连接成功';
                this.setData({ deviceId, status: true });

                this.getBLEDeviceServices(deviceId);

                wx.hideLoading();
                wx.showToast({
                    title: '连接成功',
                    icon: 'success'
                });
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('连接蓝牙设备失败', err);
                this.data.status = '蓝牙设备连接失败';
                this.setData({ status: false });
                wx.hideLoading();
                wx.showToast({
                    title: '连接失败',
                    icon: 'none'
                });
            }
        });
    }

    // 获取蓝牙设备所有服务
    private getBLEDeviceServices(deviceId: string): void {
        wx.getBLEDeviceServices({
            deviceId,
            success: (res: WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult) => {
                console.log('获取设备服务成功', res);
                const services: WeChatBLEService[] = res.services;

                if (services.length > 0) {
                    const primaryService = services.find(service => service.isPrimary);
                    const serviceId = primaryService ? primaryService.uuid : services[0].uuid;
                    this.data.serviceId = serviceId;
                    this.setData({ serviceId });
                    this.getBLEDeviceCharacteristics(deviceId, serviceId);
                } else {
                    this.data.status = '未发现设备服务';
                    this.setData({ status: false });
                }
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('获取设备服务失败', err);
                this.data.status = '获取设备服务失败';
                this.setData({ status: false });
            }
        });
    }

    // 获取蓝牙设备某个服务中的所有特征值
    private getBLEDeviceCharacteristics(deviceId: string, serviceId: string): void {
        wx.getBLEDeviceCharacteristics({
            deviceId,
            serviceId,
            success: (res: WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult) => {
                console.log('获取设备特征值成功', res);
                const characteristics: WeChatBLECharacteristic[] = res.characteristics;

                const notifyCharacteristic = characteristics.find(
                    char => char.properties.notify
                );

                const writeCharacteristic = characteristics.find(
                    char => char.properties.write
                );

                if (notifyCharacteristic) {
                    this.data.characteristicId = notifyCharacteristic.uuid;
                    this.data.status = '发现可通知的特征值';
                    
                    this.setData({
                        characteristicId: notifyCharacteristic.uuid,
                        status: true
                    });

                    this.notifyBLECharacteristicValueChange(
                        deviceId,
                        serviceId,
                        notifyCharacteristic.uuid
                    );
                } else if (writeCharacteristic) {
                    this.data.characteristicId = writeCharacteristic.uuid;
                    this.data.status = '发现可写的特征值';
                    this.setData({
                        characteristicId: writeCharacteristic.uuid,
                        status: true
                    });
                } else {
                    this.data.status = '未发现合适的特征值';
                    this.setData({ status: false });
                }
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('获取设备特征值失败', err);
                this.data.status = '获取设备特征值失败';
                this.setData({ status: false });
            }
        });
    }

    // 启用特征值变化通知
    private notifyBLECharacteristicValueChange(deviceId: string, serviceId: string, characteristicId: string): void {
        wx.notifyBLECharacteristicValueChange({
            state: true,
            deviceId,
            serviceId,
            characteristicId,
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('启用通知成功', res);
                this.data.status = '已启用特征值变化通知';
                this.setData({ status: true });
                this.onBLECharacteristicValueChange();
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('启用通知失败', err);
                this.data.status = '启用通知失败';
                this.setData({ status: false });
            }
        });
    }

    // 监听特征值变化
    private onBLECharacteristicValueChange(): void {
        wx.onBLECharacteristicValueChange((res: WechatMiniprogram.OnBLECharacteristicValueChangeCallbackResult) => {
            console.log('特征值变化', res);
            const value = this.ab2str(res.value);
            this.data.receivedData = value;
            this.data.status = '接收到新数据';
            this.setData({ status: true });
        });
    }

    // 向蓝牙设备写入数据
    writeBLECharacteristicValue(deviceId: string, serviceId: string, characteristicId: string, value: string): void {
        const buffer = this.str2ab(value);

        wx.writeBLECharacteristicValue({
            deviceId,
            serviceId,
            characteristicId,
            value: buffer,
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('写入数据成功', res);
                this.data.status = '数据写入成功';
                this.setData({ status: true });
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('写入数据失败', err);
                this.data.status = '数据写入失败';
                this.setData({ status: false });
            }
        });
    }

    // 关闭蓝牙连接
    closeBLEConnection(): void {
        if (!this.data.deviceId) return;

        wx.closeBLEConnection({
            deviceId: this.data.deviceId,
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('关闭蓝牙连接成功', res);
                this.data.deviceId = '';
                this.data.serviceId = '';
                this.data.characteristicId = '';
                this.data.status = '蓝牙连接已关闭';
                this.setData({
                    deviceId: '',
                    serviceId: '',
                    characteristicId: '',
                    status: false
                });
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('关闭蓝牙连接失败', err);
                this.data.status = '关闭蓝牙连接失败';
                this.setData({ status: false });
            }
        });
    }

    // 关闭蓝牙适配器
    closeBluetoothAdapter(): void {
        wx.closeBluetoothAdapter({
            success: (res: WechatMiniprogram.GeneralCallbackResult) => {
                console.log('关闭蓝牙适配器成功', res);
                this.data.status = '蓝牙适配器已关闭';
                this.setData({ status: false });
            },
            fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                console.error('关闭蓝牙适配器失敗', err);
                this.data.status = '关闭蓝牙适配器失败';
                this.setData({ status: false });
            }
        });
    }

    // ArrayBuffer 转字符串
    private ab2str(buf: ArrayBuffer): string {
        return String.fromCharCode.apply(null, new Uint8Array(buf) as any);
    }

    // 字符串转 ArrayBuffer
    private str2ab(str: string): ArrayBuffer {
        const buf = new ArrayBuffer(str.length); // 修正长度错误
        const bufView = new Uint8Array(buf);
        for (let i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

    // 切换扫描状态
    toggleScan(): void {
        if (!this.data.isScanning) {
            console.log("已经点击");
            
            this.startBluetoothDevicesDiscovery();
        } else {
            this.stopBluetoothDevicesDiscovery();
            wx.showToast({
                title: "已停止扫描",
                icon: "success",
                duration: 1500,
                mask: true
            });
        }
    }

    // 处理用户点击连接设备（此处自动连接无需使用）
    handleConnectDevice(e: WechatMiniprogram.TouchEvent): void {
        const deviceId = e.currentTarget.dataset.deviceId;
        if (deviceId) {
            this.connectDevice(deviceId);
        } else {
            console.error('设备ID不存在');
        }
    }
}

export default BluetoothManager;