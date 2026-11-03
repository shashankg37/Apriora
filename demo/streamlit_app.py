"""Local visual test harness for the transcript pipeline and two agents."""
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import streamlit as st
from dotenv import load_dotenv

WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"
load_dotenv(Path(__file__).resolve().with_name(".env"))
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from agents.essential_notes import essential_notes
from agents.interview_qa import interview_qa
from services.llm import LLM
from services.vector_store import TranscriptVectorStore
from transcription.pipeline import transcribe_resource
from transcription.state import TranscriptResource

st.set_page_config(page_title="IntervNotes Pipeline Demo", page_icon="📝", layout="wide")

def source_type(url: str) -> str:
    host = urlparse(url).hostname or ""
    return "youtube" if host == "youtu.be" or host.endswith("youtube.com") else "article"

async def run_pipeline(url: str, depth: str, status=None) -> tuple[TranscriptResource, str, str]:
    transcript = await transcribe_resource(url, source_type(url))
    if status:
        st.write(f"1/3 — Fetched transcript ({len(transcript.segments):,} segments · {len(transcript.full_text):,} characters).")
        st.write("2/3 — Chunking and indexing transcript in ChromaDB…")
    llm = LLM()
    # Single sandbox collection: rebuilt per run, disposed when finished.
    store = await asyncio.to_thread(lambda: TranscriptVectorStore.from_transcript(transcript, "demo"))
    try:
        if status: st.write("3/3 — Running Essential Notes and Interview Q&A agents in parallel (retrieval from the ChromaDB index)…")
        notes, qa = await asyncio.gather(
            essential_notes(transcript, depth, llm, store),
            interview_qa(transcript, llm, store),
        )
    finally:
        store.dispose()
    return transcript, notes, qa

st.title("IntervNotes — backend pipeline demo")
st.caption("Runs the real LangChain transcript pipeline, then lets the Essential Notes and Interview Q&A agents retrieve only the relevant transcript chunks from a ChromaDB index, in parallel.")

with st.sidebar:
    st.header("Local configuration")
    api_key = st.text_input("Groq API key", type="password", value=os.environ.get("GROQ_API_KEY", ""))
    model = st.text_input("Groq model", value=os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b"))
    st.info("The key is loaded from demo/.env and stays local; it is not written to any backend.")

with st.form("run-pipeline"):
    url = st.text_input("YouTube or article URL", value=os.environ.get("DEMO_TEST_URL", ""), placeholder="https://www.youtube.com/watch?v=...")
    depth = st.selectbox("Essential Notes depth", ["summary", "detailed", "interview"], index=0)
    submitted = st.form_submit_button("Run pipeline", type="primary")

if submitted:
    if not api_key:
        st.error("Enter a Groq API key to run the two agents.")
    elif not urlparse(url).scheme in {"http", "https"}:
        st.error("Enter a valid http(s) URL.")
    else:
        os.environ["GROQ_API_KEY"] = api_key
        os.environ["GROQ_MODEL"] = model
        try:
            with st.status("Running pipeline…", expanded=True) as status:
                transcript, notes, qa = asyncio.run(run_pipeline(url, depth, status))
                status.update(label="Pipeline complete", state="complete")
            st.session_state.update({"transcript": transcript, "notes": notes, "qa": qa})
        except Exception as exc:
            st.error("The pipeline could not complete. Transient Groq connection and rate-limit errors are retried automatically; please retry if the service remains unavailable.")
            with st.expander("Technical details"):
                st.code(str(exc))
                st.exception(exc)

if "transcript" in st.session_state:
    transcript: TranscriptResource = st.session_state["transcript"]
    notes, qa = st.session_state["notes"], st.session_state["qa"]
    st.success(f"Transcript ready: {len(transcript.segments):,} segments · {len(transcript.full_text):,} characters")
    transcript_tab, notes_tab, qa_tab = st.tabs(["Transcript", "Essential Notes", "Interview Q&A"])
    with transcript_tab:
        st.subheader(transcript.title)
        st.caption(transcript.url)
        st.text_area("Complete transcript resource", transcript.full_text, height=500)
        st.download_button("Download transcript (.txt)", transcript.full_text, file_name="transcript.txt", mime="text/plain")
    with notes_tab:
        st.markdown(notes)
        st.download_button("Download essential notes (.md)", notes, file_name="essential-notes.md", mime="text/markdown")
    with qa_tab:
        st.markdown(qa)
        st.download_button("Download interview Q&A (.md)", qa, file_name="interview-qa.md", mime="text/markdown")
