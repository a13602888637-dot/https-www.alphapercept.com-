from pydantic import BaseModel, Field
from typing import Optional, List

class StockSearchResult(BaseModel):
    """股票搜索结果"""
    symbol: str = Field(..., description="统一标识符，格式：600519.SH")
    code: str = Field(..., description="股票代码，如：600519")
    name: str = Field(..., description="股票名称，如：贵州茅台")
    market: str = Field(..., description="市场代码：SH/SZ")
    type: str = Field(default="STOCK", description="资产类型：STOCK/ETF/INDEX")
    pinyin: Optional[str] = Field(None, description="拼音缩写，如：gzmt")

class SearchResponse(BaseModel):
    """搜索响应"""
    success: bool = Field(default=True)
    data: List[StockSearchResult]
    count: int
    source: str = Field(default="akshare")
    query: str
