from fastapi import APIRouter, Query, HTTPException
from app.services.akshare_service import get_akshare_service
from app.models.schemas import SearchResponse, StockSearchResult
from typing import List

router = APIRouter(prefix="/search", tags=["搜索"])

@router.get("", response_model=SearchResponse)
async def search_stocks(
    q: str = Query(..., min_length=1, max_length=50, description="搜索关键词"),
    limit: int = Query(15, ge=1, le=100, description="返回结果数量")
):
    """
    A股全量搜索

    支持：
    - 股票代码（6位数字，如：600519）
    - 股票名称（中文，如：贵州茅台）
    - 部分匹配（如：茅台 → 贵州茅台）
    """
    try:
        service = get_akshare_service()
        results = service.search_stocks(query=q, limit=limit)

        return SearchResponse(
            success=True,
            data=[StockSearchResult(**r) for r in results],
            count=len(results),
            source="akshare",
            query=q
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"搜索失败: {str(e)}"
        )
