-- Pasted transcripts: a job may carry the user's own transcript instead of, or alongside, a URL.
alter table public.jobs
  drop constraint jobs_type_check,
  add constraint jobs_type_check check (type in ('youtube', 'article', 'transcript'));

alter table public.jobs
  add column transcript text check (transcript is null or length(transcript) <= 500000),
  add column title text;
