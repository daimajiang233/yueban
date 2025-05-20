Component({
    options: {
        styleIsolation: 'shared', // 允许父页面和组件样式互相影响
        addGlobalClass: true,     // 允许组件使用全局样式
      },
    externalClasses: ['button-clicked'], // 支持外部样式类
    properties: {
      text: String,
      icon: String,
      index: Number,
      className: String,
      value: String,
    },
    methods: {
      // handleTap(e:any) {
      //   this.triggerEvent('buttonTap', { index: e.currentTarget.dataset.index });
       
      //   console.log(1);
        
      // }
      onTap(e:any) {
        // const index = Number(e.currentTarget.dataset.index); // 从 dataset 读取
        const value = this.properties.value; // 从 dataset 读取

        // console.log(this.properties.index,'231');
        console.log(value,123);
        console.log(e.currentTarget.dataset,'点击的index');
        
        
        
        this.triggerEvent('buttonTap', {          
          index: this.properties.index,
          value: this.properties.value
        });

        // this.sendData(this.properties.value)
        console.log(value,"value");
        
      },

    

    }
  })