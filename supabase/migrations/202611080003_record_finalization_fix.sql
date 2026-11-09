-- Correct finalization insert and include all simulated markers in dashboard counts.
begin;
create or replace function public.finalize_demo_record(p_room text,p_payload jsonb,p_decision text,p_reason text default null)
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
 insert into private.sbar_records(id,session_id,status,public_payload) values((payload->>'case_id')::uuid,s.id,payload->>'status',payload);
 update private.demo_sessions set status=payload->>'status',ended_at=coalesce(ended_at,now()),publication_status='published',failure_code=null where id=s.id;
 return jsonb_build_object('publication','published','record',payload);
end $$;

create or replace function public.read_demo_records(p_id uuid default null,p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; stats jsonb;
begin
 if p_offset<0 or p_offset>1000 or p_limit<1 or p_limit>20 then raise exception 'invalid page'; end if;
 select jsonb_build_object('total',count(*),'completed',count(*) filter(where status='completed'),
 'incomplete',count(*) filter(where status='incomplete'),'flagged',count(*) filter(where jsonb_array_length(public_payload#>'{assessment,simulated_flags}')>0)) into stats
 from private.sbar_records where expires_at>now();
 select coalesce(jsonb_agg(public_payload order by published_at desc,id),'[]'::jsonb) into result from (
 select public_payload,published_at,id from private.sbar_records where expires_at>now() and (p_id is null or id=p_id)
 order by published_at desc,id offset p_offset limit p_limit) page;
 return jsonb_build_object('records',result,'stats',stats);
end $$;

revoke all on function public.finalize_demo_record(text,jsonb,text,text),public.read_demo_records(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.finalize_demo_record(text,jsonb,text,text),public.read_demo_records(uuid,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
