/**
 * BLE 发送辅助函数
 * 封装蓝牙数据发送，自动处理连接确保
 */
import bleService from './ble-service';

/**
 * 发送十六进制字符串（如 "0xF1"）
 * 未连接时自动触发连接
 */
export async function sendBleHex(value: string): Promise<boolean> {
  return await bleService.sendData(value);
}

/**
 * 发送原始数字值（如震动强度 50）
 * 未连接时自动触发连接
 */
export async function sendBleValue(value: number): Promise<boolean> {
  return await bleService.sendData(value);
}

/**
 * 确保蓝牙已连接（供跳转前检车用）
 */
export async function ensureBleConnected(): Promise<boolean> {
  return await bleService.ensureConnected();
}

/**
 * 获取当前蓝牙连接状态
 */
export function isBleConnected(): boolean {
  return bleService.isConnected;
}

export default bleService;
