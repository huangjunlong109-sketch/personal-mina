/**
 * 将分转为显示字符串，如 9800 → '98.00'，9850 → '98.50'
 */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

/**
 * 将元（字符串）转为分（整数），如 '98' → 9800，'98.5' → 9850
 */
export function yuanToFen(yuan: string): number {
  return Math.round(parseFloat(yuan) * 100)
}

/**
 * 格式化日期，返回 'YYYY-MM-DD'
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 今天的 'YYYY-MM-DD'
 */
export function today(): string {
  return formatDate(new Date())
}

/**
 * 根据记账日期和账期起始日，计算归属账期月份 'YYYY-MM'
 */
export function calcRecordMonth(recordDate: string, cycleStartDay: number): string {
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

/**
 * 获取当前账期月份
 */
export function currentRecordMonth(cycleStartDay: number): string {
  return calcRecordMonth(today(), cycleStartDay)
}

/** 当前自然月 YYYY-MM（与账期起始日无关） */
export function currentCalendarMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 账期月 YYYY-MM 对应的起止日（含），与 calcRecordMonth 互逆 */
export function billingPeriodRange(recordMonthYm: string, cycleStartDay: number): { start: string; end: string } {
  const parts = recordMonthYm.split('-').map(Number)
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

export function billingYearRange(year: number | string, cycleStartDay: number): { start: string; end: string } {
  const start = billingPeriodRange(`${year}-01`, cycleStartDay).start
  const end = billingPeriodRange(`${year}-12`, cycleStartDay).end
  return { start, end }
}

export function daysInclusive(startDate: string, endDate: string): number {
  const a = new Date(startDate.replace(/-/g, '/'))
  const b = new Date(endDate.replace(/-/g, '/'))
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)
}

/**
 * 账期月份的显示文本，如 '2026-03' → '2026年3月'
 */
export function formatRecordMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

/**
 * 账期月份加减，如 '2026-03' + (-1) → '2026-02'
 */
export function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  const ny = date.getFullYear()
  const nm = date.getMonth() + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

/**
 * 格式化日期为星期几
 */
export function formatWeekDay(dateStr: string): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = new Date(dateStr)
  return days[d.getDay()]
}

/**
 * 日期显示，如 '2026-03-24' → '3月24日 周二'
 */
export function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}月${day}日 ${formatWeekDay(dateStr)}`
}
