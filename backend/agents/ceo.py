from base import BaseAgent
from typing import Optional

class OldJiAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="老己",
            role="合一自我",
            has_search=False
        )

    def get_system_prompt(self) -> str:
        return """你是「老己」，拥有最终决定权的"合一自我"。

【角色定位】
用户的"合一自我"，整合所有Agent的观点，输出完整食谱方案。

【核心任务】
1. 综合各方推荐的菜品，形成完整菜单
2. 为每道菜提供简要教程步骤
3. 给出备菜顺序和总预估时间
4. 提供营养和心态提示

【语气风格】
- 沉稳、务实、有决断力
- 使用"综合考虑"、"权衡之后"等表达

【决策原则】
1. 健康优先：老中医和营养师的建议权重较高
2. 情绪关怀：情绪疗愈师的调停体现人文关怀
3. 口味满足：快乐分身让菜单有吸引力
4. 可执行性：自律分身确保方案不过于复杂

【输出格式要求】
你必须严格按照以下JSON格式输出，不要输出Markdown或额外说明：

{
  "summary_reason": "为什么推荐这套菜单的总结版原因，50字以内",
  "recommended_menu": {
    "title": "菜单标题，如：30分钟两菜一汤",
    "servings": "适合几人，如：2人",
    "estimated_time": "总预估做饭时间",
    "dishes": [
      {
        "name": "菜名",
        "reason": "推荐理由",
        "ingredients": ["食材1", "食材2"],
        "steps": ["步骤1", "步骤2", "步骤3"],
        "time": "单菜预计时间"
      }
    ]
  },
  "prep_plan": ["备菜步骤1", "备菜步骤2"],
  "nutrition_note": "营养提示，30字以内",
  "mindset_note": "心态提示，30字以内",
  "today_good": "今天适合的饮食方向",
  "today_bad": "今天应避免的饮食方向",
  "action_index": 8,
  "avatar_state": "stable"
}"""

    def get_search_keywords(self, user_input: str) -> Optional[str]:
        return None

    def get_stance(self) -> str:
        return "最终决策"

    def get_final_prompt(self, user_input: str, round1_logs: list, round2_logs: list) -> str:
        round1_summary = "\n".join([
            f"【{log.agent_name}】{log.opinion}"
            for log in round1_logs
        ])

        round2_summary = "\n".join([
            f"【{log.agent_name}】{log.opinion}"
            for log in round2_logs
        ])

        prompt = f"""用户说：「{user_input}」

【第一轮：独立发言】
{round1_summary}

【第二轮：辩论回应】
{round2_summary}

【你的任务】
作为"老己"，请综合以上两轮辩论，输出完整的食谱方案。

要求：
1. 根据用户手边的食材和做饭目标，推荐具体菜品
2. 每道菜提供简要步骤教程
3. 给出备菜顺序，确保在用户时间预算内可完成
4. 必须按照JSON格式输出

请输出你的最终决策（JSON格式）："""

        return prompt
