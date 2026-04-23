import { currentRecordMonth, addMonth, fenToYuan, formatDisplayDate } from '../../utils/date'
import { getIconEmoji } from '../../utils/categories'

const app = getApp<IAppOption>()
const PAGE_SIZE = 100

function getCycleStartDay(): number {
  return app.globalData.cycleStartDay || 1
}

function paddedMonthFromYm(ym: string): string {
  const m = ym.split('-')[1] || '01'
  return m.padStart(2, '0')
}

function buildPickerMonthList(year: number, maxYm: string): number[] {
  const [maxYear, maxMonth] = maxYm.split('-').map(Number)
  if (year > maxYear) return []
  if (year < maxYear) return Array.from({ length: 12 }, (_, i) => i + 1)
  return Array.from({ length: maxMonth }, (_, i) => i + 1)
}

function getStatusBarHeight(): number {
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

interface LedgerRecord {
  _id: string
  type: 'expense' | 'income'
  amount: number
  category_name: string
  category_icon: string
  note: string
  record_date: string
  record_month: string
  emoji?: string
  amountDisplay?: string
}

interface DayGroup {
  date: string
  dateDisplay: string
  records: LedgerRecord[]
  expenseDisplay: string
}

interface RecordListResult {
  list?: LedgerRecord[]
  has_more?: boolean
  next_offset?: number
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
    groupedList: [] as DayGroup[],
    loading: true,
    refreshing: false,
    loadingMore: false,
    hasMore: true,
    pageOffset: 0,
    hasManualPeriodSelection: false,
    listScrollTop: 0,
    showMonthPicker: false,
    pickerYears: [] as number[],
    pickerMonths: [] as number[],
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
      const latestRecordMonth = currentRecordMonth(getCycleStartDay())
      const pending = app.globalData.pendingBillRecordMonth
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
      const tabBar = this.getTabBar() as any
      tabBar?.setData?.({ selected: 0 })
    })
  },

  onRefresh() {
    this.setData({ refreshing: true })
    this.refreshPage().finally(() => {
      this.setData({ refreshing: false })
    })
  },

  // 供记账页回调刷新
  onRefreshCallback() {
    this.refreshPage()
  },

  async syncCycleStartDay() {
    try {
      const res = await wx.cloud.callFunction({ name: 'settings_get' }) as any
      const settings = res.result && res.result.settings
      if (!settings) return
      app.globalData.cycleStartDay = settings.cycle_start_day || 1
    } catch (e) {}
  },

  async refreshPage() {
    const ym = this.data.currentRecordMonth || this.data.naturalFilterYm || currentRecordMonth(getCycleStartDay())
    const requestKey = `${ym}-${Date.now()}`
    ;(this as any)._activeMonthRequestKey = requestKey
    ;(this as any)._records = []
    ;(this as any)._edgeSwitchEnabledAt = Date.now() + 500
    this.setData({
      loading: true,
      loadingMore: false,
      hasMore: true,
      pageOffset: 0,
      listScrollTop: 0,
    })

    const [summaryRes, listRes] = await Promise.all([
      this.fetchMonthSummary(ym)
        .then((value) => ({ ok: true, value }))
        .catch((error) => ({ ok: false, error })),
      this.fetchRecordPage(ym, 0)
        .then((value) => ({ ok: true, value }))
        .catch((error) => ({ ok: false, error })),
    ])
    if (!this.isActiveMonthRequest(requestKey, ym)) return

    if (summaryRes.ok) {
      const { totalExpense, totalIncome } = summaryRes.value
      this.setData({
        totalExpenseDisplay: fenToYuan(totalExpense),
        totalIncomeDisplay: fenToYuan(totalIncome),
      })
    } else {
      console.error('load summary error', summaryRes.error)
    }

    if (listRes.ok) {
      this.applyRecordPage(listRes.value, true)
      return
    }

    console.error('load records error', listRes.error)
    this.setData({
      groupedList: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      pageOffset: 0,
    })
  },

  async fetchMonthSummary(recordMonth: string): Promise<{ totalExpense: number; totalIncome: number }> {
    const [expenseRes, incomeRes] = await Promise.all([
      wx.cloud.callFunction({
        name: 'stats_query',
        data: { view: 'month', stat_type: 'expense', record_month: recordMonth },
      }),
      wx.cloud.callFunction({
        name: 'stats_query',
        data: { view: 'month', stat_type: 'income', record_month: recordMonth },
      }),
    ]) as any

    return {
      totalExpense: (expenseRes.result && expenseRes.result.total) || 0,
      totalIncome: (incomeRes.result && incomeRes.result.total) || 0,
    }
  },

  async fetchRecordPage(recordMonth: string, offset: number): Promise<RecordListResult> {
    const res = await wx.cloud.callFunction({
      name: 'record_list',
      data: {
        record_month: recordMonth,
        offset,
        page_size: PAGE_SIZE,
      },
    }) as any
    return res.result || {}
  },

  isActiveMonthRequest(requestKey: string, recordMonth: string): boolean {
    return (this as any)._activeMonthRequestKey === requestKey
      && recordMonth === (this.data.currentRecordMonth || this.data.naturalFilterYm)
  },

  applyRecordPage(result: RecordListResult, reset: boolean) {
    const page = this as any
    const prevRecords: LedgerRecord[] = reset ? [] : (page._records || [])
    const nextRecords: LedgerRecord[] = prevRecords.concat(
      ((result.list || []) as LedgerRecord[]).map((r) => {
        const record = Object.assign({}, r) as LedgerRecord
        record.emoji = getIconEmoji(r.category_icon)
        record.amountDisplay = fenToYuan(r.amount)
        return record
      }),
    )

    page._records = nextRecords
    this.setData({
      groupedList: this.groupByDate(nextRecords),
      hasMore: !!result.has_more,
      pageOffset: result.next_offset != null ? result.next_offset : nextRecords.length,
      loading: false,
      loadingMore: false,
    })
  },

  groupByDate(records: LedgerRecord[]): DayGroup[] {
    const map: Record<string, LedgerRecord[]> = {}
    for (const r of records) {
      if (!map[r.record_date]) map[r.record_date] = []
      map[r.record_date].push(r)
    }
    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        const recs = map[date]
        const expense = recs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
        return {
          date,
          dateDisplay: formatDisplayDate(date),
          records: recs,
          expenseDisplay: fenToYuan(expense),
        }
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
    const base = this.data.currentRecordMonth || currentRecordMonth(getCycleStartDay())
    const next = addMonth(base, 1)
    const cap = currentRecordMonth(getCycleStartDay())
    if (next > cap) {
      wx.showToast({ title: '不能查看未来月份', icon: 'none' })
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

  canSwitchByScroll(): boolean {
    return !this.data.loading
      && !this.data.loadingMore
      && !this.data.refreshing
      && Date.now() >= (((this as any)._edgeSwitchEnabledAt as number) || 0)
  },

  handleScrollToUpper() {
    if (!this.canSwitchByScroll()) return
    const currentYm = this.data.currentRecordMonth || currentRecordMonth(getCycleStartDay())
    const latestYm = currentRecordMonth(getCycleStartDay())
    if (currentYm >= latestYm) return
    ;(this as any)._edgeSwitchEnabledAt = Date.now() + 500
    this.nextMonth()
  },

  async handleScrollToLower() {
    if (!this.canSwitchByScroll()) return

    if (this.data.hasMore) {
      await this.loadMore()
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
    const pickerYears: number[] = []
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

  onPickerViewChange(e: any) {
    const val = e.detail.value as number[]
    if (!val || val.length < 2) return
    const yIdx = val[0]
    const mIdx = val[1]
    const years = this.data.pickerYears as number[]
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
    const years = this.data.pickerYears as number[]
    const months = this.data.pickerMonths as number[]
    const pv = this.data.pickerValue as number[]
    const y = years[pv[0]]
    const mo = months[pv[1]]
    if (y == null || mo == null) {
      this.closeMonthPicker()
      return
    }
    const ym = `${y}-${String(mo).padStart(2, '0')}`
    const cap = currentRecordMonth(getCycleStartDay())
    if (ym > cap) {
      wx.showToast({ title: '不能选择未来月份', icon: 'none' })
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

  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/record/detail?id=${id}` })
  },

  onRecordLongPress(e: any) {
    const { record } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['删除'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          await wx.cloud.callFunction({ name: 'record_delete', data: { id: record._id } })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.refreshPage()
        }
      },
    })
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return

    const ym = this.data.currentRecordMonth || this.data.naturalFilterYm || currentRecordMonth(getCycleStartDay())
    const requestKey = (this as any)._activeMonthRequestKey
    this.setData({ loadingMore: true })

    try {
      const result = await this.fetchRecordPage(ym, Number(this.data.pageOffset) || 0)
      if (!this.isActiveMonthRequest(requestKey, ym)) return
      this.applyRecordPage(result, false)
    } catch (e) {
      if (!this.isActiveMonthRequest(requestKey, ym)) return
      console.error('loadMore error', e)
      this.setData({ loadingMore: false })
    }
  },
})
