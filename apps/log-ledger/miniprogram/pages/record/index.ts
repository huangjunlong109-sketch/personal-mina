import { today, formatDate, yuanToFen, fenToYuan } from '../../utils/date'
import { getIconEmoji } from '../../utils/categories'

function fenToAmountInput(fen: number) {
  const s = fenToYuan(fen)
  if (s.endsWith('.00')) return s.slice(0, -3)
  return String(Number(s))
}

const MAX_AMOUNT = 999999.99

function normalizeAmountInput(input: string) {
  if (!input) return ''
  if (input.endsWith('.')) return input.slice(0, -1) || '0'
  return input
}

function formatAmountDisplay(amountInput: string, calcLeft: string, pendingOperator: '' | '+' | '-') {
  if (pendingOperator) return `${calcLeft}${pendingOperator}${amountInput}`
  if (amountInput === '') return '0.00'
  if (amountInput.endsWith('.')) return `${amountInput}00`
  return Number(amountInput).toFixed(2)
}

function formatCalcResult(value: number) {
  const fixed = value.toFixed(2)
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function calcResult(left: string, operator: '' | '+' | '-', right: string) {
  const leftValue = Number(normalizeAmountInput(left) || '0')
  const rightValue = Number(normalizeAmountInput(right) || '0')
  return operator === '-' ? leftValue - rightValue : leftValue + rightValue
}

interface Category {
  _id: string
  type: string
  name: string
  icon: string
  sort_order: number
  is_hidden: boolean
  emoji?: string
}

Page({
  data: {
    currentType: 'expense' as 'expense' | 'income',
    categories: [] as Category[],
    selectedCategoryId: '',
    selectedCategory: null as Category | null,
    amountInput: '',       // 原始输入字符串
    amountDisplay: '0.00',
    calcLeft: '',
    pendingOperator: '' as '' | '+' | '-',
    note: '',
    recordDate: today(),
    dateDisplay: '今天',
    canSave: false,
    actionEnabled: false,
    editId: '',            // 编辑模式的记录id
  },

  onLoad(options: any) {
    const editId = options.id || ''
    if (editId) {
      this.setData({ editId })
      void this.loadEditRecord(editId)
      return
    }
    const type = options.type || 'expense'
    this.setData({ currentType: type, editId: '', recordDate: today() })
    void this.loadCategories(type)
  },

  async loadCategories(type: string, preferredCategoryId?: string) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'category_list',
        data: { type },
      }) as any
      const list: Category[] = (res.result.list || [])
        .filter((c: Category) => !c.is_hidden)
        .map((c: Category) => ({ ...c, emoji: getIconEmoji(c.icon) }))
      let selected = list[0] || null
      let selectedId = selected?._id || ''
      if (preferredCategoryId) {
        const found = list.find((c) => c._id === preferredCategoryId)
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
    } catch (e) {
      console.error('loadCategories error', e)
    }
  },

  async loadEditRecord(id: string) {
    wx.showLoading({ title: '加载中' })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('ledger_records').doc(id).get()
      const r = res.data as any
      const amountInput = fenToAmountInput(r.amount)
      const recordDate = r.record_date || today()
      const dateDisplay = recordDate === today() ? '今天' : recordDate.slice(5)
      this.updateAmountState({
        currentType: r.type || 'expense',
        note: r.note || '',
        recordDate,
        dateDisplay,
        amountInput,
        amountDisplay: fenToYuan(r.amount),
        calcLeft: '',
        pendingOperator: '',
        editId: id,
      })
      wx.setNavigationBarTitle({ title: '编辑记录' })
      await this.loadCategories(r.type || 'expense', r.category_id)
    } catch (e) {
      console.error('loadEditRecord', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  switchType(e: any) {
    const type = e.currentTarget.dataset.type
    this.updateAmountState({ currentType: type, selectedCategoryId: '', selectedCategory: null, categories: [] })
    void this.loadCategories(type)
  },

  selectCategory(e: any) {
    const item = e.currentTarget.dataset.item
    this.updateAmountState({
      selectedCategoryId: item._id,
      selectedCategory: item,
    })
  },

  onNoteInput(e: any) {
    this.setData({ note: e.detail.value })
  },

  updateAmountState(patch: Record<string, any>) {
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

  onKey(e: any) {
    const key = e.currentTarget.dataset.key as string
    if (key === 'del') {
      this.handleDelete()
      return
    }

    if (key === '+' || key === '-') {
      this.handleOperator(key as '+' | '-')
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
    if (input.includes('.')) {
      const parts = input.split('.')
      if (parts[1].length > 2) return
    }
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

  handleOperator(operator: '+' | '-') {
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
    void this.onSave()
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

  onDate() {
    wx.showActionSheet({
      itemList: ['选择日期'],
      success: () => {
        // 触发 picker（通过 tap picker 的 wxml 方式）
        // 由于 picker 无法命令式打开，这里改用 wx.showDatePicker（暂不支持）
        // 实际方案：用 <picker> 包裹一个透明 view，用 bindtap 触发
      },
    })
    // 直接用 picker 组件，在 wxml 里放一个 picker 触发
    this.triggerDatePicker()
  },

  triggerDatePicker() {
    // 通过设置一个 flag 让 wxml 里 picker 展开（微信小程序 picker 不支持命令式）
    // 实际上 picker 需要用户点击才能触发，这里不做处理
    // 在键盘区直接用 picker 包裹整个日期按钮
  },

  onDateChange(e: any) {
    const date = e.detail.value
    const today = formatDate(new Date())
    const display = date === today ? '今天' : date.slice(5) // 显示 MM-DD
    this.setData({ recordDate: date, dateDisplay: display })
  },

  goCategory() {
    wx.navigateTo({ url: '/pages/category/index' })
  },

  goBack() {
    wx.navigateBack()
  },

  async onSave() {
    if (!this.data.canSave) return
    const { currentType, selectedCategory, amountInput, note, recordDate, editId } = this.data
    if (!selectedCategory) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }
    const amount = yuanToFen(normalizeAmountInput(amountInput) || '0')
    if (amount <= 0) {
      wx.showToast({ title: '金额不能为0', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      await wx.cloud.callFunction({
        name: 'record_save',
        data: {
          id: editId || undefined,
          type: currentType,
          amount,
          category_id: selectedCategory._id,
          category_name: selectedCategory.name,
          category_icon: selectedCategory.icon,
          note,
          record_date: recordDate,
        },
      })
      wx.hideLoading()
      wx.showToast({ title: editId ? '已更新' : '已保存', icon: 'success', duration: 800 })
      setTimeout(() => {
        // 通知明细页刷新
        const pages = getCurrentPages()
        const indexPage = pages.find((p: any) => p.route === 'pages/index/index')
        if (indexPage) (indexPage as any).onRefresh?.()
        wx.navigateBack()
      }, 900)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
      console.error('record_save error', e)
    }
  },
})
