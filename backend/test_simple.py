# -*- coding: utf-8 -*-
import sys
import os
import io

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, 'agents'))
sys.path.insert(0, os.path.join(backend_dir, 'tools'))

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

import asyncio
import logging

logging.basicConfig(
    level=logging.WARNING,
    format='%(message)s'
)

from llm_client import LLMClient
from engine import DecisionEngine

async def test():
    output_file = open(os.path.join(backend_dir, 'test_result.txt'), 'w', encoding='utf-8')
    
    def log(msg):
        print(msg)
        output_file.write(msg + '\n')
    
    log("\n" + "=" * 60)
    log("TEST: Two-Round Debate System")
    log("=" * 60)
    
    api_key = os.getenv("MODELSCOPE_API_KEY", "")
    log(f"API Key configured: {'Yes' if api_key else 'No'}")
    
    llm_client = LLMClient()
    engine = DecisionEngine(llm_client)
    
    user_input = "深夜办公室，想吃泡面但胃不舒服"
    context = {"time": "22:30", "quick_tabs": ["加班中", "压力大"]}
    
    log(f"\nUser Input: {user_input}")
    log(f"Context: {context}\n")
    
    all_logs, final_decision = await engine.run_full_debate(user_input, context)
    
    log("\n" + "=" * 60)
    log("ROUND 1: Independent Opinions")
    log("=" * 60)
    for log_item in all_logs:
        if log_item.round_num == 1:
            log(f"\n[{log_item.agent_name}] ({log_item.stance})")
            log(f"  Opinion: {log_item.opinion[:150]}...")
            if log_item.search_query:
                log(f"  Search: {log_item.search_query}")
    
    log("\n" + "=" * 60)
    log("ROUND 2: Debate Responses")
    log("=" * 60)
    for log_item in all_logs:
        if log_item.round_num == 2:
            log(f"\n[{log_item.agent_name}] ({log_item.stance})")
            log(f"  Response: {log_item.opinion[:150]}...")
    
    log("\n" + "=" * 60)
    log("OLD_JI: Final Decision")
    log("=" * 60)
    log(f"Debate Result: {final_decision.debate_result}")
    log(f"Mindset: {final_decision.mindset_adjustment}")
    log(f"Today Good: {final_decision.today_good}")
    log(f"Today Bad: {final_decision.today_bad}")
    log(f"Dinner: {final_decision.dinner_recommendation}")
    log(f"Action Index: {final_decision.action_index}")
    log(f"Avatar State: {final_decision.avatar_state}")
    
    wellness_score = engine.calculate_wellness_score(all_logs)
    log(f"\nWellness Score: {wellness_score}")
    log(f"Avatar State: {engine.determine_avatar_state(wellness_score)}")
    
    log("\n" + "=" * 60)
    log("SUCCESS: Test completed!")
    log("=" * 60 + "\n")
    
    output_file.close()

if __name__ == "__main__":
    asyncio.run(test())
