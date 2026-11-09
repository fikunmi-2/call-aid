-- Additive milestone 3 migration. Existing admissions/reservations are retained.
begin;
alter table private.demo_sessions drop constraint demo_sessions_status_check;
alter table private.demo_sessions add constraint demo_sessions_status_check
 check(status in ('reserved','active','aborted','failed','expired','completed','incomplete'));
alter table private.demo_sessions add column publication_status text not null default 'pending'
 check(publication_status in ('pending','published','withheld','failed'));
alter table private.demo_sessions add column failure_code text
 check(failure_code in ('privacy_or_scope','not_final','insufficient_information','specific_combination','unsupported_context','validation_failed','save_unavailable'));

create table private.sbar_records (
 id uuid primary key,
 session_id uuid not null unique references private.demo_sessions(id),
 status text not null check(status in ('completed','incomplete')),
 public_payload jsonb not null,
 published_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 check(jsonb_typeof(public_payload)='object' and octet_length(public_payload::text)<=24000),
 check(public_payload->>'case_id'=id::text and public_payload->>'status'=status),
 check(public_payload->>'schema_version'='3.0' and public_payload->>'publication_policy_version'='public-1.0'),
 check(public_payload->>'publication'='published' and public_payload#>'{recommendation,record_saved}'='true'::jsonb),
 check(status<>'completed' or (public_payload->>'reviewed'='true' and public_payload#>'{assessment,missing_information}'='[]'::jsonb))
);
alter table private.sbar_records enable row level security;
revoke all on private.sbar_records from public,anon,authenticated,service_role;
create index sbar_recent on private.sbar_records(published_at desc,id);

create function public.finalize_demo_record(p_room text,p_payload jsonb,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.demo_sessions; r private.sbar_records; payload jsonb; stamp timestamptz; recommendation text;
begin
 if p_decision not in ('published','withheld','failed') then raise exception 'invalid decision'; end if;
 select * into s from private.demo_sessions where room_name=p_room for update;
 if s.id is null or s.started_at is null then raise exception 'unclaimed session'; end if;
 select * into r from private.sbar_records where session_id=s.id;
 -- Cleanup/failure events and uncertain-response retries never downgrade success.
 if r.id is not null and p_decision<>'published' then
  return jsonb_build_object('publication','published','record',r.public_payload);
 end if;
 if p_decision<>'published' then
  if s.publication_status='withheld' then return jsonb_build_object('publication','withheld'); end if;
  if now()>s.expires_at+interval '15 seconds' then raise exception 'finalization expired'; end if;
  if p_payload is not null or p_reason is null then raise exception 'invalid failure'; end if;
  update private.demo_sessions set publication_status=p_decision,failure_code=p_reason where id=s.id;
  return jsonb_build_object('publication',p_decision);
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>24000
  or p_payload - array['schema_version','workflow_version','rules_version','case_id','demonstration_label','started_on','generated_on','status','reviewed','not_for_medical_use','publication','situation','background','assessment','recommendation'] <> '{}'::jsonb
  or p_payload->>'schema_version' is distinct from '2.0'
  or p_payload->>'workflow_version' is distinct from 'intake-2.0'
  or p_payload->>'rules_version' is distinct from 'demo-rules-1.0'
  or p_payload->>'publication' is distinct from 'not_published'
  or p_payload#>'{recommendation,record_saved}' is distinct from 'false'::jsonb
  or p_payload->>'not_for_medical_use' is distinct from 'true'
  or p_payload->>'status' not in ('completed','incomplete')
  or jsonb_typeof(p_payload->'situation') is distinct from 'object'
  or jsonb_typeof(p_payload->'background') is distinct from 'object'
  or jsonb_typeof(p_payload->'assessment') is distinct from 'object'
  or jsonb_typeof(p_payload->'recommendation') is distinct from 'object'
 then raise exception 'invalid projection'; end if;
 if p_payload->>'demonstration_label' is distinct from 'Demo Case '||upper(left(p_payload->>'case_id',6)) then raise exception 'invalid label'; end if;
 stamp:=coalesce(r.published_at,now());
 recommendation:='The prototype generated and saved this demonstration report.'
  ||case when p_payload->>'reviewed'='true' then ' The caller reviewed it.' else ' It has not been confirmed by the caller.' end
  ||case when jsonb_array_length(p_payload#>'{assessment,missing_information}')>0 then ' Important information is incomplete.' else '' end
  ||' No clinical recommendation was made.';
 payload:=p_payload || jsonb_build_object('schema_version','3.0','publication_policy_version','public-1.0','publication','published',
  'started_on',(s.started_at at time zone 'America/Regina')::date::text,'generated_on',(stamp at time zone 'America/Regina')::date::text);
 payload:=jsonb_set(payload,'{recommendation,record_saved}','true'::jsonb);
 payload:=jsonb_set(payload,'{recommendation,text}',to_jsonb(recommendation));
 payload:=jsonb_set(payload,'{recommendation,actions}',(payload#>'{recommendation,actions}')||'"record_saved"'::jsonb);
 if r.id is not null then
  if r.public_payload<>payload then raise exception 'conflicting finalization'; end if;
  return jsonb_build_object('publication','published','record',r.public_payload);
 end if;
 if s.publication_status='withheld' or s.status='reserved' or now()>s.expires_at+interval '15 seconds' then raise exception 'finalization unavailable'; end if;
 insert into private.sbar_records(id,session_id,status,public_payload) values((payload->>'case_id')::uuid,s.id,payload);
 update private.demo_sessions set status=payload->>'status',ended_at=coalesce(ended_at,now()),publication_status='published',failure_code=null where id=s.id;
 return jsonb_build_object('publication','published','record',payload);
end $$;

create or replace function public.demo_session_receipt(p_receipt text)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('room_name',s.room_name,
 'status',case when s.expires_at<now() and s.status in ('reserved','active') then 'expired' else s.status end,
 'publication',case when r.id is not null then 'published'
  when s.publication_status='published' then 'unavailable'
  when s.publication_status='pending' and (now()>s.expires_at+interval '15 seconds' or s.ended_at<now()-interval '30 seconds') then 'failed'
  else s.publication_status end,
 'case_id',r.id,'case_status',r.status)
 from private.demo_sessions s left join private.sbar_records r on r.session_id=s.id and r.expires_at>now()
 where s.receipt_hash=p_receipt and s.created_at>now()-interval '20 minutes' limit 1
$$;

create function public.read_demo_records(p_id uuid default null,p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; stats jsonb;
begin
 if p_offset<0 or p_offset>1000 or p_limit<1 or p_limit>20 then raise exception 'invalid page'; end if;
 select jsonb_build_object('total',count(*),'completed',count(*) filter(where status='completed'),
 'incomplete',count(*) filter(where status='incomplete'),'flagged',count(*) filter(where exists(
 select 1 from jsonb_array_elements(public_payload#>'{assessment,simulated_flags}') f where f->>'code'<>'DEMO_INCOMPLETE'))) into stats
 from private.sbar_records where expires_at>now();
 select coalesce(jsonb_agg(public_payload order by published_at desc,id),'[]'::jsonb) into result from (
 select public_payload,published_at,id from private.sbar_records where expires_at>now() and (p_id is null or id=p_id)
 order by published_at desc,id offset p_offset limit p_limit) page;
 return jsonb_build_object('records',result,'stats',stats);
end $$;

create function public.cleanup_demo_records()
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.sbar_records where id in (select id from private.sbar_records where expires_at<=now() limit 500);
 update private.demo_sessions set receipt_hash=null,network_bucket=null,browser_bucket=null where id in (
 select id from private.demo_sessions where created_at<now()-interval '48 hours' and (receipt_hash is not null or network_bucket is not null or browser_bucket is not null) limit 500);
 delete from private.demo_sessions s where s.id in (select id from private.demo_sessions
 where created_at < date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'
 and now()>(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+interval '2 days' limit 500)
 and not exists(select 1 from private.sbar_records r where r.session_id=s.id);
end $$;

revoke all on function public.finalize_demo_record(text,jsonb,text,text),public.read_demo_records(uuid,integer,integer),public.cleanup_demo_records() from public,anon,authenticated;
grant execute on function public.finalize_demo_record(text,jsonb,text,text),public.read_demo_records(uuid,integer,integer),public.cleanup_demo_records() to service_role;
revoke all on function public.demo_session_receipt(text) from public,anon,authenticated;
grant execute on function public.demo_session_receipt(text) to service_role;
notify pgrst,'reload schema';
commit;
