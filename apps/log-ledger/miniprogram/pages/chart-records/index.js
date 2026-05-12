const { calcRecordMonth, currentRecordMonth, billingPeriodRange, billingYearRange, daysInclusive, fenToYuan, formatDate, addMonth } = require('../../utils/date')
const { getIconEmoji } = require('../../utils/categories')

function decodeParam(value) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d
}

function parseDate(value) {
  if (value instanceof Date) return new Date(value)
  return new Date(String(value).replace(/-/g, '/'))
}

function getWeekEnd(startDate) {
  const end = parseDate(startDate)
  end.setDate(end.getDate() + 6)
  return end
}

function formatWeekRangeDisplay(startDate, endDate) {
  return `${startDate.getMonth() + 1}/${startDate.getDate()}-${endDate.getMonth() + 1}/${endDate.getDate()}`
}

function formatMonthDay(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatFullDate(dateStr) {
  const [year, month, day] = String(dateStr).split('-')
  return `${year}年${month}月${day}日`
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

Page({
  data: {
    viewOptions: [{ key: 'week', label: '周' }, { key: 'month', label: '月' }, { key: 'year', label: '年' }],
    sortOptions: [{ key: 'amount', label: '按金额' }, { key: 'time', label: '按时间' }],
    categoryId: '',
    categoryName: '',
    categoryIcon: '',
    categoryEmoji: '💰',
    statType: 'expense',
    currentView: 'week',
    sortBy: 'amount',
    weekStartDate: '',
    weekEndDate: '',
    weekRangeDisplay: '',
    currentRecordMonth: '',
    currentYear: 0,
    periodShortLabel: '',
    periodLabel: '',
    canGoNext: false,
    totalDisplay: '0.00',
    avgDisplay: '0.00',
    avgLabel: '平均值',
    maxDisplay: '0.00',
    recordCount: 0,
    xLabels: [],
    recordList: [],
    loading: false,
  },

  onLoad(options) {
    const app = getApp() || { globalData: { cycleStartDay: 1 } }
    const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1
    const today = new Date()
    const defaultWeekStart = getWeekStart(today)
    const weekStartDate = options.startDate || formatDate(defaultWeekStart)
    const weekEndDate = options.endDate || formatDate(getWeekEnd(weekStartDate))
    const recordMonth = options.recordMonth || currentRecordMonth(cycleStartDay)
    const categoryId = decodeParam(options.categoryId)
    const categoryName = decodeParam(options.categoryName)
    const categoryIcon = decodeParam(options.categoryIcon)
    const statType = options.statType || 'expense'
    const currentView = options.view || 'week'
    const currentYear = Number(options.year) || Number(recordMonth.split('-')[0]) || new Date().getFullYear()
    const nextData = {
      categoryId,
      categoryName,
      categoryIcon,
      categoryEmoji: getIconEmoji(categoryIcon) || '💰',
      statType,
      currentView,
      weekStartDate,
      weekEndDate,
      currentRecordMonth: recordMonth,
      currentYear,
    }
    this.setData({
      ...nextData,
      ...this.buildPeriodMeta(nextData),
    })
    wx.setNavigationBarTitle({
      title: categoryName || (statType === 'expense' ? '支出详情' : '收入详情'),
    })
  },

  onShow() {
    this.syncCycleStartDay().then(() => {
      const periodData = this.buildPeriodMeta(this.data)
      this.setData(periodData, () => this.loadRecords())
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

  buildPeriodMeta(source) {
    const app = getApp() || { globalData: { cycleStartDay: 1 } }
    const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1
    const selectedWeekStart = source.weekStartDate || formatDate(getWeekStart(new Date()))
    const selectedWeekEnd = source.weekEndDate || formatDate(getWeekEnd(selectedWeekStart))
    const selectedRecordMonth = source.currentRecordMonth || currentRecordMonth(cycleStartDay)
    const selectedYear = Number(source.currentYear) || new Date().getFullYear()
    const todayWeekStart = formatDate(getWeekStart(new Date()))
    const currentBillingMonth = currentRecordMonth(cycleStartDay)
    const currentYearValue = Number(currentRecordMonth(cycleStartDay).split('-')[0])
    const weekStart = parseDate(selectedWeekStart)
    const weekEnd = parseDate(selectedWeekEnd)
    const weekRangeDisplay = formatWeekRangeDisplay(weekStart, weekEnd)
    let periodShortLabel = ''
    let periodLabel = ''
    let canGoNext = false

    if (source.currentView === 'week') {
      periodShortLabel = selectedWeekStart === todayWeekStart ? '本周' : weekRangeDisplay
      periodLabel = `${selectedWeekStart} 至 ${selectedWeekEnd}`
      canGoNext = selectedWeekStart < todayWeekStart
    } else if (source.currentView === 'month') {
      const { start, end } = billingPeriodRange(selectedRecordMonth, cycleStartDay)
      periodShortLabel = selectedRecordMonth === currentBillingMonth ? '本账期' : `${selectedRecordMonth} 账期`
      periodLabel = `${start} 至 ${end}`
      canGoNext = selectedRecordMonth < currentBillingMonth
    } else {
      periodShortLabel = `${selectedYear}年`
      const { start, end } = billingYearRange(selectedYear, cycleStartDay)
      periodLabel = `${start} 至 ${end}`
      canGoNext = selectedYear < currentYearValue
    }

    return {
      weekRangeDisplay,
      periodShortLabel,
      periodLabel,
      canGoNext,
    }
  },

  applyFilters(nextData) {
    const merged = { ...this.data, ...nextData }
    this.setData({
      ...nextData,
      ...this.buildPeriodMeta(merged),
    }, () => this.loadRecords())
  },

  switchView(e) {
    const key = e.currentTarget.dataset.key
    if (!key || key === this.data.currentView) return
    this.applyFilters({ currentView: key })
  },

  onSortChange(e) {
    const key = e.currentTarget.dataset.key
    if (!key || key === this.data.sortBy) return
    this.setData({
      sortBy: key,
      recordList: this.sortRecords(this.rawRecords || [], key, this.totalAmount || 0),
    })
  },

  prevPeriod() {
    const { currentView, weekStartDate, currentRecordMonth: selectedRecordMonth, currentYear } = this.data
    if (currentView === 'week') {
      const start = parseDate(weekStartDate)
      start.setDate(start.getDate() - 7)
      this.applyFilters({
        weekStartDate: formatDate(start),
        weekEndDate: formatDate(getWeekEnd(start)),
      })
      return
    }
    if (currentView === 'month') {
      this.applyFilters({ currentRecordMonth: addMonth(selectedRecordMonth, -1) })
      return
    }
    this.applyFilters({ currentYear: currentYear - 1 })
  },

  nextPeriod() {
    if (!this.data.canGoNext) return
    const { currentView, weekStartDate, currentRecordMonth: selectedRecordMonth, currentYear } = this.data
    if (currentView === 'week') {
      const start = parseDate(weekStartDate)
      start.setDate(start.getDate() + 7)
      this.applyFilters({
        weekStartDate: formatDate(start),
        weekEndDate: formatDate(getWeekEnd(start)),
      })
      return
    }
    if (currentView === 'month') {
      this.applyFilters({ currentRecordMonth: addMonth(selectedRecordMonth, 1) })
      return
    }
    this.applyFilters({ currentYear: currentYear + 1 })
  },

  buildQuery() {
    const { currentView, statType, weekStartDate, weekEndDate, currentRecordMonth, currentYear, categoryId, categoryName } = this.data
    const db = wx.cloud.database()
    const _ = db.command
    const query = {
      type: statType,
      is_deleted: false,
    }

    if (categoryId) query.category_id = categoryId
    else if (categoryName) query.category_name = categoryName

    let periodLabel = ''
    const app = getApp() || { globalData: { cycleStartDay: 1 } }
    const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1

    if (currentView === 'week') {
      query.record_date = _.gte(weekStartDate).and(_.lte(weekEndDate))
      periodLabel = `${weekStartDate} 至 ${weekEndDate}`
    } else if (currentView === 'month') {
      const { start, end } = billingPeriodRange(currentRecordMonth, cycleStartDay)
      query.record_date = _.gte(start).and(_.lte(end))
      periodLabel = `${currentRecordMonth} 账期`
    } else {
      const { start, end } = billingYearRange(currentYear, cycleStartDay)
      query.record_date = _.gte(start).and(_.lte(end))
      periodLabel = `${currentYear} 年`
    }

    return { query, periodLabel }
  },

  fetchAllRecords(query) {
    const db = wx.cloud.database()
    const batchSize = 20
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

  loadRecords() {
    const { query } = this.buildQuery()
    this.setData({ loading: true })
    this.fetchAllRecords(query)
      .then((records) => {
        const list = (records || []).map((record) => ({
          ...record,
          emoji: getIconEmoji(record.category_icon),
          amountDisplay: fenToYuan(record.amount),
        }))
        const categoryIcon = this.data.categoryIcon || (list[0] && list[0].category_icon) || ''
        const categoryEmoji = getIconEmoji(categoryIcon) || this.data.categoryEmoji || '💰'
        const stats = this.buildStats(list)
        this.rawRecords = list
        this.totalAmount = stats.totalAmount
        this.setData({
          categoryIcon,
          categoryEmoji,
          totalDisplay: stats.totalDisplay,
          avgDisplay: stats.avgDisplay,
          maxDisplay: stats.maxDisplay,
          recordCount: stats.recordCount,
          xLabels: stats.xLabels,
          recordList: stats.recordList,
          loading: false,
        }, () => this.drawChart(stats.chartSeries))
      })
      .catch((e) => {
        console.error('load chart records error', e)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  buildStats(records) {
    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0)
    const chartSeries = this.buildChartSeries(records)
    const maxAmount = chartSeries.reduce((maxValue, item) => Math.max(maxValue, item.amount), 0)
    const divisor = this.getDivisor()
    const avgAmount = Math.round((totalAmount || 0) / divisor)

    return {
      totalAmount,
      totalDisplay: fenToYuan(totalAmount),
      avgDisplay: fenToYuan(avgAmount),
      maxDisplay: fenToYuan(maxAmount),
      recordCount: records.length,
      xLabels: chartSeries.map(item => item.label),
      recordList: this.sortRecords(records, this.data.sortBy, totalAmount),
      chartSeries,
    }
  },

  buildChartSeries(records) {
    const series = []
    const valueMap = {}
    const cycleStartDay = ((getApp() || { globalData: { cycleStartDay: 1 } }).globalData || {}).cycleStartDay || 1
    records.forEach((record) => {
      const key = this.data.currentView === 'year' ? calcRecordMonth(record.record_date, cycleStartDay) : record.record_date
      valueMap[key] = (valueMap[key] || 0) + record.amount
    })

    if (this.data.currentView === 'year') {
      for (let month = 1; month <= 12; month++) {
        const key = `${this.data.currentYear}-${String(month).padStart(2, '0')}`
        series.push({
          key,
          label: `${month}`,
          amount: valueMap[key] || 0,
        })
      }
      return series
    }

    let startDate = this.data.weekStartDate
    let endDate = this.data.weekEndDate

    if (this.data.currentView === 'month') {
      const range = billingPeriodRange(this.data.currentRecordMonth, cycleStartDay)
      startDate = range.start
      endDate = range.end
    }

    const start = parseDate(startDate)
    const end = parseDate(endDate)
    const totalDays = daysInclusive(startDate, endDate)
    for (let index = 0; index < totalDays; index++) {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = formatDate(date)
      series.push({
        key,
        label: this.buildDateAxisLabel(date, index, totalDays),
        amount: valueMap[key] || 0,
      })
    }

    return series
  },

  buildDateAxisLabel(date, index, totalDays) {
    if (this.data.currentView === 'week') return formatMonthDay(date)
    const day = date.getDate()
    if (index === 0 || index === totalDays - 1 || day === 10 || day === 20 || day === 30) {
      return String(day).padStart(2, '0')
    }
    return ''
  },

  getDivisor() {
    if (this.data.currentView === 'year') return 12
    if (this.data.currentView === 'month') {
      const app = getApp() || { globalData: { cycleStartDay: 1 } }
      const cycleStartDay = (app.globalData && app.globalData.cycleStartDay) || 1
      const range = billingPeriodRange(this.data.currentRecordMonth, cycleStartDay)
      return daysInclusive(range.start, range.end)
    }
    return 7
  },

  sortRecords(records, sortBy, totalAmount) {
    const sorted = records.slice().sort((a, b) => {
      if (sortBy === 'amount' && b.amount !== a.amount) return b.amount - a.amount
      const dateDiff = String(b.record_date).localeCompare(String(a.record_date))
      if (dateDiff !== 0) return dateDiff
      return this.getCreatedAtValue(b) - this.getCreatedAtValue(a)
    })

    return sorted.map((record) => {
      const percentValue = totalAmount > 0 ? (record.amount / totalAmount) * 100 : 0
      return {
        ...record,
        percentDisplay: percentValue.toFixed(1),
        barWidth: percentValue > 0 ? Math.max(percentValue, 2) : 0,
        dateDisplay: formatFullDate(record.record_date),
      }
    })
  },

  getCreatedAtValue(record) {
    if (!record || !record.created_at) return 0
    return new Date(record.created_at).getTime()
  },

  drawChart(series) {
    wx.createSelectorQuery().in(this).select('#detailLineChart').fields({ node: true, size: true }).exec((res) => {
      const canvas = res[0] && res[0].node
      const width = (res[0] && res[0].width) || 375
      const height = (res[0] && res[0].height) || 180
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const dpr = getPixelRatio()
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      const plotSeries = series && series.length ? series : [{ key: 'empty-0', amount: 0, label: '' }, { key: 'empty-1', amount: 0, label: '' }]
      const pointsSeries = plotSeries.length === 1 ? [plotSeries[0], { ...plotSeries[0], key: `${plotSeries[0].key}-copy` }] : plotSeries
      const paddingLeft = 20
      const paddingRight = 20
      const paddingTop = 18
      const paddingBottom = 26
      const chartWidth = width - paddingLeft - paddingRight
      const chartHeight = height - paddingTop - paddingBottom
      const maxValue = Math.max(...pointsSeries.map(item => item.amount), 1)

      ctx.clearRect(0, 0, width, height)
      ctx.strokeStyle = '#F0F0F0'
      ctx.lineWidth = 1
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([8, 8])
      for (let index = 0; index <= 2; index++) {
        const y = paddingTop + (chartHeight / 2) * index
        ctx.beginPath()
        ctx.moveTo(paddingLeft, y)
        ctx.lineTo(width - paddingRight, y)
        ctx.stroke()
      }
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([])

      const stepX = chartWidth / Math.max(pointsSeries.length - 1, 1)
      const points = pointsSeries.map((item, index) => ({
        x: paddingLeft + (index * stepX),
        y: paddingTop + chartHeight - ((item.amount / maxValue) * chartHeight),
      }))

      const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight)
      gradient.addColorStop(0, 'rgba(255, 208, 0, 0.24)')
      gradient.addColorStop(1, 'rgba(255, 208, 0, 0)')

      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let index = 1; index < points.length; index++) {
        const controlPoint = {
          x: (points[index - 1].x + points[index].x) / 2,
          y: (points[index - 1].y + points[index].y) / 2,
        }
        ctx.quadraticCurveTo(points[index - 1].x, points[index - 1].y, controlPoint.x, controlPoint.y)
      }
      ctx.lineTo(points[points.length - 1].x, paddingTop + chartHeight)
      ctx.lineTo(points[0].x, paddingTop + chartHeight)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.beginPath()
      ctx.strokeStyle = '#4A4745'
      ctx.lineWidth = 2
      ctx.moveTo(points[0].x, points[0].y)
      for (let index = 1; index < points.length; index++) {
        const controlPoint = {
          x: (points[index - 1].x + points[index].x) / 2,
          y: (points[index - 1].y + points[index].y) / 2,
        }
        ctx.quadraticCurveTo(points[index - 1].x, points[index - 1].y, controlPoint.x, controlPoint.y)
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
      ctx.stroke()

    })
  },

  onRecordTap(e) {
    wx.navigateTo({
      url: `/pages/record/detail?id=${e.currentTarget.dataset.id}`,
    })
  },

  onRecordLongPress(e) {
    const { record } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['删除'],
      success: (res) => {
        if (res.tapIndex !== 0) return
        const db = wx.cloud.database()
        db.collection('ledger_records')
          .doc(record._id)
          .update({ data: { is_deleted: true, updated_at: new Date() } })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadRecords()
          })
      },
    })
  },

  onChartTouchStart() {},
  onChartTouchMove() {},
  onChartTouchEnd() {},
})
