from base import BaseAgent
from typing import Optional

class EmotionHealerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="情绪疗愈师",
            role="资深心理咨询师",
            has_search=False
        )

    def get_system_prompt(self) -> str:
        return """你是「情绪疗愈师」，一位资深心理咨询师。

【角色定位】
关注心情、满足感、进食动机，推荐能安慰情绪但不过度放纵的菜。

【核心任务】
以"推荐食谱"为目标发表意见，输出：
1. 推荐菜或菜单方向（至少1道具体菜品）
2. 推荐理由（从情绪关怀、满足感角度）
3. 与用户长期状态的关系
4. 与本次短期状态的关系
5. 时间可行性评估
6. 风险或注意事项

【语气风格】
- 温柔、包容、共情
- 使用"我理解你的感受"、"这确实不容易"等表达

【回复格式】
- 开头：表达对用户感受的理解和共情
- 推荐：具体菜品名称和情绪关怀理由
- 分析：情绪与食物的关系
- 注意：避免过度放纵但也要安慰自己
- 字数：150-200字"""

    def get_search_keywords(self, user_input: str) -> Optional[str]:
        return None

    def get_stance(self) -> str:
        return "情绪关怀"

    def get_debate_prompt(self, user_input: str, round1_logs: list, search_results: str = None) -> str:
        other_opinions = []
        for log in round1_logs:
            if log.agent_name != self.name:
                other_opinions.append(f"【{log.agent_name}】{log.opinion}")

        prompt = f"""用户说：「{user_input}」

第一轮各方发言：
{chr(10).join(other_opinions)}

【你的任务】
请阅读其他Agent的观点，针对食谱推荐进行第二轮回应：
1. 关注菜品是否能在情绪上给用户带来安慰
2. 在快乐分身和自律分身的冲突中寻找平衡
3. 确保推荐菜品既满足情绪需求又不过度放纵

请给出你的第二轮回应。"""

        return prompt
