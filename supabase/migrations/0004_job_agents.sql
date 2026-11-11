-- Per-agent selection: the user picks which agents a job runs (essential notes,
-- interview Q&A, or both). Default keeps legacy rows running every agent.
alter table public.jobs
  add column agents text[] not null default '{essential_notes,interview_qa}',
  add constraint jobs_agents_non_empty_subset check (
    array_length(agents, 1) between 1 and 2
    and agents <@ array['essential_notes', 'interview_qa']::text[]
  );
