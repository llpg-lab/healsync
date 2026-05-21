import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from agents import (
    BaseAgent, AgentResponse, ALL_AGENTS, OLD_JI,
    TCMasterAgent, NutritionistAgent, EmotionHealerAgent,
    PleasureSeekerAgent, DisciplineAgent, OldJiAgent
)
from tools import duckduckgo_search, format_search_results
from llm_client import LLMClient

logger = logging.getLogger(__name__)

@dataclass
class DebateLog:
    agent_name: str
    role: str
    opinion: str
    stance: str
    round_num: int = 1
    search_query: Optional[str] = None
    search_results: Optional[str] = None

@dataclass
class FinalDecision:
    debate_result: str
    mindset_adjustment: str
    today_good: str
    today_bad: str
    dinner_recommendation: str
    action_index: int
    avatar_state: str
    summary_reason: str = ""
    recommended_menu: Optional[Dict[str, Any]] = None
    prep_plan: Optional[List[str]] = None
    nutrition_note: str = ""
    mindset_note: str = ""

class DecisionEngine:
    def __init__(self):
        self.agents = ALL_AGENTS
        self.old_ji = OLD_JI
        self._llm_clients = {}
    
    def _get_llm_client(self, agent_name: str) -> 'LLMClient':
        from llm_client import get_llm_client
        if agent_name not in self._llm_clients:
            self._llm_clients[agent_name] = get_llm_client(agent_name)
        return self._llm_clients[agent_name]
    
    async def _do_search(self, query: str) -> str:
        try:
            results = await duckduckgo_search(query)
            return format_search_results(results)
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return ""
    
    async def run_agent_round1(
        self,
        agent: BaseAgent,
        user_input: str,
        context: Dict[str, Any] = None
    ) -> DebateLog:
        agent.log_thinking("第一轮独立思考...")
        search_results_text = None
        search_query = None
        
        if agent.has_search:
            search_query = agent.get_search_keywords(user_input)
            if search_query:
                agent.log_thinking(f"搜索关键词: {search_query}")
                search_results_text = await self._do_search(search_query)
        
        prompt = self._build_round1_prompt(agent, user_input, search_results_text, context)
        
        agent.log_thinking("调用 LLM 生成意见...")
        llm_client = self._get_llm_client(agent.name)
        opinion = await llm_client.call(
            system_prompt=agent.get_system_prompt(),
            user_prompt=prompt
        )
        
        agent.log_thinking("意见生成完成")
        
        return DebateLog(
            agent_name=agent.name,
            role=agent.role,
            opinion=opinion,
            stance=agent.get_stance(),
            round_num=1,
            search_query=search_query,
            search_results=search_results_text
        )
    
    async def run_agent_round2(
        self,
        agent: BaseAgent,
        user_input: str,
        round1_logs: List[DebateLog],
        context: Dict[str, Any] = None
    ) -> DebateLog:
        agent.log_thinking("第二轮辩论回应...")
        
        search_results_text = None
        search_query = None
        
        if agent.has_search:
            search_query = agent.get_search_keywords(user_input)
            if search_query:
                search_results_text = await self._do_search(search_query)
        
        prompt = agent.get_debate_prompt(user_input, round1_logs, search_results_text)
        
        agent.log_thinking("调用 LLM 生成辩论回应...")
        llm_client = self._get_llm_client(agent.name)
        opinion = await llm_client.call(
            system_prompt=agent.get_system_prompt(),
            user_prompt=prompt
        )
        
        agent.log_thinking("辩论回应完成")
        
        return DebateLog(
            agent_name=agent.name,
            role=agent.role,
            opinion=opinion,
            stance=agent.get_stance(),
            round_num=2,
            search_query=search_query,
            search_results=search_results_text
        )
    
    def _build_round1_prompt(
        self,
        agent: BaseAgent,
        user_input: str,
        search_results: str,
        context: Dict[str, Any] = None
    ) -> str:
        prompt_parts = [f"用户说：「{user_input}」"]
        
        if context:
            if context.get("time"):
                prompt_parts.append(f"当前时间：{context['time']}")
            if context.get("mood"):
                prompt_parts.append(f"用户情绪：{context['mood']}")
            if context.get("quick_tabs"):
                prompt_parts.append(f"用户状态标签：{', '.join(context['quick_tabs'])}")
        
        if search_results:
            prompt_parts.append(f"\n📚 搜索资料：\n{search_results}")
        
        prompt_parts.append("\n请根据你的角色定位，给出你的第一轮独立意见。")
        
        return "\n".join(prompt_parts)
    
    async def run_parallel_round1(
        self,
        user_input: str,
        context: Dict[str, Any] = None
    ) -> List[DebateLog]:
        logger.info("=" * 60)
        logger.info("🎭 [ROUND 1] 第一轮：独立发言")
        logger.info(f"📝 用户输入: {user_input}")
        if context:
            logger.info(f"📋 上下文: {context}")
        logger.info("=" * 60)
        
        tasks = [
            self.run_agent_round1(agent, user_input, context)
            for agent in self.agents
        ]
        
        results = await asyncio.gather(*tasks)
        
        logger.info("-" * 60)
        logger.info("📊 第一轮发言汇总:")
        for r in results:
            logger.info(f"  ✅ [{r.agent_name}] {r.stance}")
        logger.info("=" * 60)
        
        return list(results)
    
    async def run_parallel_round2(
        self,
        user_input: str,
        round1_logs: List[DebateLog],
        context: Dict[str, Any] = None
    ) -> List[DebateLog]:
        logger.info("=" * 60)
        logger.info("🎭 [ROUND 2] 第二轮：辩论回应")
        logger.info("=" * 60)
        
        tasks = [
            self.run_agent_round2(agent, user_input, round1_logs, context)
            for agent in self.agents
        ]
        
        results = await asyncio.gather(*tasks)
        
        logger.info("-" * 60)
        logger.info("📊 第二轮辩论汇总:")
        for r in results:
            logger.info(f"  ✅ [{r.agent_name}] {r.stance}")
        logger.info("=" * 60)
        
        return list(results)
    
    async def run_old_ji_decision(
        self,
        user_input: str,
        round1_logs: List[DebateLog],
        round2_logs: List[DebateLog]
    ) -> FinalDecision:
        logger.info("=" * 60)
        logger.info("👴 [老己] 开始最终决策...")
        logger.info("=" * 60)
        
        prompt = self.old_ji.get_final_prompt(user_input, round1_logs, round2_logs)
        
        llm_client = self._get_llm_client(self.old_ji.name)
        response = await llm_client.call(
            system_prompt=self.old_ji.get_system_prompt(),
            user_prompt=prompt
        )
        
        decision = self._parse_final_decision(response)
        
        logger.info("-" * 60)
        logger.info(f"📋 博弈结果: {decision.debate_result}")
        logger.info(f"💡 心态调整: {decision.mindset_adjustment}")
        logger.info(f"✅ 今日宜: {decision.today_good}")
        logger.info(f"❌ 今日忌: {decision.today_bad}")
        logger.info(f"🍽️ 晚餐推荐: {decision.dinner_recommendation}")
        logger.info(f"⚡ 行动指数: {decision.action_index}")
        logger.info(f"🎭 分身状态: {decision.avatar_state}")
        logger.info("=" * 60)
        
        return decision
    
    def _parse_final_decision(self, response: str) -> FinalDecision:
        json_match = re.search(r'\{[\s\S]*\}', response)

        if json_match:
            try:
                data = json.loads(json_match.group())
                menu = data.get("recommended_menu")
                if menu:
                    dish_names = [d.get("name", "") for d in menu.get("dishes", [])]
                    dinner_rec = f"{menu.get('title', '推荐菜单')}：{'、'.join(dish_names)}"
                else:
                    dinner_rec = data.get("dinner_recommendation", data.get("晚餐推荐", "清炒时蔬"))

                return FinalDecision(
                    debate_result=data.get("summary_reason", data.get("博弈结果", "各方达成共识")),
                    mindset_adjustment=data.get("mindset_note", data.get("核心心态调整", "保持平和")),
                    today_good=data.get("today_good", data.get("今日宜", "清淡饮食")),
                    today_bad=data.get("today_bad", data.get("今日忌", "暴饮暴食")),
                    dinner_recommendation=dinner_rec,
                    action_index=int(data.get("action_index", data.get("行动指数", 5))),
                    avatar_state=data.get("avatar_state", data.get("分身状态", "neutral")),
                    summary_reason=data.get("summary_reason", ""),
                    recommended_menu=menu,
                    prep_plan=data.get("prep_plan"),
                    nutrition_note=data.get("nutrition_note", ""),
                    mindset_note=data.get("mindset_note", ""),
                )
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"JSON解析失败: {e}")

        return FinalDecision(
            debate_result="各方经过讨论达成共识",
            mindset_adjustment="保持平和心态",
            today_good="清淡饮食",
            today_bad="暴饮暴食",
            dinner_recommendation="清炒时蔬",
            action_index=5,
            avatar_state="neutral"
        )
    
    async def run_full_debate(
        self,
        user_input: str,
        context: Dict[str, Any] = None,
        event_queue: asyncio.Queue = None
    ) -> tuple:
        async def put_event(event_type, data):
            if event_queue:
                await event_queue.put({"type": event_type, **data})
        
        async def run_agent_with_notify(agent, round_num, user_input, context, round1_logs=None):
            if round_num == 1:
                agent_log = await self.run_agent_round1(agent, user_input, context)
            else:
                agent_log = await self.run_agent_round2(agent, user_input, round1_logs, context)
            
            await put_event("agent_complete", {
                "agent_name": agent_log.agent_name,
                "role": agent_log.role,
                "opinion": agent_log.opinion,
                "stance": agent_log.stance,
                "round_num": agent_log.round_num,
                "search_query": agent_log.search_query
            })
            return agent_log
        
        logger.info("=" * 60)
        logger.info("🎭 [ROUND 1] 第一轮：并行独立发言")
        logger.info(f"📝 用户输入: {user_input}")
        if context:
            logger.info(f"📋 上下文: {context}")
        logger.info("=" * 60)
        
        tasks = [
            run_agent_with_notify(agent, 1, user_input, context)
            for agent in self.agents
        ]
        
        round1_logs = []
        for coro in asyncio.as_completed(tasks):
            agent_log = await coro
            round1_logs.append(agent_log)
            logger.info(f"  ✅ [{agent_log.agent_name}] 第一轮完成")
        
        logger.info("-" * 60)
        logger.info("📊 第一轮发言汇总:")
        for r in round1_logs:
            logger.info(f"  ✅ [{r.agent_name}] {r.stance}")
        logger.info("=" * 60)
        
        logger.info("=" * 60)
        logger.info("🎭 [ROUND 2] 第二轮：并行辩论回应")
        logger.info("=" * 60)
        
        tasks = [
            run_agent_with_notify(agent, 2, user_input, context, round1_logs)
            for agent in self.agents
        ]
        
        round2_logs = []
        for coro in asyncio.as_completed(tasks):
            agent_log = await coro
            round2_logs.append(agent_log)
            logger.info(f"  ✅ [{agent_log.agent_name}] 第二轮完成")
        
        logger.info("-" * 60)
        logger.info("📊 第二轮辩论汇总:")
        for r in round2_logs:
            logger.info(f"  ✅ [{r.agent_name}] {r.stance}")
        logger.info("=" * 60)
        
        final_decision = await self.run_old_ji_decision(user_input, round1_logs, round2_logs)
        
        all_logs = round1_logs + round2_logs
        
        return all_logs, final_decision
    
    def calculate_wellness_score(self, debate_logs: List[DebateLog]) -> int:
        base_score = 75
        
        for log in debate_logs:
            opinion_lower = log.opinion.lower()
            
            if log.agent_name == "老中医":
                if any(word in opinion_lower for word in ["不宜", "禁忌", "避免", "伤身"]):
                    base_score -= 5
                if any(word in opinion_lower for word in ["建议", "推荐", "适合", "有益"]):
                    base_score += 3
            
            if log.agent_name == "营养师":
                if any(word in opinion_lower for word in ["高热量", "高糖", "高脂", "升糖"]):
                    base_score -= 5
                if any(word in opinion_lower for word in ["低脂", "低糖", "健康", "营养"]):
                    base_score += 3
            
            if log.agent_name == "情绪疗愈师":
                if any(word in opinion_lower for word in ["压力", "焦虑", "情绪"]):
                    base_score -= 2
                if any(word in opinion_lower for word in ["放松", "调节", "平衡"]):
                    base_score += 2
            
            if log.agent_name == "快乐分身":
                if any(word in opinion_lower for word in ["放纵", "享受", "满足"]):
                    base_score -= 3
            
            if log.agent_name == "自律分身":
                if any(word in opinion_lower for word in ["坚持", "自律", "目标"]):
                    base_score += 3
        
        return max(0, min(100, base_score))
    
    def determine_avatar_state(self, wellness_score: int) -> str:
        if wellness_score >= 80:
            return "energized"
        elif wellness_score >= 60:
            return "happy"
        elif wellness_score >= 40:
            return "neutral"
        elif wellness_score >= 20:
            return "tired"
        else:
            return "stressed"
