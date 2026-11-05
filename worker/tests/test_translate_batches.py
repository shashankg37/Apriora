from transcription.translate import _batches

def test_batches_respect_char_and_item_caps():
    texts = ["x" * 900] * 5 + ["tiny"] * 50
    batches = _batches(texts)
    # 5 big segments: two per batch by chars; 50 tiny ones capped at 40 items per batch
    assert max(len(batch) for batch in batches) <= 40
    assert all(sum(len(text) for _, text in batch) <= 3_000 + max(len(text) for _, text in batch) for batch in batches)
    ordered = [index for batch in batches for index, _ in batch]
    assert ordered == list(range(len(texts)))  # contiguous and in order

def test_batches_cover_every_segment():
    texts = ["a", "b", "c"]
    batches = _batches(texts)
    assert [index for batch in batches for index, _ in batch] == [0, 1, 2]

def test_batches_empty_input():
    assert _batches([]) == []
