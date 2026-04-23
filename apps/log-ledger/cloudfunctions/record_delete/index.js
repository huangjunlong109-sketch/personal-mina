const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 软删除记账记录
 * event: { id: string }
 */
exports.main = async (event, context) => {
  const { id } = event
  await db.collection('ledger_records').doc(id).update({
    data: { is_deleted: true, updated_at: new Date() },
  })
  return { success: true }
}
