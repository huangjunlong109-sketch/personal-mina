const { refreshCategories } = require('./utils/cache')

App({
  onLaunch() {
    wx.cloud.init({ env: 'cloud1-8gnvg7ord2c00fd6', traceUser: true })
    this.initUser().then(() => refreshCategories()).catch(e => console.error('prefetch categories error', e))
  },

  globalData: { cycleStartDay: 1, categoriesLoaded: false, pendingBillRecordMonth: '' },

  initUser() {
    return wx.cloud.callFunction({ name: 'login_init' }).then((res) => {
      const data = (res && res.result) || {}
      if (data.settings && data.settings.cycle_start_day) {
        this.globalData.cycleStartDay = data.settings.cycle_start_day
      }
      this.globalData.categoriesLoaded = true
    }).catch((e) => {
      console.error('initUser error', e)
    })
  },
})
