# AlphaPercept 本机 Uzi Worker

网页只负责创建任务和显示状态；本机 Worker 使用已经通过 ChatGPT 订阅登录的 Codex CLI 完成 Uzi 多 Agent 深研，并将公开报告推送到站点。私有持仓数量、成本和行动卡只写入数据库，不进入公开 HTML 或 Git。

```bash
npm run uzi:worker:setup -- --no-launch
npm run uzi:worker:check
npm run uzi:worker:once
```

生产环境必须配置与 `~/.local/share/alphapercept-worker/worker-secret` 内容一致的 `UZI_WORKER_SECRET`。不要把密钥写入仓库或日志。
