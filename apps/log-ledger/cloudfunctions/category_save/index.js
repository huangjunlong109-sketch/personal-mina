const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 新增/编辑/隐藏分类
 * event: {
 *   id?: string          // 有则编辑，无则新增自定义分类
 *   type?: 'expense'|'income'
 *   name?: string
 *   icon?: string
 *   is_hidden?: boolean
 *   sort_order?: number
 * }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { id, type, name, icon, is_hidden, sort_order } = event
  const now = new Date()

  if (id) {
    const docRef = db.collection('ledger_categories').doc(id)
    const snap = await docRef.get()
    const row = snap.data
    if (!row) return { success: false, err: 'not_found' }
    if (row._openid !== OPENID) return { success: false, err: 'forbidden' }

    const data = { updated_at: now }
    if (is_hidden !== undefined) data.is_hidden = is_hidden
    if (sort_order !== undefined) data.sort_order = sort_order
    // 仅自定义分类可改名称与图标
    if (!row.is_builtin) {
      if (name !== undefined && String(name).trim() !== '') data.name = String(name).trim()
      if (icon !== undefined && String(icon).trim() !== '') data.icon = String(icon).trim()
    }
    await docRef.update({ data })
    return { success: true, id }
  } else {
    // 获取当前最大 sort_order
    const last = await db.collection('ledger_categories')
      .where({ _openid: OPENID, type })
      .orderBy('sort_order', 'desc')
      .limit(1)
      .get()
    const maxOrder = last.data[0]?.sort_order ?? 0

    const data = {
      type,
      name,
      icon: icon || 'other',
      sort_order: maxOrder + 1,
      is_builtin: false,
      is_hidden: false,
      created_at: now,
      updated_at: now,
    }
    const res = await db.collection('ledger_categories').add({ data })
    return { success: true, id: res._id }
  }
}
