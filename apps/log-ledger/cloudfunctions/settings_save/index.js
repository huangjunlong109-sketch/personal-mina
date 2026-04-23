const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 保存用户设置
 * event: {
 *   cycle_start_day?: number   // 1-28
 *   default_type?: 'expense'|'income'
 * }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { cycle_start_day, default_type } = event

  const res = await db.collection('ledger_settings')
    .where({ _openid: OPENID })
    .limit(1)
    .get()

  const data = { updated_at: new Date() }
  if (cycle_start_day !== undefined) data.cycle_start_day = cycle_start_day
  if (default_type !== undefined) data.default_type = default_type

  if (res.data.length > 0) {
    await db.collection('ledger_settings').doc(res.data[0]._id).update({ data })
  } else {
    await db.collection('ledger_settings').add({
      data: { cycle_start_day: 1, default_type: 'expense', created_at: new Date(), ...data },
    })
  }

  return { success: true }
}
