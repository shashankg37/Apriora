from datetime import datetime, timezone
from typing import Any

from supabase import create_client

from config import settings


class SupabaseClient:
    """Service-role access to job state, results, and the pgmq note-jobs queue."""

    def __init__(self) -> None:
        self.client = create_client(settings.supabase_url, settings.supabase_service_key)

    @staticmethod
    def now() -> str: return datetime.now(timezone.utc).isoformat()

    def fetch_job(self, job_id: str) -> dict[str, Any] | None:
        response = self.client.table("jobs").select("*").eq("id", job_id).single().execute()
        return response.data

    def update_stage(self, job_id: str, stage: str, progress: int) -> None:
        self.client.table("jobs").update({"status": "processing", "stage": stage, "progress": progress, "updated_at": self.now()}).eq("id", job_id).execute()

    def merge(self, job_id: str, fields: dict[str, Any]) -> None:
        self.client.table("jobs").update({**fields, "updated_at": self.now()}).eq("id", job_id).execute()

    def fail(self, job_id: str, error: Exception) -> None:
        self.client.table("jobs").update({"status": "failed", "stage": "failed", "error": str(error)[:500], "updated_at": self.now()}).eq("id", job_id).execute()

    def save_result(self, state: dict[str, Any]) -> None:
        title = state.get("title") or (state["transcript"].title if state.get("transcript") else "Untitled")
        source = self.client.table("sources").insert({"owner_id": state["owner_id"], "url": state["url"], "type": state["source_type"], "title": title, "fetched_at": self.now()}).select("id").single().execute()
        note = self.client.table("notes").insert({
            "owner_id": state["owner_id"], "source_id": source.data["id"], "depth": state["depth"], "markdown": state["markdown"],
            "essential_notes": state["essential_notes"], "interview_qa": state["interview_qa"], "model": settings.groq_model,
            "flags": state.get("flags", []), "tags": [],
        }).select("id").single().execute()
        self.client.table("jobs").update({"status": "completed", "stage": "completed", "progress": 100, "source_id": source.data["id"], "note_id": note.data["id"], "updated_at": self.now()}).eq("id", state["job_id"]).execute()

    def dequeue(self, queue: str = "note-jobs", visibility_timeout: int = 60, limit: int = 1) -> list[dict[str, Any]]:
        """Read visible messages; each has msg_id, read_ct, and the message payload."""
        response = self.client.rpc("pgmq.read", {"queue_name": queue, "vt": visibility_timeout, "qty": limit}).execute()
        return response.data or []

    def ack(self, msg_id: int, queue: str = "note-jobs") -> None:
        self.client.rpc("pgmq.archive", {"queue_name": queue, "msg_id": msg_id}).execute()  # archived: stopped, inspectable

    def enqueue(self, job_id: str, queue: str = "note-jobs") -> None:
        self.client.rpc("enqueue_note_job", {"payload": {"jobId": job_id}}).execute()

    def create_job(self, owner_id: str, url: str, depth: str, source_type: str) -> str:
        response = self.client.table("jobs").insert({"owner_id": owner_id, "url": url, "type": source_type, "depth": depth}).select("id").single().execute()
        return response.data["id"]