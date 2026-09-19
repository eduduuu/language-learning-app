import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Context Reader API"
    ENVIRONMENT: str = "development"
    
    # Supabase Credentials
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Used for backend operations bypassing RLS safely
    
    # LLM Provider Configuration
    DEFAULT_LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: str
    GEMINI_API_KEY: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()