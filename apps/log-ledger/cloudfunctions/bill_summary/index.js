const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function fenToYuan(fen) {
  return (fen / 100).toFixed(2)
}

/** 与 record_save / 小程序 date 一致：按记账日与当前「每月开始于」得到账期月 YYYY-MM */
function calcRecordMonth(recordDate, cycleStartDay) {
  const date = new Date(recordDate)
  const day = date.getDate()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  if (day >= cycleStartDay) {
    return `${year}-${String(month).padStart(2, '0')}`
  }
  const prev = new Date(year, month - 2, 1)
  const py = prev.getFullYear()
  const pm = prev.getMonth() + 1
  return `${py}-${String(pm).padStart(2, '0')}`
}

function currentRecordMonth(cycleStartDay) {
  return calcRecordMonth(new Date(), cycleStartDay)
}

function billingPeriodRange(recordMonthYm, cycleStartDay) {
  const parts = String(recordMonthYm).split('-').map(Number)
  const y = parts[0]
  const m = parts[1] || 1
  const pad = (n) => String(n).padStart(2, '0')
  const start = new Date(y, m - 1, cycleStartDay)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const nextStart = new Date(nextY, nextM - 1, cycleStartDay)
  const end = new Date(nextStart)
  end.setDate(end.getDate() - 1)
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  }
}

/**
 * 月账单：按当前设置的账期起始日，用 record_date 动态汇总（改起始日立即生效）
 * 年账单：同上按账期年汇总
 * event.mode: 'calendar_year_months' | 'calendar_years'
 * event.year: 选中年（仅 calendar_year_months）
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { mode, year } = event

  const settingRes = await db.collection('ledger_settings')
    .where({ _openid: OPENID })
    .limit(1)
    .get()
  const cycleStartDay = settingRes.data[0]?.cycle_start_day ?? 1

  if (mode === 'calendar_year_months') {
    const y = Number(year) || new Date().getFullYear()
    const rangeStart = `${y - 1}-12-01`
    const rangeEnd = `${y + 1}-01-31`
    const res = await db.collection('ledger_records')
      .where({
        _openid: OPENID,
        is_deleted: false,
        record_date: _.gte(rangeStart).and(_.lte(rangeEnd)),
      })
      .limit(5000)
      .get()

    const income = {}
    const expense = {}
    for (const r of res.data) {
      const key = calcRecordMonth(r.record_date, cycleStartDay)
      if (!key || String(key).length < 7) continue
      if (r.type === 'income') {
        income[key] = (income[key] || 0) + r.amount
      } else {
        expense[key] = (expense[key] || 0) + r.amount
      }
    }

    const currentYm = currentRecordMonth(cycleStartDay)
    const [curY, curM] = currentYm.split('-').map(Number)
    let maxMonth = 12
    if (y > curY) maxMonth = 0
    else if (y === curY) maxMonth = curM

    let yearIncome = 0
    let yearExpense = 0
    const months = []
    for (let m = 12; m >= 1; m--) {
      if (m > maxMonth) continue
      const mm = String(m).padStart(2, '0')
      const recordMonth = `${y}-${mm}`
      const inc = income[recordMonth] || 0
      const exp = expense[recordMonth] || 0
      const period = billingPeriodRange(recordMonth, cycleStartDay)
      yearIncome += inc
      yearExpense += exp
      months.push({
        month: m,
        label: `${m}月账期`,
        record_month: recordMonth,
        period_start: period.start,
        period_end: period.end,
        incomeDisplay: fenToYuan(inc),
        expenseDisplay: fenToYuan(exp),
        balanceDisplay: fenToYuan(inc - exp),
      })
    }

    const yearBalance = yearIncome - yearExpense
    return {
      success: true,
      year: y,
      yearIncomeDisplay: fenToYuan(yearIncome),
      yearExpenseDisplay: fenToYuan(yearExpense),
      yearBalanceDisplay: fenToYuan(yearBalance),
      months,
    }
  }

  if (mode === 'calendar_years') {
    const res = await db.collection('ledger_records')
      .where({ _openid: OPENID, is_deleted: false })
      .field({ record_date: true, amount: true, type: true })
      .limit(5000)
      .get()

    const yMap = {}
    for (const r of res.data) {
      const ym = calcRecordMonth(r.record_date, cycleStartDay)
      if (!ym || String(ym).length < 7) continue
      const yStr = String(ym).slice(0, 4)
      if (!/^\d{4}$/.test(yStr)) continue
      if (!yMap[yStr]) yMap[yStr] = { income: 0, expense: 0 }
      if (r.type === 'income') yMap[yStr].income += r.amount
      else yMap[yStr].expense += r.amount
    }

    const years = Object.keys(yMap)
      .sort((a, b) => b.localeCompare(a))
      .map((yStr) => {
        const inc = yMap[yStr].income
        const exp = yMap[yStr].expense
        const bal = inc - exp
        return {
          year: Number(yStr),
          label: `${yStr}年`,
          incomeDisplay: fenToYuan(inc),
          expenseDisplay: fenToYuan(exp),
          balanceDisplay: fenToYuan(bal),
        }
      })

    let totalIncome = 0
    let totalExpense = 0
    for (const r of res.data) {
      if (r.type === 'income') totalIncome += r.amount
      else totalExpense += r.amount
    }
    const totalBalance = totalIncome - totalExpense

    return {
      success: true,
      totalIncomeDisplay: fenToYuan(totalIncome),
      totalExpenseDisplay: fenToYuan(totalExpense),
      totalBalanceDisplay: fenToYuan(totalBalance),
      years,
    }
  }

  return { success: false, errMsg: 'unknown mode' }
}
