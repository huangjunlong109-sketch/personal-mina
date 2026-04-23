const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 200

function billingPeriodRange(recordMonthYm, cycleStartDay) {
  const parts = String(recordMonthYm).split('-').map(Number)
  const y = parts[0]
  const m = parts[1] || 1
  const pad = (n) => String(n).padStart(2, '0')
  const start = new Date(y, m - 1, cycleStartDay)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const nextStart = new Date(nextY, nextM - 1, cycleStartDay)
  const end = new Date(nextStart)
  end.setDate(end.getDate() - 1)
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  }
}

/**
 * 查询某账期月份的记录列表
 * event: {
 *   record_month: string   // 'YYYY-MM'（账期月）
 *   natural_month: string   // 兼容旧参数名，仍按账期月处理
 *   offset?: number         // 分页偏移量
 *   page_size?: number      // 分页大小，默认 100，最大 200
 * }
 * returns: {
 *   list: Record[]
 *   has_more: boolean
 *   next_offset: number
 * }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { record_month, natural_month } = event
  const offset = Math.max(0, Number(event.offset) || 0)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(event.page_size || event.limit) || DEFAULT_PAGE_SIZE),
  )
  const settingRes = await db.collection('ledger_settings')
    .where({ _openid: OPENID })
    .limit(1)
    .get()
  const cycleStartDay = settingRes.data[0]?.cycle_start_day ?? 1

  let where
  const selectedRecordMonth = record_month || natural_month
  if (selectedRecordMonth && /^\d{4}-\d{2}$/.test(String(selectedRecordMonth))) {
    const { start, end } = billingPeriodRange(selectedRecordMonth, cycleStartDay)
    where = {
      _openid: OPENID,
      is_deleted: false,
      record_date: _.gte(start).and(_.lte(end)),
    }
  } else {
    where = {
      _openid: OPENID,
      record_month,
      is_deleted: false,
    }
  }

  const [countRes, listRes] = await Promise.all([
    db.collection('ledger_records').where(where).count(),
    db.collection('ledger_records')
      .where(where)
      .orderBy('record_date', 'desc')
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(pageSize)
      .get(),
  ])

  const list = listRes.data || []
  const nextOffset = offset + list.length
  const hasMore = nextOffset < (countRes.total || 0)

  return {
    success: true,
    list,
    has_more: hasMore,
    next_offset: nextOffset,
  }
}
