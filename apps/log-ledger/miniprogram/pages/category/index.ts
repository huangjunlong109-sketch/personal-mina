import { getIconEmoji, getIconPickerGroups } from '../../utils/categories'

interface Category {
  _id: string
  type: string
  name: string
  icon: string
  sort_order: number
  is_builtin: boolean
  is_hidden: boolean
  emoji?: string
}

const iconPickerGroups = getIconPickerGroups()

Page({
  data: {
    currentType: 'expense' as 'expense' | 'income',
    visibleList: [] as Category[],
    hiddenList: [] as Category[],
    showModal: false,
    isEditMode: false,
    editId: '' as string,
    newCatName: '',
    newCatIcon: 'food' as string,
    iconPickerGroups,
  },

  onShow() {
    this.loadCategories()
  },

  switchType(e: any) {
    this.setData({ currentType: e.currentTarget.dataset.type })
    this.loadCategories()
  },

  async loadCategories() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'category_list',
        data: { type: this.data.currentType },
      }) as any
      const list: Category[] = (res.result.list || []).map((c: Category) => ({
        ...c,
        emoji: getIconEmoji(c.icon),
      }))
      this.setData({
        visibleList: list.filter(c => !c.is_hidden),
        hiddenList: list.filter(c => c.is_hidden),
      })
    } catch (e) {
      console.error('loadCategories error', e)
    }
  },

  async hideCategory(e: any) {
    const { id } = e.currentTarget.dataset
    await wx.cloud.callFunction({
      name: 'category_save',
      data: { id, is_hidden: true },
    })
    this.loadCategories()
  },

  async showCategory(e: any) {
    const { id } = e.currentTarget.dataset
    await wx.cloud.callFunction({
      name: 'category_save',
      data: { id, is_hidden: false },
    })
    this.loadCategories()
  },

  onCatItemTap(e: any) {
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

  /** 阻止弹窗内点击冒泡/穿透到遮罩（勿删，空方法即可） */
  stopModalBubble() {},

  onNewNameInput(e: any) {
    this.setData({ newCatName: e.detail.value })
  },

  pickIcon(e: any) {
    const key = e.currentTarget.dataset.key as string
    if (key) this.setData({ newCatIcon: key })
  },

  async saveCategory() {
    const name = this.data.newCatName.trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }
    const { isEditMode, editId, newCatIcon, currentType } = this.data
    wx.showLoading({ title: isEditMode ? '保存中' : '添加中' })
    try {
      if (isEditMode && editId) {
        await wx.cloud.callFunction({
          name: 'category_save',
          data: { id: editId, name, icon: newCatIcon },
        })
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        await wx.cloud.callFunction({
          name: 'category_save',
          data: { type: currentType, name, icon: newCatIcon },
        })
        wx.showToast({ title: '已添加', icon: 'success' })
      }
      this.setData({ showModal: false, isEditMode: false, editId: '' })
      this.loadCategories()
    } catch (e) {
      wx.showToast({ title: isEditMode ? '保存失败' : '添加失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
})
