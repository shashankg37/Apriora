import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from pipeline.graph import build_graph
from pipeline.state import GraphState
from services.supabase_client import SupabaseClient
from services.vector_store import TranscriptVectorStore
from transcription.pipeline import transcribe_resource

MAX_ATTEMPTS = 5  # read_ct >= this archives the message and marks the job failed instead of redelivering

supabase = SupabaseClient()
pipeline = build_graph(supabase)


async def run_job(job_id: str, job: dict) -> None:
    state: GraphState = {"job_id": job_id, "owner_id": job["owner_id"], "url": job["url"], "source_type": job["type"], "depth": job["depth"]}
    try:
        supabase.update_stage(job_id, "transcribing resource", 15)
        state["transcript"] = await transcribe_resource(state["url"], state["source_type"])
        supabase.update_stage(job_id, "transcript ready", 30)
        result = await pipeline.ainvoke(state)
        supabase.save_result(result)
    except Exception as exc:
        supabase.fail(job_id, exc)
    finally:
        TranscriptVectorStore.drop(job_id)  # the process serves later jobs; never keep vectors for finished ones


async def poll_queue() -> None:
    while True:
        messages = supabase.dequeue()
        for message in messages:
            job_id = message["message"].get("jobId") if isinstance(message.get("message"), dict) else json.loads(message.get("message") or "{}").get("jobId")
            if not job_id:
                supabase.ack(message["msg_id"])
                continue
            job = supabase.fetch_job(job_id)
            if not job or job["status"] == "completed":
                supabase.ack(message["msg_id"])
                continue
            if message["read_ct"] >= MAX_ATTEMPTS:
                supabase.fail(job_id, RuntimeError(f"gave up after {message['read_ct']} delivery attempts"))
                supabase.ack(message["msg_id"])
                continue
            await run_job(job_id, job)
            supabase.ack(message["msg_id"])
        await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    poller = asyncio.create_task(poll_queue())
    yield
    poller.cancel()


app = FastAPI(title="IntervNotes pipeline", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict[str, str]: return {"status": "ok"}


@app.post("/process")
async def process(request: Request) -> dict[str, str]:
    """Manual one-shot trigger for local testing; production delivery is the pgmq poller."""
    payload = await request.json(); job_id = payload.get("jobId")
    job = supabase.fetch_job(job_id) if isinstance(job_id, str) else None
    if not job: return {"status": "job not found"}
    if job["status"] == "completed": return {"status": "already completed"}
    await run_job(job_id, job)
    return {"status": "completed"}
