create or replace function aems_internal.check_organization() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 -- A newly inserted profile without a manager cannot invalidate another relationship.
 -- Deferred triggers run as Auth's caller at commit, outside the profile-creation definer.
 -- Avoid querying business profiles for this unassigned self-registration case.
 if tg_op='INSERT' and new.manager_id is null then
   return null;
 end if;
 if exists(select 1 from public.profiles p left join public.profiles m on m.id=p.manager_id where p.is_active and p.manager_id is not null and (p.account_level<>'STAFF' or m.account_level<>'MANAGER' or not m.is_active or p.role is distinct from m.role or p.id=m.id)) then
   raise exception 'Atasan harus Manajer aktif pada bagian yang sama' using errcode='23514';
 end if;
 return null;
end;
$$;
revoke all on function aems_internal.check_organization() from public,anon,authenticated;
grant execute on function aems_internal.check_organization() to service_role;