Component({
  data: {
    selected: 0,
  },

  methods: {
    switchTab(e: any) {
      const { url, index } = e.currentTarget.dataset
      this.setData({ selected: index })
      wx.switchTab({ url })
    },

    goRecord() {
      wx.navigateTo({ url: '/pages/record/index' })
    },
  },
})
