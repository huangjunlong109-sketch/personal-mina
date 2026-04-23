const { callFn } = require('./utils/db')

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

  loadDefaultVehicle() {
    return callFn('vehicle.list')
      .then((res) => {
        const vehicles = (res && res.list) ? res.list : []
        if (!vehicles.length) return
        if (!this.globalData.currentVehicleId) {
          this.globalData.currentVehicleId = vehicles[0]._id
        }
        const current =
          vehicles.find((v) => v._id === this.globalData.currentVehicleId) ||
          vehicles[0] ||
          null
        this.globalData.vehicles = vehicles
        this.globalData.currentVehicle = current
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
