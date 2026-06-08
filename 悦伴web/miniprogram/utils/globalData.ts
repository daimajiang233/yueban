// 全局数据类型定义

interface UserInfo {
  name: string;
  status: boolean;
  isScanning: boolean;
  isConnected?: boolean;
  deviceId?: string;
  serviceId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  rssi?: number;
  advertisData?: string;
  foundTime?: string;
  hasAutoConnected?: boolean;
  bleWriteSeq: number;
  /** 外部页面（非我的模式）写入蓝牙时置 true，我的模式 onShow 消费 */
  externalBleWrite: boolean;
  modelInfo: {
    startPause: boolean;
    buttons: boolean[];
  };
}

interface IAppOption {
  globalData: {
    userInfo: UserInfo;
  };
  getGlobalUserInfo(): UserInfo;
  setGlobalUserInfo(userInfo: Partial<UserInfo>): void;
}
