const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 获取用户分类列表
 * event: { type?: 'expense'|'income' }  不传则返回全部
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const query = { _openid: OPENID }
  if (event.type) query.type = event.type

  const res = await db.collection('ledger_categories')
    .where(query)
    .orderBy('sort_order', 'asc')
    .limit(100)
    .get()

  return { success: true, list: res.data }
}
