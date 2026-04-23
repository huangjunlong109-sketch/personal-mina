const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function billingPeriodRange(ym, cycleStartDay) {
  const parts = String(ym).split('-').map(Number)
  const y = parts[0]
  const m = parts[1] || 1
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const start = new Date(y, m - 1, cycleStartDay)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const nextStart = new Date(nextY, nextM - 1, cycleStartDay)
  const end = new Date(nextStart)
  end.setDate(end.getDate() - 1)
  return { start: fmt(start), end: fmt(end) }
}

function calcRecordMonth(recordDate, cycleStartDay) {
  const date = new Date(recordDate)
  const day = date.getDate()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  if (day >= cycleStartDay) {
    return `${year}-${String(month).padStart(2, '0')}`
  }
  const prev = new Date(year, month - 2, 1)
  const py = prev.getFullYear()
  const pm = prev.getMonth() + 1
  return `${py}-${String(pm).padStart(2, '0')}`
}

function billingYearRange(year, cycleStartDay) {
  const start = billingPeriodRange(`${year}-01`, cycleStartDay).start
  const end = billingPeriodRange(`${year}-12`, cycleStartDay).end
  return { start, end }
}

async function fetchAllRecords(where) {
  const batchSize = 200
  const list = []
  let skip = 0

  while (true) {
    const res = await db.collection('ledger_records')
      .where(where)
      .orderBy('record_date', 'desc')
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(batchSize)
      .get()
    const pageList = res.data || []
    list.push(...pageList)
    if (pageList.length < batchSize) break
    skip += batchSize
  }

  return list
}

/**
 * 统计查询
 * event: {
 *   view: 'week'|'month'|'year'
 *   stat_type: 'expense'|'income'
 *   // week 视图需要：
 *   week_start: string   // 周一日期 'YYYY-MM-DD'
 *   week_end: string     // 周日日期 'YYYY-MM-DD'
 *   // month 视图需要：
 *   record_month: string  // 'YYYY-MM'
 *   // year 视图需要：
 *   year: number
 * }
 *
 * returns: {
 *   daily: [{ date: string, amount: number }]       // 按天
 *   category_rank: [{ category_name, category_icon, amount, percent }]
 *   total: number
 * }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { view, stat_type } = event

  let records = []
  let cycleStartDay = 1

  if (view === 'month' || view === 'year') {
    const settingRes = await db.collection('ledger_settings')
      .where({ _openid: OPENID })
      .limit(1)
      .get()
    cycleStartDay = settingRes.data[0]?.cycle_start_day ?? 1
  }

  if (view === 'week') {
    const { week_start, week_end } = event
    records = await fetchAllRecords({
      _openid: OPENID,
      type: stat_type,
      is_deleted: false,
      record_date: _.gte(week_start).and(_.lte(week_end)),
    })

  } else if (view === 'month') {
    const { record_month } = event
    const { start, end } = billingPeriodRange(record_month, cycleStartDay)
    records = await fetchAllRecords({
      _openid: OPENID,
      type: stat_type,
      is_deleted: false,
      record_date: _.gte(start).and(_.lte(end)),
    })

  } else if (view === 'year') {
    const { year } = event
    const { start, end } = billingYearRange(year, cycleStartDay)
    records = await fetchAllRecords({
      _openid: OPENID,
      type: stat_type,
      is_deleted: false,
      record_date: _.gte(start).and(_.lte(end)),
    })
  }

  const total = records.reduce((sum, r) => sum + r.amount, 0)

  // 按天汇总
  const dailyMap = {}
  for (const r of records) {
    const key = view === 'year' ? calcRecordMonth(r.record_date, cycleStartDay) : r.record_date
    dailyMap[key] = (dailyMap[key] || 0) + r.amount
  }
  const daily = Object.keys(dailyMap)
    .sort()
    .map(date => ({ date, amount: dailyMap[date] }))

  // 按分类汇总 + 排行
  const catMap = {}
  for (const r of records) {
    const key = r.category_name
    if (!catMap[key]) {
      catMap[key] = { category_name: r.category_name, category_icon: r.category_icon, amount: 0 }
    }
    catMap[key].amount += r.amount
  }
  const category_rank = Object.values(catMap)
    .sort((a, b) => b.amount - a.amount)
    .map(c => ({
      ...c,
      percent: total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0,
    }))

  return { success: true, total, daily, category_rank }
}
