import asyncio
import aiohttp
import logging
from typing import Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class SearchResult:
    title: str
    snippet: str
    url: str

async def duckduckgo_search(query: str, max_results: int = 3) -> List[SearchResult]:
    """
    使用 DuckDuckGo 进行搜索（无需 API Key）
    """
    logger.info(f"🔍 [SEARCH] 搜索关键词: {query}")
    
    results = []
    
    try:
        async with aiohttp.ClientSession() as session:
            url = "https://api.duckduckgo.com/"
            params = {
                "q": query,
                "format": "json",
                "no_html": 1,
                "skip_disambig": 1
            }
            
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=3)) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get("AbstractText"):
                        results.append(SearchResult(
                            title=data.get("Heading", "摘要"),
                            snippet=data.get("AbstractText", ""),
                            url=data.get("AbstractURL", "")
                        ))
                    
                    for topic in data.get("RelatedTopics", [])[:max_results]:
                        if isinstance(topic, dict) and "Text" in topic:
                            results.append(SearchResult(
                                title=topic.get("FirstURL", "").split("/")[-1] if topic.get("FirstURL") else "相关",
                                snippet=topic.get("Text", ""),
                                url=topic.get("FirstURL", "")
                            ))
                    
                    if not results:
                        results.append(SearchResult(
                            title="搜索结果",
                            snippet=f"关于「{query}」的即时建议：请根据常识和经验做出判断。",
                            url=""
                        ))
                    
                    logger.info(f"✅ [SEARCH] 找到 {len(results)} 条结果")
                    for i, r in enumerate(results[:3]):
                        logger.info(f"   [{i+1}] {r.title}: {r.snippet[:50]}...")
                    
    except asyncio.TimeoutError:
        logger.warning(f"⏱️ [SEARCH] 搜索超时: {query}")
        results.append(SearchResult(
            title="搜索超时",
            snippet="网络搜索超时，将基于内置知识回答。",
            url=""
        ))
    except Exception as e:
        logger.error(f"❌ [SEARCH] 搜索失败: {e}")
        results.append(SearchResult(
            title="搜索失败",
            snippet=f"搜索遇到问题: {str(e)}，将基于内置知识回答。",
            url=""
        ))
    
    return results

def format_search_results(results: List[SearchResult]) -> str:
    """格式化搜索结果为文本"""
    if not results:
        return "无搜索结果"
    
    formatted = []
    for i, r in enumerate(results, 1):
        formatted.append(f"{i}. {r.title}\n   {r.snippet}")
    
    return "\n".join(formatted)
