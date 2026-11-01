const VEHICLE_KEY = 'fuel_cache_vehicles_v1'
const RECORD_KEY = 'fuel_cache_records_v1'
const MAX_VEHICLES = 2

let vehicleRevision = 0
let vehicleSerial = 0
let recordRevision = 0
const recordSerial = {}

function readStorage(key) {
  try {
    const data = wx.getStorageSync(key)
    if (!data || typeof data !== 'object' || data.v !== 1) return null
    return data
  } catch (e) {
    console.error('read cache error', key, e)
    return null
  }
}

function writeStorage(key, data) {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('write cache error', key, e)
    return false
  }
}

function readVehicles() {
  const data = readStorage(VEHICLE_KEY)
  return data && Array.isArray(data.list) ? data.list : null
}

function writeVehicles(list, revision) {
  if (revision !== vehicleRevision) return false
  return writeStorage(VEHICLE_KEY, { v: 1, list })
}

function invalidateVehicles() {
  vehicleRevision += 1
  try { wx.removeStorageSync(VEHICLE_KEY) } catch (e) { console.error('clear vehicle cache', e) }
  try {
    const app = getApp()
    if (app) app._vehiclePromise = null
  } catch (e) {}
}

function refreshVehicles() {
  const { callFn } = require('./db')
  const serial = ++vehicleSerial
  const revision = vehicleRevision
  return callFn('vehicle.list').then(res => {
    const list = res && res.list
    if (!Array.isArray(list)) throw new Error('vehicle_list_failed')
    if (serial !== vehicleSerial || revision !== vehicleRevision) return { list: null, fresh: false }
    writeVehicles(list, revision)
    return { list, fresh: true }
  })
}

function readRecordStore() {
  const data = readStorage(RECORD_KEY)
  if (!data || typeof data.vehicles !== 'object' || data.vehicles === null) {
    return { vehicles: {}, order: [] }
  }
  return {
    vehicles: data.vehicles,
    order: Array.isArray(data.order) ? data.order : [],
  }
}

function readRecords(vehicleId) {
  if (!vehicleId) return null
  const item = readRecordStore().vehicles[vehicleId]
  return item && Array.isArray(item.list) ? item.list : null
}

function writeRecords(vehicleId, list, revision) {
  if (revision !== recordRevision || !vehicleId) return false
  const store = readRecordStore()
  store.vehicles[vehicleId] = { list }
  store.order = [vehicleId].concat(store.order.filter(id => id !== vehicleId)).slice(0, MAX_VEHICLES)
  Object.keys(store.vehicles).forEach(id => {
    if (store.order.indexOf(id) < 0) delete store.vehicles[id]
  })
  if (revision !== recordRevision) return false
  return writeStorage(RECORD_KEY, { v: 1, vehicles: store.vehicles, order: store.order })
}

function invalidateRecords(vehicleId) {
  recordRevision += 1
  const store = readRecordStore()
  if (vehicleId) {
    delete store.vehicles[vehicleId]
    store.order = store.order.filter(id => id !== vehicleId)
  } else {
    store.vehicles = {}
    store.order = []
  }
  writeStorage(RECORD_KEY, { v: 1, vehicles: store.vehicles, order: store.order })
}

function refreshRecords(vehicleId) {
  const { callFn } = require('./db')
  const serial = (recordSerial[vehicleId] || 0) + 1
  recordSerial[vehicleId] = serial
  const revision = recordRevision
  return callFn('record.list', { vehicleId }).then(res => {
    const list = res && res.list
    if (!Array.isArray(list)) throw new Error('record_list_failed')
    if (recordSerial[vehicleId] !== serial || revision !== recordRevision) return { list: null, fresh: false }
    writeRecords(vehicleId, list, revision)
    return { list, fresh: true }
  })
}

module.exports = {
  readVehicles,
  refreshVehicles,
  invalidateVehicles,
  readRecords,
  refreshRecords,
  invalidateRecords,
}
