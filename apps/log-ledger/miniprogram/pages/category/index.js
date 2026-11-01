const { getIconEmoji, getIconPickerGroups } = require('../../utils/categories')
const cache = require('../../utils/cache')

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

  onLoad() {
    this._unwatchCategories = cache.watchCategories(list => {
      if (this._sorting || this._savingSort) return
      this.applyCategories(list)
    })
  },

  onUnload() {
    if (this._unwatchCategories) this._unwatchCategories()
  },

  onShow() {
    this.loadCategories()
  },

  switchType(e) {
    this.setData({ currentType: e.currentTarget.dataset.type })
    this.loadCategories()
  },

  applyCategories(list) {
    const rows = (list || [])
      .filter(item => item.type === this.data.currentType)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(item => Object.assign({}, item, { emoji: getIconEmoji(item.icon) }))
    this.setData({
      visibleList: rows.filter(item => !item.is_hidden),
      hiddenList: rows.filter(item => item.is_hidden),
    })
  },

  loadCategories(ignoreCache, silent) {
    const type = this.data.currentType
    const seq = (this._categorySeq || 0) + 1
    this._categorySeq = seq
    if (!ignoreCache && !this._sorting && !this._savingSort) {
      const cached = cache.readCategories()
      if (cached) this.applyCategories(cached)
    }
    return cache.refreshCategories().then(({ list, fresh }) => {
      if (this._sorting || this._savingSort) return
      if (!fresh || !list || seq !== this._categorySeq || type !== this.data.currentType) return
      this.applyCategories(list)
    }).catch(err => {
      console.error('loadCategories error', err)
      if (silent || (!ignoreCache && cache.readCategories())) return
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  failCategoryChange(snapshot, title) {
    cache.revertCategories(snapshot)
    if (snapshot) this.applyCategories(snapshot)
    wx.showToast({ title, icon: 'none' })
    this.loadCategories(true, true)
  },

  hideCategory(e) {
    const id = e.currentTarget.dataset.id
    const snapshot = cache.cloneCategories()
    const next = cache.commitCategories(list => list.map(item => (
      item._id === id ? Object.assign({}, item, { is_hidden: true }) : item
    )))
    if (next) this.applyCategories(next)
    callCategorySave({ id, is_hidden: true })
      .then(() => cache.refreshCategories(list => {
        const item = list.find(row => row._id === id)
        return !!item && !!item.is_hidden
      }))
      .then(result => {
        if (result && result.fresh && result.list) this.applyCategories(result.list)
      })
      .catch(() => this.failCategoryChange(snapshot, '操作失败'))
  },

  showCategory(e) {
    const id = e.currentTarget.dataset.id
    const snapshot = cache.cloneCategories()
    const next = cache.commitCategories(list => list.map(item => (
      item._id === id ? Object.assign({}, item, { is_hidden: false }) : item
    )))
    if (next) this.applyCategories(next)
    callCategorySave({ id, is_hidden: false })
      .then(() => cache.refreshCategories(list => {
        const item = list.find(row => row._id === id)
        return !!item && !item.is_hidden
      }))
      .then(result => {
        if (result && result.fresh && result.list) this.applyCategories(result.list)
      })
      .catch(() => this.failCategoryChange(snapshot, '操作失败'))
  },

  deleteCategory(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除分类',
      content: `确定删除“${name}”吗？删除后不可恢复，已有账单不受影响。`,
      confirmColor: '#E64340',
      success: res => {
        if (!res.confirm) return
        const snapshot = cache.cloneCategories()
        const next = cache.commitCategories(list => list.filter(item => item._id !== id))
        if (next) this.applyCategories(next)
        wx.showLoading({ title: '删除中' })
        wx.cloud.callFunction({
          name: 'category_delete',
          data: { id },
        }).then(result => {
          if (!result.result || !result.result.success) {
            throw new Error((result.result && result.result.message) || 'category_delete_failed')
          }
          wx.showToast({ title: '已删除', icon: 'success' })
          return cache.refreshCategories(list => !list.some(item => item._id === id)).catch(err => {
            console.error('refresh categories', err)
            return null
          })
        }).then(result => {
          if (result && result.fresh && result.list) this.applyCategories(result.list)
        }).catch(() => this.failCategoryChange(snapshot, '删除失败'))
          .finally(() => wx.hideLoading())
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
    this._sorting = true
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
    if (!isDragging) {
      this._sorting = false
      const cached = cache.readCategories()
      if (cached) this.applyCategories(cached)
      return
    }

    this._suppressItemTap = true
    setTimeout(() => { this._suppressItemTap = false }, 200)
    const snapshot = cache.cloneCategories()
    const orderedIds = this.data.visibleList.map(item => item._id)
    cache.bumpCategories()
    this._savingSort = true
    callCategorySave({
      sort_list: orderedIds.map((id, index) => ({
        id,
        sort_order: index + 1,
      })),
    }).then(() => {
      const next = cache.commitCategories(list => list.map(item => {
        const index = orderedIds.indexOf(item._id)
        return index < 0 ? item : Object.assign({}, item, { sort_order: index + 1 })
      }))
      if (next) this.applyCategories(next)
      wx.showToast({ title: '排序已保存', icon: 'success' })
      return cache.refreshCategories(list => orderedIds.every((id, index) => {
        const item = list.find(row => row._id === id)
        return !!item && Number(item.sort_order) === index + 1
      })).catch(err => {
        console.error('refresh categories', err)
        return null
      })
    }).then(result => {
      if (result && result.fresh && result.list) this.applyCategories(result.list)
    }).catch(() => this.failCategoryChange(snapshot, '排序保存失败'))
      .finally(() => {
        this._savingSort = false
        this._sorting = false
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
        const next = cache.commitCategories(list => list.map(item => (
          item._id === editId ? Object.assign({}, item, { name, icon: newCatIcon }) : item
        )))
        this.setData({ showModal: false, isEditMode: false, editId: '' })
        if (next) this.applyCategories(next)
        wx.showToast({ title: '已保存', icon: 'success' })
        return cache.refreshCategories(list => {
          const item = list.find(row => row._id === editId)
          return !!item && item.name === name && item.icon === newCatIcon
        }).catch(err => {
          console.error('refresh categories', err)
          return null
        })
      }).then(result => {
        if (result && result.fresh && result.list) this.applyCategories(result.list)
      }).catch(() => wx.showToast({ title: '保存失败', icon: 'none' }))
        .finally(() => wx.hideLoading())
      return
    }
    wx.showLoading({ title: '添加中' })
    callCategorySave({ type: currentType, name, icon: newCatIcon })
      .then(result => {
        const next = cache.commitCategories(list => {
          const maxOrder = list.reduce((max, item) => (
            item.type === currentType ? Math.max(max, item.sort_order || 0) : max
          ), 0)
          return list.concat({
            _id: result.id,
            type: currentType,
            name,
            icon: newCatIcon,
            sort_order: maxOrder + 1,
            is_builtin: false,
            is_hidden: false,
          })
        })
        this.setData({ showModal: false })
        if (next) this.applyCategories(next)
        wx.showToast({ title: '已添加', icon: 'success' })
        return cache.refreshCategories(list => list.some(item => item._id === result.id)).catch(err => {
          console.error('refresh categories', err)
          return null
        })
      })
      .then(result => {
        if (result && result.fresh && result.list) this.applyCategories(result.list)
      })
      .catch(() => wx.showToast({ title: '添加失败', icon: 'none' }))
      .finally(() => wx.hideLoading())
  },
})
