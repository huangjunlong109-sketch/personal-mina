function formatDate(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date.replace(/-/g, '/')) : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMonthCN(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).split('-')
  if (parts.length < 2) return dateStr
  return `${parts[0]}年${parseInt(parts[1])}月`
}

function formatDayCN(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).split('-')
  if (parts.length < 3) return dateStr
  return `${parseInt(parts[2])}日`
}

function today() {
  return formatDate(new Date())
}

/**
 * 将记录列表按月分组，返回 [{month, label, records}] 倒序
 */
function groupByMonth(records) {
  const groups = {}
  records.forEach(r => {
    const key = r.refuelDate ? String(r.refuelDate).slice(0, 7) : 'unknown'
    if (!groups[key]) {
      groups[key] = { month: key, label: formatMonthCN(r.refuelDate), records: [] }
    }
    groups[key].records.push(r)
  })
  return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month))
}

module.exports = { formatDate, formatMonthCN, formatDayCN, today, groupByMonth }
