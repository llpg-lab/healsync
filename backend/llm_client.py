import os
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

def get_llm_api_key() -> str:
    return os.getenv("LLM_API_KEY") or os.getenv("MODELSCOPE_API_KEY", "")

def get_llm_base_url() -> str:
    return os.getenv("LLM_BASE_URL") or os.getenv("MODELSCOPE_BASE_URL", "https://api-inference.modelscope.cn/v1")

def get_llm_model() -> str:
    return os.getenv("LLM_MODEL") or os.getenv("MODELSCOPE_MODEL", "Qwen/Qwen3.5-397B-A17B")

def get_api_key(agent_name: str) -> str:
    return get_llm_api_key()

MOCK_RESPONSES = {
    "老中医": "老夫观你之症，似有脾胃不和之象。此时宜食清淡温热之物，忌辛辣生冷。建议以粥养胃，佐以山药、红枣，可助脾胃运化。切记，子时不睡伤肝胆，宜早休息。",
    "营养师": "根据营养学分析，建议控制总热量摄入。当前时段代谢率较低，高热量食物易转化为脂肪。建议选择低GI食物，如全谷物、蔬菜，避免血糖剧烈波动。",
    "情绪疗愈师": "我理解你此刻的感受。有时候，我们的身体在用食欲表达情绪需求。试着问问自己：你是真的饿了，还是需要一些安慰？适度的自我关爱是必要的，但也要注意方式。",
    "快乐分身": "哎呀，人生苦短，及时行乐嘛！想吃就吃，想喝就喝，何必那么纠结？开心最重要！偶尔放纵一下又不会怎样～",
    "自律分身": "想想你的健康目标，想想你想要的生活状态。每一次克制都是对未来的投资。坚持住，未来的你会感谢现在的自己！",
    "老己": "综合各方意见，建议采取折中方案：适度满足当前需求，同时注意健康影响。选择相对健康的替代方案，既照顾情绪，又不违背健康原则。",
}

class LLMClient:
    def __init__(self, api_key: str = None, agent_name: str = None):
        self.api_key = api_key or get_llm_api_key()
        self.agent_name = agent_name or "Unknown"
        self.base_url = get_llm_base_url()
        self.model = get_llm_model()
        self._client = None
    
    def _get_client(self):
        if self._client is None and self.api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    base_url=self.base_url,
                    api_key=self.api_key,
                )
                logger.info(f"[{self.agent_name}] OpenAI client created successfully")
            except ImportError:
                logger.warning("openai package not installed")
            except Exception as e:
                logger.error(f"[{self.agent_name}] Failed to create OpenAI client: {e}")
        return self._client
    
    async def call(self, system_prompt: str, user_prompt: str) -> str:
        if not self.api_key:
            logger.warning(f"[{self.agent_name}] No API key, using mock response")
            return self._get_mock_response()
        
        client = self._get_client()
        if client is None:
            logger.warning(f"[{self.agent_name}] Client is None, using mock response")
            return self._get_mock_response()
        
        try:
            loop = asyncio.get_event_loop()
            
            def sync_call():
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=2000,
                    temperature=0.7
                )
                return response.choices[0].message.content
            
            result = await loop.run_in_executor(None, sync_call)
            logger.info(f"🤖 [{self.agent_name}] LLM Response: {result[:100]}...")
            return result
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ [{self.agent_name}] LLM Error: {error_msg}")

            if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                logger.warning(f"[{self.agent_name}] API rate limit exceeded, retrying after delay...")
                await asyncio.sleep(2)
                try:
                    result = await loop.run_in_executor(None, sync_call)
                    logger.info(f"🤖 [{self.agent_name}] LLM Retry Response: {result[:100]}...")
                    return result
                except Exception as retry_err:
                    logger.error(f"❌ [{self.agent_name}] LLM Retry also failed: {retry_err}")
            return self._get_mock_response()
    
    def _get_mock_response(self) -> str:
        response = MOCK_RESPONSES.get(self.agent_name, "基于当前情况，建议综合考虑健康、情绪和实际可行性，做出平衡的选择。")
        logger.info(f"[{self.agent_name}] Using mock response")
        return response


def get_llm_client(agent_name: str) -> LLMClient:
    api_key = get_api_key(agent_name)
    logger.info(
        f"Creating LLM client for [{agent_name}] with "
        f"base_url={get_llm_base_url()}, model={get_llm_model()}, "
        f"api_key={api_key[:8] + '...' if api_key else 'None'}"
    )
    return LLMClient(api_key=api_key, agent_name=agent_name)
