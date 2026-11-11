const { callFn } = require('../../utils/db')
const cache = require('../../utils/cache')
const { groupByMonth, formatDayCN } = require('../../utils/date')

function metricText(value, unit) {
  if (value == null || value === '') return '--'
  return `${value} ${unit}`
}

function isSegmentConsumption(record) {
  if (record.importSource === 'excel' || record.tankFull === false) return false
  const consumption = Number(record.fuelConsumption)
  const liters = Number(record.liters)
  const addedMileage = Number(record.addedMileage)
  if (!(consumption > 0) || !(liters > 0) || !(addedMileage > 0)) return false
  const single = Math.round((liters / addedMileage) * 100 * 100) / 100
  return Math.abs(consumption - single) > 0.1
}

Page({
  data: {
    groups: [],
    loading: false,
    vehicleId: '',
  },

  onShow() {
    const app = getApp()
    if (!app || !app.globalData) return
    if (typeof app.applyCachedVehicles === 'function') app.applyCachedVehicles()
    const cachedId = app.globalData.currentVehicleId
    if (cachedId) {
      this.setData({ vehicleId: cachedId })
      this.loadRecords(cachedId)
    }
    const refresh = () => {
      const vehicleId = app.globalData.currentVehicleId
      if (!vehicleId) {
        this._recordSeq = (this._recordSeq || 0) + 1
        this.setData({ groups: [], loading: false, vehicleId: '' })
        return
      }
      if (vehicleId !== cachedId) {
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

  showGroups(records) {
    const groups = groupByMonth(records).map(g => ({
      ...g,
      records: g.records.map(r => ({
        ...r,
        dayLabel: formatDayCN(r.refuelDate),
        consumptionText: metricText(r.fuelConsumption, 'L/100km'),
        costText: metricText(r.costPerKm, '元/km'),
        segmentConsumption: isSegmentConsumption(r),
        hasIssue: r.issueFlags && r.issueFlags.length > 0 && !r.confirmedByUser,
      })),
    }))
    this.setData({ groups, loading: false })
  },

  loadRecords(vehicleId) {
    const seq = (this._recordSeq || 0) + 1
    this._recordSeq = seq
    const cached = cache.readRecords(vehicleId)
    if (cached) this.showGroups(cached)
    else this.setData({ loading: true })
    cache.refreshRecords(vehicleId).then(({ list, fresh }) => {
      if (!fresh || !list || seq !== this._recordSeq || vehicleId !== this.data.vehicleId) return
      this.showGroups(list)
    }).catch(() => {
      if (seq !== this._recordSeq) return
      if (!cached) this.setData({ loading: false })
    })
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
          cache.invalidateRecords(this.data.vehicleId)
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
            cache.invalidateRecords(this.data.vehicleId)
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
