from base import BaseAgent
from typing import Optional

class NutritionistAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="营养师",
            role="临床营养学博士",
            has_search=True
        )
    
    def get_system_prompt(self) -> str:
        return """你是「营养师」，一位临床营养学博士，数据至上主义者。

【角色定位】
严谨的营养学专家，用数据说话，基于循证医学给出建议。

【核心任务】
1. 第一轮：给出极度理性的生理指标分析（GI值、热量、营养成分）
2. 辩论轮：挑战老中医模糊的描述（如"上火"），要求其实质化
3. 辩论轮：用数据压制"快乐分身"的非理性冲动

【语气风格】
- 冷峻、专业，满口"皮质醇"、"胰岛素"、"升糖负荷"
- 不讲情面，只看数据
- 对模糊概念保持质疑态度

【回复格式】
- 开头：直接给出关键数据（热量、GI值、蛋白质等）
- 中间：进行科学分析，引用具体数值
- 结尾：给出明确的营养建议或替代方案
- 字数：100-150字

【辩论规则】
- 当老中医使用"上火"、"湿热"等模糊概念时，要求其用现代医学语言解释
- 当快乐分身主张放纵时，用数据说明代价（如：这会带来多少热量、多高的升糖负荷）
- 保持理性客观，用数据说服，不情绪化"""

    def get_search_keywords(self, user_input: str) -> Optional[str]:
        keywords = []
        
        food_keywords = ["吃", "喝", "食", "餐", "饭", "面", "肉", "菜", "汤", "奶茶", "饮料", "零食"]
        exercise_keywords = ["运动", "健身", "跑步", "游泳", "锻炼"]
        weight_keywords = ["减肥", "瘦", "胖", "体重", "脂"]
        health_keywords = ["血糖", "血压", "胆固醇", "营养"]
        
        has_food = any(word in user_input for word in food_keywords)
        has_exercise = any(word in user_input for word in exercise_keywords)
        has_weight = any(word in user_input for word in weight_keywords)
        has_health = any(word in user_input for word in health_keywords)
        
        if has_food:
            keywords.append("GI值 升糖指数 热量 营养成分")
        if has_exercise:
            keywords.append("运动营养 卡路里消耗 蛋白质补充")
        if has_weight:
            keywords.append("减脂 热量缺口 基础代谢")
        if has_health:
            keywords.append("营养学 健康指标")
        
        if not keywords:
            keywords.append("营养学 健康饮食 数据分析")
        
        return " ".join(keywords)
    
    def get_stance(self) -> str:
        return "数据理性"
    
    def get_debate_prompt(self, user_input: str, round1_logs: list, search_results: str = None) -> str:
        other_opinions = []
        for log in round1_logs:
            if log.agent_name != self.name:
                other_opinions.append(f"【{log.agent_name}】{log.opinion}")
        
        prompt = f"""用户说：「{user_input}」

第一轮各方发言：
{chr(10).join(other_opinions)}

【你的任务】
请阅读其他Agent的观点，选择1-2个你最支持或最反对的观点进行回应：
1. 如果老中医使用模糊概念（如"上火"），要求其用现代医学语言解释
2. 如果快乐分身主张放纵，用数据说明代价
3. 如果被说服，可以修正你的建议

请给出你的第二轮回应。"""
        
        if search_results:
            prompt += f"\n\n📚 搜索资料：\n{search_results}"
        
        return prompt
