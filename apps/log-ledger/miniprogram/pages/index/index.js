const { currentRecordMonth, addMonth, fenToYuan, formatDisplayDate } = require('../../utils/date')
const { getIconEmoji } = require('../../utils/categories')
const PAGE_SIZE = 50

function paddedMonthFromYm(ym) {
  const m = ym.split('-')[1] || '01'
  return m.padStart(2, '0')
}

function buildPickerMonthList(year, maxYm) {
  const [maxYear, maxMonth] = String(maxYm).split('-').map(Number)
  if (year > maxYear) return []
  if (year < maxYear) return Array.from({ length: 12 }, (_, i) => i + 1)
  return Array.from({ length: maxMonth }, (_, i) => i + 1)
}

function getCycleStartDay() {
  const app = getApp() || { globalData: { cycleStartDay: 1 } }
  return (app.globalData && app.globalData.cycleStartDay) || 1
}

function getStatusBarHeight() {
  if (typeof wx.getWindowInfo === 'function') {
    try {
      const info = wx.getWindowInfo()
      if (typeof info.statusBarHeight === 'number') return info.statusBarHeight
    } catch (e) {}
  }
  try {
    return wx.getSystemInfoSync().statusBarHeight || 20
  } catch (e) {
    return 20
  }
}

Page({
  data: {
    statusBarHeight: 20,
    currentYear: '',
    currentMonthNum: '',
    currentMonthPadded: '',
    currentRecordMonth: '',
    naturalFilterYm: '',
    totalIncomeDisplay: '0.00',
    totalExpenseDisplay: '0.00',
    groupedList: [],
    loading: true,
    refreshing: false,
    loadingMore: false,
    hasMore: true,
    pageOffset: 0,
    hasManualPeriodSelection: false,
    listScrollTop: 0,
    showMonthPicker: false,
    pickerYears: [],
    pickerMonths: [],
    pickerValue: [0, 0],
  },

  onLoad() {
    const statusBarHeight = getStatusBarHeight()
    const ym = currentRecordMonth(getCycleStartDay())
    const [y, m] = ym.split('-')
    this.setData({
      statusBarHeight,
      currentRecordMonth: ym,
      naturalFilterYm: ym,
      currentYear: y,
      currentMonthNum: String(parseInt(m, 10)),
      currentMonthPadded: paddedMonthFromYm(ym),
    })
  },

  onShow() {
    this.syncCycleStartDay().then(() => {
      const app = getApp() || { globalData: {} }
      const latestRecordMonth = currentRecordMonth(getCycleStartDay())
      const pending = app.globalData && app.globalData.pendingBillRecordMonth
      if (pending) {
        app.globalData.pendingBillRecordMonth = ''
        const [y, m] = pending.split('-')
        this.setData({
          naturalFilterYm: pending,
          currentRecordMonth: pending,
          currentYear: y,
          currentMonthNum: String(parseInt(m, 10)),
          currentMonthPadded: paddedMonthFromYm(pending),
          hasManualPeriodSelection: true,
        })
      } else if (!this.data.hasManualPeriodSelection) {
        const [y, m] = latestRecordMonth.split('-')
        this.setData({
          naturalFilterYm: latestRecordMonth,
          currentRecordMonth: latestRecordMonth,
          currentYear: y,
          currentMonthNum: String(parseInt(m, 10)),
          currentMonthPadded: paddedMonthFromYm(latestRecordMonth),
        })
      }
      this.refreshPage()
      const tabBar = this.getTabBar()
      if (tabBar) tabBar.setData({ selected: 0 })
    })
  },

  syncCycleStartDay() {
    const app = getApp()
    return wx.cloud.callFunction({ name: 'settings_get' }).then((res) => {
      const settings = res.result && res.result.settings
      if (!settings) return
      const cycleStartDay = settings.cycle_start_day || 1
      if (app && app.globalData) app.globalData.cycleStartDay = cycleStartDay
    }).catch(() => {})
  },

  onRefresh() {
    this.setData({ refreshing: true })
    this.refreshPage().finally(() => this.setData({ refreshing: false }))
  },

  refreshPage() {
    const ym = this.data.currentRecordMonth || this.data.naturalFilterYm || currentRecordMonth(getCycleStartDay())
    const requestKey = `${ym}-${Date.now()}`
    this._activeMonthRequestKey = requestKey
    this._records = []
    this._edgeSwitchEnabledAt = Date.now() + 500
    this.setData({
      loading: true,
      loadingMore: false,
      hasMore: true,
      pageOffset: 0,
      listScrollTop: 0,
    })

    this.fetchMonthSummary(ym).then((summary) => {
      if (!this.isActiveMonthRequest(requestKey, ym)) return
      this.setData({
        totalExpenseDisplay: fenToYuan(summary.totalExpense),
        totalIncomeDisplay: fenToYuan(summary.totalIncome),
      })
    }).catch(error => console.error('load summary error', error))

    return this.fetchRecordPage(ym, 0).then((result) => {
      if (!this.isActiveMonthRequest(requestKey, ym)) return
      this.applyRecordPage(result, true)
    }).catch((error) => {
      if (!this.isActiveMonthRequest(requestKey, ym)) return

      console.error('load records error', error)
      this.setData({
        groupedList: [],
        loading: false,
        loadingMore: false,
        hasMore: false,
        pageOffset: 0,
      })
    })
  },

  fetchMonthSummary(recordMonth) {
    return Promise.all([
      wx.cloud.callFunction({
        name: 'stats_query',
        data: { view: 'month', stat_type: 'expense', record_month: recordMonth },
      }),
      wx.cloud.callFunction({
        name: 'stats_query',
        data: { view: 'month', stat_type: 'income', record_month: recordMonth },
      }),
    ]).then(([expenseRes, incomeRes]) => ({
      totalExpense: (expenseRes.result && expenseRes.result.total) || 0,
      totalIncome: (incomeRes.result && incomeRes.result.total) || 0,
    }))
  },

  fetchRecordPage(recordMonth, offset) {
    return wx.cloud.callFunction({
      name: 'record_list',
      data: {
        record_month: recordMonth,
        offset,
        page_size: PAGE_SIZE,
      },
    }).then(res => res.result || {})
  },

  isActiveMonthRequest(requestKey, recordMonth) {
    return this._activeMonthRequestKey === requestKey
      && recordMonth === (this.data.currentRecordMonth || this.data.naturalFilterYm)
  },

  applyRecordPage(result, reset) {
    const prevRecords = reset ? [] : (this._records || [])
    const nextRecords = prevRecords.concat((result.list || []).map(r => {
      const record = Object.assign({}, r)
      record.emoji = getIconEmoji(r.category_icon)
      record.amountDisplay = fenToYuan(r.amount)
      return record
    }))

    this._records = nextRecords
    this.setData({
      groupedList: this.groupByDate(nextRecords),
      hasMore: !!result.has_more,
      pageOffset: result.next_offset != null ? result.next_offset : nextRecords.length,
      loading: false,
      loadingMore: false,
    })
  },

  groupByDate(records) {
    const map = {}
    for (const r of records) {
      if (!map[r.record_date]) map[r.record_date] = []
      map[r.record_date].push(r)
    }
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(date => {
      const recs = map[date]
      const expense = recs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
      return { date, dateDisplay: formatDisplayDate(date), records: recs, expenseDisplay: fenToYuan(expense) }
    })
  },

  prevMonth() {
    const base = this.data.currentRecordMonth || currentRecordMonth(getCycleStartDay())
    const prev = addMonth(base, -1)
    const [y, m] = prev.split('-')
    this.setData({
      currentRecordMonth: prev,
      naturalFilterYm: prev,
      currentYear: y,
      currentMonthNum: String(parseInt(m, 10)),
      currentMonthPadded: paddedMonthFromYm(prev),
      hasManualPeriodSelection: true,
    })
    this.refreshPage()
  },

  nextMonth() {
    const cycleStartDay = getCycleStartDay()
    const base = this.data.currentRecordMonth || currentRecordMonth(cycleStartDay)
    const next = addMonth(base, 1)
    const cap = currentRecordMonth(cycleStartDay)
    if (next > cap) {
      wx.showToast({ title: '不能查看未来账期', icon: 'none' })
      return
    }
    const [y, m] = next.split('-')
    this.setData({
      currentRecordMonth: next,
      naturalFilterYm: next,
      currentYear: y,
      currentMonthNum: String(parseInt(m, 10)),
      currentMonthPadded: paddedMonthFromYm(next),
      hasManualPeriodSelection: true,
    })
    this.refreshPage()
  },

  canSwitchByScroll() {
    return !this.data.loading
      && !this.data.loadingMore
      && !this.data.refreshing
      && Date.now() >= (this._edgeSwitchEnabledAt || 0)
  },

  handleScrollToUpper() {
    if (!this.canSwitchByScroll()) return
    const currentYm = this.data.currentRecordMonth || currentRecordMonth(getCycleStartDay())
    const latestYm = currentRecordMonth(getCycleStartDay())
    if (currentYm >= latestYm) return
    this._edgeSwitchEnabledAt = Date.now() + 500
    this.nextMonth()
  },

  handleScrollToLower() {
    if (!this.canSwitchByScroll()) return

    if (this.data.hasMore) {
      return this.loadMore()
    }
  },

  onFooterPrevMonth() {
    if (this.data.loading || this.data.loadingMore || this.data.hasMore) return
    this.prevMonth()
  },

  goBill() {
    wx.switchTab({ url: '/pages/bill/index' })
  },

  openMonthPicker() {
    const currentYm = currentRecordMonth(getCycleStartDay())
    const cy = Number(currentYm.split('-')[0])
    const minY = cy - 15
    const pickerYears = []
    for (let y = minY; y <= cy; y++) pickerYears.push(y)
    const ym = this.data.currentRecordMonth || currentYm
    const [sy, sm] = ym.split('-').map(Number)
    let yIdx = pickerYears.indexOf(sy)
    if (yIdx < 0) yIdx = pickerYears.length - 1
    const pickerMonths = buildPickerMonthList(pickerYears[yIdx], currentYm)
    let mIdx = pickerMonths.indexOf(sm)
    if (mIdx < 0) mIdx = Math.max(0, pickerMonths.length - 1)
    this.setData({
      showMonthPicker: true,
      pickerYears,
      pickerMonths,
      pickerValue: [yIdx, mIdx],
    })
  },

  closeMonthPicker() {
    this.setData({ showMonthPicker: false })
  },

  noop() {},

  onPickerViewChange(e) {
    const val = e.detail.value
    if (!val || val.length < 2) return
    const yIdx = val[0]
    const mIdx = val[1]
    const years = this.data.pickerYears
    const year = years[yIdx]
    const months = buildPickerMonthList(year, currentRecordMonth(getCycleStartDay()))
    let mIdx2 = mIdx
    if (mIdx2 >= months.length) mIdx2 = Math.max(0, months.length - 1)
    if (mIdx2 < 0) mIdx2 = 0
    this.setData({
      pickerMonths: months,
      pickerValue: [yIdx, mIdx2],
    })
  },

  confirmMonthPicker() {
    const years = this.data.pickerYears
    const months = this.data.pickerMonths
    const pv = this.data.pickerValue
    const y = years[pv[0]]
    const mo = months[pv[1]]
    if (y == null || mo == null) {
      this.closeMonthPicker()
      return
    }
    const ym = `${y}-${String(mo).padStart(2, '0')}`
    const cap = currentRecordMonth(getCycleStartDay())
    if (ym > cap) {
      wx.showToast({ title: '不能选择未来账期', icon: 'none' })
      return
    }
    this.setData({
      showMonthPicker: false,
      naturalFilterYm: ym,
      currentRecordMonth: ym,
      currentYear: String(y),
      currentMonthNum: String(mo),
      currentMonthPadded: String(mo).padStart(2, '0'),
      hasManualPeriodSelection: true,
    })
    this.refreshPage()
  },

  onRecordTap(e) {
    wx.navigateTo({ url: `/pages/record/detail?id=${e.currentTarget.dataset.id}` })
  },

  onRecordLongPress(e) {
    const { record } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: res => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/record/index?id=${record._id}` })
          return
        }
        if (res.tapIndex === 1) {
          wx.showModal({
            title: '确认删除',
            content: '删除后不可恢复',
            confirmColor: '#FF4444',
            success: modalRes => {
              if (!modalRes.confirm) return
              const db = wx.cloud.database()
              db.collection('ledger_records').doc(record._id)
                .update({ data: { is_deleted: true, updated_at: new Date() } })
                .then(() => {
                  wx.showToast({ title: '已删除', icon: 'success' })
                  this.refreshPage()
                })
            },
          })
        }
      },
    })
  },

  loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return

    const ym = this.data.currentRecordMonth || this.data.naturalFilterYm || currentRecordMonth(getCycleStartDay())
    const requestKey = this._activeMonthRequestKey
    this.setData({ loadingMore: true })

    this.fetchRecordPage(ym, Number(this.data.pageOffset) || 0)
      .then(result => {
        if (!this.isActiveMonthRequest(requestKey, ym)) return
        this.applyRecordPage(result, false)
      })
      .catch(e => {
        if (!this.isActiveMonthRequest(requestKey, ym)) return
        console.error('loadMore error', e)
        this.setData({ loadingMore: false })
      })
  },
})
