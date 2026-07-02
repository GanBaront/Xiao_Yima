const util = require('./util.js')

const STORAGE_KEYS = {
  PERIOD_HISTORY: 'period_history',
  USER_SETTINGS: 'user_settings'
}

const DEFAULT_SETTINGS = {
  cycleLength: 28,
  periodLength: 5
}

/**
 * 获取经期历史记录
 */
const getPeriodHistory = () => {
  return wx.getStorageSync(STORAGE_KEYS.PERIOD_HISTORY) || []
}

/**
 * 保存经期历史记录
 */
const savePeriodHistory = (data) => {
  wx.setStorageSync(STORAGE_KEYS.PERIOD_HISTORY, data)
}

/**
 * 获取用户设置
 */
const getSettings = () => {
  const saved = wx.getStorageSync(STORAGE_KEYS.USER_SETTINGS)
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS }
}

/**
 * 保存用户设置
 */
const saveSettings = (settings) => {
  wx.setStorageSync(STORAGE_KEYS.USER_SETTINGS, settings)
}

/**
 * 获取当前进行中的经期（endDate 为 null 的那条）
 */
const getActivePeriod = () => {
  const history = getPeriodHistory()
  // 排除 skipped 记录，取最近一条未结束的正常记录
  const active = history.filter(p => p.endDate === null && !p.skipped)
  return active.length > 0 ? active[active.length - 1] : null
}

/**
 * 检查日期是否与已有经期重叠
 * @param {string} startDate - yyyy-MM-dd
 * @param {string} endDate - yyyy-MM-dd (null 表示进行中)
 * @param {string} excludeId - 排除的记录 ID（更新时排除自身）
 */
const checkOverlap = (startDate, endDate, excludeId = null) => {
  const history = getPeriodHistory()
  const newStart = util.parseDate(startDate)
  const newEnd = endDate ? util.parseDate(endDate) : new Date() // 进行中的用今天

  for (let p of history) {
    if (p.skipped) continue // skipped 记录不参与重叠检测
    if (excludeId && String(p.id) === String(excludeId)) continue

    const pStart = util.parseDate(p.startDate)
    const pEnd = p.endDate ? util.parseDate(p.endDate) : new Date()

    // 检查重叠：两个区间有交集
    if (newStart <= pEnd && newEnd >= pStart) {
      return p // 返回重叠的记录
    }
  }
  return null
}

/**
 * 重新计算所有记录的 cycleLength
 * 规则：每条记录的 cycleLength = 本条 startDate - 上一条 startDate（第一条为 null）
 * 调用时机：任何数据变更后都应调用，保证周期数据始终准确
 */
const recalculateCycles = (history) => {
  const sorted = [...history].sort((a, b) => a.startDate.localeCompare(b.startDate))
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].skipped) {
      sorted[i].cycleLength = null
      continue
    }
    // 跳过 skipped 记录，找上一条有效记录计算周期
    let prev = null
    for (let j = i - 1; j >= 0; j--) {
      if (!sorted[j].skipped) { prev = sorted[j]; break }
    }
    sorted[i].cycleLength = prev ? util.diffDays(prev.startDate, sorted[i].startDate) : null
  }
  return sorted
}

/**
 * 新增一条经期记录
 * @param {object} period - { startDate, endDate, tags }
 */
const addPeriod = (period) => {
  const history = getPeriodHistory()

  // 检查是否已有进行中的经期（排除 skipped 记录）
  const activeList = history.filter(p => p.endDate === null && !p.skipped)
  const existing = activeList.length > 0 ? activeList[activeList.length - 1] : null

  if (existing && period.endDate) {
    // 结束进行中的记录：跳过重叠检查（结束日必然与 active period 重叠）
    existing.endDate = period.endDate
    existing.periodLength = util.diffDays(existing.startDate, period.endDate) + 1
    if (period.tags && Object.keys(period.tags).length > 0) {
      existing.tags = { ...existing.tags, ...period.tags }
    }
    // cycleLength 不受结束操作影响，无需重算
    savePeriodHistory(history)
    return { success: true, record: existing }
  }

  if (existing && !period.endDate) {
    // 已有进行中的经期
    const today = util.today()
    if (existing.startDate < today) {
      // 过往遗留的活跃记录（如导入数据所致），自动关闭后再新建
      existing.endDate = existing.startDate
      existing.periodLength = 1
    } else {
      return { success: false, message: '已有进行中的经期，请先结束' }
    }
  }

  // 新增记录：重叠检测
  const overlap = checkOverlap(period.startDate, period.endDate)
  if (overlap) {
    return { success: false, overlap: true, conflictPeriod: overlap, message: '该日期与已有经期重叠' }
  }

  // 计算 periodLength
  let periodLength = null
  if (period.endDate) {
    periodLength = util.diffDays(period.startDate, period.endDate) + 1
  }

  const record = {
    id: String(new Date(period.startDate).getTime()),
    startDate: period.startDate,
    endDate: period.endDate || null,
    cycleLength: null, // 由 recalculateCycles 统一计算
    periodLength: periodLength,
    tags: period.tags || {}
  }

  history.push(record)

  // 重算全部 cycleLength 后保存
  const recalculated = recalculateCycles(history)
  savePeriodHistory(recalculated)
  return { success: true, record: record }
}

