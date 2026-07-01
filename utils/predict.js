const storage = require('./storage.js')
const util = require('./util.js')

/**
 * 计算加权平均周期和行经天数
 * 越近的数据权重越高
 */
const getCycleStats = (history) => {
  if (history.length < 2) return null

  // 需要有 cycleLength 的有效记录
  const validRecords = history.filter(p => p.cycleLength !== null)
  if (validRecords.length === 0) return null

  // 加权平均：越近权重越高 (index / sum of indices)
  const totalWeight = validRecords.reduce((sum, _, i) => sum + (i + 1), 0)
  const weightedCycle = validRecords.reduce((sum, p, i) => {
    return sum + p.cycleLength * (i + 1)
  }, 0) / totalWeight

  // 加权平均 periodLength
  const recordsWithLength = history.filter(p => p.periodLength !== null)
  let weightedPeriod = null
  if (recordsWithLength.length > 0) {
    const periodWeight = recordsWithLength.reduce((sum, _, i) => sum + (i + 1), 0)
    weightedPeriod = recordsWithLength.reduce((sum, p, i) => {
      return sum + p.periodLength * (i + 1)
    }, 0) / periodWeight
  }

  return {
    avgCycle: Math.round(weightedCycle),
    avgPeriod: weightedPeriod ? Math.round(weightedPeriod) : null
  }
}

/**
 * 预测下一次经期
 * @returns {{ startDate: string, endDate: string, daysUntil: number, isInPeriod: boolean, periodDay: number }}
 */
const predictNext = () => {
  const history = storage.getPeriodHistory()
  const settings = storage.getSettings()
  const today = util.today()

  // 检查是否处于进行中的经期
  const active = storage.getActivePeriod()
  if (active) {
    const periodDay = util.diffDays(active.startDate, today) + 1
    return {
      isInPeriod: true,
      periodDay: periodDay,
      startDate: active.startDate,
      endDate: null,
      daysUntil: 0
    }
  }

  // 没有历史记录，使用默认设置预测
  if (history.length === 0) {
    // 从今天开始预测（用户尚未记录过任何经期，无法预测）
    return {
      isInPeriod: false,
      startDate: null,
      endDate: null,
      daysUntil: null,
      needFirstRecord: true
    }
  }

  // 取最后一次经期的开始日期
  const lastPeriod = history[history.length - 1]

  // 判断使用默认值还是加权平均值
  const historyWithCycle = history.filter(p => p.cycleLength !== null)
  let cycleLength, periodLength

  // 冷启动 vs 数据成熟：PRD 要求历史 ≥ 3 次启用加权平均
  // 首条记录无 cycleLength，所以至少需要 2 个有效 cycleLength（即 ≥ 3 条记录）
  const dataMature = history.length >= 3 && historyWithCycle.length >= 2

  if (dataMature) {
    // 数据成熟：加权平均
    const stats = getCycleStats(history)
    cycleLength = stats.avgCycle
    periodLength = stats.avgPeriod || settings.periodLength
  } else {
    // 冷启动：使用默认设置
    cycleLength = settings.cycleLength
    periodLength = settings.periodLength
  }

  // 预测下次开始日期 = 最后一次开始日期 + 周期天数
  const lastStartDate = util.parseDate(lastPeriod.startDate)
  const predictedStart = util.addDays(lastStartDate, cycleLength)
  const predictedEnd = util.addDays(predictedStart, periodLength - 1)

  const predictedStartStr = util.formatDate(predictedStart)
  const predictedEndStr = util.formatDate(predictedEnd)

  // 计算距离预测日期的天数
  const daysUntil = util.diffDays(today, predictedStartStr)

  // 如果预测开始日期已过，且不在经期中，说明可能已延迟
  if (predictedStartStr < today) {
    return {
      isInPeriod: false,
      startDate: predictedStartStr,
      endDate: predictedEndStr,
      daysUntil: -daysUntil, // 已超过的天数
      isOverdue: true
    }
  }

  return {
    isInPeriod: false,
    startDate: predictedStartStr,
    endDate: predictedEndStr,
    daysUntil: daysUntil,
    isOverdue: false
  }
}

/**
 * 生成未来 N 个周期的预测日期列表
 */
const predictFuture = (count = 6) => {
  const history = storage.getPeriodHistory()
  const settings = storage.getSettings()

  if (history.length === 0) return []

  const historyWithCycle = history.filter(p => p.cycleLength !== null)
  let cycleLength, periodLength

  const dataMature = history.length >= 3 && historyWithCycle.length >= 2

  if (dataMature) {
    const stats = getCycleStats(history)
    cycleLength = stats.avgCycle
    periodLength = stats.avgPeriod || settings.periodLength
  } else {
    cycleLength = settings.cycleLength
    periodLength = settings.periodLength
  }

  const lastPeriod = history[history.length - 1]
  let lastStart = util.parseDate(lastPeriod.startDate)
  const today = util.today()
  const result = []

  for (let i = 0; i < count; i++) {
    lastStart = util.addDays(lastStart, cycleLength)
    const startStr = util.formatDate(lastStart)
    const endStr = util.formatDate(util.addDays(lastStart, periodLength - 1))

    // 只返回未来的预测
    if (endStr >= today) {
      result.push({ startDate: startStr, endDate: endStr })
    }
  }

  return result
}

module.exports = {
  getCycleStats,
  predictNext,
  predictFuture
}
