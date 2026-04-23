// @ts-nocheck
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
      .then((res: any) => {
        const vehicles = (res && res.list) ? res.list : []
        if (!vehicles.length) return
        if (!(this as any).globalData.currentVehicleId) {
          ;(this as any).globalData.currentVehicleId = vehicles[0]._id
        }
        const current =
          vehicles.find((v: any) => v._id === (this as any).globalData.currentVehicleId) ||
          vehicles[0] ||
          null
        ;(this as any).globalData.vehicles = vehicles
        ;(this as any).globalData.currentVehicle = current
      })
      .catch((e: any) => console.error('loadDefaultVehicle', e))
  },

  ensureDefaultVehicle() {
    if ((this as any)._vehiclePromise) return (this as any)._vehiclePromise
    ;(this as any)._vehiclePromise = (this as any).loadDefaultVehicle()
    return (this as any)._vehiclePromise
  },
})
