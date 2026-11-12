from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Bunmyaku API"
    ENVIRONMENT: str = "development"

    
    # Supabase Credentials
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Used for backend operations bypassing RLS safely
    
    # LLM Provider Configuration
    DEFAULT_LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: str
    GEMINI_API_KEY: str

    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()