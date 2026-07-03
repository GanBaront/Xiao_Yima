# 晓例假

> 一款极简、注重隐私的女性生理期记录微信小程序

## 功能

- **一键记录** — 首页点击"姨妈来啦 / 姨妈走啦"即可记录，支持标记痛经程度、血量、心情
- **姨妈期预测** — 基于加权平均算法（近期数据权重更高），预测下次姨妈期日期和倒计时
- **日历视图** — 月历展示历史姨妈期（粉色标记）和预测姨妈期（虚线标记），支持手动补录
- **历史管理** — 按月份搜索、删除单条记录，标记某月"没来"
- **数据统计** — 平均周期、平均行经天数、总记录数
- **参数自动校准** — 积累 ≥4 次记录后，自动用加权平均值校准默认周期天数
- **导入导出** — JSON 文件导出备份 + 文件导入 / 手动日历补录
- **纯本地存储** — 所有数据仅存于手机本地，不上传服务器，保护隐私

## 技术栈

- 微信小程序原生框架（WXML + WXSS + JS）
- 纯本地存储（`wx.setStorageSync` / `wx.getStorageSync`）
- 加权平均预测算法
- 莫兰迪粉配色方案

## 项目结构

```
Xiao_Yima/
├── app.js                  # 全局入口：静默登录、初始化设置、数据校验
├── app.json                # 页面注册 + tabBar 配置（首页/日历/设置）
├── app.wxss                # 全局样式：CSS 变量、卡片、弹窗、标签选择器
├── project.config.json     # 微信开发者工具项目配置
├── images/                 # tabBar 图标
├── utils/
│   ├── util.js             # 日期工具：formatDate / diffDays / getMonthDays 等
│   ├── storage.js          # 数据层：姨妈期 CRUD、重叠检测、cycleLength 重算、导入导出
│   └── predict.js          # 预测算法：加权平均周期、下次姨妈期预测、未来预测列表
└── pages/
    ├── index/              # 首页：姨妈期倒计时 / 进行中天数、一键记录弹窗
    ├── calendar/           # 日历页：月历视图、历史标记、预测标记、手动补录
    └── settings/           # 设置页：生理参数滑块、历史记录查看/搜索/删除、导入导出
```

## 快速开始

1. 下载[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目目录 `Xiao_Yima`
3. 填写自己的 `appid`（`project.config.json` → `appid`，也可使用测试号）
4. 编译预览

## 数据流

```
用户操作 → storage.addPeriod / updatePeriod / deletePeriod
         → recalculateCycles（重算所有 cycleLength）
         → savePeriodHistory（写入本地 Storage）
         → predict.predictNext / predictFuture（读取最新数据预测）
```

### cycleLength 计算规则

- 每条记录的 `cycleLength = 本条 startDate - 上一条 startDate`（首条为 null）
- **skipped 记录**（当月没来）不参与周期计算
- **跨 skipped 月份的周期**视为脏数据，置为 null，不参与平均统计

### 参数自动校准

- 累计 ≥4 条有效记录且 ≥3 条有 cycleLength 时自动触发
- 仅校准**周期天数**，行经天数保持用户手动设置值

## 配色

| 用途 | 色值 |
|---|---|
| 主色 | `#FF6B81` |
| 浅主色 | `#FFB6C1` |
| 背景 | `#FFF5F5` |
| 文字主 | `#333333` |
| 文字次 | `#999999` |
| 姨妈期标记 | `rgba(255, 107, 129, 0.3)` |
| 预测标记 | `rgba(255, 107, 129, 0.1)` + dashed |

## 版本

**v1.1.0**

- 历史记录支持按月份搜索和单条删除
- 手动导入新增"当月没来"标记功能
- 首页天数加单位，修复同天起止持续天数显示
- 日历页年份快速跳转
- 全局排除 skipped 记录对统计/渲染/预测的影响
- 跨 skipped 月份的周期不计入平均

## License

MIT
