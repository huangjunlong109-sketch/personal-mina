App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-8gnvg7ord2c00fd6',
      traceUser: true,
    })
    this.initUser()
  },

  globalData: {
    cycleStartDay: 1,
    categoriesLoaded: false,
    pendingBillRecordMonth: '',
  },

  async initUser() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login_init' })
      const data = res.result as any
      if (data && data.settings && data.settings.cycle_start_day) {
        this.globalData.cycleStartDay = data.settings.cycle_start_day
      }
      this.globalData.categoriesLoaded = true
    } catch (e) {
      console.error('initUser error', e)
    }
  },
})
