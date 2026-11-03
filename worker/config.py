import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    groq_api_key: str = os.environ.get("GROQ_API_KEY", "")
    groq_model: str = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
    supabase_url: str = os.environ.get("SUPABASE_URL", "")
    supabase_service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


settings = Settings()