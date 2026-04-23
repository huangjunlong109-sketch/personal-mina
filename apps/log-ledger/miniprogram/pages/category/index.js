const { getIconEmoji, getIconPickerGroups } = require('../../utils/categories')

Page({
  data: {
    currentType: 'expense',
    visibleList: [],
    hiddenList: [],
    showModal: false,
    isEditMode: false,
    editId: '',
    newCatName: '',
    newCatIcon: 'food',
    iconPickerGroups: getIconPickerGroups(),
  },

  onShow() {
    this.loadCategories()
  },

  switchType(e) {
    this.setData({ currentType: e.currentTarget.dataset.type })
    this.loadCategories()
  },

  loadCategories() {
    const db = wx.cloud.database()
    db.collection('ledger_categories')
      .where({ type: this.data.currentType })
      .orderBy('sort_order', 'asc')
      .get()
      .then(res => {
        const list = (res.data || []).map(c => ({ ...c, emoji: getIconEmoji(c.icon) }))
        this.setData({
          visibleList: list.filter(c => !c.is_hidden),
          hiddenList: list.filter(c => c.is_hidden),
        })
      }).catch(err => {
        console.error('loadCategories error', err)
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  hideCategory(e) {
    const db = wx.cloud.database()
    db.collection('ledger_categories').doc(e.currentTarget.dataset.id)
      .update({ data: { is_hidden: true, updated_at: new Date() } })
      .then(() => this.loadCategories())
  },

  showCategory(e) {
    const db = wx.cloud.database()
    db.collection('ledger_categories').doc(e.currentTarget.dataset.id)
      .update({ data: { is_hidden: false, updated_at: new Date() } })
      .then(() => this.loadCategories())
  },

  onCatItemTap(e) {
    const { id, name, icon, builtin } = e.currentTarget.dataset
    if (String(builtin) === 'true') {
      wx.showToast({ title: '内置分类不可修改', icon: 'none' })
      return
    }
    this.setData({
      showModal: true,
      isEditMode: true,
      editId: id,
      newCatName: name || '',
      newCatIcon: icon || 'other',
    })
  },

  showAddModal() {
    const def = this.data.currentType === 'income' ? 'salary' : 'food'
    this.setData({
      showModal: true,
      isEditMode: false,
      editId: '',
      newCatName: '',
      newCatIcon: def,
    })
  },

  hideAddModal() {
    this.setData({ showModal: false, isEditMode: false, editId: '' })
  },

  stopModalBubble() {},

  onNewNameInput(e) {
    this.setData({ newCatName: e.detail.value })
  },

  pickIcon(e) {
    const key = e.currentTarget.dataset.key
    if (key) this.setData({ newCatIcon: key })
  },

  saveCategory() {
    const name = this.data.newCatName.trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }
    const { isEditMode, editId, newCatIcon, currentType } = this.data
    if (isEditMode && editId) {
      wx.showLoading({ title: '保存中' })
      wx.cloud.callFunction({
        name: 'category_save',
        data: { id: editId, name, icon: newCatIcon },
      }).then(() => {
        this.setData({ showModal: false, isEditMode: false, editId: '' })
        wx.showToast({ title: '已保存', icon: 'success' })
        this.loadCategories()
      }).catch(() => wx.showToast({ title: '保存失败', icon: 'none' }))
        .finally(() => wx.hideLoading())
      return
    }
    const db = wx.cloud.database()
    db.collection('ledger_categories')
      .where({ type: currentType })
      .orderBy('sort_order', 'desc')
      .limit(1)
      .get()
      .then(res => {
        const maxOrder = res.data[0] ? res.data[0].sort_order : 0
        return db.collection('ledger_categories').add({
          data: {
            type: currentType,
            name,
            icon: newCatIcon,
            sort_order: maxOrder + 1,
            is_builtin: false,
            is_hidden: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        })
      })
      .then(() => {
        this.setData({ showModal: false })
        wx.showToast({ title: '已添加', icon: 'success' })
        this.loadCategories()
      })
      .catch(() => wx.showToast({ title: '添加失败', icon: 'none' }))
  },
})
