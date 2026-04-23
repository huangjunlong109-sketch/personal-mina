const { today, calcRecordMonth, yuanToFen, fenToYuan } = require('../../utils/date')
const { getIconEmoji } = require('../../utils/categories')

function fenToAmountInput(fen) {
  const s = fenToYuan(fen)
  if (s.endsWith('.00')) return s.slice(0, -3)
  return String(Number(s))
}

const MAX_AMOUNT = 999999.99

function normalizeAmountInput(input) {
  if (!input) return ''
  if (input.endsWith('.')) return input.slice(0, -1) || '0'
  return input
}

function formatAmountDisplay(amountInput, calcLeft, pendingOperator) {
  if (pendingOperator) return `${calcLeft}${pendingOperator}${amountInput}`
  if (amountInput === '') return '0.00'
  if (amountInput.endsWith('.')) return `${amountInput}00`
  return Number(amountInput).toFixed(2)
}

function formatCalcResult(value) {
  const fixed = value.toFixed(2)
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function calcResult(left, operator, right) {
  const leftValue = Number(normalizeAmountInput(left) || '0')
  const rightValue = Number(normalizeAmountInput(right) || '0')
  return operator === '-' ? leftValue - rightValue : leftValue + rightValue
}

Page({
  data: {
    currentType: 'expense',
    categories: [],
    selectedCategoryId: '',
    selectedCategory: null,
    amountInput: '',
    amountDisplay: '0.00',
    calcLeft: '',
    pendingOperator: '',
    note: '',
    recordDate: '',
    dateDisplay: '今天',
    canSave: false,
    actionEnabled: false,
    editId: '',
  },

  onLoad(options) {
    const editId = options.id || ''
    if (editId) {
      this.setData({ editId })
      this.loadRecordForEdit(editId)
      return
    }
    const type = options.type || 'expense'
    this.setData({ currentType: type, editId: '', recordDate: today() })
    this.loadCategories(type)
  },

  loadRecordForEdit(id) {
    wx.showLoading({ title: '加载中' })
    const db = wx.cloud.database()
    db.collection('ledger_records')
      .doc(id)
      .get()
      .then(res => {
        const r = res.data
        const amountInput = fenToAmountInput(r.amount)
        const recordDate = r.record_date || today()
        const dateDisplay = recordDate === today() ? '今天' : recordDate.slice(5)
        this.updateAmountState({
          currentType: r.type || 'expense',
          note: r.note || '',
          recordDate,
          dateDisplay,
          amountInput,
          calcLeft: '',
          pendingOperator: '',
          editId: id,
        })
        wx.setNavigationBarTitle({ title: '编辑记录' })
        return this.loadCategories(r.type || 'expense', r.category_id)
      })
      .catch(e => {
        console.error('loadRecordForEdit', e)
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
      .finally(() => wx.hideLoading())
  },

  loadCategories(type, preferredCategoryId) {
    const db = wx.cloud.database()
    return db.collection('ledger_categories')
      .where({ type, is_hidden: false })
      .orderBy('sort_order', 'asc')
      .get()
      .then(res => {
        const list = (res.data || []).map(c => ({ ...c, emoji: getIconEmoji(c.icon) }))
        let selected = list[0] || null
        let selectedId = selected ? selected._id : ''
        if (preferredCategoryId) {
          const found = list.find(c => c._id === preferredCategoryId)
          if (found) {
            selected = found
            selectedId = found._id
          }
        }
        this.updateAmountState({
          categories: list,
          selectedCategoryId: selectedId,
          selectedCategory: selected,
        })
      })
      .catch(err => console.error('loadCategories error', err))
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type
    this.updateAmountState({ currentType: type, selectedCategoryId: '', selectedCategory: null, categories: [] })
    this.loadCategories(type, '')
  },

  selectCategory(e) {
    const item = e.currentTarget.dataset.item
    this.updateAmountState({
      selectedCategoryId: item._id,
      selectedCategory: item,
    })
  },

  onNoteInput(e) { this.setData({ note: e.detail.value }) },

  updateAmountState(patch) {
    const nextData = {
      amountInput: this.data.amountInput,
      calcLeft: this.data.calcLeft,
      pendingOperator: this.data.pendingOperator,
      selectedCategoryId: this.data.selectedCategoryId,
      ...patch,
    }
    const currentValue = Number(normalizeAmountInput(nextData.amountInput) || '0')
    const canSave = !nextData.pendingOperator && !!nextData.selectedCategoryId && currentValue > 0
    const actionEnabled = nextData.pendingOperator ? nextData.amountInput !== '' : canSave

    this.setData({
      ...patch,
      amountDisplay: formatAmountDisplay(nextData.amountInput, nextData.calcLeft, nextData.pendingOperator),
      canSave,
      actionEnabled,
    })
  },

  onKey(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'del') {
      this.handleDelete()
      return
    }

    if (key === '+' || key === '-') {
      this.handleOperator(key)
      return
    }

    if (key === '.') {
      let input = this.data.amountInput
      if (input.includes('.')) return
      if (input === '') input = '0'
      this.updateAmountState({ amountInput: `${input}.` })
      return
    }

    let input = this.data.amountInput
    if (input === '0') input = key
    else input += key
    if (input.includes('.') && input.split('.')[1].length > 2) return
    if (Number(normalizeAmountInput(input) || '0') > MAX_AMOUNT) return

    this.updateAmountState({ amountInput: input })
  },

  handleDelete() {
    const { amountInput, calcLeft, pendingOperator } = this.data
    if (pendingOperator) {
      if (amountInput) {
        this.updateAmountState({ amountInput: amountInput.slice(0, -1) })
        return
      }
      this.updateAmountState({ amountInput: calcLeft, calcLeft: '', pendingOperator: '' })
      return
    }
    this.updateAmountState({ amountInput: amountInput.slice(0, -1) })
  },

  handleOperator(operator) {
    const { amountInput, calcLeft, pendingOperator } = this.data
    if (pendingOperator) {
      if (amountInput === '') {
        this.updateAmountState({ pendingOperator: operator })
        return
      }
      const result = calcResult(calcLeft, pendingOperator, amountInput)
      if (result < 0) {
        wx.showToast({ title: '结果不能小于0', icon: 'none' })
        return
      }
      if (result > MAX_AMOUNT) {
        wx.showToast({ title: '金额不能超过999999.99', icon: 'none' })
        return
      }
      this.updateAmountState({
        calcLeft: formatCalcResult(result),
        amountInput: '',
        pendingOperator: operator,
      })
      return
    }

    const normalizedInput = normalizeAmountInput(amountInput)
    if (!normalizedInput) return

    this.updateAmountState({
      calcLeft: normalizedInput,
      amountInput: '',
      pendingOperator: operator,
    })
  },

  onActionButton() {
    if (this.data.pendingOperator) {
      this.onEqual()
      return
    }
    this.onSave()
  },

  onEqual() {
    const { calcLeft, pendingOperator, amountInput } = this.data
    if (!pendingOperator || amountInput === '') return

    const result = calcResult(calcLeft, pendingOperator, amountInput)
    if (result < 0) {
      wx.showToast({ title: '结果不能小于0', icon: 'none' })
      return
    }
    if (result > MAX_AMOUNT) {
      wx.showToast({ title: '金额不能超过999999.99', icon: 'none' })
      return
    }

    this.updateAmountState({
      amountInput: formatCalcResult(result),
      calcLeft: '',
      pendingOperator: '',
    })
  },

  onDateChange(e) {
    const date = e.detail.value
    this.setData({ recordDate: date, dateDisplay: date === today() ? '今天' : date.slice(5) })
  },

  goCategory() { wx.navigateTo({ url: '/pages/category/index' }) },
  goBack() { wx.navigateBack() },

  onSave() {
    if (!this.data.canSave || !this.data.selectedCategory) return
    const { editId, currentType, selectedCategory, amountInput, note, recordDate } = this.data
    const amount = yuanToFen(normalizeAmountInput(amountInput) || '0')
    if (amount <= 0) return

    const app = getApp()
    const cycleStartDay = (app && app.globalData && app.globalData.cycleStartDay) || 1
    const record_month = calcRecordMonth(recordDate, cycleStartDay)
    const now = new Date()
    const db = wx.cloud.database()

    const payload = {
      type: currentType,
      amount,
      category_id: selectedCategory._id,
      category_name: selectedCategory.name,
      category_icon: selectedCategory.icon,
      note: note || '',
      record_date: recordDate,
      record_month,
      updated_at: now,
    }

    wx.showLoading({ title: '保存中...' })
    const p = editId
      ? db.collection('ledger_records').doc(editId).update({ data: payload })
      : db.collection('ledger_records').add({
          data: {
            ...payload,
            is_deleted: false,
            created_at: now,
          },
        })
    p.then(() => {
      wx.hideLoading()
      wx.showToast({ title: editId ? '已更新' : '已保存', icon: 'success', duration: 800 })
      setTimeout(() => wx.navigateBack(), 900)
    }).catch(e => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
      console.error('record save error', e)
    })
  },
})
