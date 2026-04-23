export interface Category {
  _id?: string
  type: 'expense' | 'income'
  name: string
  icon: string
  sort_order: number
  is_builtin: boolean
  is_hidden: boolean
}

/** 支出内置分类 */
export const BUILTIN_EXPENSE: Omit<Category, '_id'>[] = [
  { type: 'expense', name: '餐饮', icon: 'food', sort_order: 1, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '住房', icon: 'home', sort_order: 2, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '汽车', icon: 'car', sort_order: 3, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '孩子', icon: 'child', sort_order: 4, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '娱乐', icon: 'entertainment', sort_order: 5, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '人情', icon: 'gift', sort_order: 6, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '运动', icon: 'sport', sort_order: 7, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '通讯', icon: 'phone', sort_order: 8, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '社交', icon: 'social', sort_order: 9, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '旅行', icon: 'travel', sort_order: 10, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '医疗', icon: 'medical', sort_order: 11, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '礼金', icon: 'present', sort_order: 12, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '办公', icon: 'office', sort_order: 13, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '主机', icon: 'game', sort_order: 14, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '家用', icon: 'household', sort_order: 15, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '露营', icon: 'camping', sort_order: 16, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '现金', icon: 'cash', sort_order: 17, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '交通', icon: 'transport', sort_order: 18, is_builtin: true, is_hidden: false },
  { type: 'expense', name: '新年', icon: 'newyear', sort_order: 19, is_builtin: true, is_hidden: false },
]

/** 收入内置分类 */
export const BUILTIN_INCOME: Omit<Category, '_id'>[] = [
  { type: 'income', name: '工资', icon: 'salary', sort_order: 1, is_builtin: true, is_hidden: false },
  { type: 'income', name: '兼职', icon: 'parttime', sort_order: 2, is_builtin: true, is_hidden: false },
  { type: 'income', name: '理财', icon: 'invest', sort_order: 3, is_builtin: true, is_hidden: false },
  { type: 'income', name: '礼金', icon: 'present', sort_order: 4, is_builtin: true, is_hidden: false },
  { type: 'income', name: '其它', icon: 'other', sort_order: 5, is_builtin: true, is_hidden: false },
]

/** icon key → emoji（记账分类展示） */
export const ICON_EMOJI: Record<string, string> = {
  food: '🍜',
  home: '🏠',
  car: '🚗',
  child: '👶',
  entertainment: '🎭',
  gift: '🤝',
  sport: '🏃',
  phone: '📱',
  social: '💬',
  travel: '✈️',
  medical: '💊',
  present: '🎁',
  office: '💼',
  game: '🎮',
  household: '🏡',
  camping: '⛺',
  cash: '💰',
  transport: '🚌',
  newyear: '🎊',
  salary: '💵',
  parttime: '⏰',
  invest: '📈',
  other: '📦',
  settings: '⚙️',
  // 生活
  pet: '🐕',
  cat: '🐱',
  plant: '🪴',
  laundry: '🧺',
  cleaning: '🧹',
  light: '💡',
  bath: '🛁',
  bed: '🛏️',
  sofa: '🛋️',
  keyring: '🔑',
  umbrella: '☂️',
  flower: '🌸',
  tea: '🍵',
  tools: '🛠️',
  garden: '🌳',
  baby_bottle: '🍼',
  knife_fork: '🍴',
  soap: '🧼',
  haircut: '💇',
  moon: '🌙',
  sun: '☀️',
  fire: '🔥',
  // 餐饮扩展
  rice: '🍚',
  bread: '🍞',
  egg: '🥚',
  bento: '🍱',
  burger: '🍔',
  pizza: '🍕',
  icecream: '🍦',
  coffee: '☕',
  sushi: '🍣',
  dumpling: '🥟',
  fruit: '🍎',
  beer: '🍺',
  cake: '🎂',
  wine: '🍷',
  // 交通扩展
  bike: '🚲',
  taxi: '🚕',
  train: '🚆',
  metro: '🚇',
  ship: '🚢',
  scooter: '🛵',
  fuel: '⛽',
  // 购物
  bag: '🛍️',
  cart: '🛒',
  shirt: '👕',
  shoes: '👟',
  watch: '⌚',
  glasses: '👓',
  ring: '💍',
  camera: '📷',
  // 娱乐扩展
  movie: '🎬',
  music: '🎵',
  mic: '🎤',
  dice: '🎲',
  ticket: '🎫',
  // 运动扩展
  yoga: '🧘',
  swim: '🏊',
  soccer: '⚽',
  basketball: '🏀',
  cycling: '🚴',
  // 医疗扩展
  hospital: '🏥',
  mask: '😷',
  tooth: '🦷',
  syringe: '💉',
  // 人情
  heart: '❤️',
  wedding: '💒',
  // 学习办公
  book: '📚',
  laptop: '💻',
  calendar: '📅',
  memo: '📝',
  chart: '📊',
  mail: '✉️',
  // 收入扩展
  bonus: '🧧',
  coin: '🪙',
  bank: '🏦',
}

