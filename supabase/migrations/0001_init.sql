-- IntervNotes backend MVP: schema, RLS (port of firestore.rules), and job queue.

create extension if not exists pgmq;
select pgmq.create('note-jobs');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  url text not null,
  type text not null check (type in ('youtube', 'article')),
  depth text not null check (depth in ('summary', 'detailed', 'interview')),
  status text not null default 'queued',
  stage text not null default 'queued',
  progress int not null default 0,
  checkpoint jsonb,
  error text,
  source_id uuid,
  note_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  url text not null,
  type text not null,
  title text not null,
  fetched_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source_id uuid not null references public.sources(id) on delete cascade,
  depth text not null,
  markdown text not null,
  essential_notes text,
  interview_qa jsonb,
  model text not null,
  flags text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index notes_owner_created_idx on public.notes (owner_id, created_at desc);
create index jobs_owner_created_idx on public.jobs (owner_id, created_at desc);

-- RLS: client-side port of firestore.rules (own rows readable, nothing client-writable
-- except job creation; the worker uses the service role key and bypasses RLS).
alter table public.jobs enable row level security;
alter table public.sources enable row level security;
alter table public.notes enable row level security;

create policy "users create own jobs" on public.jobs
  for insert to authenticated with check (owner_id = auth.uid());
create policy "users read own jobs" on public.jobs
  for select to authenticated using (owner_id = auth.uid());
create policy "users read own sources" on public.sources
  for select to authenticated using (owner_id = auth.uid());
create policy "users read own notes" on public.notes
  for select to authenticated using (owner_id = auth.uid());

-- pgmq RPC access for the create-note Edge Function (enqueue) and the worker via the
-- service role key; anonymous and authenticated clients get nothing.
grant execute on all functions in schema pgmq to service_role;

create or replace function public.enqueue_note_job(payload jsonb)
returns void language sql security definer set search_path = public, pgmq as $$
  select pgmq.send('note-jobs', payload);
$$;
grant execute on function public.enqueue_note_job(jsonb) to service_role;