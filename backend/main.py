import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

from routers.epub_router import router as epub_router
from routers.vocabulary_router import router as vocab_router
from routers.quiz_router import router as quiz_router
from routers.analytics_router import router as analytics_router
from routers.dictionary_router import router as dictionary_router
from routers.bsky_router import router as bsky_router
from routers.reading_progress_router import router as reading_progress_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allowed origins for CORS (Localhost + Vercel + custom domains)
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

# Support custom frontend URLs passed via environment variables (e.g. FRONTEND_URL or ALLOWED_ORIGINS)
custom_origins = os.getenv("FRONTEND_URL") or os.getenv("ALLOWED_ORIGINS")
if custom_origins:
    for origin in custom_origins.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(epub_router)
app.include_router(vocab_router)
app.include_router(quiz_router)
app.include_router(analytics_router)
app.include_router(dictionary_router)
app.include_router(bsky_router)
app.include_router(reading_progress_router)

# Support both GET and HEAD for Render's health checks
@app.api_route("/", methods=["GET", "HEAD"], tags=["Health"])
@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "llm_provider": settings.DEFAULT_LLM_PROVIDER,
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)