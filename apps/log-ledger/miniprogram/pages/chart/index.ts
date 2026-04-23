import { currentRecordMonth, billingPeriodRange, daysInclusive, fenToYuan, formatDate } from '../../utils/date'
import { getIconEmoji } from '../../utils/categories'

const app = getApp<IAppOption>()

/** 获取本周周一的日期 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d
}

function getPixelRatio(): number {
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
    viewOptions: [
      { key: 'week', label: '周' },
      { key: 'month', label: '月' },
      { key: 'year', label: '年' },
    ],
    currentView: 'week' as 'week' | 'month' | 'year',
    statType: 'expense' as 'expense' | 'income',

    // 周
    weekStartDate: '',
    weekEndDate: '',
    weekRangeDisplay: '',
    isCurrentWeek: true,

    // 月
    currentRecordMonth: '',

    // 年
    currentYear: new Date().getFullYear(),

    // 数据
    totalDisplay: '0.00',
    avgLabel: '日均值',
    avgDisplay: '0.00',
    dailyList: [] as any[],
    xLabels: [] as string[],
    categoryRank: [] as any[],
    loading: false,
  },

  onLoad() {
    const today = new Date()
    const weekStart = getWeekStart(today)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const cycleStartDay = app.globalData.cycleStartDay || 1
    const ym = currentRecordMonth(cycleStartDay)

    this.setData({
      weekStartDate: formatDate(weekStart),
      weekEndDate: formatDate(weekEnd),
      weekRangeDisplay: `${(weekStart.getMonth() + 1)}/${weekStart.getDate()}-${(weekEnd.getMonth() + 1)}/${weekEnd.getDate()}`,
      isCurrentWeek: true,
      currentRecordMonth: ym,
    })
  },

  onShow() {
    this.syncCycleStartDay().then(() => {
      const cycleStartDay = app.globalData.cycleStartDay || 1
      const ym = currentRecordMonth(cycleStartDay)
      this.setData({
        currentRecordMonth: ym,
        currentYear: Number(ym.split('-')[0]),
      })
      const tabBar = this.getTabBar() as any
      tabBar?.setData?.({ selected: 1 })
      this.loadStats()
    })
  },

  async syncCycleStartDay() {
    try {
      const res = await wx.cloud.callFunction({ name: 'settings_get' }) as any
      const settings = res.result && res.result.settings
      if (!settings) return
      app.globalData.cycleStartDay = settings.cycle_start_day || 1
    } catch (e) {}
  },

  switchView(e: any) {
    const key = e.currentTarget.dataset.key
    const avgLabel = key === 'week' ? '日均值' : key === 'month' ? '日均值' : '月均值'
    this.setData({ currentView: key, avgLabel })
    this.loadStats()
  },

  toggleStatType() {
    const next = this.data.statType === 'expense' ? 'income' : 'expense'
    this.setData({ statType: next })
    this.loadStats()
  },

  prevWeek() {
    const start = new Date(this.data.weekStartDate)
    start.setDate(start.getDate() - 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const todayWeekStart = formatDate(getWeekStart(new Date()))
    const newStart = formatDate(start)
    this.setData({
      weekStartDate: newStart,
      weekEndDate: formatDate(end),
      weekRangeDisplay: `${(start.getMonth() + 1)}/${start.getDate()}-${(end.getMonth() + 1)}/${end.getDate()}`,
      isCurrentWeek: newStart === todayWeekStart,
    })
    this.loadStats()
  },

  nextWeek() {
    const today = new Date()
    const currentWeekStart = getWeekStart(today)
    const start = new Date(this.data.weekStartDate)
    start.setDate(start.getDate() + 7)
    // 不超过本周
    if (start > currentWeekStart) return
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const newStart = formatDate(start)
    const todayWeekStart = formatDate(currentWeekStart)
    this.setData({
      weekStartDate: newStart,
      weekEndDate: formatDate(end),
      weekRangeDisplay: `${(start.getMonth() + 1)}/${start.getDate()}-${(end.getMonth() + 1)}/${end.getDate()}`,
      isCurrentWeek: newStart === todayWeekStart,
    })
    this.loadStats()
  },

  prevYear() {
    this.setData({ currentYear: this.data.currentYear - 1 })
    this.loadStats()
  },

  nextYear() {
    const maxYear = Number(currentRecordMonth(app.globalData.cycleStartDay || 1).split('-')[0])
    if (this.data.currentYear >= maxYear) return
    this.setData({ currentYear: this.data.currentYear + 1 })
    this.loadStats()
  },

  async loadStats() {
    this.setData({ loading: true })
    const { currentView, statType, weekStartDate, weekEndDate, currentRecordMonth, currentYear } = this.data

    const params: any = { view: currentView, stat_type: statType }
    if (currentView === 'week') {
      params.week_start = weekStartDate
      params.week_end = weekEndDate
    } else if (currentView === 'month') {
      params.record_month = currentRecordMonth
    } else {
      params.year = currentYear
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'stats_query', data: params }) as any
      const { total, daily, category_rank } = res.result

      const enrichedRank = (category_rank || []).map((c: any) => {
        const item = Object.assign({}, c)
        item.emoji = getIconEmoji(c.category_icon)
        item.amountDisplay = fenToYuan(c.amount)
        return item
      })

      // 计算平均值
      let avg = 0
      if (currentView === 'year') {
        avg = total / 12
      } else if (currentView === 'month') {
        const cycle = app.globalData.cycleStartDay || 1
        const { start, end } = billingPeriodRange(currentRecordMonth, cycle)
        avg = total / daysInclusive(start, end)
      } else {
        avg = total / 7
      }

      const xLabels = this.buildXLabels(daily || [], currentView)

      this.setData({
        totalDisplay: fenToYuan(total),
        avgDisplay: fenToYuan(Math.round(avg)),
        dailyList: daily || [],
        xLabels,
        categoryRank: enrichedRank,
        loading: false,
      })

      this.drawChart(daily || [])
    } catch (e) {
      console.error('loadStats error', e)
      this.setData({ loading: false })
    }
  },

  buildXLabels(daily: any[], view: string): string[] {
    if (daily.length === 0) return []
    if (view === 'week') {
      const days = ['一', '二', '三', '四', '五', '六', '日']
      return days
    } else if (view === 'month') {
      // 取首中末
      return ['1', '10', '20', '31']
    } else {
      return ['1月', '4月', '7月', '10月', '12月']
    }
  },

  drawChart(daily: any[]) {
    if (daily.length === 0) return
    const plotDaily = daily.length === 1 ? [daily[0], Object.assign({}, daily[0])] : daily

    wx.createSelectorQuery()
      .in(this)
      .select('#lineChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0]?.node
        const width = res[0]?.width || 375
        const height = res[0]?.height || 180
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const dpr = getPixelRatio()
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        const paddingLeft = 20
        const paddingRight = 20
        const paddingTop = 20
        const paddingBottom = 30
        const chartW = width - paddingLeft - paddingRight
        const chartH = height - paddingTop - paddingBottom

        const amounts = plotDaily.map((d: any) => d.amount)
        const maxVal = Math.max(...amounts, 1)

        ctx.clearRect(0, 0, width, height)

        // 网格线
        ctx.strokeStyle = '#F0F0F0'
        ctx.lineWidth = 1
        for (let i = 0; i <= 3; i++) {
          const y = paddingTop + (chartH / 3) * i
          ctx.beginPath()
          ctx.moveTo(paddingLeft, y)
          ctx.lineTo(width - paddingRight, y)
          ctx.stroke()
        }

        const stepX = chartW / Math.max(plotDaily.length - 1, 1)

        const points = plotDaily.map((d: any, i: number) => ({
          x: paddingLeft + i * stepX,
          y: paddingTop + chartH - (d.amount / maxVal) * chartH,
        }))

        // 渐变填充
        const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH)
        gradient.addColorStop(0, 'rgba(255,208,0,0.3)')
        gradient.addColorStop(1, 'rgba(255,208,0,0)')

        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          const cp = {
            x: (points[i - 1].x + points[i].x) / 2,
            y: (points[i - 1].y + points[i].y) / 2,
          }
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cp.x, cp.y)
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
        ctx.lineTo(points[points.length - 1].x, paddingTop + chartH)
        ctx.lineTo(points[0].x, paddingTop + chartH)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()

        // 折线
        ctx.beginPath()
        ctx.strokeStyle = '#FFD000'
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          const cp = {
            x: (points[i - 1].x + points[i].x) / 2,
            y: (points[i - 1].y + points[i].y) / 2,
          }
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cp.x, cp.y)
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
        ctx.stroke()

        // 数据点
        for (const p of points) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
          ctx.fillStyle = '#FFFFFF'
          ctx.fill()
          ctx.strokeStyle = '#FFD000'
          ctx.lineWidth = 3
          ctx.stroke()
        }
      })
  },

  onChartTouchStart() {},
  onChartTouchMove() {},
  onChartTouchEnd() {},
})
