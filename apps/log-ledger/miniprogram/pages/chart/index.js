const { calcRecordMonth, currentRecordMonth, billingPeriodRange, billingYearRange, daysInclusive, fenToYuan, formatDate } = require('../../utils/date')
const { getIconEmoji } = require('../../utils/categories')

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d
}

function getPixelRatio() {
  if (typeof wx.getWindowInfo === 'function') {
    try {
      const info = wx.getWindowInfo()
      if (info && info.pixelRatio) return info.pixelRatio
    } catch (e) {}
  }
  try {
    return wx.getSystemInfoSync().pixelRatio || 1
  } catch (e) {
    return 1
  }
}

function formatMonthDayLabel(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

Page({
  data: {
    viewOptions: [{ key: 'week', label: '周' }, { key: 'month', label: '月' }, { key: 'year', label: '年' }],
    currentView: 'week',
    statType: 'expense',
    weekStartDate: '',
    weekEndDate: '',
    weekRangeDisplay: '',
    isCurrentWeek: true,
    currentRecordMonth: '',
    currentYear: new Date().getFullYear(),
    totalDisplay: '0.00',
    avgLabel: '日均值',
    avgDisplay: '0.00',
    dailyList: [],
    xLabels: [],
    categoryRank: [],
    loading: false,
  },

  onLoad() {
    const app = getApp() || { globalData: { cycleStartDay: 1 } }
    const today = new Date()
    const weekStart = getWeekStart(today)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1
    const ym = currentRecordMonth(cycleStartDay)
    const billingYear = Number(ym.split('-')[0])
    this.setData({
      weekStartDate: formatDate(weekStart),
      weekEndDate: formatDate(weekEnd),
      weekRangeDisplay: `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
      isCurrentWeek: true,
      currentRecordMonth: ym,
      currentYear: billingYear,
    })
  },

  onShow() {
    this.syncCycleStartDay().then(() => {
      const app = getApp() || { globalData: { cycleStartDay: 1 } }
      const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1
      const ym = currentRecordMonth(cycleStartDay)
      this.setData({ currentRecordMonth: ym, currentYear: Number(ym.split('-')[0]) })
      const tabBar = this.getTabBar()
      if (tabBar) tabBar.setData({ selected: 1 })
      this.loadStats()
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

  fetchAllRecords(query) {
    const db = wx.cloud.database()
    const batchSize = 200
    const list = []

    const loadPage = (skip) => {
      return db.collection('ledger_records')
        .where(query)
        .orderBy('record_date', 'desc')
        .orderBy('created_at', 'desc')
        .skip(skip)
        .limit(batchSize)
        .get()
        .then((res) => {
          const pageList = res.data || []
          list.push(...pageList)
          if (pageList.length < batchSize) return list
          return loadPage(skip + batchSize)
        })
    }

    return loadPage(0)
  },

  switchView(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ currentView: key, avgLabel: key === 'year' ? '月均值' : '日均值' })
    this.loadStats()
  },

  toggleStatType() {
    this.setData({ statType: this.data.statType === 'expense' ? 'income' : 'expense' })
    this.loadStats()
  },

  prevWeek() {
    const start = new Date(this.data.weekStartDate)
    start.setDate(start.getDate() - 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const newStart = formatDate(start)
    const todayWeekStart = formatDate(getWeekStart(new Date()))
    this.setData({
      weekStartDate: newStart, weekEndDate: formatDate(end),
      weekRangeDisplay: `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`,
      isCurrentWeek: newStart === todayWeekStart,
    })
    this.loadStats()
  },

  nextWeek() {
    const currentWeekStart = getWeekStart(new Date())
    const start = new Date(this.data.weekStartDate)
    start.setDate(start.getDate() + 7)
    if (start > currentWeekStart) return
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const newStart = formatDate(start)
    this.setData({
      weekStartDate: newStart, weekEndDate: formatDate(end),
      weekRangeDisplay: `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`,
      isCurrentWeek: newStart === formatDate(currentWeekStart),
    })
    this.loadStats()
  },

  prevYear() { this.setData({ currentYear: this.data.currentYear - 1 }); this.loadStats() },
  nextYear() {
    const cycleStartDay = ((getApp() || { globalData: { cycleStartDay: 1 } }).globalData || {}).cycleStartDay || 1
    const maxYear = Number(currentRecordMonth(cycleStartDay).split('-')[0])
    if (this.data.currentYear >= maxYear) return
    this.setData({ currentYear: this.data.currentYear + 1 }); this.loadStats()
  },

  openCategoryRecords(e) {
    const { categoryId, categoryName, categoryIcon } = e.currentTarget.dataset
    const { currentView, statType, weekStartDate, weekEndDate, currentRecordMonth, currentYear } = this.data
    const params = [
      `view=${currentView}`,
      `statType=${statType}`,
      `categoryId=${encodeURIComponent(categoryId || '')}`,
      `categoryName=${encodeURIComponent(categoryName || '')}`,
      `categoryIcon=${encodeURIComponent(categoryIcon || '')}`,
      `startDate=${weekStartDate || ''}`,
      `endDate=${weekEndDate || ''}`,
      `recordMonth=${currentRecordMonth || ''}`,
      `year=${currentYear || ''}`,
    ]
    wx.navigateTo({
      url: `/pages/chart-records/index?${params.join('&')}`,
    })
  },

  loadStats() {
    this.setData({ loading: true })
    const { currentView, statType, weekStartDate, weekEndDate, currentRecordMonth, currentYear } = this.data
    const params = { view: currentView, stat_type: statType }
    if (currentView === 'week') {
      params.week_start = weekStartDate
      params.week_end = weekEndDate
    } else if (currentView === 'month') {
      params.record_month = currentRecordMonth
    } else {
      params.year = currentYear
    }

    const app = getApp() || { globalData: { cycleStartDay: 1 } }
    const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1

    wx.cloud.callFunction({ name: 'stats_query', data: params }).then((res) => {
      const result = (res && res.result) || {}
      const total = result.total || 0
      const daily = result.daily || []
      const categoryRank = (result.category_rank || [])
        .map((item, index) => {
          const nextItem = Object.assign({}, item)
          nextItem.category_id = item.category_id || ''
          nextItem.rowKey = item.category_id || `${item.category_name}-${index}`
          nextItem.emoji = getIconEmoji(item.category_icon)
          nextItem.amountDisplay = fenToYuan(item.amount)
          return nextItem
        })

      let divisor = 7
      if (currentView === 'year') divisor = 12
      else if (currentView === 'month') {
        const { start, end } = billingPeriodRange(currentRecordMonth, cycleStartDay)
        divisor = daysInclusive(start, end)
      }
      const avg = Math.round((total || 0) / divisor)

      this.setData({
        totalDisplay: fenToYuan(total),
        avgDisplay: fenToYuan(avg),
        dailyList: daily,
        xLabels: this.buildXLabels(daily, currentView),
        categoryRank,
        loading: false,
      })
      this.drawChart(daily)
    }).catch(e => {
      if (e && e.errMsg && e.errMsg.includes('timeout')) {
        console.warn('[cloud timeout] ledger.chart.loadStats', e)
      } else {
        console.error('loadStats error', e)
      }
      this.setData({ loading: false })
    })
  },

  buildXLabels(daily, view) {
    if (daily.length === 0) return []
    if (view === 'week') return ['一', '二', '三', '四', '五', '六', '日']
    if (view === 'month') {
      const cycleStartDay = ((getApp() || { globalData: { cycleStartDay: 1 } }).globalData || {}).cycleStartDay || 1
      const { start, end } = billingPeriodRange(this.data.currentRecordMonth, cycleStartDay)
      const startDate = new Date(start)
      const endDate = new Date(end)
      const totalDays = daysInclusive(start, end)
      const checkpoints = [0, Math.floor((totalDays - 1) / 3), Math.floor(((totalDays - 1) * 2) / 3), totalDays - 1]
      return checkpoints.map((offset) => {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + offset)
        if (offset === totalDays - 1) return formatMonthDayLabel(endDate)
        return formatMonthDayLabel(date)
      })
    }
    return ['1月', '4月', '7月', '10月', '12月']
  },

  drawChart(daily) {
    if (daily.length === 0) return
    const plotDaily = daily.length === 1 ? [daily[0], Object.assign({}, daily[0])] : daily
    wx.createSelectorQuery().in(this).select('#lineChart').fields({ node: true, size: true }).exec(res => {
      const canvas = res[0] && res[0].node
      const width = (res[0] && res[0].width) || 375
      const height = (res[0] && res[0].height) || 180
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const dpr = getPixelRatio()
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      const pL = 20, pR = 20, pT = 20, pB = 30
      const chartW = width - pL - pR
      const chartH = height - pT - pB
      const maxVal = Math.max(...plotDaily.map(d => d.amount), 1)
      ctx.clearRect(0, 0, width, height)
      ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 1
      for (let i = 0; i <= 3; i++) {
        const y = pT + (chartH / 3) * i
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(width - pR, y); ctx.stroke()
      }
      const stepX = chartW / Math.max(plotDaily.length - 1, 1)
      const points = plotDaily.map((d, i) => ({ x: pL + i * stepX, y: pT + chartH - (d.amount / maxVal) * chartH }))
      const gradient = ctx.createLinearGradient(0, pT, 0, pT + chartH)
      gradient.addColorStop(0, 'rgba(255,208,0,0.3)')
      gradient.addColorStop(1, 'rgba(255,208,0,0)')
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const cp = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 }
        ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, cp.x, cp.y)
      }
      ctx.lineTo(points[points.length-1].x, points[points.length-1].y)
      ctx.lineTo(points[points.length-1].x, pT + chartH)
      ctx.lineTo(points[0].x, pT + chartH)
      ctx.closePath(); ctx.fillStyle = gradient; ctx.fill()
      ctx.beginPath(); ctx.strokeStyle = '#FFD000'; ctx.lineWidth = 3
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const cp = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 }
        ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, cp.x, cp.y)
      }
      ctx.lineTo(points[points.length-1].x, points[points.length-1].y); ctx.stroke()
      points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'; ctx.fill()
        ctx.strokeStyle = '#FFD000'; ctx.lineWidth = 3; ctx.stroke()
      })
    })
  },

  onChartTouchStart() {},
  onChartTouchMove() {},
  onChartTouchEnd() {},
})
