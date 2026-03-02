import akshare as ak
import pandas as pd
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class AKShareService:
    """AKShare 数据服务封装"""

    def __init__(self):
        """初始化时加载股票列表到内存"""
        self._stock_list: pd.DataFrame = self._load_stock_list()
        logger.info(f"Loaded {len(self._stock_list)} stocks into memory")

    def _load_stock_list(self) -> pd.DataFrame:
        """
        加载 A股全部股票列表（沪深）
        数据加载到内存，占用约 10MB
        """
        try:
            # 获取沪深 A股列表
            sh_stocks = ak.stock_info_a_code_name()
            sz_stocks = ak.stock_info_sz_name_code()

            # 标准化列名
            sh_stocks = sh_stocks.rename(columns={'code': 'code', 'name': 'name'})
            sz_stocks = sz_stocks.rename(columns={'A股代码': 'code', 'A股简称': 'name'})

            # 只保留需要的列
            sh_stocks = sh_stocks[['code', 'name']]
            sz_stocks = sz_stocks[['code', 'name']]

            # 添加市场标识
            sh_stocks['market'] = 'SH'
            sz_stocks['market'] = 'SZ'

            # 合并
            all_stocks = pd.concat([sh_stocks, sz_stocks], ignore_index=True)

            # 添加类型字段（默认为 STOCK，后续可扩展 ETF/INDEX 识别）
            all_stocks['type'] = 'STOCK'

            return all_stocks

        except Exception as e:
            logger.error(f"Failed to load stock list: {e}")
            # 返回空 DataFrame 以避免服务崩溃
            return pd.DataFrame(columns=['code', 'name', 'market', 'type'])

    def search_stocks(self, query: str, limit: int = 15) -> List[Dict]:
        """
        内存搜索股票（毫秒级响应）

        Args:
            query: 搜索关键词（支持代码、名称）
            limit: 返回结果数量限制

        Returns:
            股票列表
        """
        if not query or len(self._stock_list) == 0:
            return []

        query_lower = query.lower().strip()

        # 1. 精确匹配代码（最高优先级）
        exact_code_match = self._stock_list[
            self._stock_list['code'] == query
        ]
        if not exact_code_match.empty:
            return self._format_results(exact_code_match.head(limit))

        # 2. 精确匹配名称
        exact_name_match = self._stock_list[
            self._stock_list['name'] == query
        ]
        if not exact_name_match.empty:
            return self._format_results(exact_name_match.head(limit))

        # 3. 模糊匹配名称（包含关系）
        fuzzy_match = self._stock_list[
            self._stock_list['name'].str.contains(query, case=False, na=False)
        ]

        # 4. 如果结果不足，尝试代码前缀匹配
        if len(fuzzy_match) < limit:
            code_prefix_match = self._stock_list[
                self._stock_list['code'].str.startswith(query)
            ]
            fuzzy_match = pd.concat([fuzzy_match, code_prefix_match]).drop_duplicates()

        return self._format_results(fuzzy_match.head(limit))

    def _format_results(self, df: pd.DataFrame) -> List[Dict]:
        """格式化查询结果"""
        results = []
        for _, row in df.iterrows():
            results.append({
                'symbol': f"{row['code']}.{row['market']}",
                'code': row['code'],
                'name': row['name'],
                'market': row['market'],
                'type': row.get('type', 'STOCK'),
                'pinyin': None  # TODO: 添加拼音支持
            })
        return results

# 全局单例
_akshare_service: AKShareService = None

def get_akshare_service() -> AKShareService:
    """获取 AKShare 服务单例"""
    global _akshare_service
    if _akshare_service is None:
        _akshare_service = AKShareService()
    return _akshare_service
