Component({
    options: {
      styleIsolation: 'apply-shared' // 允许父页面样式影响组件
    },
    externalClasses: ['button-clicked'], // 支持外部样式类
    properties: {
      text: String,
      icon: String,
      index: Number,
      className: String,
      value: String
    },
    methods: {
      // handleTap(e:any) {
      //   this.triggerEvent('buttonTap', { index: e.currentTarget.dataset.index });
       
      //   console.log(1);
        
      // }
      onTap(e:any) {
        const index = Number(e.currentTarget.dataset.index); // 从 dataset 读取
        console.log(this.properties.index,'231');
        console.log(index,123);
        
        
        this.triggerEvent('buttonTap', {          
          index: this.properties.valueindex,
          value: this.properties.value
        });
      }

    }
  })