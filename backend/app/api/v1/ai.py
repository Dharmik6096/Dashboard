"""AI Chat endpoint — uses Gemini (primary) with Groq fallback."""
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from app.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

SYSTEM_PROMPT = """You are the DevOps Monitor Troubleshooting Copilot.

Your primary source of truth is the read-only telemetry and tools provided by DevOps Monitor.
For infrastructure questions, always inspect available telemetry before answering.
Never tell the user to manually discover information that an available tool can retrieve.
Never fabricate metrics, server state, counts, timestamps or root causes.
Clearly distinguish observed facts from inference.
If sufficient data is unavailable, state exactly what telemetry is missing.
You must never execute infrastructure-changing operations.
You are analysis-only. NEVER automatically execute or recommend the user to manually execute: SSH commands, Docker commands, SQL commands, Redis commands, RabbitMQ operations, systemctl, kill, rm, restart, reload or any other mutations.

For troubleshooting questions, structure your answer strictly as follows:
SUMMARY
...
EVIDENCE
...
LIKELY CAUSE
...
NEXT CHECK
...
CONFIDENCE
High/Medium/Low
"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AIContext(BaseModel):
    conversation_id: str | None = None
    environment_id: str | None = None
    server_id: str | None = None
    page: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    time_range: str | None = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: AIContext | None = None


class ChatResponse(BaseModel):
    reply: str
    model: str


async def _call_gemini(messages: List[ChatMessage]) -> tuple[str, str]:
    """Call Google Gemini API and return (reply, model_name)."""
    # Convert messages to Gemini format (roles: "user" / "model")
    contents = []
    for msg in messages[-20:]:
        if msg.role in ("user", "assistant"):
            gemini_role = "model" if msg.role == "assistant" else "user"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": msg.content}]
            })

    model = "gemini-2.0-flash"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={settings.GEMINI_API_KEY}"
    )

    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 1024,
            "temperature": 0.4,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)

    if response.status_code == 400:
        raise HTTPException(status_code=400, detail=f"Gemini API error 400: {response.text}")
    if response.status_code == 401 or response.status_code == 403:
        raise HTTPException(status_code=401, detail="Invalid Gemini API key.")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Gemini rate limit reached.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {response.status_code}")

    data = response.json()
    reply = data["candidates"][0]["content"]["parts"][0]["text"]
    return reply, model


async def _call_groq(messages: List[ChatMessage]) -> tuple[str, str]:
    """Call Groq API and return (reply, model_name)."""
    openai_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages[-20:]:
        if msg.role in ("user", "assistant"):
            openai_messages.append({"role": msg.role, "content": msg.content})

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "groq/compound-mini",
                "messages": openai_messages,
                "max_tokens": 1024,
                "temperature": 0.4,
            },
        )

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid Groq API key.")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Groq rate limit reached.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq API error: {response.status_code}")

    data = response.json()
    reply = data["choices"][0]["message"]["content"]
    return reply, data.get("model", "groq/compound-mini")


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(body: ChatRequest):
    """Send messages to Gemini (primary) or Groq (fallback) and return the reply."""

    # Temporary poor-man's function calling injection for Docker images test
    last_msg = body.messages[-1].content.lower()
    print(f"DEBUG AI: last_msg is {last_msg}")
    print(f"DEBUG AI: context is {body.context}")
    if "docker images" in last_msg or "how many images" in last_msg:
        if body.context and body.context.server_id:
            from app.api.v1.ai_tools import get_docker_image_summary
            import json
            try:
                print(f"DEBUG AI: calling get_docker_image_summary for {body.context.server_id}")
                res = await get_docker_image_summary(body.context.server_id)
                print(f"DEBUG AI: result is {res}")
                injection = f"\n\n[SYSTEM TOOL RESULT: get_docker_image_summary({body.context.server_id}) returned: {json.dumps(res)}]"
                body.messages[-1].content += injection
            except Exception as e:
                print(f"DEBUG AI: error in tool call: {e}")
                body.messages[-1].content += f"\n\n[SYSTEM TOOL ERROR: {str(e)}]"
        else:
            print("DEBUG AI: no context or server_id provided")

    try:
        # --- Primary: Gemini ---
        if settings.GEMINI_API_KEY:
            try:
                reply, model = await _call_gemini(body.messages)
                return ChatResponse(reply=reply, model=model)
            except HTTPException as e:
                # Fall through to Groq on rate-limit; re-raise other errors
                if e.status_code != 429:
                    raise

        # --- Fallback: Groq ---
        if settings.GROQ_API_KEY:
            reply, model = await _call_groq(body.messages)
            return ChatResponse(reply=reply, model=model)

        raise HTTPException(
            status_code=503,
            detail="No AI API key configured. Set GEMINI_API_KEY or GROQ_API_KEY in .env"
        )

    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out. Please try again.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Network error reaching AI provider: {str(e)}")
