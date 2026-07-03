const storage = require('../../utils/storage.js')
const predict = require('../../utils/predict.js')
const util = require('../../utils/util.js')

Page({
  data: {
    // 状态
    isInPeriod: false,
    periodDay: 0,
    daysUntil: 0,
    isOverdue: false,
    nextStartDate: '',
    needFirstRecord: true,

    // 弹窗
    showTagsPopup: false,
    pendingAction: '', // 'start' | 'end'

    // 标签选择
    painLevels: [
      { key: 'light', label: '轻度', selected: false },
      { key: 'medium', label: '中度', selected: false },
      { key: 'heavy', label: '重度', selected: false }
    ],
    flowLevels: [
      { key: 'low', label: '少', selected: false },
      { key: 'medium', label: '中', selected: false },
      { key: 'high', label: '多', selected: false }
    ],
    moods: [
      { key: 'happy', label: '😊 开心', selected: false },
      { key: 'calm', label: '😐 平静', selected: false },
      { key: 'irritable', label: '😤 烦躁', selected: false },
      { key: 'sad', label: '😢 郁闷', selected: false }
    ],

    // 今天日期
    todayStr: ''
  },

  onLoad() {
    this.refreshStatus()
  },

  onShow() {
    // 从其他 tab 切回时强制关闭弹窗，确保状态干净
    if (this.data.showTagsPopup) {
      this.closeTagsPopup()
    }
    this.refreshStatus()
  },

  /**
   * 刷新页面状态
   */
  refreshStatus() {
    const status = predict.predictNext()
    const todayStr = util.today()

    // 二次校验：直接从 storage 确认是否真的存在活跃姨妈期，防止状态残留
    const active = storage.getActivePeriod()
    const actuallyInPeriod = !!active

    this.setData({
      isInPeriod: actuallyInPeriod,
      periodDay: actuallyInPeriod ? status.periodDay : 0,
      daysUntil: status.daysUntil,
      isOverdue: status.isOverdue || false,
      nextStartDate: status.startDate || '',
      needFirstRecord: !actuallyInPeriod && (status.needFirstRecord || false),
      todayStr: todayStr
    })
  },

  /**
   * 点击主按钮
   */
  onMainButtonTap() {
    if (this.data.isInPeriod) {
      this.setData({ showTagsPopup: true, pendingAction: 'end' })
    } else {
      this.setData({ showTagsPopup: true, pendingAction: 'start' })
    }
  },

  /**
   * 选择标签
   */
  onTagSelect(e) {
    const { group, key } = e.currentTarget.dataset
    const list = this.data[group]
    const idx = list.findIndex(item => item.key === key)

    // 单选：点击已选中则取消，否则切换
    list.forEach((item, i) => {
      item.selected = i === idx ? !item.selected : false
    })

    this.setData({ [group]: list })
  },

  /**
   * 确认标签并执行操作
   */
  onConfirmTags() {
    const pain = this.data.painLevels.find(i => i.selected)
    const flow = this.data.flowLevels.find(i => i.selected)
    const mood = this.data.moods.find(i => i.selected)

    const tags = {}
    if (pain) tags.pain = pain.key
    if (flow) tags.flow = flow.key
    if (mood) tags.mood = mood.key

    const today = this.data.todayStr

    if (this.data.pendingAction === 'start') {
      const result = storage.addPeriod({
        startDate: today,
        endDate: null,
        tags: tags
      })

      if (!result.success) {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '已记录，好好照顾自己 ❤️', icon: 'none', duration: 2000 })
    } else if (this.data.pendingAction === 'end') {
      const result = storage.addPeriod({
        startDate: today, // 会被 addPeriod 忽略，它会找 active period
        endDate: today,
        tags: tags
      })

      if (!result.success) {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '本次姨妈期已结束', icon: 'none', duration: 2000 })
    }

    this.closeTagsPopup()
    this.refreshStatus()
  },

  /**
   * 关闭标签弹窗（不保存）
   */
  closeTagsPopup() {
    // 重置标签
    this.data.painLevels.forEach(i => i.selected = false)
    this.data.flowLevels.forEach(i => i.selected = false)
    this.data.moods.forEach(i => i.selected = false)
    this.setData({
      showTagsPopup: false,
      pendingAction: '',
      painLevels: this.data.painLevels,
      flowLevels: this.data.flowLevels,
      moods: this.data.moods
    })
  },

  /**
   * 取消 — 不记录，直接关闭弹窗
   */
  onSkipTags() {
    this.closeTagsPopup()
  },

  /**
   * 阻止弹窗事件冒泡
   */
  preventBubble() {}
})
