const ICON_EMOJI = {
  food: '🍜', home: '🏠', car: '🚗', child: '👶',
  entertainment: '🎭', gift: '🤝', sport: '🏃', phone: '📱',
  social: '💬', travel: '✈️', medical: '💊', present: '🎁',
  office: '💼', game: '🎮', household: '🏡', camping: '⛺',
  cash: '💰', transport: '🚌', newyear: '🎊',
  salary: '💵', parttime: '⏰', invest: '📈', other: '📦',
  settings: '⚙️',
  pet: '🐕', cat: '🐱', plant: '🪴', laundry: '🧺', cleaning: '🧹',
  light: '💡', bath: '🛁', bed: '🛏️', sofa: '🛋️', keyring: '🔑',
  umbrella: '☂️', flower: '🌸', tea: '🍵', tools: '🛠️', garden: '🌳',
  baby_bottle: '🍼', knife_fork: '🍴', soap: '🧼', haircut: '💇',
  moon: '🌙', sun: '☀️', fire: '🔥',
  rice: '🍚', bread: '🍞', egg: '🥚', bento: '🍱', burger: '🍔',
  pizza: '🍕', icecream: '🍦', coffee: '☕', sushi: '🍣', dumpling: '🥟',
  fruit: '🍎', beer: '🍺', cake: '🎂', wine: '🍷',
  bike: '🚲', taxi: '🚕', train: '🚆', metro: '🚇', ship: '🚢',
  scooter: '🛵', fuel: '⛽',
  bag: '🛍️', cart: '🛒', shirt: '👕', shoes: '👟', watch: '⌚',
  glasses: '👓', ring: '💍', camera: '📷',
  movie: '🎬', music: '🎵', mic: '🎤', dice: '🎲', ticket: '🎫',
  yoga: '🧘', swim: '🏊', soccer: '⚽', basketball: '🏀', cycling: '🚴',
  hospital: '🏥', mask: '😷', tooth: '🦷', syringe: '💉',
  heart: '❤️', wedding: '💒',
  book: '📚', laptop: '💻', calendar: '📅', memo: '📝', chart: '📊',
  mail: '✉️',
  bonus: '🧧', coin: '🪙', bank: '🏦',
}

const GROUP_DEFS = [
  {
    id: 'life',
    label: '生活',
    keys: [
      'home', 'household', 'camping', 'child', 'pet', 'cat', 'plant', 'laundry', 'cleaning',
      'light', 'bath', 'bed', 'sofa', 'keyring', 'umbrella', 'flower', 'tea', 'garden',
      'baby_bottle', 'knife_fork', 'tools', 'soap', 'haircut', 'moon', 'sun', 'fire',
    ],
  },
  { id: 'food', label: '餐饮', keys: ['food', 'rice', 'bread', 'egg', 'bento', 'burger', 'pizza', 'icecream', 'coffee', 'sushi', 'dumpling', 'fruit', 'beer', 'cake', 'wine'] },
  { id: 'transport', label: '交通出行', keys: ['car', 'transport', 'travel', 'bike', 'taxi', 'train', 'metro', 'ship', 'scooter', 'fuel'] },
  { id: 'shopping', label: '购物消费', keys: ['bag', 'cart', 'shirt', 'shoes', 'watch', 'glasses', 'ring', 'present', 'camera'] },
  { id: 'fun', label: '娱乐休闲', keys: ['entertainment', 'game', 'movie', 'music', 'mic', 'dice', 'ticket', 'newyear'] },
  { id: 'sport', label: '运动健身', keys: ['sport', 'yoga', 'swim', 'soccer', 'basketball', 'cycling'] },
  { id: 'medical', label: '医疗健康', keys: ['medical', 'hospital', 'mask', 'tooth', 'syringe'] },
  { id: 'social', label: '人情社交', keys: ['gift', 'social', 'heart', 'wedding'] },
  { id: 'work', label: '学习办公', keys: ['office', 'phone', 'book', 'laptop', 'calendar', 'memo', 'chart', 'mail'] },
  { id: 'income', label: '收入理财', keys: ['salary', 'parttime', 'invest', 'cash', 'bonus', 'coin', 'bank', 'other'] },
]

function getIconEmoji(icon) {
  return ICON_EMOJI[icon] || '📝'
}

function getIconPickerGroups() {
  const used = new Set()
  const groups = []
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

function getIconPickerList() {
  return Object.entries(ICON_EMOJI)
    .filter(([k]) => k !== 'settings')
    .map(([key, emoji]) => ({ key, emoji }))
}

module.exports = { getIconEmoji, ICON_EMOJI, getIconPickerGroups, getIconPickerList }
