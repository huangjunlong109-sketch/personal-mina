const { currentRecordMonth } = require('../../utils/date')

const currentY = () => {
  const app = getApp() || { globalData: { cycleStartDay: 1 } }
  const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1
  return Number(currentRecordMonth(cycleStartDay).split('-')[0])
}

function buildYearLabels(from, to) {
  const labels = []
  for (let y = to; y >= from; y--) labels.push(`${y}年`)
  return labels
}

Page({
  data: {
    billTab: 'month',
    selectedYear: currentY(),
    yearLabels: [],
    yearIndex: 0,
    mainBalance: '0.00',
    mainIncome: '0.00',
    mainExpense: '0.00',
    colA: '月份',
    incomeCol: '月收入',
    expenseCol: '月支出',
    balanceCol: '月结余',
    tableRows: [],
    loading: true,
  },

  onShow() {
    this.syncCycleStartDay().then(() => {
      const tabBar = this.getTabBar()
      if (tabBar) tabBar.setData({ selected: 2 })
      this.ensureYears()
      this.refresh()
    })
  },

  syncCycleStartDay() {
    const app = getApp()
    return wx.cloud.callFunction({ name: 'settings_get' }).then((res) => {
      const settings = res.result && res.result.settings
      if (!settings) return
      const cycleStartDay = settings.cycle_start_day || 1
      if (app && app.globalData) app.globalData.cycleStartDay = cycleStartDay
      if (!this.data.yearLabels.length) this.setData({ selectedYear: Number(currentRecordMonth(cycleStartDay).split('-')[0]) })
    }).catch(() => {})
  },

  ensureYears() {
    const to = currentY()
    const from = to - 15
    const yearLabels = buildYearLabels(from, to)
    let yearIndex = yearLabels.indexOf(`${this.data.selectedYear}年`)
    if (yearIndex < 0) {
      yearIndex = 0
      this.setData({ selectedYear: parseInt(yearLabels[0], 10) })
    }
    this.setData({ yearLabels, yearIndex })
  },

  onBillTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.billTab) return
    this.setData({ billTab: tab }, () => this.refresh())
  },

  onYearChange(e) {
    const idx = Number(e.detail.value)
    const label = this.data.yearLabels[idx]
    const y = parseInt(label, 10)
    this.setData({ yearIndex: idx, selectedYear: y }, () => this.refresh())
  },

  refresh() {
    if (this.data.billTab === 'month') this.loadMonthBill()
    else this.loadYearBill()
  },

  loadMonthBill() {
    this.setData({
      loading: true,
      colA: '账期',
      incomeCol: '月收入',
      expenseCol: '月支出',
      balanceCol: '月结余',
    })
    wx.cloud
      .callFunction({
        name: 'bill_summary',
        data: { mode: 'calendar_year_months', year: this.data.selectedYear },
      })
      .then((res) => {
        const r = res.result || {}
        if (!r.success) throw new Error(r.errMsg || 'fail')
        const tableRows = (r.months || []).map((row) => ({
          rowKey: `m-${row.record_month || row.month}`,
          label: row.label,
          ym: row.record_month || `${r.year}-${String(row.month).padStart(2, '0')}`,
          incomeDisplay: row.incomeDisplay,
          expenseDisplay: row.expenseDisplay,
          balanceDisplay: row.balanceDisplay,
        }))
        this.setData({
          mainBalance: r.yearBalanceDisplay,
          mainIncome: r.yearIncomeDisplay,
          mainExpense: r.yearExpenseDisplay,
          tableRows,
          loading: false,
        })
      })
      .catch((e) => {
        console.error(e)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  loadYearBill() {
    this.setData({
      loading: true,
      colA: '年份',
      incomeCol: '年收入',
      expenseCol: '年支出',
      balanceCol: '年结余',
    })
    wx.cloud
      .callFunction({ name: 'bill_summary', data: { mode: 'calendar_years' } })
      .then((res) => {
        const r = res.result || {}
        if (!r.success) throw new Error(r.errMsg || 'fail')
        const tableRows = (r.years || []).map((row) => ({
          rowKey: `y-${row.year}`,
          label: row.label,
          year: row.year,
          incomeDisplay: row.incomeDisplay,
          expenseDisplay: row.expenseDisplay,
          balanceDisplay: row.balanceDisplay,
        }))
        this.setData({
          mainBalance: r.totalBalanceDisplay,
          mainIncome: r.totalIncomeDisplay,
          mainExpense: r.totalExpenseDisplay,
          tableRows,
          loading: false,
        })
      })
      .catch((e) => {
        console.error(e)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  onRowTap(e) {
    const { ym, year } = e.currentTarget.dataset
    if (this.data.billTab === 'month' && ym) {
      const app = getApp()
      if (app && app.globalData) app.globalData.pendingBillRecordMonth = ym
      wx.switchTab({ url: '/pages/index/index' })
      return
    }
    if (this.data.billTab === 'year' && year) {
      const y = Number(year)
      const yearLabels = this.data.yearLabels
      const idx = yearLabels.indexOf(`${y}年`)
      this.setData({
        billTab: 'month',
        selectedYear: y,
        yearIndex: idx >= 0 ? idx : 0,
      }, () => this.loadMonthBill())
    }
  },
})
