// app.js
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
  },

  globalData: {
    // 全局状态：当前经期信息
    periodStatus: null
  }
})
