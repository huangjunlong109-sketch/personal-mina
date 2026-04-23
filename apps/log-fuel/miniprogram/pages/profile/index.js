const { callFn } = require('../../utils/db')

Page({
  data: {
    currentVehicle: null,
    vehicles: [],
    showPicker: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadVehicles()
  },

  loadVehicles() {
    callFn('vehicle.list').then(res => {
      const vehicles = (res && res.list) ? res.list : []
      const app = getApp()
      if (!app) return
      if (!app.globalData.currentVehicleId && vehicles.length > 0) {
        app.globalData.currentVehicleId = vehicles[0]._id
        app.globalData.currentVehicle = vehicles[0]
      }
      const currentVehicle = vehicles.find(v => v._id === app.globalData.currentVehicleId) || vehicles[0] || null
      app.globalData.currentVehicle = currentVehicle
      this.setData({ vehicles, currentVehicle })
    })
  },

  selectVehicle(e) {
    const vehicle = this.data.vehicles.find(v => v._id === e.currentTarget.dataset.id)
    if (!vehicle) return
    const app = getApp()
    app.globalData.currentVehicleId = vehicle._id
    app.globalData.currentVehicle = vehicle
    this.setData({ currentVehicle: vehicle, showPicker: false })
    wx.showToast({ title: `已切换到 ${vehicle.model}` })
  },

  showVehiclePicker() { this.setData({ showPicker: true }) },
  hideVehiclePicker() { this.setData({ showPicker: false }) },

  goAddVehicle() {
    this.setData({ showPicker: false })
    wx.navigateTo({ url: '/pages/vehicle/index' })
  },

  goImport() { wx.navigateTo({ url: '/pages/import/index' }) },

  onDeleteVehicle(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除', content: '同时删除该车所有记录，确定吗？', confirmColor: '#FF3B30',
      success: (r) => {
        if (!r.confirm) return
        callFn('vehicle.delete', { id }).then(() => {
          wx.showToast({ title: '已删除' })
          const app = getApp()
          if (app.globalData.currentVehicleId === id) {
            app.globalData.currentVehicleId = ''
            app.globalData.currentVehicle = null
          }
          this.loadVehicles()
        })
      },
    })
  },
})
