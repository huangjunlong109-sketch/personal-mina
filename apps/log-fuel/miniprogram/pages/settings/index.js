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
    versionText: getVersionText(),
  },
  onLoad() {},
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },
  onAbout() {
    wx.showModal({
      title: 'LoG油耗',
      content: `个人油耗记录工具，数据存储于微信云开发，仅本账号可见。\n当前版本：${this.data.versionText}`,
      showCancel: false,
    })
  },
})
