const { callFn } = require('../../utils/db')

Page({
  data: {
    brand: '',
    model: '',
    plate: '',
    loading: false,
  },

  onBrandInput(e) { this.setData({ brand: e.detail.value }) },
  onModelInput(e) { this.setData({ model: e.detail.value }) },
  onPlateInput(e) { this.setData({ plate: e.detail.value }) },

  onSave() {
    const { brand, model, plate } = this.data
    if (!brand || !model) {
      wx.showToast({ title: '品牌和车型必填', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    callFn('vehicle.add', { data: { brand, model, plate } })
      .then(res => {
        const app = getApp()
        if (res && res._id) {
          app.globalData.currentVehicleId = res._id
          app.globalData.currentVehicle = { _id: res._id, brand, model, plate }
        }
        wx.showToast({ title: '添加成功' })
        setTimeout(() => wx.navigateBack(), 900)
      })
      .catch(() => wx.showToast({ title: '添加失败', icon: 'error' }))
      .finally(() => this.setData({ loading: false }))
  },
})
