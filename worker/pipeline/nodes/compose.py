from pipeline.state import GraphState
from services.checkpointer import JobCheckpointer

async def compose(state: GraphState, checkpoint: JobCheckpointer) -> GraphState:
    checkpoint.mark(state["job_id"], "composing notes", 90)
    transcript = state["transcript"]
    header = f"# {transcript.title}\n\nSource: {transcript.url}"
    if state.get("essential_notes"):
        header += f"\n\n## Essential Notes\n\n{state['essential_notes']}"
    if state.get("interview_qa"):
        header += f"\n\n## Interview Q&A\n\n{state['interview_qa']}"
    return {"markdown": header, "flags": []}
