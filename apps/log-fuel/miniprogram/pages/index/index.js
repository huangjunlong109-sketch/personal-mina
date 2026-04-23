const { callFn } = require('../../utils/db')

function buildDefaultStats() {
  return {
    latestConsumption: null,
    avgConsumption: null,
    dailyMileage: null,
    totalLiters: null,
    totalAmount: null,
    monthlyAvgAmount: null,
    issueCount: 0,
  }
}

function roundTo(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const base = Math.pow(10, digits)
  return Math.round(num * base) / base
}

function average(values) {
  const valid = (values || []).filter(item => Number.isFinite(item))
  if (!valid.length) return null
  return roundTo(valid.reduce((sum, item) => sum + item, 0) / valid.length, 2)
}

function formatMonthDay(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return String(dateStr).slice(5).replace('-', '/')
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatMonthLabel(monthStr) {
  if (!monthStr) return ''
  const month = String(monthStr).slice(5, 7)
  return `${parseInt(month, 10)}月`
}

function formatMetric(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return num.toFixed(digits).replace(/\.?0+$/, '')
}

function sortByRecord(a, b) {
  const dateDiff = String(a.refuelDate || '').localeCompare(String(b.refuelDate || ''))
  if (dateDiff !== 0) return dateDiff
  return Number(a.odometer || 0) - Number(b.odometer || 0)
}

function buildConsumptionPoints(records) {
  return (records || [])
    .filter(item => item.refuelDate && Number(item.fuelConsumption) > 0)
    .sort(sortByRecord)
    .map(item => ({
      label: formatMonthDay(item.refuelDate),
      value: roundTo(item.fuelConsumption, 2),
    }))
}

function buildCostPoints(records) {
  const monthMap = {}
  ;(records || []).forEach(item => {
    if (!item.refuelDate || Number(item.totalAmount) <= 0) return
    const monthKey = String(item.refuelDate).slice(0, 7)
    monthMap[monthKey] = (monthMap[monthKey] || 0) + Number(item.totalAmount)
  })
  return Object.keys(monthMap)
    .sort()
    .map(monthKey => ({
      label: formatMonthLabel(monthKey),
      value: roundTo(monthMap[monthKey], 2),
    }))
}

function buildStatsFromRecords(records) {
  const list = records || []
  if (!list.length) return buildDefaultStats()

  const latestConsumption = Number(list[0].fuelConsumption) > 0
    ? roundTo(list[0].fuelConsumption, 2)
    : null
  const totalLiters = roundTo(list.reduce((sum, item) => sum + (Number(item.liters) || 0), 0), 2)
  const totalAmount = roundTo(list.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0), 2)
  const totalMileage = list.reduce((sum, item) => sum + (Number(item.addedMileage) || 0), 0)
  const avgConsumption = totalMileage > 0 ? roundTo((totalLiters / totalMileage) * 100, 2) : null

  let dailyMileage = null
  if (list.length >= 2) {
    const dates = list.map(item => item.refuelDate).filter(Boolean).sort()
    if (dates.length >= 2) {
      const msSpan = new Date(dates[dates.length - 1]) - new Date(dates[0])
      const daySpan = Math.max(1, Math.round(msSpan / 86400000))
      dailyMileage = Math.round(totalMileage / daySpan)
    }
  }

  return {
    latestConsumption,
    avgConsumption,
    dailyMileage,
    totalLiters,
    totalAmount,
    monthlyAvgAmount: average(buildCostPoints(list).map(item => item.value)),
    issueCount: list.filter(item => item.issueFlags && item.issueFlags.length > 0 && !item.confirmedByUser).length,
  }
}

function pickTickIndices(length, maxCount = 5) {
  if (length <= 0) return []
  if (length <= maxCount) return Array.from({ length }, (_, index) => index)
  const result = []
  for (let i = 0; i < maxCount; i++) {
    result.push(Math.round((i * (length - 1)) / (maxCount - 1)))
  }
  return Array.from(new Set(result)).sort((a, b) => a - b)
}

