from pipeline.state import GraphState

def test_graph_state_can_hold_a_job():
    state: GraphState = {"job_id": "job", "owner_id": "owner", "url": "https://example.com", "source_type": "article", "depth": "detailed"}
    assert state["source_type"] == "article"
