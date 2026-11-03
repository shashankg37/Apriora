# Local pipeline demo

This is a local Streamlit test harness, not the product frontend. It bypasses the Supabase Edge Function, the pgmq queue, the worker service, and Postgres, but calls the production LangChain transcript pipeline and the same Essential Notes and Interview Q&A agent code.

```powershell
cd demo
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Set `GROQ_API_KEY=your-key` in `demo/.env`, then run:

```powershell
streamlit run streamlit_app.py
```

Paste a public YouTube or article URL, select note depth, and run it. The interface displays the complete transcript before the separate agent outputs, making grounding easy to inspect.

Long videos are automatically split at transcript boundaries. Both agents process every chunk and then consolidate their own output. On the current 7k input-tokens-per-minute Groq tier, the demo deliberately spaces requests when needed; a long video can therefore take several minutes rather than failing with a 413 request-too-large error.
