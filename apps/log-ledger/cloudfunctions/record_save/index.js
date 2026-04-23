const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 根据记账日期和账期起始日，计算归属账期月份 'YYYY-MM'
 */
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

/**
 * 保存记账记录（新增或编辑）
 * event: {
 *   id?: string           // 有 id 则编辑，无则新增
 *   type: 'expense'|'income'
 *   amount: number        // 单位：分
 *   category_id: string
 *   category_name: string
 *   category_icon: string
 *   note?: string
 *   record_date: string   // 'YYYY-MM-DD'
 * }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { id, type, amount, category_id, category_name, category_icon, note, record_date } = event

  // 获取账期设置
  const settingRes = await db.collection('ledger_settings')
    .where({ _openid: OPENID })
    .limit(1)
    .get()
  const cycleStartDay = settingRes.data[0]?.cycle_start_day ?? 1
  const record_month = calcRecordMonth(record_date, cycleStartDay)

  const now = new Date()
  const data = {
    type,
    amount,
    category_id,
    category_name,
    category_icon,
    note: note || '',
    record_date,
    record_month,
    updated_at: now,
    is_deleted: false,
  }

  if (id) {
    // 编辑
    await db.collection('ledger_records').doc(id).update({ data })
    return { success: true, id }
  } else {
    // 新增
    data.created_at = now
    const res = await db.collection('ledger_records').add({ data })
    return { success: true, id: res._id }
  }
}
