import { fenToYuan } from '../../utils/date'
import { getIconEmoji } from '../../utils/categories'

let detailRecordId = ''

Page({
  data: {
    record: null as any,
  },

  onLoad(options: any) {
    detailRecordId = options.id || ''
  },

  onShow() {
    if (detailRecordId) void this.loadRecord(detailRecordId)
  },

  onEdit() {
    if (!this.data.record) return
    wx.navigateTo({ url: `/pages/record/index?id=${this.data.record._id}` })
  },

  async loadRecord(id: string) {
    wx.showLoading({ title: '加载中' })
    try {
      // 通过云数据库直接查单条
      const db = wx.cloud.database()
      const res = await db.collection('ledger_records').doc(id).get()
      const r = res.data as any
      this.setData({
        record: {
          ...r,
          emoji: getIconEmoji(r.category_icon),
          amountDisplay: fenToYuan(r.amount),
        },
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      confirmColor: '#FF4444',
      success: async (res) => {
        if (!res.confirm) return
        await wx.cloud.callFunction({
          name: 'record_delete',
          data: { id: this.data.record._id },
        })
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      },
    })
  },
})
