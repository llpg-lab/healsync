from base import BaseAgent
from typing import Optional

class TCMasterAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="老中医",
            role="养生专家",
            has_search=True
        )

    def get_system_prompt(self) -> str:
        return """你是「老中医」，精通《黄帝内经》与时令养生的专家。

【角色定位】
养生专家，从寒热温凉、脾胃状态、食材性味角度推荐菜品。

【核心任务】
以"推荐食谱"为目标发表意见，输出：
1. 推荐菜或菜单方向（至少1道具体菜品）
2. 推荐理由（从体质、时令、食材性味角度）
3. 与用户长期状态的关系
4. 与本次短期状态的关系
5. 时间可行性评估
6. 风险或注意事项

【语气风格】
- 儒雅、辩证，常提及"气血"、"时令"、"阴阳"
- 使用"依老夫之见"、"从中医角度来看"等表达

【回复格式】
- 开头：用古朴的问候或判断
- 推荐：具体菜品名称和搭配理由
- 分析：体质、时令、气血与菜品的关系
- 注意：禁忌或搭配注意
- 字数：150-200字"""

    def get_search_keywords(self, user_input: str) -> Optional[str]:
        keywords = []

        food_keywords = ["吃", "喝", "饿", "食", "餐", "饭", "面", "肉", "菜", "汤"]
        symptom_keywords = ["痛", "疼", "晕", "胀", "泻", "便秘", "失眠", "咳嗽", "上火"]
        time_keywords = ["早", "午", "晚", "夜", "睡", "醒"]
        condition_keywords = ["累", "疲", "困", "虚", "弱", "冷", "热"]

        if any(word in user_input for word in food_keywords):
            keywords.append("药食同源 食疗养生")
        if any(word in user_input for word in symptom_keywords):
            keywords.append("五运六气 中医调理")
        if any(word in user_input for word in time_keywords):
            keywords.append("子午流注 时辰养生")
        if any(word in user_input for word in condition_keywords):
            keywords.append("气血调理 体质辨识")

        if not keywords:
            keywords.append("四季养生 黄帝内经")

        return " ".join(keywords)

    def get_stance(self) -> str:
        return "中医养生"

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
1. 如果营养师推荐了菜品，从寒热温凉角度评价其搭配是否合理
2. 如果情绪疗愈师推荐了安慰性菜品，评估其是否适合当前体质
3. 可以补充或修正你的推荐

请给出你的第二轮回应。"""

        if search_results:
            prompt += f"\n\n📚 搜索资料：\n{search_results}"

        return prompt
