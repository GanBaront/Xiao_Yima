const storage = require('../../utils/storage.js')
const predict = require('../../utils/predict.js')
const util = require('../../utils/util.js')

Page({
  data: {
    // 当前显示的年份和月份
    currentYear: 2026,
    currentMonth: 7,

    // 日历网格数据
    weeks: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],

    // 标记数据
    markedDates: {}, // { 'yyyy-MM-dd': { type: 'period'|'predict', start: bool, end: bool } }

    // 弹窗
    showEditPopup: false,
    editDate: '',
    editDateStr: '',
    isInHistory: false,
    isInPredict: false,
    existingRecord: null,

    // 弹窗中的标签
    editPain: '',
    editFlow: '',
    editMoods: [],

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
    ]
  },

  onLoad() {
    const now = new Date()
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    })
    this.renderCalendar()
  },

  onShow() {
    this.renderCalendar()
  },

  /**
   * 上一个月
   */
  prevMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 1) {
      this.setData({ currentYear: currentYear - 1, currentMonth: 12 })
    } else {
      this.setData({ currentMonth: currentMonth - 1 })
    }
    this.renderCalendar()
  },

  /**
   * 下一个月
   */
  nextMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 12) {
      this.setData({ currentYear: currentYear + 1, currentMonth: 1 })
    } else {
      this.setData({ currentMonth: currentMonth + 1 })
    }
    this.renderCalendar()
  },

  /**
   * 渲染日历
   */
  renderCalendar() {
    const { currentYear, currentMonth } = this.data
    const monthDays = util.getMonthDays(currentYear, currentMonth)
    const firstDay = util.getMonthFirstDay(currentYear, currentMonth)
    const today = util.today()

    // 生成标记数据
    const markedDates = this.buildMarkedDates()

    // 构建日历网格
    const weeks = []
    let week = []

    // 填充当月第一天之前的空白
    for (let i = 0; i < firstDay; i++) {
      week.push({ day: '', empty: true })
    }

    // 填充当月每一天
    for (let day = 1; day <= monthDays; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const mark = markedDates[dateStr] || null
      const isToday = dateStr === today
      const isPast = dateStr < today

      week.push({
        day: day,
        dateStr: dateStr,
        isToday: isToday,
        isPast: isPast,
        mark: mark,
        empty: false
      })

      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }

    // 填充最后一周
    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ day: '', empty: true })
      }
      weeks.push(week)
    }

    this.setData({ weeks, markedDates })
  },

  /**
   * 构建标记数据
   */
  buildMarkedDates() {
    const history = storage.getPeriodHistory()
    const predictions = predict.predictFuture(6)
    const marked = {}

    // 标记历史姨妈期（skipped 记录不参与渲染）
    history.forEach(p => {
      if (p.skipped) return
      if (p.endDate) {
        const start = util.parseDate(p.startDate)
        const end = util.parseDate(p.endDate)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = util.formatDate(d)
          marked[ds] = {
            type: 'period',
            start: ds === p.startDate,
            end: ds === p.endDate,
            record: p
          }
        }
      } else {
        // 进行中的
        const start = util.parseDate(p.startDate)
        const today = new Date()
        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
          const ds = util.formatDate(d)
          marked[ds] = {
            type: 'period',
            start: ds === p.startDate,
            end: false,
            record: p
          }
        }
      }
    })

    // 标记预测期
    predictions.forEach(p => {
      const start = util.parseDate(p.startDate)
      const end = util.parseDate(p.endDate)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = util.formatDate(d)
        if (!marked[ds]) {
          marked[ds] = {
            type: 'predict',
            start: ds === p.startDate,
            end: ds === p.endDate
          }
        }
      }
    })

    return marked
  },

  /**
   * 点击日期
   */
  onDateTap(e) {
    const { dateStr, isPast, mark } = e.currentTarget.dataset
    if (!dateStr) return

    // 只能编辑过去的日期
    if (dateStr > util.today()) {
      // 未来预测日期，仅展示预测信息
      if (mark && mark.type === 'predict') {
        wx.showToast({ title: '预测姨妈期，暂无数据', icon: 'none' })
      }
      return
    }

    const history = storage.getPeriodHistory()
    let existingRecord = null
    if (mark && mark.type === 'period' && mark.record) {
      existingRecord = mark.record
    }

    // 初始化弹窗数据
    const editPain = existingRecord && existingRecord.tags && existingRecord.tags.pain
      ? existingRecord.tags.pain : ''
    const editFlow = existingRecord && existingRecord.tags && existingRecord.tags.flow
      ? existingRecord.tags.flow : ''
    const editMoods = existingRecord && existingRecord.tags && existingRecord.tags.mood
      ? existingRecord.tags.mood : []

    this.setData({
      showEditPopup: true,
      editDate: dateStr,
      editDateStr: dateStr,
      isInHistory: mark && mark.type === 'period',
      isInPredict: mark && mark.type === 'predict',
      existingRecord: existingRecord,
      editPain: editPain,
      editFlow: editFlow,
      editMoods: editMoods
    })
  },

  /**
   * 设为生理期第一天
   */
  onSetAsFirstDay() {
    const { editDate, existingRecord } = this.data

    if (existingRecord) {
      // 更新已有记录的开始日期
      const result = storage.updatePeriod(existingRecord.id, { startDate: editDate })
      if (!result.success) {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
        return
      }
    } else {
      // 新建记录
      const result = storage.addPeriod({
        startDate: editDate,
        endDate: null,
        tags: {}
      })
      if (!result.success) {
        if (result.overlap) {
          wx.showToast({ title: '该日期与已有姨妈期重叠', icon: 'none' })
        } else {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' })
        }
        return
      }
    }

    wx.showToast({ title: '已设为姨妈期第一天', icon: 'none' })
    this.closeEditPopup()
    this.renderCalendar()
  },

  /**
   * 设为生理期结束日
   */
  onSetAsEndDay() {
    const { editDate, existingRecord } = this.data

    if (!existingRecord) {
      wx.showToast({ title: '请先设置开始日期', icon: 'none' })
      return
    }

    if (editDate < existingRecord.startDate) {
      wx.showToast({ title: '结束日不能早于开始日', icon: 'none' })
      return
    }

    const result = storage.updatePeriod(existingRecord.id, { endDate: editDate })
    if (!result.success) {
      wx.showToast({ title: result.message || '操作失败', icon: 'none' })
      return
    }

    wx.showToast({ title: '已设为姨妈期结束日', icon: 'none' })
    this.closeEditPopup()
    this.renderCalendar()
  },

  /**
   * 保存标签修改
   */
  onSaveTags() {
    const { existingRecord, editPain, editFlow, editMoods } = this.data

    if (!existingRecord) {
      wx.showToast({ title: '请先设置姨妈期日期', icon: 'none' })
      return
    }

    const tags = {}
    if (editPain) tags.pain = editPain
    if (editFlow) tags.flow = editFlow
    if (editMoods.length > 0) tags.mood = editMoods

    const result = storage.updatePeriod(existingRecord.id, { tags: tags })
    if (!result.success) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      return
    }

    wx.showToast({ title: '标签已更新', icon: 'none' })
    this.closeEditPopup()
    this.renderCalendar()
  },

  /**
   * 标签选择
   */
  onEditTagSelect(e) {
    const { group, key } = e.currentTarget.dataset
    if (group === 'editPain') {
      this.setData({ editPain: this.data.editPain === key ? '' : key })
    } else if (group === 'editFlow') {
      this.setData({ editFlow: this.data.editFlow === key ? '' : key })
    } else if (group === 'editMoods') {
      let moods = [...this.data.editMoods]
      const idx = moods.indexOf(key)
      if (idx > -1) {
        moods.splice(idx, 1)
      } else {
        moods.push(key)
      }
      this.setData({ editMoods: moods })
    }
  },

  /**
   * 关闭弹窗
   */
  closeEditPopup() {
    this.setData({ showEditPopup: false })
  },

  preventBubble() {}
})
