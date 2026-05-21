import sys
import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, 'agents'))
sys.path.insert(0, os.path.join(BACKEND_DIR, 'tools'))

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import logging
import sys
import json
import asyncio
from datetime import datetime
from pathlib import Path

from database import (
    calendar_summary,
    create_diet_record,
    create_suggestion,
    create_user,
    get_conn,
    get_session_user,
    init_db,
    list_diet_records,
    list_suggestions,
    login_user,
    logout_token,
    upsert_profile,
    utc_now,
)

load_dotenv(os.path.join(BACKEND_DIR, '.env'))

print(f"[DEBUG] Loading .env from: {os.path.join(BACKEND_DIR, '.env')}")
print(f"[DEBUG] MODELSCOPE_API_KEY: {os.getenv('MODELSCOPE_API_KEY', 'NOT FOUND')[:20]}...")
print(f"[DEBUG] MODELSCOPE_MODEL: {os.getenv('MODELSCOPE_MODEL', 'NOT FOUND')}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HealSync Multi-Agent API",
    description="Multi-Agent Health Decision System with Two-Round Debate",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(BACKEND_DIR) / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
init_db()

MODELSCOPE_API_KEY = os.getenv("MODELSCOPE_API_KEY", "")
MODELSCOPE_BASE_URL = os.getenv("MODELSCOPE_BASE_URL", "https://api-inference.modelscope.cn/v1")
MODELSCOPE_MODEL = os.getenv("MODELSCOPE_MODEL", "moonshotai/Kimi-K2.5")

class DecisionRequest(BaseModel):
    user_input: str
    context: Optional[dict] = None
    quick_tabs: Optional[List[str]] = None

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    profile: Optional[dict] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class ProfileRequest(BaseModel):
    profile: dict

class SuggestionRequest(BaseModel):
    ingredients: str = ""
    mood: str = ""
    note: str = ""
    decision: Optional[dict] = None
    score: Optional[int] = None
    requestPayload: Optional[dict] = None
    createdAt: Optional[str] = None

class AgentOpinion(BaseModel):
    agent_name: str
    role: str
    opinion: str
    stance: str
    round_num: int = 1
    search_query: Optional[str] = None

class FinalDecisionOutput(BaseModel):
    debate_result: str
    mindset_adjustment: str
    today_good: str
    today_bad: str
    dinner_recommendation: str
    action_index: int
    avatar_state: str
    summary_reason: str = ""
    recommended_menu: Optional[dict] = None
    prep_plan: Optional[List[str]] = None
    nutrition_note: str = ""
    mindset_note: str = ""

class DecisionResponse(BaseModel):
    round1_debate: List[AgentOpinion]
    round2_debate: List[AgentOpinion]
    final_decision: FinalDecisionOutput
    wellness_score: int

from llm_client import LLMClient, get_llm_client
from engine import DecisionEngine

engine = DecisionEngine()
test_llm_client = get_llm_client("test")

def extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return authorization[len(prefix):].strip()

def require_user(authorization: Optional[str]) -> dict:
    token = extract_token(authorization)
    session = get_session_user(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session["user"]

def current_token(authorization: Optional[str]) -> str:
    return extract_token(authorization)

def today_key() -> str:
    return datetime.now().date().isoformat()

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "HealSync Multi-Agent Backend",
        "version": "3.0.0",
        "message": "Two-Round Debate System is ready!",
        "llm_configured": bool(MODELSCOPE_API_KEY),
        "agents": ["老中医", "营养师", "情绪疗愈师", "快乐分身", "自律分身", "老己"]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "llm_ready": bool(MODELSCOPE_API_KEY)}

@app.post("/auth/register")
async def register(request: RegisterRequest):
    username = request.username.strip()
    email = request.email.strip()
    if not username:
        raise HTTPException(status_code=400, detail="请输入用户名")
    if not email:
        raise HTTPException(status_code=400, detail="请输入邮箱")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少需要 6 位")
    try:
        return create_user(username, email, request.password, request.profile or {})
    except Exception as e:
        message = str(e)
        if "UNIQUE" in message.upper():
            raise HTTPException(status_code=409, detail="用户名或邮箱已存在")
        raise HTTPException(status_code=500, detail=message)

@app.post("/auth/login")
async def login(request: LoginRequest):
    session = login_user(request.username.strip(), request.password)
    if not session:
        raise HTTPException(status_code=401, detail="用户名或密码不正确")
    return session

@app.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    logout_token(current_token(authorization))
    return {"ok": True}

@app.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    token = current_token(authorization)
    session = get_session_user(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session

@app.put("/me/profile")
async def update_profile(request: ProfileRequest, authorization: Optional[str] = Header(default=None)):
    user = require_user(authorization)
    with get_conn() as conn:
        profile = upsert_profile(conn, user["id"], request.profile)
    return {"profile": profile}

@app.get("/workbench")
async def get_workbench(date: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    user = require_user(authorization)
    day = date or today_key()
    return {
        "date": day,
        "suggestions": list_suggestions(user["id"], day),
        "records": list_diet_records(user["id"], day),
        "calendar": calendar_summary(user["id"]),
    }

@app.get("/diet/suggestions")
async def get_suggestions(date: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    user = require_user(authorization)
    return {"suggestions": list_suggestions(user["id"], date)}

@app.post("/diet/suggestions")
async def post_suggestion(request: SuggestionRequest, authorization: Optional[str] = Header(default=None)):
    user = require_user(authorization)
    suggestion = create_suggestion(user["id"], request.model_dump())
    return suggestion

@app.get("/diet/records")
async def get_records(date: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    user = require_user(authorization)
    return {"records": list_diet_records(user["id"], date)}

@app.get("/calendar/summary")
async def get_calendar_summary(authorization: Optional[str] = Header(default=None)):
    user = require_user(authorization)
    return calendar_summary(user["id"])

@app.post("/decide", response_model=DecisionResponse)
async def make_decision(request: DecisionRequest):
    logger.info(f"\n{'='*60}")
    logger.info(f"🎯 [REQUEST] 收到决策请求")
    logger.info(f"📝 用户输入: {request.user_input}")
    logger.info(f"{'='*60}")
    
    try:
        context = request.context or {}
        if request.quick_tabs:
            context["quick_tabs"] = request.quick_tabs
        
        all_logs, final_decision = await engine.run_full_debate(request.user_input, context)
        
        round1_logs = [log for log in all_logs if log.round_num == 1]
        round2_logs = [log for log in all_logs if log.round_num == 2]
        
        wellness_score = engine.calculate_wellness_score(all_logs)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ [COMPLETE] 决策完成")
        logger.info(f"📊 健康评分: {wellness_score}")
        logger.info(f"🎭 状态: {final_decision.avatar_state}")
        logger.info(f"{'='*60}\n")
        
        return DecisionResponse(
            round1_debate=[
                AgentOpinion(
                    agent_name=log.agent_name,
                    role=log.role,
                    opinion=log.opinion,
                    stance=log.stance,
                    round_num=log.round_num,
                    search_query=log.search_query
                )
                for log in round1_logs
            ],
            round2_debate=[
                AgentOpinion(
                    agent_name=log.agent_name,
                    role=log.role,
                    opinion=log.opinion,
                    stance=log.stance,
                    round_num=log.round_num,
                    search_query=log.search_query
                )
                for log in round2_logs
            ],
            final_decision=FinalDecisionOutput(
                debate_result=final_decision.debate_result,
                mindset_adjustment=final_decision.mindset_adjustment,
                today_good=final_decision.today_good,
                today_bad=final_decision.today_bad,
                dinner_recommendation=final_decision.dinner_recommendation,
                action_index=final_decision.action_index,
                avatar_state=final_decision.avatar_state,
                summary_reason=final_decision.summary_reason,
                recommended_menu=final_decision.recommended_menu,
                prep_plan=final_decision.prep_plan,
                nutrition_note=final_decision.nutrition_note,
                mindset_note=final_decision.mindset_note,
            ),
            wellness_score=wellness_score
        )
        
    except Exception as e:
        logger.error(f"❌ [ERROR] Decision failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_decision_stream(request: DecisionRequest):
    context = request.context or {}
    if request.quick_tabs:
        context["quick_tabs"] = request.quick_tabs
    
    event_queue = asyncio.Queue()
    
    async def run_debate():
        try:
            all_logs, final_decision = await engine.run_full_debate(
                request.user_input, 
                context, 
                event_queue=event_queue
            )
            
            wellness_score = engine.calculate_wellness_score(all_logs)
            
            final_data = {
                "type": "final_decision",
                "debate_result": final_decision.debate_result,
                "mindset_adjustment": final_decision.mindset_adjustment,
                "today_good": final_decision.today_good,
                "today_bad": final_decision.today_bad,
                "dinner_recommendation": final_decision.dinner_recommendation,
                "action_index": final_decision.action_index,
                "avatar_state": final_decision.avatar_state,
                "wellness_score": wellness_score,
                "summary_reason": final_decision.summary_reason,
                "recommended_menu": final_decision.recommended_menu,
                "prep_plan": final_decision.prep_plan,
                "nutrition_note": final_decision.nutrition_note,
                "mindset_note": final_decision.mindset_note,
            }
            await event_queue.put(final_data)
            await event_queue.put({"type": "done"})
        except Exception as e:
            await event_queue.put({"type": "error", "message": str(e)})
    
    debate_task = asyncio.create_task(run_debate())
    
    try:
        while True:
            event = await event_queue.get()
            
            if event.get("type") == "done":
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                break
            
            if event.get("type") == "error":
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                break
            
            logger.info(f"🔍 [STREAM] 发送事件: {event.get('type')}, agent: {event.get('agent_name', 'N/A')}")
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            
            if event.get("type") == "final_decision":
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                break
    finally:
        debate_task.cancel()
        try:
            await debate_task
        except asyncio.CancelledError:
            pass

@app.post("/decide/stream")
async def make_decision_stream(request: DecisionRequest):
    logger.info(f"\n{'='*60}")
    logger.info(f"🎯 [STREAM REQUEST] 收到流式决策请求")
    logger.info(f"📝 用户输入: {request.user_input}")
    logger.info(f"{'='*60}")
    
    return StreamingResponse(
        generate_decision_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )

@app.post("/diet/analyze")
async def analyze_diet_with_vision(
    images: List[UploadFile] = File(...),
    user_id: str = Form(default="default"),
    authorization: Optional[str] = Header(default=None)
):
    import base64
    import json

    auth_user = None
    if authorization:
        auth_user = require_user(authorization)
        user_id = auth_user["id"]

    logger.info(f"[DIET] Vision analyze for user={user_id}, image_count={len(images)}")
    if not images:
        raise HTTPException(status_code=400, detail="请至少上传一张饮食照片")

    images_data = []
    image_urls = []
    request_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    for img in images:
        content_type = img.content_type or "image/jpeg"
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{img.filename} 不是图片文件")
        content = await img.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"{img.filename} 是空文件")
        suffix = Path(img.filename or "").suffix.lower() or ".jpg"
        safe_user_id = user_id.replace("/", "_")
        upload_folder = UPLOAD_DIR / safe_user_id / request_id
        upload_folder.mkdir(parents=True, exist_ok=True)
        image_name = f"{len(images_data) + 1}{suffix}"
        image_path = upload_folder / image_name
        image_path.write_bytes(content)
        image_urls.append(f"/uploads/{safe_user_id}/{request_id}/{image_name}")
        images_data.append({
            "filename": img.filename or "image",
            "content_type": content_type,
            "content": base64.b64encode(content).decode("utf-8"),
        })

    prompt = f"""请分析用户上传的 {len(images_data)} 张饮食照片。必须观察图片内容，识别实际食物，不要套用示例答案。

请严格只输出 JSON，不要输出 Markdown 或额外说明：
{{
  "food_identification": ["食物1", "食物2"],
  "analysis": {{
    "tcm": "从中医角度分析性味、适宜人群和注意事项，100字以内",
    "nutrition": "从营养角度分析热量、营养结构、搭配建议，100字以内",
    "psychology": "从心理角度分析饮食情绪、满足感和进食动机，100字以内"
  }},
  "score": 85
}}

评分标准：90-100 非常健康，70-89 比较健康，50-69 一般，30-49 不太健康，0-29 非常不健康。"""

    try:
        client = test_llm_client._get_client()
        if client is None:
            raise HTTPException(status_code=503, detail="模型客户端不可用，请检查 MODELSCOPE_API_KEY 和 openai 依赖")

        content = [{"type": "text", "text": prompt}]
        for index, img in enumerate(images_data, start=1):
            content.append({"type": "text", "text": f"图片 {index}：{img['filename']}"})
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['content_type']};base64,{img['content']}"
                },
            })

        response = client.chat.completions.create(
            model=os.getenv("MODELSCOPE_MODEL", "Qwen/Qwen3.5-397B-A17B"),
            messages=[
                {"role": "system", "content": "你是专业营养师和中医师。你必须基于用户上传的图片进行饮食分析，并始终输出合法 JSON。"},
                {"role": "user", "content": content},
            ],
            max_tokens=1000,
            temperature=0.4,
        )

        result_text = response.choices[0].message.content or ""
        logger.info(f"[DIET] Vision model response: {result_text[:300]}...")
        json_start = result_text.find("{")
        json_end = result_text.rfind("}") + 1
        json_text = result_text[json_start:json_end] if json_start >= 0 and json_end > json_start else result_text
        try:
            result = json.loads(json_text)
        except Exception as parse_error:
            logger.error(f"[DIET] Failed to parse model JSON: {parse_error}; raw={result_text[:500]}")
            raise HTTPException(status_code=502, detail="模型已返回，但结果不是合法 JSON，请重试")

        food_identification = result.get("food_identification") or []
        if not isinstance(food_identification, list):
            food_identification = [str(food_identification)]

        analysis = result.get("analysis") or {}
        if not isinstance(analysis, dict):
            analysis = {"nutrition": str(analysis)}

        try:
            score = int(result.get("score", 60))
        except (TypeError, ValueError):
            score = 60
        score = max(0, min(100, score))

        record = {
            "food_identification": [str(item) for item in food_identification],
            "analysis": {
                "tcm": str(analysis.get("tcm", "暂无中医分析")),
                "nutrition": str(analysis.get("nutrition", "暂无营养分析")),
                "psychology": str(analysis.get("psychology", "暂无心理分析")),
            },
            "score": score,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
            "image_count": len(images_data),
            "model_used": os.getenv("MODELSCOPE_MODEL", "Qwen/Qwen3.5-397B-A17B"),
        }

        if auth_user:
            return create_diet_record(
                user_id=auth_user["id"],
                food_identification=record["food_identification"],
                analysis=record["analysis"],
                score=score,
                model_used=record["model_used"],
                image_urls=image_urls,
                created_at=record["timestamp"],
            )

        save_diet_record(record)
        record["images"] = image_urls
        return record

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DIET] Vision analyze error: {e}")
        raise HTTPException(status_code=502, detail=f"饮食图片模型分析失败：{e}")