/**
 * 更新经期记录
 */
const updatePeriod = (id, updates) => {
  const history = getPeriodHistory()
  const idx = history.findIndex(p => String(p.id) === String(id))
  if (idx === -1) return { success: false, message: '记录不存在' }

  // 重叠检测
  if (updates.startDate || updates.endDate) {
    const newStart = updates.startDate || history[idx].startDate
    const newEnd = updates.endDate !== undefined ? updates.endDate : history[idx].endDate
    const overlap = checkOverlap(newStart, newEnd, id)
    if (overlap) {
      return { success: false, overlap: true, conflictPeriod: overlap }
    }
  }

  // 如果修改了日期，重新计算 periodLength
  if (updates.startDate || updates.endDate) {
    const s = updates.startDate || history[idx].startDate
    const e = updates.endDate !== undefined ? updates.endDate : history[idx].endDate
    if (e) {
      updates.periodLength = util.diffDays(s, e) + 1
    }
  }

  history[idx] = { ...history[idx], ...updates }

  // 重算全部 cycleLength 后保存
  const recalculated = recalculateCycles(history)
  savePeriodHistory(recalculated)
  return { success: true, record: recalculated.find(p => String(p.id) === String(id)) }
}

/**
 * 删除一条经期记录
 * @param {string} id - 记录 ID
 */
const deletePeriod = (id) => {
  const history = getPeriodHistory()
  const idx = history.findIndex(p => String(p.id) === String(id))
  if (idx === -1) return { success: false, message: '记录不存在' }

  history.splice(idx, 1)

  // 重算全部 cycleLength 后保存
  const recalculated = recalculateCycles(history)
  savePeriodHistory(recalculated)
  return { success: true }
}

/**
 * 导出数据为 JSON 字符串
 */
const exportData = () => {
  const data = {
    version: '1.0.0',
    exportTime: util.formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss'),
    periodHistory: getPeriodHistory(),
    settings: getSettings()
  }
  return JSON.stringify(data, null, 2)
}

/**
 * 导入数据（合并模式：新记录追加，已有记录跳过）
 */
const importData = (jsonStr) => {
  try {
    const data = JSON.parse(jsonStr)

    // 格式校验
    if (!data.periodHistory || !Array.isArray(data.periodHistory)) {
      return { success: false, message: '数据格式不正确，缺少经期历史记录' }
    }

    const currentHistory = getPeriodHistory()
    const existingIds = new Set(currentHistory.map(p => p.id))
    let merged = [...currentHistory]

    for (let record of data.periodHistory) {
      if (!record.id || !record.startDate) continue
      if (!existingIds.has(String(record.id))) {
        merged.push(record)
        existingIds.add(String(record.id))
      }
    }

    // 排序 + 重算全部 cycleLength
    const recalculated = recalculateCycles(merged)
    savePeriodHistory(recalculated)

    // 合并设置
    if (data.settings) {
      const currentSettings = getSettings()
      saveSettings({ ...currentSettings, ...data.settings })
    }

    const newCount = merged.length - currentHistory.length
    return {
      success: true,
      totalRecords: merged.length,
      newRecords: newCount
    }
  } catch (e) {
    return { success: false, message: 'JSON 解析失败：' + e.message }
  }
}

module.exports = {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  getPeriodHistory,
  savePeriodHistory,
  getSettings,
  saveSettings,
  getActivePeriod,
  checkOverlap,
  recalculateCycles,
  addPeriod,
  updatePeriod,
  deletePeriod,
  exportData,
  importData
}