function traceSmoothLine(ctx, points) {
  if (!points.length) return
  ctx.moveTo(points[0].x, points[0].y)
  if (points.length === 1) return
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const current = points[i]
    const midX = (prev.x + current.x) / 2
    const midY = (prev.y + current.y) / 2
    ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
  }
  const lastPoint = points[points.length - 1]
  ctx.lineTo(lastPoint.x, lastPoint.y)
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
    stats: buildDefaultStats(),
    currentVehicle: null,
    chartTab: 'consumption',
    loading: false,
    initialLoading: true,
    hasLoadedOnce: false,
    chartTransitioning: false,
    records: [],
    chartReady: false,
    chartPoints: [],
    chartAvgValue: null,
    chartMetaText: '平均油耗 --',
    chartLegendPrimary: '油耗 L/100km',
    chartLegendSecondary: '平均油耗',
    chartEmptyText: '暂无油耗数据',
  },

  onShow() {
    const app = getApp()
    if (!app || !app.globalData) return
    const refresh = () => {
      const currentVehicle = app.globalData.currentVehicle || null
      this.setData({ currentVehicle })
      if (currentVehicle && currentVehicle._id) {
        this.loadDashboard(currentVehicle._id)
      } else {
        this.setData({
          stats: buildDefaultStats(),
          records: [],
          loading: false,
          initialLoading: false,
        }, () => this.refreshChart())
      }
    }
    if (typeof app.ensureDefaultVehicle === 'function') {
      app.ensureDefaultVehicle().then(refresh).catch(() => refresh())
    } else {
      refresh()
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  loadDashboard(vehicleId) {
    const showSkeleton = !this.data.hasLoadedOnce
    this.setData({
      loading: true,
      initialLoading: showSkeleton,
      chartTransitioning: !showSkeleton,
    })
    callFn('record.list', { vehicleId })
      .then((listRes) => {
        const records = (listRes && listRes.list) ? listRes.list : []
        this.setData({
          stats: {
            ...buildDefaultStats(),
            ...buildStatsFromRecords(records),
          },
          records,
        }, () => this.refreshChart(() => {
          this.setData({
            loading: false,
            initialLoading: false,
            hasLoadedOnce: true,
          }, () => {
            this.safeDrawChart()
          })
          setTimeout(() => {
            this.setData({ chartTransitioning: false })
          }, 180)
        }))
      })
      .catch(() => {
        this.setData({
          stats: buildDefaultStats(),
          records: [],
        }, () => this.refreshChart(() => {
          this.setData({
            loading: false,
            initialLoading: false,
            hasLoadedOnce: true,
          }, () => {
            this.safeDrawChart()
          })
          setTimeout(() => {
            this.setData({ chartTransitioning: false })
          }, 180)
        }))
      })
  },

  refreshChart(callback) {
    const chartData = this.buildChartModel(this.data.records, this.data.stats, this.data.chartTab)
    this.setData(chartData, () => {
      if (!this.data.initialLoading) {
        this.drawChart()
      }
      if (typeof callback === 'function') callback()
    })
  },

  safeDrawChart() {
    const run = () => this.drawChart()
    if (typeof wx.nextTick === 'function') {
      wx.nextTick(run)
      return
    }
    setTimeout(run, 0)
  },

  buildChartModel(records, stats, chartTab) {
    if (chartTab === 'cost') {
      return this.buildCostChartModel(records)
    }
    return this.buildConsumptionChartModel(records, stats)
  },

  buildConsumptionChartModel(records, stats) {
    const points = buildConsumptionPoints(records)
    const avgValue = Number(stats.avgConsumption) > 0
      ? roundTo(stats.avgConsumption, 2)
      : average(points.map(item => item.value))
    return {
      chartReady: points.length > 0,
      chartPoints: points,
      chartAvgValue: avgValue,
      chartMetaText: `平均油耗 ${formatMetric(avgValue)} L/100km`,
      chartLegendPrimary: '油耗 L/100km',
      chartLegendSecondary: '平均油耗',
      chartEmptyText: '暂无油耗数据',
    }
  },

  buildCostChartModel(records) {
    const points = buildCostPoints(records)
    const avgValue = average(points.map(item => item.value))
    return {
      chartReady: points.length > 0,
      chartPoints: points,
      chartAvgValue: avgValue,
      chartMetaText: `月均油费 ${formatMetric(avgValue)} 元`,
      chartLegendPrimary: '油费 元',
      chartLegendSecondary: '月均油费',
      chartEmptyText: '暂无油费数据',
    }
  },

  clearChart() {
    wx.createSelectorQuery()
      .in(this)
      .select('#lineChart')
      .fields({ node: true, size: true })
      .exec(res => {
        const canvas = res[0] && res[0].node
        const width = (res[0] && res[0].width) || 0
        const height = (res[0] && res[0].height) || 0
        if (!canvas || !width || !height) return
        const dpr = getPixelRatio()
        canvas.width = width * dpr
        canvas.height = height * dpr
      })
  },

  drawChart() {
    if (!this.data.chartReady || !this.data.chartPoints.length) {
      this.clearChart()
      return
    }
    wx.createSelectorQuery()
      .in(this)
      .select('#lineChart')
      .fields({ node: true, size: true })
      .exec(res => {
        const canvas = res[0] && res[0].node
        const width = (res[0] && res[0].width) || 0
        const height = (res[0] && res[0].height) || 0
        if (!canvas || !width || !height) return

        const ctx = canvas.getContext('2d')
        const dpr = getPixelRatio()
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        const left = 58
        const top = 24
        const right = 22
        const bottom = 56
        const plotWidth = width - left - right
        const plotHeight = height - top - bottom
        const points = this.data.chartPoints
        const avgValue = Number(this.data.chartAvgValue)
        const values = points.map(item => Number(item.value))
        if (Number.isFinite(avgValue)) values.push(avgValue)
        let minValue = Math.min(...values)
        let maxValue = Math.max(...values)
        if (minValue === maxValue) {
          const padding = Math.max(minValue * 0.15, 1)
          minValue = Math.max(0, minValue - padding)
          maxValue = maxValue + padding
        } else {
          const padding = (maxValue - minValue) * 0.18
          minValue = Math.max(0, minValue - padding)
          maxValue = maxValue + padding
        }

        const valueToY = (value) => {
          if (maxValue === minValue) return top + plotHeight / 2
          return top + (maxValue - value) * plotHeight / (maxValue - minValue)
        }
        const getX = (index) => {
          if (points.length === 1) return left + plotWidth / 2
          return left + (plotWidth * index) / (points.length - 1)
        }
        const formatAxisValue = (value) => (
          this.data.chartTab === 'consumption'
            ? formatMetric(value, 1)
            : formatMetric(value, value >= 100 ? 0 : 1)
        )

        ctx.strokeStyle = '#EEF3FB'
        ctx.lineWidth = 1
        ctx.fillStyle = '#B5BCD0'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        for (let i = 0; i < 4; i++) {
          const ratio = i / 3
          const y = top + plotHeight * ratio
          const tickValue = maxValue - (maxValue - minValue) * ratio
          ctx.beginPath()
          ctx.moveTo(left, y)
          ctx.lineTo(width - right, y)
          ctx.stroke()
          ctx.fillText(formatAxisValue(tickValue), left - 10, y)
        }

        if (Number.isFinite(avgValue)) {
          const avgY = valueToY(avgValue)
          ctx.save()
          ctx.setLineDash([6, 6])
          ctx.strokeStyle = 'rgba(171, 185, 216, 0.95)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(left, avgY)
          ctx.lineTo(width - right, avgY)
          ctx.stroke()
          ctx.restore()
        }

        const chartPoints = points.map((item, index) => ({
          x: getX(index),
          y: valueToY(Number(item.value)),
          label: item.label,
        }))

        const areaGradient = ctx.createLinearGradient(0, top, 0, top + plotHeight)
        areaGradient.addColorStop(0, 'rgba(124, 165, 244, 0.12)')
        areaGradient.addColorStop(1, 'rgba(123, 169, 248, 0)')
        ctx.beginPath()
        traceSmoothLine(ctx, chartPoints)
        ctx.lineTo(chartPoints[chartPoints.length - 1].x, top + plotHeight)
        ctx.lineTo(chartPoints[0].x, top + plotHeight)
        ctx.closePath()
        ctx.fillStyle = areaGradient
        ctx.fill()

        ctx.beginPath()
        ctx.strokeStyle = '#7CA4F4'
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        traceSmoothLine(ctx, chartPoints)
        ctx.stroke()

        const tickIndices = pickTickIndices(chartPoints.length, 5)
        ctx.fillStyle = '#AAB2C5'
        ctx.font = '10px sans-serif'
        ctx.textBaseline = 'top'
        tickIndices.forEach(index => {
          const point = chartPoints[index]
          if (!point) return
          if (index === 0) ctx.textAlign = 'left'
          else if (index === chartPoints.length - 1) ctx.textAlign = 'right'
          else ctx.textAlign = 'center'
          ctx.fillText(point.label, point.x, top + plotHeight + 14)
        })
      })
  },

  switchChartTab(e) {
    const { tab } = e.currentTarget.dataset
    if (!tab || tab === this.data.chartTab) return
    this.setData({
      chartTab: tab,
      chartTransitioning: true,
    }, () => this.refreshChart(() => {
      setTimeout(() => {
        this.setData({ chartTransitioning: false })
      }, 160)
    }))
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/index' })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/index' })
  },

  showVehiclePicker() {
    wx.switchTab({ url: '/pages/profile/index' })
  },
})
