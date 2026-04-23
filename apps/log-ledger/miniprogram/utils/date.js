function fenToYuan(fen) {
  return (fen / 100).toFixed(2)
}

function yuanToFen(yuan) {
  return Math.round(parseFloat(yuan) * 100)
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function today() {
  return formatDate(new Date())
}

function calcRecordMonth(recordDate, cycleStartDay) {
  const date = new Date(recordDate)
  const day = date.getDate()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  if (day >= cycleStartDay) {
    return `${year}-${String(month).padStart(2, '0')}`
  } else {
    const prev = new Date(year, month - 2, 1)
    const py = prev.getFullYear()
    const pm = prev.getMonth() + 1
    return `${py}-${String(pm).padStart(2, '0')}`
  }
}

function currentRecordMonth(cycleStartDay) {
  return calcRecordMonth(today(), cycleStartDay)
}

function currentCalendarMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function billingPeriodRange(recordMonthYm, cycleStartDay) {
  const parts = String(recordMonthYm).split('-').map(Number)
  const y = parts[0]
  const m = parts[1] || 1
  const start = new Date(y, m - 1, cycleStartDay)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const nextStart = new Date(nextY, nextM - 1, cycleStartDay)
  const end = new Date(nextStart)
  end.setDate(end.getDate() - 1)
  return { start: formatDate(start), end: formatDate(end) }
}

function billingYearRange(year, cycleStartDay) {
  const start = billingPeriodRange(`${year}-01`, cycleStartDay).start
  const end = billingPeriodRange(`${year}-12`, cycleStartDay).end
  return { start, end }
}

function daysInclusive(startDate, endDate) {
  const a = new Date(String(startDate).replace(/-/g, '/'))
  const b = new Date(String(endDate).replace(/-/g, '/'))
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)
}

function addMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  const ny = date.getFullYear()
  const nm = date.getMonth() + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function formatWeekDay(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date(dateStr).getDay()]
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${formatWeekDay(dateStr)}`
}

module.exports = {
  fenToYuan, yuanToFen, formatDate, today,
  calcRecordMonth, currentRecordMonth, currentCalendarMonth, billingPeriodRange, billingYearRange, daysInclusive, addMonth,
  formatWeekDay, formatDisplayDate,
}
