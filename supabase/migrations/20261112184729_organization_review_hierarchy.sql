begin;
alter table public.profiles add column if not exists account_level text not null default 'STAFF' check(account_level in ('MANAGER','STAFF'));
alter table public.profiles add column if not exists manager_id uuid references public.profiles(id) on delete restrict;
alter table public.profiles add constraint aems_manager_not_self check(manager_id is null or manager_id<>id);
create index if not exists profiles_manager_id_idx on public.profiles(manager_id);
alter table public.mapping_change_requests add column if not exists approver_id uuid references public.profiles(id) on delete restrict;
create index if not exists mapping_requests_approver_idx on public.mapping_change_requests(approver_id,status);
create or replace function aems_internal.check_organization() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.profiles p left join public.profiles m on m.id=p.manager_id where p.is_active and p.manager_id is not null and (p.account_level<>'STAFF' or m.account_level<>'MANAGER' or not m.is_active or p.role is distinct from m.role or p.id=m.id)) then
   raise exception 'Atasan harus Manajer aktif pada bagian yang sama' using errcode='23514';
 end if;
 return null;
end;
$$;
revoke all on function aems_internal.check_organization() from public,anon,authenticated;
grant execute on function aems_internal.check_organization() to service_role;
create constraint trigger aems_org_integrity after insert or update on public.profiles deferrable initially deferred for each row execute function aems_internal.check_organization();
notify pgrst,'reload schema';
commit;
