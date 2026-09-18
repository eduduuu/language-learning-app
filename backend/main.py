from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers.epub_router import router as epub_router
from routers.vocabulary_router import router as vocab_router
from routers.quiz_router import router as quiz_router
from routers.analytics_router import router as analytics_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register complete application routing suite
app.include_router(epub_router)
app.include_router(vocab_router)
app.include_router(quiz_router)
app.include_router(analytics_router)

@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "llm_provider": settings.DEFAULT_LLM_PROVIDER
    }