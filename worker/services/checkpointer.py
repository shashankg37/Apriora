from typing import Any

from services.supabase_client import SupabaseClient


class JobCheckpointer:
    """Records completed graph stages in the jobs table; large graph data stays out of Postgres."""
    def __init__(self, supabase_client: SupabaseClient) -> None: self.supabase = supabase_client
    def mark(self, job_id: str, stage: str, progress: int, metadata: dict[str, Any] | None = None) -> None:
        self.supabase.merge(job_id, {"checkpoint": {"stage": stage, "metadata": metadata or {}}})
        self.supabase.update_stage(job_id, stage, progress)