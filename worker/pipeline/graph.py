from langgraph.graph import END, START, StateGraph
from pipeline.nodes import compose, essential_notes, interview_qa, retrieval
from pipeline.state import GraphState
from services.checkpointer import JobCheckpointer
from services.supabase_client import SupabaseClient
from services.llm import LLM

# Canonical agent names, matching jobs.agents; jobs with no selection run everything.
ALL_AGENTS = ("essential_notes", "interview_qa")

def build_graph(supabase: SupabaseClient):
    checkpoint, llm = JobCheckpointer(supabase), LLM()
    builder = StateGraph(GraphState)
    async def index_node(state: GraphState):
        return await retrieval.prepare_retrieval(state, checkpoint)
    async def notes_node(state: GraphState):
        if "essential_notes" not in state.get("agents", ALL_AGENTS): return {}  # agent not selected
        return await essential_notes.essential_notes_agent(state, checkpoint, llm)
    async def qa_node(state: GraphState):
        if "interview_qa" not in state.get("agents", ALL_AGENTS): return {}  # agent not selected
        return await interview_qa.interview_qa_agent(state, checkpoint, llm)
    async def compose_node(state: GraphState):
        return await compose.compose(state, checkpoint)
    builder.add_node("prepare_retrieval", index_node)
    builder.add_node("essential_notes_agent", notes_node)
    builder.add_node("interview_qa_agent", qa_node)
    builder.add_node("compose", compose_node)
    # Retrieval is prepared once; selected agents then work over the same indexed chunks.
    builder.add_edge(START, "prepare_retrieval")
    builder.add_edge("prepare_retrieval", "essential_notes_agent")
    builder.add_edge("prepare_retrieval", "interview_qa_agent")
    builder.add_edge(["essential_notes_agent", "interview_qa_agent"], "compose")
    builder.add_edge("compose", END)
    return builder.compile()
