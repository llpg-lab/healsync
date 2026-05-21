from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

@dataclass
class AgentResponse:
    agent_name: str
    role: str
    opinion: str
    stance: str
    search_query: Optional[str] = None
    search_results: Optional[str] = None

class BaseAgent(ABC):
    def __init__(self, name: str, role: str, has_search: bool = False):
        self.name = name
        self.role = role
        self.has_search = has_search
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        pass
    
    @abstractmethod
    def get_search_keywords(self, user_input: str) -> Optional[str]:
        pass
    
    @abstractmethod
    def get_stance(self) -> str:
        pass
    
    def get_debate_prompt(self, user_input: str, round1_logs: list, search_results: str = None) -> str:
        other_opinions = []
        for log in round1_logs:
            if log.agent_name != self.name:
                other_opinions.append(f"【{log.agent_name}】{log.opinion}")
        
        prompt = f"""用户说：「{user_input}」

第一轮各方发言：
{chr(10).join(other_opinions)}

【你的任务】
请阅读其他Agent的观点，选择1-2个你最支持或最反对的观点进行回应。
如果被说服，可以修正你的建议。

请给出你的第二轮回应。"""
        
        if search_results:
            prompt += f"\n\n📚 搜索资料：\n{search_results}"
        
        return prompt
    
    def log_thinking(self, message: str):
        logger.info(f"🤖 [{self.name}] {message}")
