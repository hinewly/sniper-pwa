# 屋顶狙击 v0.4.0 固定10关/选关/首通积分 交接

- last_updated: 2026-11-02 10:58
- status: done
- version: v0.4.0

## 任务目标

把主流程收敛为固定 10 关；支持从已解锁关开始；每关每模式首通发 DaoBox 统一积分；手机端保持轻量排版。

## 当前状态

已完成并部署国内站 `https://sniper.daobox.net.cn`。

## 最近完成

- 固定第 1-10 关；第 5 关起明显加压，第 10 关高压但可通关（23 目标 / 42 秒 / 1000ms 停留）。
- 主菜单「起始关卡」胶囊：第 N 关通过后解锁；手机只显示已解锁，iPad/桌面显示 1-10 并置灰未解锁。
- 从选中关开局得分归零；失败后“再来一次”从当前关重试；第 10 关完成后显示“全部通关”和“再战第 10 关”。
- 首通积分表：第 1-10 关 = 10/20/50/80/100/200/300/400/500/700；狙击/机枪分开；服务端每关每模式只发一次。
- daobox-home 新增 `POST /api/reward/game/clear` 与 `reward_game_clears` 表；入 `reward_points` / `reward_ledger`，不直接改会员到期日。
- 游客过关提示“登录后可领”；登录用户过关自动入账。
- 手机端内容做减法：次要规则折叠、弹窗限高滚动、按钮全宽、起始关 5 列网格。
- 版本联动：v0.4.0 + style.css?v=3 + game.js?v=11 + SW dbsniper-v12。

## 验证

- `node -c` / `node --check` 全过。
- 本地 Playwright：393px 菜单/过关提示、1024px 解锁/第10关终局全过；页面错误 0。
- daobox-home 本地 Wrangler API：未登录 401；首通 +10；重复过关 already:true；非法 level 400。
- 国内 rsync + 重启成功；线上未登录 `/api/reward/game/clear` 返回 401。
- 海外 Cloudflare 同步部署 Version `dc39fb90-dfaa-4696-886a-484416fa30da`。
- 线上冒烟：v0.4.0 / SW dbsniper-v12 / game.js?v=11 全 200；手机第 1 关过关 +10 积分提示正常；页面错误 0。

## 重要决策

- 本期只发积分，不做“玩法直接换天数”。
- 继续沿用账号中心现有 100 积分 = 1 天、每月最多 7 天的兑换规则。
- 钓鱼积分下调（100 斤 = 10 积分）列入下一版全局积分平衡，不与本次混改。

## 待办

- 下一版：全局积分平衡，钓鱼 `100 斤 = 1 天 + 10 积分`。
- 用户手机实测：选关、机枪扫射手感、第 6-10 关难度。
- 二期：任务制关卡（mission 字段保留）、挑战/无尽模式、积分兑换商城。

## 注意事项

- 首通积分以后端 `reward_game_clears` 判重为准，不要在前端做唯一判重。
- `reward_game_clears` 主键是 `(user_id, app, mode, level)`；以后接其他游戏时先在 `GAME_CLEAR_POINTS` 增加配置。
- 改 game.js/style.css/SW 必须同步版本参数；当前为 game.js?v=11 / style.css?v=3 / dbsniper-v12。

## 相关文件

- `public/game.js`、`public/index.html`、`public/style.css`、`public/service-worker.js`
- `/Users/zoujiean/CodeX/daobox-home/worker/src/index.js`
- `/Users/zoujiean/CodeX/daobox-home/docs/handoff/game-clear-reward-api.md`
- 截图：`/Users/zoujiean/CodeX/_temp-screenshots/2026-11/狙击v0.4.0-*.png`
