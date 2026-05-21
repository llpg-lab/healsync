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
        return """你是「老中医」，一位精通《黄帝内经》与时令养生的专家。

【角色定位】
养生专家，精通中医理论，擅长从气血、时令、体质角度分析健康问题。

【核心任务】
1. 第一轮：给出中医维度的深度分析，包括体质判断、时令影响、气血状态
2. 辩论轮：观察营养学家的成分论，尝试从中医角度进行"寒热平性"的转化解释
3. 辩论轮：反驳"快乐分身"的伤身主张，用中医理论说明放纵的代价

【语气风格】
- 儒雅、辩证，常提及"气血"、"时令"、"阴阳"
- 使用"依老夫之见"、"从中医角度来看"等表达
- 对待"上火"、"湿热"等概念要有实质化解释

【回复格式】
- 开头：用古朴的问候或判断
- 中间：阐述中医分析（体质、时令、气血）
- 结尾：给出明确的养生建议或禁忌
- 字数：100-150字

【辩论规则】
- 当营养师提到具体数据时，用中医概念进行对应解释（如：高升糖→湿热内生）
- 当快乐分身主张放纵时，温和但坚定地指出伤身之处
- 保持儒雅风度，不与人争吵，但立场坚定"""

    def get_search_keywords(self, user_input: str) -> Optional[str]:
        keywords = []
        
        food_keywords = ["吃", "喝", "饿", "食", "餐", "饭", "面", "肉", "菜", "汤"]
        symptom_keywords = ["痛", "疼", "晕", "胀", "泻", "便秘", "失眠", "咳嗽", "上火"]
        time_keywords = ["早", "午", "晚", "夜", "睡", "醒"]
        condition_keywords = ["累", "疲", "困", "虚", "弱", "冷", "热"]
        
        has_food = any(word in user_input for word in food_keywords)
        has_symptom = any(word in user_input for word in symptom_keywords)
        has_time = any(word in user_input for word in time_keywords)
        has_condition = any(word in user_input for word in condition_keywords)
        
        if has_food:
            keywords.append("药食同源 食疗养生")
        if has_symptom:
            keywords.append("五运六气 中医调理")
        if has_time:
            keywords.append("子午流注 时辰养生")
        if has_condition:
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
请阅读其他Agent的观点，选择1-2个你最支持或最反对的观点进行回应：
1. 如果营养师提到具体数据，请用中医概念进行对应解释
2. 如果快乐分身主张放纵，请温和但坚定地反驳
3. 如果被说服，可以修正你的建议

请给出你的第二轮回应。"""
        
        if search_results:
            prompt += f"\n\n📚 搜索资料：\n{search_results}"
        
        return prompt
