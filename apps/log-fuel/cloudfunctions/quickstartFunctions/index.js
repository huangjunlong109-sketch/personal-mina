const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ─── 工具 ────────────────────────────────────────────────────────────────────

function inferTankFull(totalAmount) {
  if (totalAmount == null) return true
  return !Number.isInteger(Number(totalAmount))
}

function toYmd(dateLike) {
  if (!dateLike) return ''
  if (dateLike instanceof Date) return dateLike.toISOString().slice(0, 10)
  return String(dateLike).slice(0, 10)
}

function validateRecord(record, prevOdometer) {
  const flags = []
  const { liters, unitPrice, totalAmount, odometer, addedMileage, fuelConsumption } = record

  if (!record.refuelDate || !liters || !totalAmount || !odometer) {
    flags.push('missing_field')
  }
  if (liters && unitPrice && totalAmount) {
    const expected = Math.round(liters * unitPrice * 100) / 100
    if (Math.abs(totalAmount - expected) > 0.06) flags.push('amount_mismatch')
  }
  if (prevOdometer != null && addedMileage != null && odometer != null) {
    const calcAdded = odometer - prevOdometer
    if (Math.abs(calcAdded - addedMileage) > 1) flags.push('mileage_mismatch')
  }
  if (fuelConsumption != null && addedMileage > 0 && liters) {
    const calc = Math.round((liters / addedMileage) * 100 * 100) / 100
    if (Math.abs(fuelConsumption - calc) > 0.1) flags.push('consumption_mismatch')
  }
  if (addedMileage != null && addedMileage <= 0) flags.push('interval_invalid')
  return flags
}

function roundTo(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const base = Math.pow(10, digits)
  return Math.round(num * base) / base
}

function parseNumber(value) {
  const num = parseFloat(value)
  return Number.isFinite(num) ? num : 0
}

function parseInteger(value) {
  const num = parseInt(value)
  return Number.isFinite(num) ? num : 0
}

function sameValue(a, b) {
  if (a == null && b == null) return true
  return a === b
}

