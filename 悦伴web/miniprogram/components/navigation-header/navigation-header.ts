// interface IPageData {
//     isScanning: boolean;
//     status: string;
//     deviceId: string;
//     serviceId: string;
//     characteristicId: string;
//     receivedData: string; // 用于存储接收到的数据
// }

Component({
    data: {
        isScanning: false,
    //     status: '未开始扫描',
    //     deviceId: '',
    //     serviceId: '',
    //     characteristicId: '',
    //     receivedData: '' // 初始化接收数据
    },
   

    // lifetimes: {
    //     attached(){
    //         const app = getApp();
    //         this.data.isScanning = app.globalData.userInfo.isScanning
    //         console.log(this.data.isScanning);
            
    //         // 此时组件实例已经创建，但还不能使用 setData
    //         console.log('组件创建完成');
    //       },
    // },

    methods: {
        toggleScan(){
         const app = getApp()
            if(!this.data.isScanning){
                app.globalData.userInfo.isScanning = true
                
            }else{
                wx.showToast({
                    title:"蓝牙已连接",
                    icon:"success",
                    duration:1500,
                    mask:true
                })
            }
        }
    }
});