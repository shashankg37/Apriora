from agents.interview_qa import interview_qa as run_interview_qa
from pipeline.state import GraphState
from services.checkpointer import JobCheckpointer
from services.llm import LLM

async def interview_qa_agent(state: GraphState, checkpoint: JobCheckpointer, llm: LLM) -> GraphState:
    checkpoint.mark(state["job_id"], "interview Q&A", 45)
    return {"interview_qa": await run_interview_qa(state["transcript"], llm, state["store"])}