function sameArray(a, b) {
  const left = Array.isArray(a) ? a : []
  const right = Array.isArray(b) ? b : []
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function needsManualDerivedRepair(records) {
  return (records || []).some(record =>
    record.importSource !== 'excel' && (
      !hasOwn(record, 'addedMileage') ||
      !hasOwn(record, 'fuelConsumption') ||
      !hasOwn(record, 'costPerKm') ||
      !Array.isArray(record.issueFlags) ||
      record.confirmedByUser == null
    )
  )
}

function sortByRecordAsc(a, b) {
  const dateDiff = String(a.refuelDate || '').localeCompare(String(b.refuelDate || ''))
  if (dateDiff !== 0) return dateDiff
  return Number(a.odometer || 0) - Number(b.odometer || 0)
}

function normalizeManualRecord(data, vehicleId) {
  const liters = parseNumber(data.liters)
  const unitPrice = parseNumber(data.unitPrice)
  const totalAmount = parseNumber(data.totalAmount)
  return {
    vehicleId,
    refuelDate: toYmd(data.refuelDate),
    fuelGrade: data.fuelGrade || '92#',
    liters,
    unitPrice: unitPrice || (liters > 0 && totalAmount > 0 ? roundTo(totalAmount / liters) : 0),
    totalAmount,
    odometer: parseInteger(data.odometer),
    tankFull: data.tankFull == null ? true : !!data.tankFull,
    importSource: 'manual',
  }
}

function buildManualDerived(record, prevOdometer) {
  const odometer = Number(record.odometer)
  const liters = Number(record.liters)
  const totalAmount = Number(record.totalAmount)
  const hasPrev = prevOdometer != null && Number.isFinite(Number(prevOdometer))
  const hasOdometer = Number.isFinite(odometer) && odometer > 0
  const addedMileage = hasPrev && hasOdometer ? odometer - Number(prevOdometer) : null
  const fuelConsumption = addedMileage > 0 && liters > 0
    ? roundTo((liters / addedMileage) * 100)
    : null
  const costPerKm = addedMileage > 0 && totalAmount > 0
    ? roundTo(totalAmount / addedMileage)
    : null
  const next = { ...record, addedMileage, fuelConsumption, costPerKm }
  return {
    addedMileage,
    fuelConsumption,
    costPerKm,
    issueFlags: validateRecord(next, hasPrev ? Number(prevOdometer) : null),
  }
}

async function recalcManualRecords(openid, vehicleId) {
  const res = await db.collection('fuel_records')
    .where({ _openid: openid, vehicleId, isDeleted: _.neq(1) })
    .orderBy('refuelDate', 'asc')
    .orderBy('odometer', 'asc')
    .limit(500)
    .get()
  const records = (res.data || []).sort(sortByRecordAsc)
  let prevOdometer = null
  const now = new Date()

  for (const record of records) {
    if (record.importSource !== 'excel') {
      const derived = buildManualDerived(record, prevOdometer)
      const patch = {}
      let changed = false

      ;['addedMileage', 'fuelConsumption', 'costPerKm'].forEach((key) => {
        if (!sameValue(record[key], derived[key])) {
          patch[key] = derived[key]
          changed = true
        }
      })

      if (!sameArray(record.issueFlags, derived.issueFlags)) {
        patch.issueFlags = derived.issueFlags
        patch.confirmedByUser = false
        changed = true
      }

      if (record.confirmedByUser == null) {
        patch.confirmedByUser = false
        changed = true
      }

      if (changed) {
        patch.modifyTime = now
        await db.collection('fuel_records').doc(record._id).update({ data: patch })
        Object.assign(record, patch)
      }
    }
    prevOdometer = record.odometer != null ? Number(record.odometer) : null
  }
}

// ─── vehicle ─────────────────────────────────────────────────────────────────

async function vehicleList(openid) {
  const res = await db.collection('vehicles')
    .where({ _openid: openid })
    .orderBy('createTime', 'asc')
    .get()
  return { list: res.data }
}

async function vehicleAdd(openid, data) {
  const now = new Date()
  const res = await db.collection('vehicles').add({
    data: { _openid: openid, ...data, createTime: now, modifyTime: now }
  })
  return { _id: res._id }
}

async function vehicleDelete(openid, id) {
  // 删除车辆及其所有记录
  await db.collection('fuel_records').where({ _openid: openid, vehicleId: id }).remove()
  await db.collection('vehicles').doc(id).remove()
  return { ok: true }
}

// ─── record ───────────────────────────────────────────────────────────────────

async function fetchRecordsDesc(openid, vehicleId) {
  const res = await db.collection('fuel_records')
    .where({ _openid: openid, vehicleId, isDeleted: _.neq(1) })
    .orderBy('refuelDate', 'desc')
    .orderBy('odometer', 'desc')
    .limit(500)
    .get()
  return res.data || []
}

async function recordList(openid, vehicleId) {
  let records = await fetchRecordsDesc(openid, vehicleId)
  if (needsManualDerivedRepair(records)) {
    await recalcManualRecords(openid, vehicleId)
    records = await fetchRecordsDesc(openid, vehicleId)
  }
  return { list: records }
}

async function recordGet(openid, id) {
  const res = await db.collection('fuel_records').doc(id).get()
  if (!res.data || res.data._openid !== openid || res.data.isDeleted === 1) {
    throw new Error('forbidden')
  }
  return res.data
}

async function recordAdd(openid, data) {
  const now = new Date()
  const record = normalizeManualRecord(data || {}, data && data.vehicleId)
  const res = await db.collection('fuel_records').add({
    data: {
      _openid: openid,
      ...record,
      addedMileage: null,
      fuelConsumption: null,
      costPerKm: null,
      issueFlags: [],
      confirmedByUser: false,
      isDeleted: 0,
      createTime: now,
      modifyTime: now
    }
  })
  await recalcManualRecords(openid, record.vehicleId)
  return { _id: res._id }
}

async function recordUpdate(openid, id, data) {
  const oldRecord = await recordGet(openid, id)
  const now = new Date()
  const record = normalizeManualRecord(data || {}, oldRecord.vehicleId)
  await db.collection('fuel_records').doc(id).update({
    data: { ...record, confirmedByUser: false, modifyTime: now }
  })
  await recalcManualRecords(openid, oldRecord.vehicleId)
  return { ok: true }
}

async function recordDelete(openid, id) {
  const record = await recordGet(openid, id)
  await db.collection('fuel_records').doc(id).update({
    data: { isDeleted: 1, modifyTime: new Date() }
  })
  await recalcManualRecords(openid, record.vehicleId)
  return { ok: true }
}

async function recordConfirmIssue(openid, id) {
  await recordGet(openid, id)
  await db.collection('fuel_records').doc(id).update({
    data: { confirmedByUser: true, modifyTime: new Date() }
  })
  return { ok: true }
}

async function recordLastOdometer(openid, vehicleId) {
  const res = await db.collection('fuel_records')
    .where({ _openid: openid, vehicleId, isDeleted: _.neq(1) })
    .orderBy('refuelDate', 'desc')
    .orderBy('odometer', 'desc')
    .limit(1)
    .get()
  if (!res.data.length) return { odometer: null, unitPrice: null }
  return {
    odometer: res.data[0].odometer,
    unitPrice: res.data[0].unitPrice != null ? res.data[0].unitPrice : null,
  }
}

async function recordStats(openid, vehicleId) {
  const res = await db.collection('fuel_records')
    .where({ _openid: openid, vehicleId, isDeleted: _.neq(1) })
    .orderBy('refuelDate', 'desc')
    .orderBy('odometer', 'desc')
    .limit(500)
    .get()
  const records = res.data
  if (!records.length) return {}

  const latestConsumption = records[0].fuelConsumption || null
  const totalLiters = records.reduce((s, r) => s + (r.liters || 0), 0)
  const totalAmount = records.reduce((s, r) => s + (r.totalAmount || 0), 0)
  const totalMileage = records.reduce((s, r) => s + (r.addedMileage || 0), 0)
  const avgConsumption = totalMileage > 0
    ? Math.round(totalLiters / totalMileage * 100 * 100) / 100
    : null

  // 日均里程：总增加里程 / 日历天数跨度
  let dailyMileage = null
  if (records.length >= 2) {
    const dates = records.map(r => r.refuelDate).filter(Boolean).sort()
    const msSpan = new Date(dates[dates.length - 1]) - new Date(dates[0])
    const daySpan = Math.max(1, Math.round(msSpan / 86400000))
    dailyMileage = Math.round(totalMileage / daySpan)
  }

  const issueCount = records.filter(r => r.issueFlags && r.issueFlags.length > 0 && !r.confirmedByUser).length

  return {
    latestConsumption,
    avgConsumption,
    dailyMileage,
    totalLiters: Math.round(totalLiters * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    issueCount,
  }
}

// ─── import ──────────────────────────────────────────────────────────────────

async function upsertImportedRecords(openid, vehicleId, importRows) {
  const results = { success: 0, updated: 0, failed: 0, issues: [] }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const validRows = (importRows || []).filter(r =>
    r.externalId && r.refuelDate && DATE_RE.test(String(r.refuelDate).slice(0, 10))
  )
  validRows.sort((a, b) => String(a.refuelDate).localeCompare(String(b.refuelDate)))

  // 预查询已存在记录，避免每行都查一次数据库导致超时
  const externalIds = Array.from(new Set(validRows.map(r => String(r.externalId))))
  const existingMap = new Map()
  for (let i = 0; i < externalIds.length; i += 100) {
    const chunk = externalIds.slice(i, i + 100)
    const existRes = await db.collection('fuel_records')
      .where({ _openid: openid, vehicleId, externalId: _.in(chunk) })
      .field({ _id: true, externalId: true })
      .get()
    existRes.data.forEach(item => existingMap.set(String(item.externalId), item._id))
  }

  let prevOdometer = null

  for (let i = 0; i < validRows.length; i++) {
    const r = validRows[i]
    const row = r.sourceRow || (i + 2)

    try {
      const refuelDate = toYmd(r.refuelDate)
      const liters = parseFloat(r.liters) || 0
      const unitPrice = parseFloat(r.unitPrice) || 0
      const totalAmount = parseFloat(r.totalAmount) || 0
      const odometer = parseInt(r.odometer) || 0
      const addedMileage = parseFloat(r.addedMileage) || 0
      const fuelConsumption = parseFloat(r.fuelConsumption) || 0
      const costPerKm = parseFloat(r.costPerKm) || 0
      const tankFull = r.tankFull == null ? inferTankFull(totalAmount) : !!r.tankFull

      const record = {
        vehicleId, refuelDate, fuelGrade: r.fuelGrade || '92#',
        liters, unitPrice, totalAmount, odometer, addedMileage,
        fuelConsumption, costPerKm, tankFull, importSource: 'excel',
        externalId: String(r.externalId),
      }
      const issueFlags = validateRecord(record, prevOdometer)
      record.issueFlags = issueFlags
      record.confirmedByUser = false

      if (issueFlags.length > 0) {
        results.issues.push({ row, reason: issueFlags.join(', ') })
      }

      prevOdometer = odometer

      // upsert by externalId
      const now = new Date()
      const existingId = existingMap.get(record.externalId)
      if (existingId) {
        await db.collection('fuel_records').doc(existingId).update({
          data: { ...record, modifyTime: now }
        })
        results.updated++
      } else {
        const addRes = await db.collection('fuel_records').add({
          data: { _openid: openid, ...record, isDeleted: 0, createTime: now, modifyTime: now }
        })
        existingMap.set(record.externalId, addRes._id)
        results.success++
      }
    } catch (e) {
      results.failed++
      results.issues.push({ row, reason: String(e.message || e) })
    }
  }

  return results
}

async function recordImport(openid, vehicleId, fileID) {
  const dlRes = await cloud.downloadFile({ fileID })
  const buffer = dlRes.fileContent
  const XLSX = require('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  const COL = {
    id: '记录 ID',
    date: '加油日期',
    grade: '油号',
    liters: '加油量 (L)',
    unitPrice: '支付单价 (元)',
    totalAmount: '支付总额 (元)',
    odometer: '行驶里程 (km)',
    addedMileage: '增加里程 (km)',
    fuelConsumption: '最新油耗 (L/100km)',
    costPerKm: '每公里油费 (元)',
  }
  const importRows = rows.map((r, i) => ({
    sourceRow: i + 2,
    externalId: r[COL.id] ? String(r[COL.id]).trim() : '',
    refuelDate: toYmd(r[COL.date]),
    fuelGrade: r[COL.grade] || '92#',
    liters: parseFloat(r[COL.liters]) || 0,
    unitPrice: parseFloat(r[COL.unitPrice]) || 0,
    totalAmount: parseFloat(r[COL.totalAmount]) || 0,
    odometer: parseInt(r[COL.odometer]) || 0,
    addedMileage: parseFloat(r[COL.addedMileage]) || 0,
    fuelConsumption: parseFloat(r[COL.fuelConsumption]) || 0,
    costPerKm: parseFloat(r[COL.costPerKm]) || 0,
  })).filter(r => r.externalId && r.refuelDate && r.refuelDate !== '统计汇总')
  const ret = await upsertImportedRecords(openid, vehicleId, importRows)
  await cloud.deleteFile({ fileList: [fileID] }).catch(() => {})
  return ret
}

async function recordImportRows(openid, vehicleId, rows) {
  return upsertImportedRecords(openid, vehicleId, rows || [])
}

async function recordClearAll(openid, vehicleId) {
  const res = await db.collection('fuel_records')
    .where({ _openid: openid, vehicleId })
    .remove()
  return { removed: res.stats && res.stats.removed || 0 }
}

// ─── 入口 ────────────────────────────────────────────────────────────────────

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { type } = event

  switch (type) {
    // vehicle
    case 'vehicle.list':   return vehicleList(OPENID)
    case 'vehicle.add':    return vehicleAdd(OPENID, event.data)
    case 'vehicle.delete': return vehicleDelete(OPENID, event.id)

    // record
    case 'record.list':          return recordList(OPENID, event.vehicleId)
    case 'record.get':           return recordGet(OPENID, event.id)
    case 'record.add':           return recordAdd(OPENID, event.data)
    case 'record.update':        return recordUpdate(OPENID, event.id, event.data)
    case 'record.delete':        return recordDelete(OPENID, event.id)
    case 'record.confirmIssue':  return recordConfirmIssue(OPENID, event.id)
    case 'record.lastOdometer':  return recordLastOdometer(OPENID, event.vehicleId)
    case 'record.stats':         return recordStats(OPENID, event.vehicleId)
    case 'record.import':        return recordImport(OPENID, event.vehicleId, event.fileID)
    case 'record.importRows':    return recordImportRows(OPENID, event.vehicleId, event.rows)
    case 'record.clearAll':      return recordClearAll(OPENID, event.vehicleId)

    default: return { error: 'unknown type: ' + type }
  }
}
