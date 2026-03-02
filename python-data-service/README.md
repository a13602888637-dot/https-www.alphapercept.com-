# Alpha-Quant A股数据服务

基于 FastAPI + AKShare 的 A股全量搜索与实时行情微服务。

## 本地开发

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

访问 API 文档: http://localhost:8000/docs

## API 端点

- `GET /search?q={query}&limit={limit}` - A股搜索
- `GET /health` - 健康检查

## 部署到 Railway

1. 登录 Railway: https://railway.app/
2. 新建项目 → Deploy from GitHub repo
3. 选择此仓库的 `python-data-service` 目录
4. Railway 会自动检测 `railway.toml` 并部署
5. 获取部署 URL（如：https://your-app.up.railway.app）
6. 在 Next.js 项目中配置环境变量：`PYTHON_SERVICE_URL=https://your-app.up.railway.app`

## 环境变量

- `PORT`: 服务端口（Railway 自动注入）
- `FRONTEND_URL`: 前端域名（用于 CORS 配置）