@app.post("/diet/analyze/mock")
async def analyze_diet(
    images: List[UploadFile] = File(...),
    user_id: str = Form(default="default")
):
    import base64
    import json
    from pathlib import Path
    
    logger.info(f"[DIET] Analyzing diet for user: {user_id}")
    
    images_data = []
    for img in images:
        content = await img.read()
        images_data.append({
            "filename": img.filename,
            "content": base64.b64encode(content).decode('utf-8')
        })
    
    prompt = f"""请分析以下食物图片，识别用户吃了什么，并从多个角度给出评价。

请严格按照以下JSON格式输出（不要输出其他内容，只输出JSON）：
{{
    "food_identification": ["食物1", "食物2", ...],
    "analysis": {{
        "tcm": "从中医角度分析这些食物的性味归经、适宜人群、注意事项等（100字以内）",
        "nutrition": "从营养学角度分析热量、营养成分、搭配建议等（100字以内）",
        "psychology": "从心理角度分析饮食情绪、进食动机、心理满足感等（100字以内）"
    }},
    "score": 85
}}

评分标准：
- 90-100分：非常健康的饮食搭配
- 70-89分：比较健康的饮食
- 50-69分：一般，有改进空间
- 30-49分：不太健康的饮食
- 0-29分：非常不健康的饮食

共上传了 {len(images_data)} 张食物图片，请综合分析后给出评价。"""

    try:
        client = test_llm_client._get_client()
        if client is None:
            return generate_mock_diet_result()
        
        messages = [
            {"role": "system", "content": "你是一个专业的营养师和中医师，擅长分析饮食结构并给出健康建议。请始终以JSON格式输出结果。"},
            {"role": "user", "content": prompt}
        ]
        
        response = client.chat.completions.create(
            model=os.getenv("MODELSCOPE_MODEL", "Qwen/Qwen3.5-397B-A17B"),
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )
        
        result_text = response.choices[0].message.content
        logger.info(f"[DIET] LLM Response: {result_text[:200]}...")
        
        try:
            json_start = result_text.find('{')
            json_end = result_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(result_text[json_start:json_end])
            else:
                result = json.loads(result_text)
        except:
            result = generate_mock_diet_result()
        
        record = {
            "food_identification": result.get("food_identification", ["食物"]),
            "analysis": result.get("analysis", {
                "tcm": "暂无中医分析",
                "nutrition": "暂无营养分析", 
                "psychology": "暂无心理分析"
            }),
            "score": result.get("score", 60),
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }
        
        save_diet_record(record)
        
        return record
        
    except Exception as e:
        logger.error(f"[DIET] Error: {e}")
        return generate_mock_diet_result()

