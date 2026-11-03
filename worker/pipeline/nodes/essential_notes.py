from agents.essential_notes import essential_notes as run_essential_notes
from pipeline.state import GraphState
from services.checkpointer import JobCheckpointer
from services.llm import LLM

async def essential_notes_agent(state: GraphState, checkpoint: JobCheckpointer, llm: LLM) -> GraphState:
    checkpoint.mark(state["job_id"], "essential notes", 45)
    return {"essential_notes": await run_essential_notes(state["transcript"], state["depth"], llm, state["store"])}
