import argparse
import asyncio
import uuid

from pipeline.graph import build_graph
from services.supabase_client import SupabaseClient
from services.vector_store import TranscriptVectorStore
from transcription.pipeline import transcribe_resource

async def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("url"); parser.add_argument("--depth", default="detailed", choices=["summary", "detailed", "interview"])
    args = parser.parse_args(); source_type = "youtube" if "youtu" in args.url else "article"
    client = SupabaseClient()
    # Local runs are seeded with a stable owner id; the service role key bypasses RLS.
    job_id = client.create_job(str(uuid.uuid5(uuid.NAMESPACE_URL, "local-cli")), args.url, args.depth, source_type)
    state = {"job_id": job_id, "owner_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "local-cli")), "url": args.url, "source_type": source_type, "depth": args.depth, "transcript": await transcribe_resource(args.url, source_type)}
    try:
        result = await build_graph(client).ainvoke(state); client.save_result(result); print(result["markdown"])
    finally:
        TranscriptVectorStore.drop(job_id)
if __name__ == "__main__": asyncio.run(main())