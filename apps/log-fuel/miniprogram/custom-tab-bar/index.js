Component({
  data: {
    selected: 0,
    tabs: [
      { pagePath: '/pages/index/index', text: '油耗', icon: '⛽' },
      { pagePath: '/pages/profile/index', text: '我的', icon: '🚗' },
      { pagePath: '/pages/settings/index', text: '设置', icon: '⚙️' }
    ]
  },
  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset
      wx.switchTab({ url: path })
      this.setData({ selected: index })
    }
  }
})