def generate_mock_diet_result():
    return {
        "food_identification": ["米饭", "青菜", "鸡蛋"],
        "analysis": {
            "tcm": "米饭性平味甘，补中益气；青菜清热解毒；鸡蛋滋阴润燥。整体搭配平和，适合日常食用。",
            "nutrition": "碳水、蛋白质、维生素搭配均衡，热量适中。建议增加优质蛋白比例。",
            "psychology": "清淡饮食反映平和心态，有助于情绪稳定。建议细嚼慢咽，享受进食过程。"
        },
        "score": 75
    }

def save_diet_record(record):
    import json
    from pathlib import Path
    
    workspace_path = Path("/mnt/workspace")
    if not workspace_path.exists():
        workspace_path = Path("./data")
        workspace_path.mkdir(exist_ok=True)
    
    records_file = workspace_path / "diet_records.json"
    
    records = []
    if records_file.exists():
        try:
            with open(records_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        except:
            records = []
    
    records.append(record)
    
    with open(records_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    
    logger.info(f"[DIET] Record saved to {records_file}")

@app.get("/diet/records/{user_id}")
async def get_diet_records(user_id: str):
    import json
    from pathlib import Path
    
    workspace_path = Path("/mnt/workspace")
    if not workspace_path.exists():
        workspace_path = Path("./data")
    
    records_file = workspace_path / "diet_records.json"
    
    if not records_file.exists():
        return {"records": []}
    
    try:
        with open(records_file, 'r', encoding='utf-8') as f:
            records = json.load(f)
        user_records = [r for r in records if r.get("user_id") == user_id]
        return {"records": user_records}
    except:
        return {"records": []}

@app.get("/test-llm")
async def test_llm():
    if not MODELSCOPE_API_KEY:
        return {"status": "error", "message": "MODELSCOPE_API_KEY not configured"}
    
    response = await test_llm_client.call(
        system_prompt="你是一个友好的AI助手。",
        user_prompt="请用一句话回复：你好！"
    )
    return {"status": "success", "response": response}

@app.get("/test-search")
async def test_search():
    from tools import duckduckgo_search, format_search_results
    
    results = await duckduckgo_search("健康饮食 建议")
    formatted = format_search_results(results)
    return {"status": "success", "results": formatted}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
