begin;
-- RPC persistence intentionally runs with an empty search_path. Every relation
-- referenced by its hierarchy trigger must therefore be schema-qualified.
create or replace function public.trg_er_no_cycle() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  -- Closing a historic relationship cannot introduce a cycle.
  if new.valid_to is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('aems.hierarchy'));
  if exists (
    with recursive sub as (
      select new.child_equipment_id as id,1 as lvl
      union all
      select r.child_equipment_id,sub.lvl+1
      from public.equipment_relationships r join sub on r.parent_equipment_id=sub.id
      where r.valid_to is null and sub.lvl<50
    ) select 1 from sub where id=new.parent_equipment_id
  ) then raise exception 'CYCLE_DETECTED' using errcode='AE001'; end if;
  return new;
end; $$;
revoke all on function public.trg_er_no_cycle() from public,anon,authenticated;
grant execute on function public.trg_er_no_cycle() to service_role;

-- Earlier submitted requests predate explicit departmental manager routing.
-- Route them to the requester's current valid manager without approving them.
with routed as (
 update public.mapping_change_requests r set approver_id=m.id
 from public.profiles s join public.profiles m on m.id=s.manager_id
 where r.requested_by=s.id and r.status='SUBMITTED' and r.approver_id is null
 and s.is_active and s.account_level='STAFF' and m.is_active
 and m.account_level='MANAGER' and m.role=s.role and m.id<>s.id
 and m.email_verified_at is not null
 returning r.id,r.request_code,r.approver_id
)
insert into public.audit_logs(entity_type,entity_id,entity_code,action,old_values,new_values,changed_fields,actor_name)
select 'MAPPING_REQUEST',id,request_code,'ASSIGN_LEGACY_APPROVER',jsonb_build_object('approver_id',null),jsonb_build_object('approver_id',approver_id),array['approver_id'],'Sistem' from routed;
notify pgrst,'reload schema';
commit;
