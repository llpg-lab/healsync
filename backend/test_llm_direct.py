# -*- coding: utf-8 -*-
import sys
import os
import time

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

output_file = open(os.path.join(backend_dir, 'llm_test_result.txt'), 'w', encoding='utf-8')

def log(msg):
    print(msg, flush=True)
    output_file.write(msg + '\n')
    output_file.flush()

log("=" * 60)
log("Testing Qwen3.5 vs Qwen3")
log("=" * 60)

api_key = os.getenv("MODELSCOPE_API_KEY", "")
base_url = "https://api-inference.modelscope.cn/v1"

from openai import OpenAI
client = OpenAI(base_url=base_url, api_key=api_key)

# Test 1: Qwen3.5 - 普通文本
log("\n[TEST 1] Qwen/Qwen3.5-397B-A17B - 普通文本")
log("-" * 40)
try:
    start_time = time.time()
    response = client.chat.completions.create(
        model='Qwen/Qwen3.5-397B-A17B',
        messages=[{"role": "user", "content": "你好"}],
        max_tokens=50
    )
    elapsed = time.time() - start_time
    log(f"SUCCESS in {elapsed:.2f}s!")
    log(f"Response: {response.choices[0].message.content}")
except Exception as e:
    log(f"FAILED: {e}")

# Test 2: Qwen3.5 - 流式输出
log("\n[TEST 2] Qwen/Qwen3.5-397B-A17B - 流式输出")
log("-" * 40)
try:
    start_time = time.time()
    response = client.chat.completions.create(
        model='Qwen/Qwen3.5-397B-A17B',
        messages=[{"role": "user", "content": "你好"}],
        max_tokens=50,
        stream=True
    )
    result = ""
    for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            result += chunk.choices[0].delta.content
    elapsed = time.time() - start_time
    log(f"SUCCESS in {elapsed:.2f}s!")
    log(f"Response: {result}")
except Exception as e:
    log(f"FAILED: {e}")

# Test 3: Qwen3.5 - 多模态（图片）
log("\n[TEST 3] Qwen/Qwen3.5-397B-A17B - 多模态（图片）")
log("-" * 40)
try:
    start_time = time.time()
    response = client.chat.completions.create(
        model='Qwen/Qwen3.5-397B-A17B',
        messages=[{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': '描述这幅图'},
                {'type': 'image_url', 'image_url': {'url': 'https://modelscope.oss-cn-beijing.aliyuncs.com/demo/images/audrey_hepburn.jpg'}}
            ]
        }],
        max_tokens=100
    )
    elapsed = time.time() - start_time
    log(f"SUCCESS in {elapsed:.2f}s!")
    log(f"Response: {response.choices[0].message.content[:100]}...")
except Exception as e:
    log(f"FAILED: {e}")

# Test 4: Qwen3 - 普通文本
log("\n[TEST 4] Qwen/Qwen3-235B-A22B - 普通文本")
log("-" * 40)
try:
    start_time = time.time()
    response = client.chat.completions.create(
        model='Qwen/Qwen3-235B-A22B',
        messages=[{"role": "user", "content": "你好"}],
        max_tokens=50
    )
    elapsed = time.time() - start_time
    log(f"SUCCESS in {elapsed:.2f}s!")
    log(f"Response: {response.choices[0].message.content}")
except Exception as e:
    log(f"FAILED: {e}")

output_file.close()
log("\nDone!")
