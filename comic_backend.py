"""
Narratoons — Comic Panel Generator Backend
==========================================
FastAPI server that generates comic panels via Stability AI.

Run with:
    python -m uvicorn comic_backend:app --reload

Health check:
    http://127.0.0.1:8000/health

API docs:
    http://127.0.0.1:8000/docs
"""

import os
import re
import requests
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# ── Load .env ───────────────────────────────────────────────
load_dotenv()

STABILITY_API_KEY = os.getenv("STABILITY_API_KEY")
if not STABILITY_API_KEY:
    raise ValueError(
        "\n❌ STABILITY_API_KEY not found!\n"
        "Create a .env file in this folder:\n"
        "  STABILITY_API_KEY=sk-your-key-here\n"
        "Get a free key at: https://platform.stability.ai/\n"
    )

# ── App ─────────────────────────────────────────────────────
app = FastAPI(title="Narratoons API", version="1.0.0")

# CORS — allows the browser HTML page to call this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null"],   # "null" covers file:// opened HTML files
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Sanitize Input ──────────────────────────────────────────
def sanitize_prompt(prompt: str) -> str:
    """Strip dangerous characters and enforce length limit."""
    if not prompt or not isinstance(prompt, str):
        raise HTTPException(status_code=400, detail="Prompt must be a non-empty string.")
    cleaned = re.sub(r'[<>{}[\]\\]', '', prompt).strip()
    if len(cleaned) > 500:
        raise HTTPException(status_code=400, detail="Prompt must be under 500 characters.")
    return cleaned


# ── Call Stability AI ───────────────────────────────────────
def generate_image(prompt: str, style: str, width: int = 1024, height: int = 1024) -> str:
    """
    Call Stability AI SDXL and return base64 PNG string.

    Allowed SDXL dimensions:
        1024×1024  1152×896  1216×832  1344×768  1536×640
        640×1536   768×1344  832×1216  896×1152
    """
    engine = "stable-diffusion-xl-1024-v1-0"
    url    = f"https://api.stability.ai/v1/generation/{engine}/text-to-image"

    payload = {
        "text_prompts": [{"text": f"{prompt}, {style} comic style"}],
        "cfg_scale": 7,
        "height":    height,
        "width":     width,
        "samples":   1,
        "steps":     30,
    }

    try:
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {STABILITY_API_KEY}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["artifacts"][0]["base64"]

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Stability AI timed out. Try again.")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Stability AI error: {e}")


# ── CORS Preflight ──────────────────────────────────────────
@app.options("/generate-comic")
async def options_handler():
    return JSONResponse(content={}, headers={
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })


# ── Main Endpoint ───────────────────────────────────────────
@app.post("/generate-comic")
async def generate_comic(request: Request):
    """
    POST /generate-comic

    Body:
        prompt     (str)   — scene description
        style      (str)   — Japanese | American | Egyptian
        grid_type  (int)   — 0 | 1 | 2
        num_panels (int)   — 1–4

    Returns:
        { "images": ["data:image/png;base64,...", ...] }
    """
    try:
        body       = await request.json()
        prompt     = sanitize_prompt(body.get("prompt", ""))
        style      = body.get("style", "Japanese")
        grid_type  = int(body.get("grid_type", 0))
        num_panels = int(body.get("num_panels", 4))
        panel_sizes = body.get("panel_sizes", [])

        if grid_type not in [0, 1, 2]:
            raise HTTPException(status_code=400, detail="grid_type must be 0, 1, or 2.")
        if not (1 <= num_panels <= 4):
            raise HTTPException(status_code=400, detail="num_panels must be 1–4.")

        allowed = {
            (1024,1024),(1152,896),(1216,832),(1344,768),(1536,640),
            (640,1536),(768,1344),(832,1216),(896,1152)
        }

        images = []
        for i in range(num_panels):
            w = int(panel_sizes[i].get("width",  1024)) if i < len(panel_sizes) else 1024
            h = int(panel_sizes[i].get("height", 1024)) if i < len(panel_sizes) else 1024
            if (w, h) not in allowed:
                w, h = 1024, 1024

            print(f"  Panel {i+1}/{num_panels}: {w}×{h}, style={style}")
            b64 = generate_image(prompt, style, w, h)
            images.append(f"data:image/png;base64,{b64}")

        return {"images": images}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


# ── Utility Endpoints ───────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "app": "Narratoons", "api_key_loaded": bool(STABILITY_API_KEY)}

@app.get("/")
def root():
    return {
        "app": "Narratoons API",
        "docs": "http://127.0.0.1:8000/docs",
        "endpoints": {
            "POST /generate-comic": "Generate comic panels",
            "GET  /health":         "Health check",
        }
    }
