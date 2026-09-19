from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

from routers.epub_router import router as epub_router
from routers.vocabulary_router import router as vocab_router
from routers.quiz_router import router as quiz_router
from routers.analytics_router import router as analytics_router
from routers.dictionary_router import router as dictionary_router
from routers.bsky_router import router as bsky_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
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

@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "llm_provider": settings.DEFAULT_LLM_PROVIDER,
    }