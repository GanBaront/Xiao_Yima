// app.js
const storage = require('./utils/storage.js')

App({
  onLaunch() {
    // 静默登录：获取微信用户 openId
    wx.login({
      success: res => {
        if (res.code) {
          // 个人主体小程序，纯本地存储，code 仅用于静默标识
          // 不向后台服务器发送 code
          console.log('静默登录成功')
        }
      }
    })

    // 初始化默认设置（如果不存在）
    const settings = wx.getStorageSync('user_settings')
    if (!settings) {
      wx.setStorageSync('user_settings', {
        cycleLength: 28,
        periodLength: 5
      })
    }

    // 启动时重算 cycleLength，清理跨 skipped 月份的脏周期数据
    const history = storage.getPeriodHistory()
    if (history.length > 0) {
      const recalculated = storage.recalculateCycles(history)
      storage.savePeriodHistory(recalculated)
    }
  },

  globalData: {
    // 全局状态：当前姨妈期信息
    periodStatus: null
  }
})
