from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="Alpha-Quant A股数据服务",
    description="基于 AKShare 的 A股全量搜索与实时行情服务",
    version="1.0.0"
)

# CORS 配置（允许 Next.js 调用）
# Note: FastAPI CORS doesn't support wildcards in URLs like "https://*.vercel.app"
# Use allow_origin_regex instead for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "alpha-quant-data-service"}

@app.get("/")
async def root():
    return {
        "message": "Alpha-Quant A股数据服务",
        "docs": "/docs",
        "health": "/health"
    }
