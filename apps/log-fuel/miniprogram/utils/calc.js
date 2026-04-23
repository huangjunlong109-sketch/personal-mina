/**
 * 满枪推断：支付总额为整数 → 未跳枪；有小数 → 已跳枪
 */
function inferTankFull(totalAmount) {
  if (totalAmount == null) return true
  return !Number.isInteger(Number(totalAmount))
}

/**
 * 百公里油耗
 */
function calcConsumption(liters, addedMileage) {
  if (!liters || !addedMileage || addedMileage <= 0) return null
  return Math.round((liters / addedMileage) * 100 * 100) / 100
}

/**
 * 每公里油费
 */
function calcCostPerKm(totalAmount, addedMileage) {
  if (!totalAmount || !addedMileage || addedMileage <= 0) return null
  return Math.round((totalAmount / addedMileage) * 100) / 100
}

/**
 * 校验记录，返回 issueFlags 数组
 * 以传入值为准，仅做标记，不改写字段
 */
function validateRecord(record, prevOdometer) {
  const flags = []
  const { liters, unitPrice, totalAmount, odometer, addedMileage, fuelConsumption } = record

  if (!record.refuelDate || !liters || !totalAmount || !odometer) {
    flags.push('missing_field')
  }

  if (liters && unitPrice && totalAmount) {
    const expected = Math.round(liters * unitPrice * 100) / 100
    if (Math.abs(totalAmount - expected) > 0.06) {
      flags.push('amount_mismatch')
    }
  }

  if (prevOdometer != null && addedMileage != null && odometer != null) {
    const calcAdded = odometer - prevOdometer
    if (Math.abs(calcAdded - addedMileage) > 1) {
      flags.push('mileage_mismatch')
    }
  }

  if (fuelConsumption != null && addedMileage != null && addedMileage > 0 && liters) {
    const calcConsump = calcConsumption(liters, addedMileage)
    if (calcConsump && Math.abs(fuelConsumption - calcConsump) > 0.1) {
      flags.push('consumption_mismatch')
    }
  }

  if (addedMileage != null && addedMileage <= 0) {
    flags.push('interval_invalid')
  }

  return flags
}

module.exports = { inferTankFull, calcConsumption, calcCostPerKm, validateRecord }