/** 分组定义（同一 key 只出现在一个分组；未列入的 key 会进「更多」） */
const GROUP_DEFS: { id: string; label: string; keys: string[] }[] = [
  {
    id: 'life',
    label: '生活',
    keys: [
      'home', 'household', 'camping', 'child', 'pet', 'cat', 'plant', 'laundry', 'cleaning',
      'light', 'bath', 'bed', 'sofa', 'keyring', 'umbrella', 'flower', 'tea', 'garden',
      'baby_bottle', 'knife_fork', 'tools', 'soap', 'haircut', 'moon', 'sun', 'fire',
    ],
  },
  {
    id: 'food',
    label: '餐饮',
    keys: [
      'food', 'rice', 'bread', 'egg', 'bento', 'burger', 'pizza', 'icecream', 'coffee',
      'sushi', 'dumpling', 'fruit', 'beer', 'cake', 'wine',
    ],
  },
  {
    id: 'transport',
    label: '交通出行',
    keys: ['car', 'transport', 'travel', 'bike', 'taxi', 'train', 'metro', 'ship', 'scooter', 'fuel'],
  },
  {
    id: 'shopping',
    label: '购物消费',
    keys: ['bag', 'cart', 'shirt', 'shoes', 'watch', 'glasses', 'ring', 'present', 'camera'],
  },
  {
    id: 'fun',
    label: '娱乐休闲',
    keys: ['entertainment', 'game', 'movie', 'music', 'mic', 'dice', 'ticket', 'newyear'],
  },
  {
    id: 'sport',
    label: '运动健身',
    keys: ['sport', 'yoga', 'swim', 'soccer', 'basketball', 'cycling'],
  },
  {
    id: 'medical',
    label: '医疗健康',
    keys: ['medical', 'hospital', 'mask', 'tooth', 'syringe'],
  },
  {
    id: 'social',
    label: '人情社交',
    keys: ['gift', 'social', 'heart', 'wedding'],
  },
  {
    id: 'work',
    label: '学习办公',
    keys: ['office', 'phone', 'book', 'laptop', 'calendar', 'memo', 'chart', 'mail'],
  },
  {
    id: 'income',
    label: '收入理财',
    keys: ['salary', 'parttime', 'invest', 'cash', 'bonus', 'coin', 'bank', 'other'],
  },
]

export interface IconGroup {
  id: string
  label: string
  icons: { key: string; emoji: string }[]
}

export function getIconEmoji(icon: string): string {
  return ICON_EMOJI[icon] || '📝'
}

/** 按分组返回可选图标（settings 不出现；未编入分组的 key 归入「更多」） */
export function getIconPickerGroups(): IconGroup[] {
  const used = new Set<string>()
  const groups: IconGroup[] = []

  for (const g of GROUP_DEFS) {
    const icons = g.keys
      .filter((k) => ICON_EMOJI[k] && k !== 'settings')
      .map((k) => {
        used.add(k)
        return { key: k, emoji: ICON_EMOJI[k] }
      })
    if (icons.length) groups.push({ id: g.id, label: g.label, icons })
  }

  const rest = Object.keys(ICON_EMOJI)
    .filter((k) => k !== 'settings' && !used.has(k))
    .map((k) => ({ key: k, emoji: ICON_EMOJI[k] }))
  if (rest.length) groups.push({ id: 'more', label: '更多', icons: rest })

  return groups
}

/** @deprecated 使用 getIconPickerGroups */
export function getIconPickerList(): { key: string; emoji: string }[] {
  return Object.entries(ICON_EMOJI)
    .filter(([k]) => k !== 'settings')
    .map(([key, emoji]) => ({ key, emoji }))
}
