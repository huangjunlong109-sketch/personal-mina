const { fenToYuan } = require('../../utils/date')
const { getIconEmoji } = require('../../utils/categories')

Page({
  data: { record: null },

  onLoad(options) {
    this.recordId = options.id || ''
  },

  onShow() {
    if (this.recordId) this.loadRecord(this.recordId)
  },

  onEdit() {
    if (!this.data.record) return
    wx.navigateTo({ url: `/pages/record/index?id=${this.data.record._id}` })
  },

  loadRecord(id) {
    wx.showLoading({ title: '加载中' })
    const db = wx.cloud.database()
    db.collection('ledger_records').doc(id).get().then(res => {
      const r = res.data
      this.setData({
        record: { ...r, emoji: getIconEmoji(r.category_icon), amountDisplay: fenToYuan(r.amount) }
      })
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除', content: '删除后不可恢复', confirmColor: '#FF4444',
      success: res => {
        if (!res.confirm) return
        const db = wx.cloud.database()
        db.collection('ledger_records').doc(this.data.record._id)
          .update({ data: { is_deleted: true, updated_at: new Date() } })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 800)
          })
      },
    })
  },
})
