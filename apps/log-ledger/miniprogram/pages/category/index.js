const { getIconEmoji, getIconPickerGroups } = require('../../utils/categories')

function callCategorySave(data) {
  return wx.cloud.callFunction({
    name: 'category_save',
    data,
  }).then(res => {
    if (!res.result || !res.result.success) {
      throw new Error((res.result && res.result.err) || 'category_save_failed')
    }
    return res.result
  })
}

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
    draggingId: '',
  },

  onShow() {
    this.loadCategories()
  },

  switchType(e) {
    this.setData({ currentType: e.currentTarget.dataset.type })
    this.loadCategories()
  },

  loadCategories() {
    wx.cloud.callFunction({
      name: 'category_list',
      data: { type: this.data.currentType },
    })
      .then(res => {
        if (!res.result || !res.result.success) throw new Error('category_list_failed')
        const list = (res.result.list || []).map(c => ({ ...c, emoji: getIconEmoji(c.icon) }))
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
    callCategorySave({ id: e.currentTarget.dataset.id, is_hidden: true })
      .then(() => this.loadCategories())
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  showCategory(e) {
    callCategorySave({ id: e.currentTarget.dataset.id, is_hidden: false })
      .then(() => this.loadCategories())
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  deleteCategory(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除分类',
      content: `确定删除“${name}”吗？删除后不可恢复，已有账单不受影响。`,
      confirmColor: '#E64340',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中' })
        wx.cloud.callFunction({
          name: 'category_delete',
          data: { id },
        }).then(result => {
          if (!result.result || !result.result.success) {
            throw new Error((result.result && result.result.message) || 'category_delete_failed')
          }
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadCategories()
        }).catch(() => {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }).finally(() => wx.hideLoading())
      },
    })
  },

  onCatItemTap(e) {
    if (this._suppressItemTap) return
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

  onCatTouchStart(e) {
    if (this._savingSort) return
    this._dragIndex = Number(e.currentTarget.dataset.index)
    this._dragging = false
    this._dragRects = []
    wx.createSelectorQuery()
      .selectAll('.cat-item--draggable')
      .boundingClientRect(rects => {
        this._dragRects = rects || []
      })
      .exec()
  },

  onCatTouchMove(e) {
    if (this._dragIndex === undefined || !this._dragRects.length) return
    const touch = e.touches[0]
    if (!touch) return
    const targetIndex = this._dragRects.findIndex(rect =>
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    )
    if (targetIndex < 0 || targetIndex === this._dragIndex) return

    const visibleList = [...this.data.visibleList]
    const [dragged] = visibleList.splice(this._dragIndex, 1)
    visibleList.splice(targetIndex, 0, dragged)
    this._dragIndex = targetIndex
    this._dragging = true
    this.setData({ visibleList, draggingId: dragged._id })
  },

  onCatTouchEnd() {
    const isDragging = this._dragging
    this._dragIndex = undefined
    this._dragRects = []
    this._dragging = false
    this.setData({ draggingId: '' })
    if (!isDragging) return

    this._suppressItemTap = true
    setTimeout(() => { this._suppressItemTap = false }, 200)
    this._savingSort = true
    callCategorySave({
      sort_list: this.data.visibleList.map((item, index) => ({
        id: item._id,
        sort_order: index + 1,
      })),
    }).then(() => {
      wx.showToast({ title: '排序已保存', icon: 'success' })
    }).catch(() => {
      wx.showToast({ title: '排序保存失败', icon: 'none' })
      this.loadCategories()
    }).finally(() => {
      this._savingSort = false
    })
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
      callCategorySave({ id: editId, name, icon: newCatIcon }).then(() => {
        this.setData({ showModal: false, isEditMode: false, editId: '' })
        wx.showToast({ title: '已保存', icon: 'success' })
        this.loadCategories()
      }).catch(() => wx.showToast({ title: '保存失败', icon: 'none' }))
        .finally(() => wx.hideLoading())
      return
    }
    wx.showLoading({ title: '添加中' })
    callCategorySave({ type: currentType, name, icon: newCatIcon })
      .then(() => {
        this.setData({ showModal: false })
        wx.showToast({ title: '已添加', icon: 'success' })
        this.loadCategories()
      })
      .catch(() => wx.showToast({ title: '添加失败', icon: 'none' }))
      .finally(() => wx.hideLoading())
  },
})
