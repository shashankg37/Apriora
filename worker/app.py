import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from pipeline.graph import ALL_AGENTS, build_graph
from pipeline.state import GraphState
from services.supabase_client import SupabaseClient
from services.vector_store import TranscriptVectorStore
from transcription.pipeline import transcribe_resource

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("worker")

MAX_ATTEMPTS = 5  # read_ct >= this archives the message and marks the job failed instead of redelivering

supabase = SupabaseClient()
pipeline = build_graph(supabase)


async def run_job(job_id: str, job: dict) -> None:
    state: GraphState = {"job_id": job_id, "owner_id": job["owner_id"], "url": job["url"], "source_type": job["type"], "depth": job["depth"], "agents": list(job.get("agents") or ALL_AGENTS)}
    if job.get("transcript"): state["custom_transcript"] = job["transcript"]  # user-pasted transcript acquisition path
    if job.get("title"): state["title"] = job["title"]
    logger.info("job %s picked up (type=%s, agents=%s)", job_id, job["type"], state["agents"])
    try:
        supabase.update_stage(job_id, "acquiring transcript" if state.get("custom_transcript") else "transcribing resource", 15)
        state["transcript"] = await transcribe_resource(state["url"], state["source_type"], state.get("custom_transcript"), state.get("title"))
        logger.info("job %s transcript ready (%d chars)", job_id, len(state["transcript"].full_text))
        supabase.update_stage(job_id, "transcript ready", 30)
        result = await pipeline.ainvoke(state)
        supabase.save_result(result)
        logger.info("job %s completed", job_id)
    except Exception as exc:
        logger.exception("job %s failed", job_id)
        supabase.fail(job_id, exc)
    finally:
        TranscriptVectorStore.drop(job_id)  # the process serves later jobs; never keep vectors for finished ones


async def poll_queue() -> None:
    while True:
        try:
            messages = supabase.dequeue()
            if messages:
                logger.info("dequeued %d message(s)", len(messages))
            for message in messages:
                job_id = message["message"].get("jobId") if isinstance(message.get("message"), dict) else json.loads(message.get("message") or "{}").get("jobId")
                if not job_id:
                    logger.warning("queue message %s has no jobId; archiving", message["msg_id"])
                    supabase.ack(message["msg_id"])
                    continue
                job = supabase.fetch_job(job_id)
                if not job or job["status"] == "completed":
                    logger.warning("job %s missing or already completed; archiving message", job_id)
                    supabase.ack(message["msg_id"])
                    continue
                if message["read_ct"] >= MAX_ATTEMPTS:
                    logger.error("job %s gave up after %d delivery attempts", job_id, message["read_ct"])
                    supabase.fail(job_id, RuntimeError(f"gave up after {message['read_ct']} delivery attempts"))
                    supabase.ack(message["msg_id"])
                    continue
                await run_job(job_id, job)
                supabase.ack(message["msg_id"])
        except Exception:
            logger.exception("queue poll failed; retrying in 3s")  # never let one error kill the poller
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
