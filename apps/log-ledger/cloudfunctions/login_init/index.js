const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ALL_CATEGORIES = [
  { type: 'expense', name: '餐饮', icon: 'food', sort_order: 1 },
  { type: 'expense', name: '住房', icon: 'home', sort_order: 2 },
  { type: 'expense', name: '汽车', icon: 'car', sort_order: 3 },
  { type: 'expense', name: '孩子', icon: 'child', sort_order: 4 },
  { type: 'expense', name: '娱乐', icon: 'entertainment', sort_order: 5 },
  { type: 'expense', name: '人情', icon: 'gift', sort_order: 6 },
  { type: 'expense', name: '运动', icon: 'sport', sort_order: 7 },
  { type: 'expense', name: '通讯', icon: 'phone', sort_order: 8 },
  { type: 'expense', name: '旅行', icon: 'travel', sort_order: 9 },
  { type: 'expense', name: '医疗', icon: 'medical', sort_order: 10 },
  { type: 'expense', name: '礼金', icon: 'present', sort_order: 11 },
  { type: 'expense', name: '交通', icon: 'transport', sort_order: 12 },
  { type: 'income', name: '工资', icon: 'salary', sort_order: 1 },
  { type: 'income', name: '兼职', icon: 'parttime', sort_order: 2 },
  { type: 'income', name: '理财', icon: 'invest', sort_order: 3 },
  { type: 'income', name: '礼金', icon: 'present', sort_order: 4 },
  { type: 'income', name: '其它', icon: 'other', sort_order: 5 },
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const now = new Date()

  // 检查是否已初始化（只查数量，快）
  const catCount = await db.collection('ledger_categories').where({ _openid: OPENID }).count()

  if (catCount.total === 0) {
    // 串行插入，避免并发超时
    for (const cat of ALL_CATEGORIES) {
      await db.collection('ledger_categories').add({
        data: { ...cat, is_builtin: true, is_hidden: false, created_at: now, updated_at: now },
      })
    }
  }

  // 获取或创建设置
  const settingRes = await db.collection('ledger_settings').where({ _openid: OPENID }).limit(1).get()
  let settings
  if (settingRes.data.length === 0) {
    const defaultSettings = {
      cycle_start_day: 1,
      default_type: 'expense',
      created_at: now,
      updated_at: now,
    }
    await db.collection('ledger_settings').add({ data: defaultSettings })
    settings = defaultSettings
  } else {
    settings = settingRes.data[0]
  }

  return { success: true, settings }
}
