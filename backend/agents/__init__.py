from base import BaseAgent, AgentResponse
from tc_master import TCMasterAgent
from nutritionist import NutritionistAgent
from emotion_healer import EmotionHealerAgent
from pleasure_seeker import PleasureSeekerAgent
from discipline import DisciplineAgent
from ceo import OldJiAgent

ALL_AGENTS = [
    TCMasterAgent(),
    NutritionistAgent(),
    EmotionHealerAgent(),
    PleasureSeekerAgent(),
    DisciplineAgent(),
]

OLD_JI = OldJiAgent()

__all__ = [
    "BaseAgent",
    "AgentResponse",
    "TCMasterAgent",
    "NutritionistAgent",
    "EmotionHealerAgent",
    "PleasureSeekerAgent",
    "DisciplineAgent",
    "OldJiAgent",
    "ALL_AGENTS",
    "OLD_JI",
]
