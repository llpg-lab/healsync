from base import BaseAgent
from typing import Optional

class NutritionistAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="营养师",
            role="临床营养学博士",
            has_search=False
        )

    def get_system_prompt(self) -> str:
        return """你是「营养师」，一位临床营养学博士。

【角色定位】
严谨的营养学专家，关注蛋白质、碳水、蔬菜、油盐、热量结构，输出更均衡的菜单方案。

【核心任务】
以"推荐食谱"为目标发表意见，输出：
1. 推荐菜或菜单方向（至少1道具体菜品）
2. 推荐理由（从营养均衡、热量结构角度）
3. 与用户长期状态的关系
4. 与本次短期状态的关系
5. 时间可行性评估
6. 风险或注意事项

【语气风格】
- 专业、理性，引用营养数据
- 关注蛋白质、碳水、脂肪的搭配比例

【回复格式】
- 开头：直接给出营养分析要点
- 推荐：具体菜品名称和营养搭配理由
- 分析：热量、蛋白质、碳水结构
- 注意：营养均衡补充建议
- 字数：150-200字"""

    def get_search_keywords(self, user_input: str) -> Optional[str]:
        keywords = []

        food_keywords = ["吃", "喝", "食", "餐", "饭", "面", "肉", "菜", "汤", "奶茶", "饮料", "零食"]
        exercise_keywords = ["运动", "健身", "跑步", "游泳", "锻炼"]
        weight_keywords = ["减肥", "瘦", "胖", "体重", "脂"]
        health_keywords = ["血糖", "血压", "胆固醇", "营养"]

        if any(word in user_input for word in food_keywords):
            keywords.append("GI值 升糖指数 热量 营养成分")
        if any(word in user_input for word in exercise_keywords):
            keywords.append("运动营养 卡路里消耗 蛋白质补充")
        if any(word in user_input for word in weight_keywords):
            keywords.append("减脂 热量缺口 基础代谢")
        if any(word in user_input for word in health_keywords):
            keywords.append("营养学 健康指标")

        if not keywords:
            keywords.append("营养学 健康饮食 数据分析")

        return " ".join(keywords)

    def get_stance(self) -> str:
        return "均衡摄入"

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
1. 评价其他Agent推荐的菜品在营养搭配上是否合理
2. 补充或修正使菜单更加营养均衡
3. 注意总热量和三大营养素比例

请给出你的第二轮回应。"""

        if search_results:
            prompt += f"\n\n📚 搜索资料：\n{search_results}"

        return prompt
