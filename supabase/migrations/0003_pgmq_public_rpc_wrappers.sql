-- PostgREST RPCs can only call functions exposed in the db-schemas (public unless configured
-- otherwise), while the pgmq extension lives in its own schema. Thin security-definer wrappers
-- in public give the worker's service-role client access, and mirror the enqueue_note_job
-- pattern added in 0001. Param names match the worker's rpc() payloads exactly.

create or replace function public.pgmq_read(queue_name text, vt int, qty int)
returns setof pgmq.message_record
language sql security definer set search_path = public, pgmq as
$$ select * from pgmq.read(queue_name, vt, qty) $$;
grant execute on function public.pgmq_read(text, int, int) to service_role;

create or replace function public.pgmq_archive(queue_name text, msg_id bigint)
returns boolean
language sql security definer set search_path = public, pgmq as
$$ select * from pgmq.archive(queue_name, msg_id) $$;
grant execute on function public.pgmq_archive(text, bigint) to service_role;
