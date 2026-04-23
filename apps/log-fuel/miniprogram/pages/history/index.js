const { callFn } = require('../../utils/db')
const { groupByMonth, formatDayCN } = require('../../utils/date')

Page({
  data: {
    groups: [],
    loading: false,
    vehicleId: '',
  },

  onShow() {
    const app = getApp()
    if (!app || !app.globalData) return
    const refresh = () => {
      const vehicleId = app.globalData.currentVehicleId
      if (vehicleId) {
        this.setData({ vehicleId })
        this.loadRecords(vehicleId)
      }
    }
    if (typeof app.ensureDefaultVehicle === 'function') {
      app.ensureDefaultVehicle().then(refresh).catch(() => refresh())
    } else {
      refresh()
    }
  },

  loadRecords(vehicleId) {
    this.setData({ loading: true })
    callFn('record.list', { vehicleId }).then(res => {
      const records = (res && res.list) ? res.list : []
      const groups = groupByMonth(records).map(g => ({
        ...g,
        records: g.records.map(r => ({
          ...r,
          dayLabel: formatDayCN(r.refuelDate),
          hasIssue: r.issueFlags && r.issueFlags.length > 0 && !r.confirmedByUser,
        })),
      }))
      this.setData({ groups, loading: false })
    }).catch(() => this.setData({ loading: false }))
  },

  getRecordById(id) {
    for (const group of this.data.groups) {
      const record = (group.records || []).find(item => item._id === id)
      if (record) return record
    }
    return null
  },

  onMoreTap(e) {
    const { id } = e.currentTarget.dataset
    const record = this.getRecordById(id)
    const itemList = []
    if (record && record.hasIssue) itemList.push('确认核实')
    itemList.push('编辑', '删除')
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = itemList[res.tapIndex]
        if (action === '确认核实') {
          this.confirmIssue(id)
        } else if (action === '编辑') {
          wx.navigateTo({ url: `/pages/record/index?id=${id}` })
        } else if (action === '删除') {
          this.confirmDelete(id)
        }
      },
    })
  },

  confirmIssue(id) {
    wx.showModal({
      title: '确认核实',
      content: '确认这条记录已经核实无误？',
      confirmText: '确认',
      success: (res) => {
        if (!res.confirm) return
        callFn('record.confirmIssue', { id }).then(() => {
          wx.showToast({ title: '已确认' })
          this.loadRecords(this.data.vehicleId)
        })
      },
    })
  },

  confirmDelete(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定吗？',
      confirmColor: '#FF3B30',
      success: (r) => {
        if (r.confirm) {
          callFn('record.delete', { id }).then(() => {
            wx.showToast({ title: '已删除' })
            this.loadRecords(this.data.vehicleId)
          })
        }
      },
    })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/index' })
  },
})
