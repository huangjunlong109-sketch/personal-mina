const { callFn } = require('../../utils/db')
// 微信构建 npm 不会带上 xlsx/dist 子路径，直接引用 vendor 里的 mini 包
const XLSX = require('../../vendor/xlsx.mini.min.js')

function normalizeHeaderKey(s) {
  if (s == null) return ''
  return String(s)
    .replace(/\ufeff/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 供表头匹配：去掉各类空白，便于「记录ID」「记 录 ID」等与模板对齐 */
function headerMatchKey(s) {
  return normalizeHeaderKey(s).replace(/\s+/g, '')
}

/** @returns {string} */
function formatDateValue(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = normalizeHeaderKey(v)
  if (s.includes('统计汇总')) return '统计汇总'
  const m = s.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?(?:[ T].*)?$/)
  if (m) {
    const month = Number(m[2])
    const day = Number(m[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return ''
    const mm = m[2].padStart(2, '0')
    const dd = m[3].padStart(2, '0')
    return `${m[1]}-${mm}-${dd}`
  }
  // 无法识别为日期（如汇总行的数字），返回空让行被过滤掉
  return ''
}

function isSummaryStartRow(idRaw, dateRaw) {
  const first = headerMatchKey(idRaw)
  const second = headerMatchKey(dateRaw)
  if (!first && !second) return false
  return [
    '统计汇总',
    '用户id',
    'wecarid',
    '总记录数',
    '总增加里程(km)',
    '总加油量(l)',
    '总支付总额(元)',
    '平均油耗(l/100km)',
  ].includes(first) || first === '统计汇总' || second === '统计汇总'
}

/**
 * 在二维表里找表头行，并返回列索引
 * @param {string[][]} matrix
 */
function findHeaderMapping(matrix) {
  const rules = {
    id: [
      /记录id/i,
      /记录编号/i,
      /记录号/i,
      /^id$/i,
      /^uuid$/i,
      /流水号/,
      /编号/,
    ],
    date: [/加油日期/, /加油时间/, /时间/, /日期/],
    grade: [/油号/, /油品/, /汽油/],
    liters: [/加油量/, /加油量\(l\)/i, /油量/, /升数/, /加油l/i, /\(l\)/i],
    unitPrice: [/单价/, /支付单价/, /元\/l/i, /每升/],
    totalAmount: [/总额/, /支付总额/, /金额/, /费用/, /合计/],
    odometer: [/里程.*km/i, /总里程/, /里程表/, /行驶里程/, /表显里程/, /里程\(/],
    addedMileage: [/增加里程/, /区间里程/, /本次里程/],
    fuelConsumption: [/油耗/, /最新油耗/i, /l\/100km/i, /百公里/],
    costPerKm: [/每公里/, /公里油费/, /油费\/km/i],
  }

  const scanRows = Math.min(matrix.length, 120)
  for (let r = 0; r < scanRows; r++) {
    const row = matrix[r] || []
    const norm = row.map((c) => normalizeHeaderKey(c))
    const compact = row.map((c) => headerMatchKey(c))
    const idx = {}
    let ok = true
    for (const key of Object.keys(rules)) {
      const pats = rules[key]
      let found = -1
      for (let c = 0; c < norm.length; c++) {
        const h = norm[c]
        const hc = compact[c]
        if (!h && !hc) continue
        if (pats.some((re) => re.test(h) || re.test(hc))) {
          found = c
          break
        }
      }
      if (found < 0) {
        if (key === 'id' || key === 'date') ok = false
      } else {
        idx[key] = found
      }
    }
    if (ok && idx.id != null && idx.date != null) {
      return { mode: 'matrix', headerRow: r, idx, headersSample: norm.filter(Boolean).slice(0, 12) }
    }
  }
  return null
}

/**
 * 用 sheet_to_json 默认模式（对象数组）按「列名」匹配，避免合并单元格导致 header:1 首行为空
 * @param {Record<string, any>[]} objectRows
 */
function findHeaderMappingFromObjectKeys(objectRows) {
  if (!objectRows || !objectRows.length) return null
  const keys = Object.keys(objectRows[0] || {})
  if (!keys.length) return null
  const keyNorm = {}
  keys.forEach((k) => {
    keyNorm[k] = { raw: k, norm: normalizeHeaderKey(k), compact: headerMatchKey(k) }
  })
  const rules = {
    id: [/记录id/i, /记录编号/i, /记录号/i, /^id$/i, /^uuid$/i, /流水号/],
    date: [/加油日期/, /加油时间/, /时间/, /日期/],
    grade: [/油号/, /油品/, /汽油/],
    liters: [/加油量/, /加油量\(l\)/i, /油量/, /升数/],
    unitPrice: [/单价/, /支付单价/, /元\/l/i, /每升/],
    totalAmount: [/总额/, /支付总额/, /金额/, /费用/, /合计/],
    odometer: [/里程.*km/i, /总里程/, /里程表/, /行驶里程/, /表显里程/],
    addedMileage: [/增加里程/, /区间里程/, /本次里程/],
    fuelConsumption: [/油耗/, /最新油耗/i, /l\/100km/i, /百公里/],
    costPerKm: [/每公里/, /公里油费/, /油费\/km/i],
  }
  const fieldToOriginalKey = {}
  for (const field of Object.keys(rules)) {
    const pats = rules[field]
    let found = null
    for (const k of keys) {
      const { norm, compact } = keyNorm[k]
      if (!norm && !compact) continue
      if (pats.some((re) => re.test(norm) || re.test(compact))) {
        found = k
        break
      }
    }
    if (field === 'id' || field === 'date') {
      if (!found) return null
    }
    if (found) fieldToOriginalKey[field] = found
  }
  return { mode: 'object', fieldToOriginalKey, keysSample: keys.slice(0, 12) }
}

function matrixHeadPreview(matrix, maxRows, maxCols) {
  const out = []
  const limR = Math.min(matrix.length, maxRows)
  for (let r = 0; r < limR; r++) {
    const row = matrix[r] || []
    const cells = []
    const limC = Math.min(row.length, maxCols)
    for (let c = 0; c < limC; c++) {
      const v = row[c]
      if (v == null || v === '') cells.push('')
      else cells.push(normalizeHeaderKey(v).slice(0, 20))
    }
    if (cells.some(Boolean)) out.push(cells)
  }
  return out
}

/**
 * 表头文字与模板不一致时：按列内容推断「ID 列 + 日期列」
 * @param {any[][]} matrix
 */
function inferHeaderByContent(matrix) {
  const maxCol = Math.min(
    40,
    matrix.reduce((m, row) => Math.max(m, (row && row.length) || 0), 0)
  )
  if (maxCol < 2) return null

  const dataStart = 0
  const dataEnd = Math.min(matrix.length, 300)

  const dateRe = /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const looksLikeYmd = (s) => dateRe.test(String(s || ''))

  let bestId = -1
  let bestIdScore = -1
  let bestDate = -1
  let bestDateScore = -1

  for (let c = 0; c < maxCol; c++) {
    let uuidHits = 0
    let dateHits = 0
    let samples = 0
    for (let r = dataStart; r < dataEnd; r++) {
      const v = cellAt(matrix[r] || [], c)
      if (v == null || v === '') continue
      samples++
      const sv = String(v).trim()
      if (uuidRe.test(sv)) uuidHits++
      if (looksLikeYmd(sv) || v instanceof Date) dateHits++
    }
    if (samples >= 5) {
      const dateScore = dateHits / samples
      if (dateScore > bestDateScore) {
        bestDateScore = dateScore
        bestDate = c
      }
    }
    if (samples >= 5) {
      let compactIdHits = 0
      for (let r = dataStart; r < dataEnd; r++) {
        const v = cellAt(matrix[r] || [], c)
        if (v == null || v === '') continue
        const sv = String(v).trim()
        if (uuidRe.test(sv)) {
          compactIdHits++
          continue
        }
        if (looksLikeYmd(sv) || v instanceof Date) continue
        if (/^\d{4,12}$/.test(sv)) compactIdHits++
      }
      const idScore = (uuidHits * 2 + compactIdHits) / Math.max(1, samples)
      if (idScore > bestIdScore) {
        bestIdScore = idScore
        bestId = c
      }
    }
  }

  if (bestId < 0 || bestDate < 0 || bestId === bestDate) return null
  if (bestDateScore < 0.35) return null
  if (bestIdScore < 0.15) return null

  const headerRowGuess = 0
  return {
    mode: 'matrix',
    headerRow: headerRowGuess,
    idx: { id: bestId, date: bestDate },
    headersSample: ['(自动推断列)', `id列≈第${bestId + 1}列`, `日期列≈第${bestDate + 1}列`],
  }
}

function cellAt(row, i) {
  if (i == null || i < 0) return null
  return row[i]
}

function numAt(row, i) {
  const v = cellAt(row, i)
  if (v == null || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function intAt(row, i) {
  const v = cellAt(row, i)
  if (v == null || v === '') return 0
  const n = parseInt(String(v).replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function strAt(row, i) {
  const v = cellAt(row, i)
  if (v == null) return ''
  return String(v).trim()
}

Page({
  data: {
    currentVehicle: null,
    fileName: '',
    filePath: '',
    status: 'idle', // idle | parsing | importing | done | error
    progressText: '',
    result: null,
  },

  onShow() {
    const app = getApp()
    if (!app) return
    const refresh = () => {
      this.setData({ currentVehicle: app.globalData.currentVehicle || null })
    }
    if (typeof app.ensureDefaultVehicle === 'function') {
      app.ensureDefaultVehicle().then(refresh).catch(() => refresh())
    } else {
      refresh()
    }
  },

  chooseFile() {
    if (!this.data.currentVehicle) {
      wx.showToast({ title: '请先在「我的」选择车辆', icon: 'none' })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx'],
      success: (res) => {
        const file = res.tempFiles[0]
        this.setData({ fileName: file.name, filePath: file.path, status: 'idle', result: null })
      },
      fail: (e) => {
        // 用户取消不提示
        if (e.errMsg && e.errMsg.includes('cancel')) return
        wx.showToast({ title: '选择文件失败', icon: 'none' })
      },
    })
  },

  startImport() {
    const { filePath, currentVehicle } = this.data
    if (!filePath) {
      wx.showToast({ title: '请先选择 xlsx 文件', icon: 'none' })
      return
    }
    if (!currentVehicle) {
      wx.showToast({ title: '请先选择车辆', icon: 'none' })
      return
    }

    this.setData({ status: 'parsing', progressText: '🔍 解析中...', result: null })

    this.parseLocalXlsx(filePath)
      .then(rows => this.importInBatches(rows, currentVehicle._id))
      .catch(err => {
        console.error(err)
        this.setData({ status: 'error', result: { errorMsg: err.message || '解析失败，请检查文件格式' } })
      })
  },

  parseLocalXlsx(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          try {
            const wb = XLSX.read(res.data, { type: 'base64', cellDates: true })
            let map = null
            let matrix = []
            let objectRows = []
            for (let si = 0; si < wb.SheetNames.length; si++) {
              const ws = wb.Sheets[wb.SheetNames[si]]
              objectRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, cellDates: true })
              map = findHeaderMappingFromObjectKeys(objectRows)
              if (map) {
                matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
                break
              }
              matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
              map = findHeaderMapping(matrix) || inferHeaderByContent(matrix)
              if (map) break
            }
            if (!map) {
              const ws0 = wb.Sheets[wb.SheetNames[0]]
              const m0 = XLSX.utils.sheet_to_json(ws0, { header: 1, defval: null, raw: false })
              const prev = matrixHeadPreview(m0, 8, 14)
                .map((cells) => cells.join(' | '))
                .join('\n')
              reject(
                new Error(
                  `未识别表头。首表「${wb.SheetNames[0]}」前若干行预览：\n${prev || '(空)'}`
                )
              )
              return
            }
            const rows = []
            if (map.mode === 'object') {
              const fk = map.fieldToOriginalKey
              let reachedSummary = false
              objectRows.forEach((obj, i) => {
                if (reachedSummary) return
                const idRaw = obj[fk.id]
                const dateRaw = obj[fk.date]
                if (isSummaryStartRow(idRaw, dateRaw)) {
                  reachedSummary = true
                  return
                }
                const externalId = idRaw != null && idRaw !== '' ? String(idRaw).trim() : ''
                const refuelDate = formatDateValue(dateRaw)
                if (!externalId || !refuelDate || refuelDate === '统计汇总') return
                const g = fk.grade ? obj[fk.grade] : ''
                rows.push({
                  sourceRow: i + 2,
                  externalId,
                  refuelDate,
                  fuelGrade: (g != null && String(g).trim()) ? String(g).trim() : '92#',
                  liters: fk.liters ? parseFloat(String(obj[fk.liters]).replace(/,/g, '')) || 0 : 0,
                  unitPrice: fk.unitPrice ? parseFloat(String(obj[fk.unitPrice]).replace(/,/g, '')) || 0 : 0,
                  totalAmount: fk.totalAmount ? parseFloat(String(obj[fk.totalAmount]).replace(/,/g, '')) || 0 : 0,
                  odometer: fk.odometer ? parseInt(String(obj[fk.odometer]).replace(/,/g, ''), 10) || 0 : 0,
                  addedMileage: fk.addedMileage ? parseFloat(String(obj[fk.addedMileage]).replace(/,/g, '')) || 0 : 0,
                  fuelConsumption: fk.fuelConsumption ? parseFloat(String(obj[fk.fuelConsumption]).replace(/,/g, '')) || 0 : 0,
                  costPerKm: fk.costPerKm ? parseFloat(String(obj[fk.costPerKm]).replace(/,/g, '')) || 0 : 0,
                })
              })
            } else {
              const { headerRow, idx } = map
              for (let r = headerRow + 1; r < matrix.length; r++) {
                const line = matrix[r] || []
                const idRaw = cellAt(line, idx.id)
                const dateRaw = cellAt(line, idx.date)
                if (isSummaryStartRow(idRaw, dateRaw)) break
                const externalId = idRaw != null && idRaw !== '' ? String(idRaw).trim() : ''
                const refuelDate = formatDateValue(dateRaw)
                if (!externalId || !refuelDate || refuelDate === '统计汇总') continue
                const g = strAt(line, idx.grade)
                rows.push({
                  sourceRow: r + 1,
                  externalId,
                  refuelDate,
                  fuelGrade: g || '92#',
                  liters: numAt(line, idx.liters),
                  unitPrice: numAt(line, idx.unitPrice),
                  totalAmount: numAt(line, idx.totalAmount),
                  odometer: intAt(line, idx.odometer),
                  addedMileage: numAt(line, idx.addedMileage),
                  fuelConsumption: numAt(line, idx.fuelConsumption),
                  costPerKm: numAt(line, idx.costPerKm),
                })
              }
            }
            if (!rows.length) {
              reject(
                new Error(
                  '表头已识别，但未解析到数据行。请确认导出文件首列表名与原油耗工具一致，或发我一份脱敏 xlsx 表头截图。'
                )
              )
              return
            }
            resolve(rows)
          } catch (e) {
            reject(new Error('文件解析失败，请确认是标准 xlsx 文件'))
          }
        },
        fail: () => reject(new Error('读取文件失败')),
      })
    })
  },

  async importInBatches(rows, vehicleId) {
    if (!rows.length) {
      this.setData({ status: 'error', result: { errorMsg: '未解析到有效记录，请检查模板' } })
      return
    }
    const batchSize = 20
    const total = rows.length
    const totalBatch = Math.ceil(total / batchSize)
    const summary = { success: 0, updated: 0, failed: 0, issues: [] }

    this.setData({ status: 'importing' })

    for (let i = 0; i < totalBatch; i++) {
      const start = i * batchSize
      const chunk = rows.slice(start, start + batchSize)
      this.setData({ progressText: `⬆️ 导入中...(${i + 1}/${totalBatch})` })
      const part = await callFn('record.importRows', { vehicleId, rows: chunk })
      summary.success += part.success || 0
      summary.updated += part.updated || 0
      summary.failed += part.failed || 0
      if (part.issues && part.issues.length) {
        summary.issues = summary.issues.concat(part.issues)
      }
    }

    this.setData({ status: 'done', progressText: '', result: summary })
  },

  reset() {
    this.setData({ fileName: '', filePath: '', status: 'idle', progressText: '', result: null })
  },

  clearAllRecords() {
    const { currentVehicle } = this.data
    if (!currentVehicle) return
    const vehicleName = `${currentVehicle.brand} ${currentVehicle.model}${currentVehicle.plate ? `（${currentVehicle.plate}）` : ''}`
    wx.showModal({
      title: '清空所有记录',
      content: `将删除「${vehicleName}」的全部加油记录，不可恢复，确认吗？`,
      confirmText: '清空',
      confirmColor: '#FF3B30',
      success: (r) => {
        if (!r.confirm) return
        this.setData({ status: 'importing', progressText: '🗑 清空中...' })
        callFn('record.clearAll', { vehicleId: currentVehicle._id })
          .then((res) => {
            this.setData({ status: 'idle', progressText: '' })
            wx.showToast({ title: `已清空 ${res.removed || 0} 条`, icon: 'success' })
          })
          .catch((e) => {
            this.setData({ status: 'error', result: { errorMsg: e.message || '清空失败' } })
          })
      },
    })
  },
})
