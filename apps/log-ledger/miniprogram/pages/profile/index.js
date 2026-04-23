const cycleDayOptions = Array.from({ length: 28 }, (_, i) => `每月 ${i + 1} 日`)
const defaultTypeOptions = ['支出', '收入']

function getVersionText() {
  try {
    const { miniProgram } = wx.getAccountInfoSync()
    if (miniProgram.version) return `v${miniProgram.version}`
    const envVersionMap = {
      develop: '开发版',
      trial: '体验版',
      release: '正式版',
    }
    return envVersionMap[miniProgram.envVersion] || '-'
  } catch (e) {
    console.error('getVersionText error', e)
    return '-'
  }
}

Page({
  data: {
    avatarUrl: '/images/avatar.png',
    nickName: '用户',
    cycleDayOptions,
    cycleDayIndex: 0,
    defaultTypeOptions,
    defaultTypeIndex: 0,
    versionText: getVersionText(),
  },

  onLoad() { this.loadSettings() },

  onShow() {
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 3 })
  },

  loadSettings() {
    wx.cloud.callFunction({ name: 'settings_get' }).then(res => {
      const settings = res.result && res.result.settings
      if (!settings) return
      const cycleDay = settings.cycle_start_day || 1
      const defaultType = settings.default_type || 'expense'
      this.setData({ cycleDayIndex: cycleDay - 1, defaultTypeIndex: defaultType === 'expense' ? 0 : 1 })
      const app = getApp()
      if (app && app.globalData) app.globalData.cycleStartDay = cycleDay
    }).catch(e => console.error('loadSettings error', e))
  },

  onCycleDayChange(e) {
    const index = Number(e.detail.value)
    const cycleStartDay = index + 1
    this.setData({ cycleDayIndex: index })
    const app = getApp()
    if (app && app.globalData) app.globalData.cycleStartDay = cycleStartDay
    wx.cloud.callFunction({
      name: 'settings_save',
      data: { cycle_start_day: cycleStartDay },
    }).then(() => wx.showToast({ title: '已保存', icon: 'success' }))
  },

  onDefaultTypeChange(e) {
    const index = Number(e.detail.value)
    const defaultType = index === 0 ? 'expense' : 'income'
    this.setData({ defaultTypeIndex: index })
    wx.cloud.callFunction({
      name: 'settings_save',
      data: { default_type: defaultType },
    }).then(() => wx.showToast({ title: '已保存', icon: 'success' }))
  },

  goCategory() { wx.navigateTo({ url: '/pages/category/index' }) },
  exportData() { wx.showToast({ title: '暂未开放', icon: 'none' }) },
})
