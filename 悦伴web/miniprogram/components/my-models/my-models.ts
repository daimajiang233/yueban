Component({
    properties: {
      text: {
        type: String,
        value: ''
      },
      icon: {
        type: String,
        value: ''
      },
      index: {
        type: Number,
        value: 0
      },
      className: {
        type: String,
        value: ''
      },
      value: {
        type: String,
        value: ''
      }
    },
    methods: {
      handleTap(e:any) {
        this.triggerEvent('buttonTap', { index: e.currentTarget.dataset.index });
      }
    }
  })