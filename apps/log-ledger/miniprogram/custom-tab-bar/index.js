Component({
  data: {
    selected: 0,
  },

  methods: {
    switchTab(e) {
      const { url, index } = e.currentTarget.dataset
      this.setData({ selected: index })
      wx.switchTab({ url })
    },

    goRecord() {
      wx.navigateTo({
        url: '/pages/record/index',
        fail(err) {
          console.error('navigateTo record failed', err)
          wx.showToast({ title: '跳转失败:' + err.errMsg, icon: 'none' })
        }
      })
    },
  },
})
