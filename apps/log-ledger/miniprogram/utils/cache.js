const CATEGORY_KEY = 'ledger_cache_categories_v1'
const MONTH_KEY = 'ledger_cache_months_v1'
const MAX_MONTHS = 3

let categoryRevision = 0
let categorySerial = 0
let recordRevision = 0
const categoryWatchers = new Set()

function readStorage(key) {
  try {
    const data = wx.getStorageSync(key)
    if (!data || typeof data !== 'object' || data.v !== 1) return null
    return data
  } catch (e) {
    console.error('read cache error', key, e)
    return null
  }
}

function writeStorage(key, data) {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('write cache error', key, e)
    return false
  }
}

function readCategories() {
  const data = readStorage(CATEGORY_KEY)
  return data && Array.isArray(data.list) ? data.list : null
}

function emitCategories(list) {
  categoryWatchers.forEach(listener => {
    try { listener(list) } catch (e) { console.error('category watcher', e) }
  })
}

function writeCategories(list, revision) {
  if (revision !== categoryRevision) return false
  const saved = writeStorage(CATEGORY_KEY, { v: 1, list })
  if (saved && revision === categoryRevision) emitCategories(list)
  return saved
}

function watchCategories(listener) {
  categoryWatchers.add(listener)
  return () => categoryWatchers.delete(listener)
}

function cloneCategories() {
  const list = readCategories()
  return list ? list.map(item => Object.assign({}, item)) : null
}

function revertCategories(list) {
  const revision = bumpCategories()
  if (!Array.isArray(list)) {
    try { wx.removeStorageSync(CATEGORY_KEY) } catch (e) { console.error('clear category cache', e) }
    return
  }
  writeCategories(list.map(item => Object.assign({}, item)), revision)
}

function bumpCategories() {
  categoryRevision += 1
  return categoryRevision
}

function commitCategories(mutator) {
  const current = readCategories()
  const revision = bumpCategories()
  if (!current) return null
  const next = mutator(current.map(item => Object.assign({}, item)))
  if (!Array.isArray(next)) return null
  writeCategories(next, revision)
  return next
}

function refreshCategories(accept) {
  const serial = ++categorySerial
  const revision = categoryRevision
  return wx.cloud.callFunction({
    name: 'category_list',
    data: {},
  }).then(res => {
    const list = res.result && res.result.list
    if (!res.result || !res.result.success || !Array.isArray(list)) {
      throw new Error('category_list_failed')
    }
    if (serial !== categorySerial || revision !== categoryRevision) return { list: null, fresh: false }
    if (typeof accept === 'function' && !accept(list)) return { list: null, fresh: false }
    writeCategories(list, revision)
    return { list, fresh: true }
  })
}

function readMonthStore() {
  const data = readStorage(MONTH_KEY)
  if (!data || typeof data.months !== 'object' || data.months === null) {
    return { months: {}, order: [] }
  }
  return {
    months: data.months,
    order: Array.isArray(data.order) ? data.order : [],
  }
}

function getMonthCache(recordMonth, cycleStartDay) {
  const item = readMonthStore().months[recordMonth]
  if (!item || Number(item.cycleStartDay) !== Number(cycleStartDay) || !Array.isArray(item.list)) return null
  return item
}

function saveMonthCache(revision, recordMonth, cycleStartDay, payload) {
  if (revision !== recordRevision) return false
  const store = readMonthStore()
  store.months[recordMonth] = {
    cycleStartDay: Number(cycleStartDay) || 1,
    list: payload.list || [],
    has_more: !!payload.has_more,
    next_offset: payload.next_offset || 0,
    totalExpense: payload.totalExpense || 0,
    totalIncome: payload.totalIncome || 0,
  }
  store.order = [recordMonth].concat(store.order.filter(month => month !== recordMonth)).slice(0, MAX_MONTHS)
  Object.keys(store.months).forEach(month => {
    if (store.order.indexOf(month) < 0) delete store.months[month]
  })
  if (revision !== recordRevision) return false
  return writeStorage(MONTH_KEY, { v: 1, months: store.months, order: store.order })
}

function bumpRecords() {
  recordRevision += 1
  try {
    wx.removeStorageSync(MONTH_KEY)
  } catch (e) {
    console.error('clear record cache error', e)
  }
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    pages.forEach(page => {
      if (page.route === 'pages/index/index' && typeof page.refreshPage === 'function') page.refreshPage()
    })
  } catch (e) {
    console.error('refresh record pages', e)
  }
  return recordRevision
}

function getRecordRevision() {
  return recordRevision
}

module.exports = {
  readCategories,
  watchCategories,
  cloneCategories,
  bumpCategories,
  commitCategories,
  revertCategories,
  refreshCategories,
  getMonthCache,
  saveMonthCache,
  bumpRecords,
  getRecordRevision,
}
