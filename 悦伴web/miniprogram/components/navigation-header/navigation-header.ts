/**
 * navigation-header 组件
 * 显示 banner 和蓝牙连接/断开按钮，使用统一的 bleService
 */
import bleService from "../../utils/ble-service";

Component({
  data: {
    isScanning: false,
    statusText: "",
  },

  lifetimes: {
    attached() {
      // 初始化状态
      const { isConnected, statusText } = bleService.status;
      this.setData({ isScanning: isConnected, statusText });

      // 监听 bleService 状态变化
      (this as any)._unsubStatus = bleService.onStatusChange((s) => {
        this.setData({
          isScanning: s.isConnected,
          statusText: s.statusText,
        });
      });
    },

    detached() {
      if ((this as any)._unsubStatus) {
        (this as any)._unsubStatus();
      }
    },
  },

  methods: {
    /** 点击连接/断开按钮 */
    async toggleScan() {
      wx.vibrateShort({ type: "heavy" });

      if (this.data.isScanning) {
        // 当前已连接 → 断开
        await bleService.disconnect();
        this.setData({ isScanning: false });
      } else {
        // 当前未连接 → 开始连接（loading 由 bleService 内部处理，首页自动显示）
        const ok = await bleService.connect();
        this.setData({ isScanning: ok });
      }
    },
  },
});
