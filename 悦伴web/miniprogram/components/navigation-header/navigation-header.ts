interface IPageData {
    isScanning: boolean;
    status: string;
    deviceId: string;
    serviceId: string;
    characteristicId: string;
    receivedData: string; // 用于存储接收到的数据
}

Component({
    data: {
        isScanning: false,
        status: '未开始扫描',
        deviceId: '',
        serviceId: '',
        characteristicId: '',
        receivedData: '' // 初始化接收数据
    } as IPageData,

    lifetimes: {
        attached() {
            this.initBluetooth();
            console.log('第一步加载初始化蓝牙');

            // 初始化特征值变化监听器
            wx.onBLECharacteristicValueChange((res) => {
                console.log('收到数据:', res);
                // 将接收到的缓冲区转换为十六进制字符串以显示
                const value = res.value;
                const hexData = Array.from(new Uint8Array(value))
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
                this.setData({
                    receivedData: hexData,
                    status: `收到数据: ${hexData}`
                });
                console.log(`收到数据 (十六进制): ${hexData}`);
            });
        },
        detached() {
            // 当组件从页面移除时，停止扫描并关闭蓝牙适配器
            if (this.data.isScanning) {
                wx.stopBluetoothDevicesDiscovery();
            }
            wx.closeBluetoothAdapter();
        }
    },

    methods: {
        initBluetooth() {
            // 打开蓝牙适配器
            wx.openBluetoothAdapter({
                success: () => {
                    this.setData({ status: '蓝牙适配器初始化成功' });
                    console.log('蓝牙适配器初始化成功');

                    // 开始监听设备发现
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
                    console.error('蓝牙适配器初始化失败:', res.errMsg);
                    this.setData({ status: `蓝牙适配器初始化失败: ${res.errMsg}` });
                }
            });
        },

        toggleScan() {
            // 切换扫描状态
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
                            // 开始扫描蓝牙设备
                            wx.startBluetoothDevicesDiscovery({
                                services: [],
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
            // 连接到指定的蓝牙设备
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
            // 获取蓝牙设备的服务
            wx.getBLEDeviceServices({
                deviceId: this.data.deviceId,
                success: (res) => {
                    console.log('服务:', res.services); // 调试日志
                    for (const service of res.services) {
                        this.setData({ serviceId: service.uuid });
                        this.getBLECharacteristics();
                        break; // 使用第一个服务；如需特定服务可修改
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
            // 获取蓝牙设备的特征值
            wx.getBLEDeviceCharacteristics({
                deviceId: this.data.deviceId,
                serviceId: this.data.serviceId,
                success: (res) => {
                    console.log('特征值:', res.characteristics); // 调试日志
                    for (const char of res.characteristics) {
                        if (char.properties.write && char.properties.read) {
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

        enableNotifications() {
            // 启用特征值通知
            wx.notifyBLECharacteristicValueChange({
                deviceId: this.data.deviceId,
                serviceId: this.data.serviceId,
                characteristicId: this.data.characteristicId,
                state: true,
                success: () => {
                    this.setData({ status: '已启用通知' });
                    console.log('已启用通知');
                },
                fail: (res) => {
                    this.setData({ status: `启用通知失败: ${res.errMsg}` });
                    console.error('启用通知失败:', res.errMsg);
                }
            });
        },

        sendCommand() {
            // 发送指令到蓝牙设备
            const buffer = new ArrayBuffer(2);
            const dataView = new DataView(buffer);
            dataView.setUint16(0, 0xfff, false); // 发送 0xfff 作为 16 位值，大端序
            wx.writeBLECharacteristicValue({
                deviceId: this.data.deviceId,
                serviceId: this.data.serviceId,
                characteristicId: this.data.characteristicId,
                value: buffer,
                success: () => {
                    this.setData({ status: ' distinguir指令发送成功' });
                    console.log('指令发送成功');
                    this.enableNotifications(); // 发送指令后启用通知
                },
                fail: (res) => {
                    this.setData({ status: `指令发送失败: ${res.errMsg}` });
                }
            });
        }
    }
});