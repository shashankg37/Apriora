from pipeline.state import GraphState
from services.checkpointer import JobCheckpointer

async def compose(state: GraphState, checkpoint: JobCheckpointer) -> GraphState:
    checkpoint.mark(state["job_id"], "composing notes", 90)
    transcript = state["transcript"]
    return {"markdown": f"# {transcript.title}\n\nSource: {transcript.url}\n\n## Essential Notes\n\n{state['essential_notes']}\n\n## Interview Q&A\n\n{state['interview_qa']}", "flags": []}
