// pages/my-Model/my-Model.ts
Page({
  /**
   * 页面的初始数据
   */
  data: {
    startPause: false,
    buttons: Array(10).fill(false) // 初始化 10 个按钮，未选中
  },
  handleButtonTap(e:any) {
    console.log(e.currentTarget,1234);
    
    const index = Number(e.currentTarget.dataset.index); // 获取点击按钮的索引
    const newButtons = Array(10).fill(false); // 重置所有按钮
    newButtons[index] = true; // 设置当前按钮为选中
    console.log(index);

    // 更新数据
    this.setData({
      buttons: newButtons
    });

    // 触发自定义事件，传递 index 和 data-value
    // this.triggerEvent('buttonTap', { 
    //   index, 
    //   value: e.currentTarget.dataset.value 
    // });
    console.log(1);
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {

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