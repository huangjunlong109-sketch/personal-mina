const app = getApp<IAppOption>()

// 生成 1~28 日的选项
const cycleDayOptions = Array.from({ length: 28 }, (_, i) => `每月 ${i + 1} 日`)
const defaultTypeOptions = ['支出', '收入']

function getVersionText() {
  try {
    const { miniProgram } = wx.getAccountInfoSync()
    if (miniProgram.version) return `v${miniProgram.version}`
    const envVersionMap: Record<string, string> = {
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
    cycleDayIndex: 0,       // index 即 cycleStartDay - 1
    defaultTypeOptions,
    defaultTypeIndex: 0,    // 0=支出 1=收入
    versionText: getVersionText(),
  },

  onLoad() {
    this.loadUserInfo()
    this.loadSettings()
  },

  onShow() {
    const tabBar = this.getTabBar() as any
    tabBar?.setData?.({ selected: 3 })
  },

  loadUserInfo() {
    wx.getUserProfile({
      desc: '展示用户信息',
      success: (res) => {
        this.setData({
          avatarUrl: res.userInfo.avatarUrl,
          nickName: res.userInfo.nickName,
        })
      },
      fail: () => { /* 未授权则用默认头像 */ },
    })
  },

  async loadSettings() {
    try {
      const res = await wx.cloud.callFunction({ name: 'settings_get' }) as any
      const settings = res.result.settings
      if (!settings) return
      const cycleDay = settings.cycle_start_day ?? 1
      const defaultType = settings.default_type ?? 'expense'
      this.setData({
        cycleDayIndex: cycleDay - 1,
        defaultTypeIndex: defaultType === 'expense' ? 0 : 1,
      })
      app.globalData.cycleStartDay = cycleDay
    } catch (e) {
      console.error('loadSettings error', e)
    }
  },

  async onCycleDayChange(e: any) {
    const index = Number(e.detail.value)
    const cycleStartDay = index + 1
    this.setData({ cycleDayIndex: index })
    app.globalData.cycleStartDay = cycleStartDay
    await wx.cloud.callFunction({
      name: 'settings_save',
      data: { cycle_start_day: cycleStartDay },
    })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  async onDefaultTypeChange(e: any) {
    const index = Number(e.detail.value)
    const defaultType = index === 0 ? 'expense' : 'income'
    this.setData({ defaultTypeIndex: index })
    await wx.cloud.callFunction({
      name: 'settings_save',
      data: { default_type: defaultType },
    })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  goCategory() {
    wx.navigateTo({ url: '/pages/category/index' })
  },

  exportData() {
    wx.showToast({ title: '暂未开放', icon: 'none' })
  },
})
