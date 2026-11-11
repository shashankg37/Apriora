import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Worker runs from start commands like `python app.py` with the env dir relative to itself.
load_dotenv(Path(__file__).resolve().with_name(".env"))


@dataclass(frozen=True)
class Settings:
    groq_api_key: str = os.environ.get("GROQ_API_KEY", "")
    groq_model: str = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
    supabase_url: str = os.environ.get("SUPABASE_URL", "")
    supabase_service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


settings = Settings()