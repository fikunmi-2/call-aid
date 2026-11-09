-- Only content-free admission state in milestone 1. No transcripts or case data.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.demo_sessions (
 id uuid primary key, room_name text unique not null, participant_identity text not null,
 receipt_hash text, network_bucket text, browser_bucket text,
 status text not null default 'reserved' check(status in ('reserved','active','aborted','failed','expired')),
 created_at timestamptz not null default now(), started_at timestamptz, ended_at timestamptz,
 expires_at timestamptz not null, call_seconds integer not null check(call_seconds between 1 and 600),
 reserved_seconds integer not null check(reserved_seconds>0), reserved_cost_units integer not null check(reserved_cost_units>0)
);
alter table private.demo_sessions enable row level security;
revoke all on private.demo_sessions from public, anon, authenticated;
create index demo_session_created on private.demo_sessions(created_at);
create index demo_session_active on private.demo_sessions(expires_at) where status in ('reserved','active');

create or replace function public.reserve_demo_session(p_id uuid,p_room text,p_identity text,p_receipt text,p_network text,p_browser text,p_call_seconds integer,p_concurrency integer,p_rate integer,p_daily integer,p_global_daily integer,p_daily_seconds integer,p_monthly_budget integer,p_cost integer)
-- NULL cumulative thresholds mean unlimited. Only trusted service_role can call
-- this RPC; the web backend permits NULL thresholds only in localhost next dev.
-- This documents existing SQL NULL behavior; no database migration is required.
returns jsonb language plpgsql security definer set search_path='' as $$
declare n timestamptz:=now(); deadline timestamptz; d integer; r integer; g integer; seconds_used bigint; cost_used bigint;
begin
 if least(p_call_seconds,p_concurrency,p_rate,p_daily,p_global_daily,p_daily_seconds,p_monthly_budget,p_cost)<1 or p_call_seconds>600 or p_concurrency>5 then raise exception 'invalid limits'; end if;
 -- Serialize all reservations across Vercel instances. Never refund reservations on client failures.
 perform pg_advisory_xact_lock(83140721);
 update private.demo_sessions set status='expired',ended_at=n where status in ('reserved','active') and expires_at<=n;
 if (select count(*) from private.demo_sessions where status in ('reserved','active') and expires_at>n)>=p_concurrency then return jsonb_build_object('allowed',false,'reason','busy'); end if;
 if exists(select 1 from private.demo_sessions where browser_bucket=p_browser and status in ('reserved','active') and expires_at>n) then return jsonb_build_object('allowed',false,'reason','busy'); end if;
 select count(*) filter(where created_at>n-interval '10 minutes'),count(*) into r,d from private.demo_sessions where created_at>n-interval '24 hours' and (network_bucket=p_network or browser_bucket=p_browser);
 select count(*),coalesce(sum(reserved_seconds),0) into g,seconds_used from private.demo_sessions where created_at>=date_trunc('day',n at time zone 'UTC') at time zone 'UTC';
 select coalesce(sum(reserved_cost_units),0) into cost_used from private.demo_sessions where created_at>=date_trunc('month',n at time zone 'UTC') at time zone 'UTC';
 if r>=p_rate or d>=p_daily or g>=p_global_daily or seconds_used+p_call_seconds>p_daily_seconds or cost_used+p_cost>p_monthly_budget then return jsonb_build_object('allowed',false,'reason','limit'); end if;
 deadline:=n+make_interval(secs=>p_call_seconds+60);
 insert into private.demo_sessions(id,room_name,participant_identity,receipt_hash,network_bucket,browser_bucket,expires_at,call_seconds,reserved_seconds,reserved_cost_units) values(p_id,p_room,p_identity,p_receipt,p_network,p_browser,deadline,p_call_seconds,p_call_seconds,p_cost);
 return jsonb_build_object('allowed',true,'expires_at',deadline);
end $$;

create or replace function public.claim_demo_session(p_room text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.demo_sessions;
begin
 update private.demo_sessions set status='active',started_at=now() where room_name=p_room and status='reserved' and expires_at>now() returning * into s;
 if s.id is null then return null; end if;
 return jsonb_build_object('identity',s.participant_identity,'expires_at',s.expires_at,'call_seconds',s.call_seconds);
end $$;
create or replace function public.finish_demo_session(p_room text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('aborted','failed','expired') then raise exception 'invalid status'; end if;
 update private.demo_sessions set status=p_status,ended_at=now() where room_name=p_room and status in ('reserved','active');
end $$;
create or replace function public.demo_session_receipt(p_receipt text)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('room_name',room_name,'status',case when expires_at<now() and status in ('reserved','active') then 'expired' else status end) from private.demo_sessions where receipt_hash=p_receipt and created_at>now()-interval '10 minutes' limit 1
$$;
-- RPCs are reachable through PostgREST but executable only by a trusted backend.
revoke all on function public.reserve_demo_session(uuid,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.claim_demo_session(text),public.finish_demo_session(text,text),public.demo_session_receipt(text) from public,anon,authenticated;
grant execute on function public.reserve_demo_session(uuid,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer),public.claim_demo_session(text),public.finish_demo_session(text,text),public.demo_session_receipt(text) to service_role;
