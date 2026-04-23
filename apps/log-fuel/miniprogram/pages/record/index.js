const { callFn } = require('../../utils/db')
const { today } = require('../../utils/date')
const { validateRecord } = require('../../utils/calc')

const FUEL_GRADES = ['92#', '95#', '98#', '0#']

function parsePositiveNumber(value) {
  const num = parseFloat(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

function formatDecimal(value) {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 100) / 100
  return String(Number(rounded.toFixed(2)))
}

Page({
  data: {
    statusBarHeight: 20,
    navContentHeight: 44,
    capsuleSpace: 120,
    pageTitle: '记油耗',
    isEdit: false,
    recordId: '',
    currentVehicle: null,
    refuelDate: today(),
    fuelGrade: '92#',
    fuelGradeIndex: 0,
    liters: '',
    unitPrice: '',
    totalAmount: '',
    odometer: '',
    tankFull: true,
    lastOdometer: null,
    fuelGrades: FUEL_GRADES,
    loading: false,
  },

  onLoad(options) {
    this.initNavBar()
    const app = getApp()
    if (!app) return
    this.setData({ currentVehicle: app.globalData.currentVehicle || null })

    if (options.id) {
      this.setData({ isEdit: true, recordId: options.id, pageTitle: '编辑油耗' })
      this.loadRecord(options.id)
    } else {
      this.loadLatestRecordInfo()
    }
  },

  initNavBar() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null
    const statusBarHeight = systemInfo.statusBarHeight || 20
    const navContentHeight = menuButton
      ? menuButton.height + (menuButton.top - statusBarHeight) * 2
      : 44
    const capsuleSpace = menuButton
      ? systemInfo.windowWidth - menuButton.left + 12
      : 120
    this.setData({ statusBarHeight, navContentHeight, capsuleSpace })
  },

  loadRecord(id) {
    callFn('record.get', { id }).then(r => {
      if (!r) return
      this.setData({
        refuelDate: r.refuelDate,
        fuelGrade: r.fuelGrade || '92#',
        fuelGradeIndex: Math.max(0, FUEL_GRADES.indexOf(r.fuelGrade)),
        liters: String(r.liters || ''),
        unitPrice: String(r.unitPrice || ''),
        totalAmount: String(r.totalAmount || ''),
        odometer: String(r.odometer || ''),
        tankFull: r.tankFull !== false,
      })
    })
  },

  loadLatestRecordInfo() {
    const app = getApp()
    const vehicleId = app.globalData.currentVehicleId
    if (!vehicleId) return
    callFn('record.list', { vehicleId }).then(res => {
      const latest = res && res.list && res.list.length ? res.list[0] : null
      if (!latest) return
      const nextData = {}
      if (latest.odometer) nextData.lastOdometer = latest.odometer
      if (latest.unitPrice != null && latest.unitPrice !== '' && !this.data.unitPrice) {
        nextData.unitPrice = formatDecimal(Number(latest.unitPrice))
      }
      if (Object.keys(nextData).length) this.setData(nextData)
    })
  },

  onDateChange(e) { this.setData({ refuelDate: e.detail.value }) },

  onFuelGradeChange(e) {
    const index = Number(e.detail.value)
    this.setData({ fuelGradeIndex: index, fuelGrade: FUEL_GRADES[index] })
  },

  onLitersInput(e) {
    this.syncAmountAndLiters('liters', e.detail.value)
  },

  onUnitPriceInput(e) {
    this.syncByUnitPrice(e.detail.value)
  },

  onTotalAmountInput(e) {
    this.syncAmountAndLiters('totalAmount', e.detail.value)
  },

  onOdometerInput(e) { this.setData({ odometer: e.detail.value }) },

  syncAmountAndLiters(changedField, rawValue) {
    const nextData = {
      liters: this.data.liters,
      unitPrice: this.data.unitPrice,
      totalAmount: this.data.totalAmount,
      [changedField]: rawValue,
    }
    const unitPrice = parsePositiveNumber(nextData.unitPrice)
    if (!unitPrice) {
      this.setData(nextData)
      return
    }
    const liters = parsePositiveNumber(nextData.liters)
    const totalAmount = parsePositiveNumber(nextData.totalAmount)

    if (changedField === 'liters' && liters) {
      nextData.totalAmount = formatDecimal(liters * unitPrice)
    }

    if (changedField === 'totalAmount' && totalAmount) {
      nextData.liters = formatDecimal(totalAmount / unitPrice)
    }

    this.setData(nextData)
  },

  syncByUnitPrice(rawValue) {
    const nextData = {
      liters: this.data.liters,
      unitPrice: rawValue,
      totalAmount: this.data.totalAmount,
    }
    const unitPrice = parsePositiveNumber(nextData.unitPrice)
    if (!unitPrice) {
      this.setData(nextData)
      return
    }
    const liters = parsePositiveNumber(nextData.liters)
    const totalAmount = parsePositiveNumber(nextData.totalAmount)

    if (totalAmount) {
      nextData.liters = formatDecimal(totalAmount / unitPrice)
    } else if (liters) {
      nextData.totalAmount = formatDecimal(liters * unitPrice)
    }

    this.setData(nextData)
  },

  onTankFullChange(e) {
    // data-value="0" → 已跳枪(true)，data-value="1" → 未跳枪(false)
    this.setData({ tankFull: parseInt(e.currentTarget.dataset.value) === 0 })
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onSave() {
    const { currentVehicle, isEdit, recordId, refuelDate, fuelGrade, liters, unitPrice, totalAmount, odometer, tankFull } = this.data

    if (!currentVehicle) {
      wx.showToast({ title: '请先到「我的」选择车辆', icon: 'none' })
      return
    }
    if (!refuelDate || !liters || !totalAmount || !odometer) {
      wx.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }

    const record = {
      vehicleId: currentVehicle._id,
      refuelDate,
      fuelGrade,
      liters: parseFloat(liters),
      unitPrice: parseFloat(unitPrice) || 0,
      totalAmount: parseFloat(totalAmount),
      odometer: parseInt(odometer),
      tankFull,
      importSource: 'manual',
    }
    record.issueFlags = validateRecord(record)

    this.setData({ loading: true })
    const fn = isEdit
      ? callFn('record.update', { id: recordId, data: record })
      : callFn('record.add', { data: record })

    fn.then(() => {
      wx.showToast({ title: '保存成功' })
      setTimeout(() => wx.navigateBack(), 900)
    }).catch(() => {
      wx.showToast({ title: '保存失败', icon: 'error' })
    }).finally(() => {
      this.setData({ loading: false })
    })
  },
})
