const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('ledger_settings')
    .where({ _openid: OPENID })
    .limit(1)
    .get()
  return { success: true, settings: res.data[0] || null }
}
