/**
 * navigation-btnList 组件
 * 首页功能入口卡片。requireBle=true（默认）时未连接会先触发连接再跳转。
 * requireBle=false 时直接跳转（如分享页，加入房间无需蓝牙）。
 */
import bleService from "../../utils/ble-service";

Component({
  properties: {
    zhTitle: { type: String, value: "" },
    enTitle: { type: String, value: "" },
    iconUrl: { type: String, value: "" },
    bluetoothData: { type: String, value: "" },
    pageSrc: { type: String, value: "" },
    requireBle: { type: Boolean, value: true },
  },

  methods: {
    /** 点击卡片：requireBle 为 true 且未连接时先触发连接再跳转 */
    async sendData(event: any) {
      wx.vibrateShort({ type: "heavy" });
      const pageSrc = event.currentTarget.dataset.pagesrc as string;
      if (!pageSrc) return;

      // requireBle=true 且未连接：触发连接搜索，成功后自动跳转
      if (this.properties.requireBle && !bleService.isConnected) {
        console.log("[navigation-btnList] 未连接，触发自动连接后跳转到", pageSrc);
        const ok = await bleService.connect();
        if (!ok) return; // connect() 内部已处理 toast
      }

      wx.navigateTo({
        url: `/pages/${pageSrc}`,
        fail: () => {
          wx.showToast({ title: "跳转失败", icon: "error", duration: 1500 });
        },
      });
    },
  },
});
