-- Preserve the existing capacity reservation while a confirmed result is spoken.
-- No table/schema/data replacement. Old post-disconnect finalization still works.
begin;
create function public.save_demo_record_for_closing(p_room text,p_payload jsonb,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare held boolean; result jsonb;
begin
 select status='active' into held from private.demo_sessions where room_name=p_room for update;
 result:=public.finalize_demo_record(p_room,p_payload,p_decision,p_reason);
 if held and result->>'publication'='published' then
  update private.demo_sessions set status='active',ended_at=null where room_name=p_room;
 end if;
 return result;
end $$;

create or replace function public.finish_demo_session(p_room text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('aborted','failed','expired') then raise exception 'invalid status'; end if;
 update private.demo_sessions s set status=coalesce((select r.status from private.sbar_records r where r.session_id=s.id),p_status),ended_at=now()
 where s.room_name=p_room and s.status in ('reserved','active');
end $$;

revoke all on function public.save_demo_record_for_closing(text,jsonb,text,text),public.finish_demo_session(text,text) from public,anon,authenticated;
grant execute on function public.save_demo_record_for_closing(text,jsonb,text,text),public.finish_demo_session(text,text) to service_role;
notify pgrst,'reload schema';
commit;
