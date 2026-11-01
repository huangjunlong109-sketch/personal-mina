const cache = require('./utils/cache')

App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-8gmqyyxmc23bcc24',
      traceUser: true,
    })
  },
  globalData: {
    currentVehicleId: '',
    currentVehicle: null,
    vehicles: [],
  },

  syncVehicles(list) {
    const vehicles = Array.isArray(list) ? list : []
    this.globalData.vehicles = vehicles
    if (!vehicles.length) {
      this.globalData.currentVehicleId = ''
      this.globalData.currentVehicle = null
      return
    }
    const current = vehicles.find(v => v._id === this.globalData.currentVehicleId) || vehicles[0]
    this.globalData.currentVehicleId = current._id
    this.globalData.currentVehicle = current
  },

  applyCachedVehicles() {
    const list = cache.readVehicles()
    if (!list) return false
    if (this.globalData.currentVehicleId && !list.some(v => v._id === this.globalData.currentVehicleId)) return false
    this.syncVehicles(list)
    return true
  },

  loadDefaultVehicle() {
    this.applyCachedVehicles()
    return cache.refreshVehicles()
      .then(({ list, fresh }) => {
        if (fresh && list) this.syncVehicles(list)
      })
      .catch((e) => {
        if (e && e.errMsg && e.errMsg.includes('timeout')) {
          console.warn('[cloud timeout] loadDefaultVehicle', e)
          return
        }
        console.error('loadDefaultVehicle', e)
      })
  },

  ensureDefaultVehicle() {
    if (this._vehiclePromise) return this._vehiclePromise
    this._vehiclePromise = this.loadDefaultVehicle()
    return this._vehiclePromise
  },
})
