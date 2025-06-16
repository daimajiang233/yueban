interface UserInfo {
    name: string;
    status: boolean;
    isScanning: boolean;
    deviceId?: string;
    serviceId?: string;
    writeCharacteristicId?: string;
    notifyCharacteristicId?: string;
    rssi?: number;
    advertisData?: string;
    foundTime?: string;
    modelInfo:object,
    connected:boolean
}

// 定义 IAppOption 接口，明确 globalData 的结构
interface IAppOption {
    globalData: {
        userInfo: UserInfo;
        // 可以添加其他全局数据字段
        // someOtherData: number;
    };
}

// 扩展 wx.App 类型，让 TypeScript 能正确识别 App 实例的类型
// declare const getApp: <T = IAppOption>() => T;    已经声明了