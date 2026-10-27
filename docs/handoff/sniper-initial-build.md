# 火柴人狙击首版搭建 交接

- last_updated: 2026-10-27 11:20
- status: active
- version: v0.1.0

## 任务目标

家族第 14 个应用「火柴人狙击」：方案 B（城市街区 + 瞄准镜 + 敌人探头/跑动），免费 + 时长配额，国内站上线。关卡结构预留方案 C 任务制。

## 当前状态

✅ 国内站已上线 https://sniper.daobox.net.cn（HTTPS 200、线上 E2E 全过）。剩手机实测 + 首页入口待用户拍板。

## 最近完成

- 引擎 public/game.js：程序化城市生成（楼+窗）、敌人两型（peek 窗口探头 3 阶段 / runner 街面横穿）、呼吸晃动准星、爆头/身体判定、连击 x5、弹匣+装填、弹孔/飘字/屏幕震动特效、WebAudio 合成音效（零素材）
- 关卡：5 个预制关 + 无限程序化爬梯（quota+2、间隔/探头时间递减、晃动递增）；LEVELS 预留 mission 字段（方案 C 二期）
- 部署：/opt/sniper-pwa + systemd 8800 + Caddy + DNS（aliyun-cli 自动加 RecordId 2114887471078050816）
- portal：PILL_ANCHORS + CHECKIN_APPS 加 sniper（国内 rsync + 海外 CF worker Version a0694280）
- 线上 E2E：HTTPS 12 秒签发，开局→击杀→得分全通，无页面错误

## 待办

- [ ] 手机实测：触屏瞄准手感（目前 pointerdown 即开枪，拖动瞄准体验待验证）、加主屏幕、音效
- [x] 首页入口：2026-10-27 用户要求上线（v1.4.9-audit，daobox-home commit 含 app.js+index.html?v=7；踩坑记录：改 app.js 必须同步升 index.html 的 ?v= 版本号）
- [ ] 二期（方案 C）：任务制关卡（只打红头巾/别打平民/风偏提前量），数据结构已预留 mission 字段
- [ ] 平衡性调参：依用户试玩反馈调 spawnGap/showTime/sway/分数

## 重要决策

- 2026-10-27 用户看示意图后拍板方案 B（火柴人狙击）；命名 sniper-pwa；端口 8800（分配表排队）
- 美术口径：卡通火柴人、无血液，页面注明「卡通竞技风格，无血腥内容」
- 触屏方案 v1：pointerdown 即开枪（点击哪里打哪里），拖动瞄准在 v1.1 观察后决定

## 注意事项

- 8800 端口本版已占，下一个新应用从 8801（docs/服务器端口分配.md）
- game.js 有 window.__sniperTest E2E 钩子（state/enemies/aim/fire），无害但别删
- enemyBody() 在 peek rise 早期返回 null，drawEnemy 已判空——改判定逻辑时注意
- 音效全 WebAudio 合成，改音色在 SFX 对象

## 相关文件

- public/game.js（全部游戏逻辑）· index.html · style.css · sw.js · manifest.json
- server/node-server.mjs（PORT=8800）
- 示意图：_temp-screenshots/2026-10/狙击方案B-火柴人狙击-示意图.png
