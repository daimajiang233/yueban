// pages/share/share.ts
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  dataFn(){
    wx.cloud.callFunction({
        name: 'remote', // 替换为实际的云函数名称
        data: { /* 可以在这里传入需要的参数 */name: 'test' },
        success: res => {
          console.log(res.result); // 输出返回的结果
        },
        fail: err => {
          console.error(err); // 调用失败的回调
        }
      });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.dataFn()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})