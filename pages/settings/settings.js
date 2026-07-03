const storage = require('../../utils/storage.js')
const predict = require('../../utils/predict.js')
const util = require('../../utils/util.js')

Page({
  data: {
    cycleLength: 28,
    periodLength: 5,

    // 统计
    totalRecords: 0,
    avgCycle: '--',
    avgPeriod: '--',

    // 导入方式选择
    showImportMethod: false,

    // 手动导入 - 日历
    showManualImport: false,
    manualYear: 2026,
    manualMonth: 7,
    manualWeeks: [],
    manualWeekDays: ['日', '一', '二', '三', '四', '五', '六'],
    manualStart: '',   // yyyy-MM-dd
    manualEnd: '',     // yyyy-MM-dd

    // 手动导入 - 标签
    manualPain: '',
    manualFlow: '',
    manualMood: '',

    painLevels: [
      { key: 'light', label: '轻度' },
      { key: 'medium', label: '中度' },
      { key: 'heavy', label: '重度' }
    ],
    flowLevels: [
      { key: 'low', label: '少' },
      { key: 'medium', label: '中' },
      { key: 'high', label: '多' }
    ],
    moodOptions: [
      { key: 'happy', label: '😊 开心' },
      { key: 'calm', label: '😐 平静' },
      { key: 'irritable', label: '😤 烦躁' },
      { key: 'sad', label: '😢 郁闷' }
    ],

    // 手动导入 - 待添加列表
    manualPending: [],

    // 导入结果
    showImportResult: false,
    importResult: {},

    // 历史记录查看
    showHistory: false,
    historyRecords: [],
    historySearchDate: ''
  },

  onLoad() {
    this.loadSettings()
  },

  onShow() {
    this.loadSettings()
    this.loadStats()
  },

  loadSettings() {
    const settings = storage.getSettings()
    const history = storage.getPeriodHistory()

    // 收集 ≥ 4 次记录时，用加权平均值自动校准生理参数（排除 skipped）
    const validHistory = history.filter(p => !p.skipped)
    const historyWithCycle = validHistory.filter(p => p.cycleLength !== null)
    if (validHistory.length >= 4 && historyWithCycle.length >= 3) {
      const stats = predict.getCycleStats(history)
      if (stats && stats.avgCycle) {
        settings.cycleLength = stats.avgCycle
        storage.saveSettings(settings)
      }
    }

    this.setData({
      cycleLength: settings.cycleLength,
      periodLength: settings.periodLength
    })
  },

  loadStats() {
    const history = storage.getPeriodHistory()
    const validHistory = history.filter(p => !p.skipped)
    const stats = predict.getCycleStats(history)

    this.setData({
      totalRecords: validHistory.length,
      avgCycle: stats ? stats.avgCycle : '--',
      avgPeriod: stats && stats.avgPeriod ? stats.avgPeriod : '--'
    })
  },

  // ========== 参数设置 ==========

  onCycleChange(e) {
    this.setData({ cycleLength: e.detail.value })
    this.saveCurrentSettings()
  },

  onPeriodChange(e) {
    this.setData({ periodLength: e.detail.value })
    this.saveCurrentSettings()
  },

  saveCurrentSettings() {
    storage.saveSettings({
      cycleLength: this.data.cycleLength,
      periodLength: this.data.periodLength
    })
  },

  // ========== 导出数据 ==========

  onExportData() {
    const jsonStr = storage.exportData()
    const fs = wx.getFileSystemManager()
    const tmpPath = `${wx.env.USER_DATA_PATH}/menstruation_data.json`

    try {
      fs.writeFileSync(tmpPath, jsonStr, 'utf8')
      wx.shareFileMessage({
        filePath: tmpPath,
        fileName: 'menstruation_data.json',
        success: () => {
          wx.showToast({ title: '请选择发送对象', icon: 'none' })
        },
        fail: () => {
          this.copyToClipboard(jsonStr)
        }
      })
    } catch (e) {
      this.copyToClipboard(jsonStr)
    }
  },

  copyToClipboard(jsonStr) {
    wx.setClipboardData({
      data: jsonStr,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板，请粘贴保存', icon: 'none', duration: 2500 })
      }
    })
  },

  // ========== 导入数据 - 入口 ==========

  onImportData() {
    this.setData({ showImportMethod: true })
  },

  closeImportMethod() {
    this.setData({ showImportMethod: false })
  },

  // ========== 文件导入 ==========

  onFileImport() {
    this.setData({ showImportMethod: false })

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        if (res.tempFiles[0].size > 1024 * 1024) {
          wx.showToast({ title: '文件过大，请检查文件', icon: 'none' })
          return
        }
        try {
          const fs = wx.getFileSystemManager()
          const content = fs.readFileSync(res.tempFiles[0].path, 'utf8')
          const result = storage.importData(content)

          this.setData({ showImportResult: true, importResult: result })

          if (result.success) {
            this.loadSettings()
            this.loadStats()
          }
        } catch (e) {
          wx.showToast({ title: '文件读取失败', icon: 'none' })
        }
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择文件失败', icon: 'none' })
        }
      }
    })
  },

  // ========== 手动导入 ==========

  onManualImport() {
    this.setData({ showImportMethod: false })

    const now = new Date()
    this.setData({
      showManualImport: true,
      manualYear: now.getFullYear(),
      manualMonth: now.getMonth() + 1,
      manualStart: '',
      manualEnd: '',
      manualPain: '',
      manualFlow: '',
      manualMood: '',
      manualPending: []
    })
    this.renderManualCalendar()
  },

  closeManualImport() {
    this.setData({ showManualImport: false })
  },

  // 日历渲染
  renderManualCalendar() {
    const { manualYear, manualMonth, manualStart, manualEnd } = this.data
    const monthDays = util.getMonthDays(manualYear, manualMonth)
    const firstDay = util.getMonthFirstDay(manualYear, manualMonth)

    // 确定高亮区间
    let highlightStart = null
    let highlightEnd = null
    if (manualStart) {
      highlightStart = manualStart
      highlightEnd = manualEnd || manualStart
    }

    const weeks = []
    let week = []

    for (let i = 0; i < firstDay; i++) {
      week.push({ day: '', empty: true })
    }

    const today = util.today()

    for (let day = 1; day <= monthDays; day++) {
      const dateStr = `${manualYear}-${String(manualMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isFuture = dateStr > today
      const inRange = highlightStart && dateStr >= highlightStart && dateStr <= highlightEnd
      const isStart = dateStr === manualStart
      const isEnd = dateStr === manualEnd

      week.push({
        day: day,
        dateStr: dateStr,
        empty: false,
        isFuture: isFuture,
        inRange: inRange,
        isStart: isStart,
        isEnd: isEnd
      })

      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ day: '', empty: true })
      }
      weeks.push(week)
    }

    this.setData({ manualWeeks: weeks })
  },

  prevManualMonth() {
    let { manualYear, manualMonth } = this.data
    if (manualMonth === 1) {
      this.setData({ manualYear: manualYear - 1, manualMonth: 12 })
    } else {
      this.setData({ manualMonth: manualMonth - 1 })
    }
    this.renderManualCalendar()
  },

  nextManualMonth() {
    let { manualYear, manualMonth } = this.data
    if (manualMonth === 12) {
      this.setData({ manualYear: manualYear + 1, manualMonth: 1 })
    } else {
      this.setData({ manualMonth: manualMonth + 1 })
    }
    this.renderManualCalendar()
  },

  // 点击年份快速跳转
  onManualYearChange(e) {
    const year = parseInt(e.detail.value)  // picker fields="year" 返回 "2026"
    this.setData({ manualYear: year })
    this.renderManualCalendar()
  },

  // 点击日期选择起止
  onManualDateTap(e) {
    const { dateStr, isFuture } = e.currentTarget.dataset
    if (!dateStr || isFuture) return

    const { manualStart, manualEnd } = this.data

    if (!manualStart || (manualStart && manualEnd)) {
      // 全新选择：设为首日
      this.setData({ manualStart: dateStr, manualEnd: '' })
    } else if (manualStart && !manualEnd) {
      // 已有首日：设为末日（允许同一天 = 1天姨妈期）
      if (dateStr < manualStart) {
        // 选中的更早：交换
        this.setData({ manualStart: dateStr, manualEnd: manualStart })
      } else {
        this.setData({ manualEnd: dateStr })
      }
    }
    this.renderManualCalendar()
  },

  // 标签选择
  onManualTagSelect(e) {
    const { group, key } = e.currentTarget.dataset
    if (group === 'manualPain') {
      this.setData({ manualPain: this.data.manualPain === key ? '' : key })
    } else if (group === 'manualFlow') {
      this.setData({ manualFlow: this.data.manualFlow === key ? '' : key })
    } else if (group === 'manualMood') {
      this.setData({ manualMood: this.data.manualMood === key ? '' : key })
    }
  },

  // 添加到待导入列表
  onAddManualRecord() {
    const { manualStart, manualEnd } = this.data
    if (!manualStart) {
      wx.showToast({ title: '请先选择开始日期', icon: 'none' })
      return
    }
    const end = manualEnd || manualStart

    const tags = {}
    if (this.data.manualPain) tags.pain = this.data.manualPain
    if (this.data.manualFlow) tags.flow = this.data.manualFlow
    if (this.data.manualMood) tags.mood = this.data.manualMood

    // 重叠检测（与已有记录 + 待添加记录）
    const existing = storage.getPeriodHistory()
    const pending = this.data.manualPending
    const allRecords = [...existing, ...pending]
    const newStart = util.parseDate(manualStart)
    const newEnd = util.parseDate(end)

    for (let r of allRecords) {
      const rStart = util.parseDate(r.startDate)
      const rEnd = r.endDate ? util.parseDate(r.endDate) : new Date()
      if (newStart <= rEnd && newEnd >= rStart) {
        wx.showToast({ title: `${manualStart} ~ ${end} 与已有记录重叠`, icon: 'none' })
        return
      }
    }

    const record = {
      id: String(new Date(manualStart).getTime()),
      startDate: manualStart,
      endDate: end,
      tags: tags
    }

    const newPending = [...pending, record].sort((a, b) => a.startDate.localeCompare(b.startDate))

    this.setData({
      manualPending: newPending,
      manualStart: '',
      manualEnd: '',
      manualPain: '',
      manualFlow: '',
      manualMood: ''
    })
    this.renderManualCalendar()
    wx.showToast({ title: '已添加', icon: 'success', duration: 1000 })
  },

  // 当月没来
  onSkipMonth() {
    const { manualYear, manualMonth } = this.data
    const monthStr = `${manualYear}-${String(manualMonth).padStart(2, '0')}`

    // 检查当月是否已有姨妈期记录
    const existing = storage.getPeriodHistory()
    if (existing.some(p => p.startDate.startsWith(monthStr))) {
      wx.showToast({ title: '该月已有姨妈期记录', icon: 'none' })
      return
    }

    // 检查待导入列表
    if (this.data.manualPending.some(p => p.startDate.startsWith(monthStr))) {
      wx.showToast({ title: '该月已添加记录', icon: 'none' })
      return
    }

    const record = {
      id: 'skip-' + monthStr,
      startDate: monthStr + '-01',
      endDate: null,
      skipped: true,
      periodLength: null,
      tags: {},
      displayMonth: `${manualYear}年${manualMonth}月`
    }

    const newPending = [...this.data.manualPending, record].sort((a, b) => a.startDate.localeCompare(b.startDate))
    this.setData({ manualPending: newPending })
    wx.showToast({ title: `${manualYear}年${manualMonth}月 已标记为没来`, icon: 'success', duration: 1200 })
  },

  // 删除待导入列表中的某条
  onRemoveManualRecord(e) {
    const { id } = e.currentTarget.dataset
    const pending = this.data.manualPending.filter(p => p.id !== id)
    this.setData({ manualPending: pending })
  },

  // 确认手动导入
  onConfirmManualImport() {
    const pending = this.data.manualPending
    if (pending.length === 0) {
      wx.showToast({ title: '请先添加至少一条记录', icon: 'none' })
      return
    }

    const history = storage.getPeriodHistory()
    let merged = [...history]
    let newCount = 0

    for (let record of pending) {
      const exists = history.find(p => String(p.id) === String(record.id))
      if (!exists) {
        record.cycleLength = null
        record.periodLength = record.skipped ? null : (util.diffDays(record.startDate, record.endDate) + 1)
        merged.push(record)
        newCount++
      }
    }

    // 调用 storage 层重算 cycleLength 后保存
    const recalculated = storage.recalculateCycles(merged)
    storage.savePeriodHistory(recalculated)

    this.setData({
      showManualImport: false,
      showImportResult: true,
      importResult: {
        success: true,
        totalRecords: merged.length,
        newRecords: newCount
      }
    })
    this.loadStats()
  },

  // ========== 导入结果弹窗 ==========

  closeImportResult() {
    this.setData({ showImportResult: false })
  },

  // ========== 清空数据 ==========

  onClearData() {
    wx.showModal({
      title: '确认清空',
      content: '将删除所有姨妈期记录和设置，此操作不可恢复。建议先导出数据备份。',
      confirmText: '确认清空',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('period_history')
          wx.removeStorageSync('user_settings')
          wx.setStorageSync('user_settings', { cycleLength: 28, periodLength: 5 })
          this.loadSettings()
          this.loadStats()
          wx.showToast({ title: '数据已清空', icon: 'none', duration: 1500 })
          // 切回首页刷新状态
          setTimeout(() => { wx.switchTab({ url: '/pages/index/index' }) }, 800)
        }
      }
    })
  },

  // ========== 查看历史记录 ==========

  onViewHistory() {
    const history = storage.getPeriodHistory()
    const TAG_LABELS = {
      pain: { light: '轻度痛经', medium: '中度痛经', heavy: '重度痛经' },
      flow: { low: '量少', medium: '量中', high: '量多' },
      mood: { happy: '😊 开心', calm: '😐 平静', irritable: '😤 烦躁', sad: '😢 郁闷' }
    }

    const formatRecord = (p) => {
      if (p.skipped) {
        const parts = p.startDate.split('-')
        const monthLabel = `${parseInt(parts[0])}年${parseInt(parts[1])}月`
        return {
          id: p.id,
          startDate: monthLabel,
          endDate: '没来',
          duration: '—',
          cycle: '—',
          tags: [],
          isActive: false,
          skipped: true,
          searchMonth: `${parts[0]}-${parts[1]}`  // 用于按月份搜索
        }
      }
      const tags = []
      if (p.tags) {
        if (p.tags.pain) tags.push(TAG_LABELS.pain[p.tags.pain] || p.tags.pain)
        if (p.tags.flow) tags.push(TAG_LABELS.flow[p.tags.flow] || p.tags.flow)
        if (p.tags.mood) {
          const moods = Array.isArray(p.tags.mood) ? p.tags.mood : [p.tags.mood]
          moods.forEach(m => tags.push(TAG_LABELS.mood[m] || m))
        }
      }
      return {
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate || '进行中',
        duration: (p.periodLength && p.periodLength > 1) ? `${p.periodLength} 天` : '—',
        cycle: p.cycleLength ? `${p.cycleLength} 天` : '—',
        tags: tags,
        isActive: !p.endDate
      }
    }

    const records = history.slice().reverse().map(formatRecord)

    this.setData({
      showHistory: true,
      historySearchDate: '',
      historyRecords: records,
      _allHistory: records
    })
  },

  // 月份搜索（picker fields=month 返回 yyyy-MM）
  onHistorySearchDateChange(e) {
    const month = e.detail.value  // e.g. "2026-07"
    const allRecords = this.data._allHistory
    if (!month) {
      this.setData({ historySearchDate: month, historyRecords: allRecords })
      return
    }
    // 筛选：记录开始日期以该月份开头（skipped 记录用 searchMonth 匹配）
    const filtered = allRecords.filter(r => {
      if (r.searchMonth) return r.searchMonth === month
      return r.startDate.startsWith(month)
    })
    this.setData({ historySearchDate: month, historyRecords: filtered })
  },

  // 清除搜索
  onClearHistorySearch() {
    this.setData({
      historySearchDate: '',
      historyRecords: this.data._allHistory
    })
  },

  // 删除历史记录
  onDeleteHistoryRecord(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '将永久删除该条姨妈期记录，不可恢复。',
      confirmText: '删除',
      confirmColor: '#FF5252',
      success: (res) => {
        if (!res.confirm) return

        const result = storage.deletePeriod(id)
        if (!result.success) {
          wx.showToast({ title: result.message || '删除失败', icon: 'none' })
          return
        }

        // 从当前列表移除
        const allRecords = this.data._allHistory.filter(r => r.id !== id)
        const visibleRecords = this.data.historyRecords.filter(r => r.id !== id)
        this.setData({
          _allHistory: allRecords,
          historyRecords: visibleRecords
        })
        this.loadStats()
        wx.showToast({ title: '已删除', icon: 'success', duration: 1200 })
      }
    })
  },

  closeHistory() {
    this.setData({ showHistory: false })
  },

  preventBubble() {}
})
