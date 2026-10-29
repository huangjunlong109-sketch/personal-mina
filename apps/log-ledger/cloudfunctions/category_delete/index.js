const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 删除自定义分类（is_builtin=true 的不允许删除）
 * event: { id: string }
 */
exports.main = async (event, context) => {
  const { id } = event
  const { OPENID } = cloud.getWXContext()
  if (!id) return { success: false, message: '缺少分类ID' }

  const doc = await db.collection('ledger_categories').doc(id).get()
  if (!doc.data) {
    return { success: false, message: '分类不存在' }
  }
  if (doc.data._openid !== OPENID) {
    return { success: false, message: '无权删除该分类' }
  }
  if (doc.data.is_builtin) {
    return { success: false, message: '内置分类不可删除' }
  }
  await db.collection('ledger_categories').doc(id).remove()
  return { success: true }
}
