/**
 * 日期格式化
 * @param {Date} date
 * @param {string} fmt - yyyy-MM-dd, yyyy/MM/dd 等
 */
const formatDate = (date, fmt = 'yyyy-MM-dd') => {
  const o = {
    'M+': date.getMonth() + 1,
    'd+': date.getDate(),
    'h+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds(),
    'q+': Math.floor((date.getMonth() + 3) / 3),
    'S': date.getMilliseconds()
  }
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  for (let k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
    }
  }
  return fmt
}

/**
 * 日期加减天数
 */
const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/**
 * 计算两个日期相差天数
 */
const diffDays = (d1, d2) => {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((new Date(d1).getTime() - new Date(d2).getTime()) / oneDay))
}

/**
 * 获取某月总天数
 */
const getMonthDays = (year, month) => {
  return new Date(year, month, 0).getDate()
}

/**
 * 获取某月第一天是周几 (0=周日, 1=周一...)
 */
const getMonthFirstDay = (year, month) => {
  return new Date(year, month - 1, 1).getDay()
}

/**
 * 解析日期字符串为 Date (yyyy-MM-dd)
 */
const parseDate = (str) => {
  const parts = str.split('-')
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
}

/**
 * 比较两个日期字符串 (yyyy-MM-dd)
 * 返回 -1: d1 < d2, 0: d1 == d2, 1: d1 > d2
 */
const compareDate = (d1, d2) => {
  if (d1 < d2) return -1
  if (d1 > d2) return 1
  return 0
}

/**
 * 获取今天的日期字符串
 */
const today = () => formatDate(new Date())

module.exports = {
  formatDate,
  addDays,
  diffDays,
  getMonthDays,
  getMonthFirstDay,
  parseDate,
  compareDate,
  today
}
