# OSINT 收盘报告 17:00 时效保障

## 目标

- 工作日北京时间 16:30 开始生成收盘报告。
- 上游龙虎榜尚未就绪时，在 16:40、16:50、16:55、16:58 自动重试。
- 17:00 前报告应出现在 `/osint/reports`；Vercel 自带 cron 继续作为延迟兜底。

Vercel Hobby cron 只有小时级精度，不能单独承担这个时效目标。精确定时器应使用支持 `Asia/Shanghai` 时区和自定义请求头的外部服务。

## 外部定时任务

为下列时间分别创建工作日任务：

| 时间（Asia/Shanghai） | 请求 |
| --- | --- |
| 16:30，周一至周五 | `GET https://www.alphapercept.com/api/osint/v1/reports/generate?edition=close` |
| 16:40，周一至周五 | 同上 |
| 16:50，周一至周五 | 同上 |
| 16:55，周一至周五 | 同上 |
| 16:58，周一至周五 | 同上 |

每个请求必须设置：

```text
Authorization: Bearer <CRON_SECRET>
```

不要把 CRON_SECRET 放进 URL、日志或截图。所有任务使用相同请求头，生产环境中的 `CRON_SECRET` 仍是唯一真源。

## 返回值与重试判定

- `HTTP 201`：本次创建了当天收盘报告。
- `HTTP 200`：当天报告已经存在，本次安全复用，没有重复落库。
- `HTTP 503` + `code=CLOSE_DATA_NOT_READY`：龙虎榜尚未达到当天 `live` 门禁，按 `Retry-After` 等待下一个时间点。
- `HTTP 500` + `code=REPORT_GENERATION_FAILED`：数据库或程序故障；不要当成数据未就绪，立即检查函数日志。
- `HTTP 403`：请求头缺失或密钥不一致，立即检查定时器配置，不要降低鉴权。

普通定时调用是幂等的：只有健康、当天龙虎榜一致且具备导出条件的终版会被复用。降级报告会在下一次任务中重新生成；并发任务若撞到唯一键，会回读已经成功的报告。

## Vercel 兜底

`vercel.json` 中现有 `30 8 * * 1-5`（UTC）继续保留。Hobby 计划可能把它延后最多约 59 分钟，因此它只负责外部定时器故障后的兜底，不作为 17:00 时效承诺。

## 验收

17:00 运行完整探测，并为失败退出配置告警：

```bash
node scripts/probe-osint-close-report.mjs --date=YYYY-MM-DD
```

`probe-osint-close-report.mjs` 会读取当天报告、核对龙虎榜日期，并真实请求、解码两张 PNG。退出码非 0 即为未达标；告警信息不得包含 `CRON_SECRET`。

通过条件：

- 存在当天 `edition=close`；
- `status=healthy`；
- 报告详情中的 `lhb.status=live` 且 `lhb.tradeDate` 等于当天；
- `stories` 与 `hotlist` 两个 PNG 导出均返回 `HTTP 200`、`content-type: image/png`、尺寸 1080×1920。
