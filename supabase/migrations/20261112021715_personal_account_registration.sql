begin;
-- Every self-registration starts without business-data access; metadata cannot grant a role.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,full_name,role,is_active)
  values(new.id, coalesce(new.email,''), coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''), split_part(coalesce(new.email,'Pengguna'),'@',1)), null, true)
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Database enforcement complements the admin form and server validation.
create or replace function aems_internal.guard_last_admin()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_demotion boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('aems.persist.v1',0));
  if tg_op='DELETE' then v_demotion := true;
  else v_demotion := new.role is distinct from 'ADMIN'::public.app_role or not new.is_active; end if;
  if old.role = 'ADMIN' and old.is_active and v_demotion and
     (select count(*) from public.profiles where role='ADMIN' and is_active and id<>old.id) = 0 then
    raise exception 'Last active administrator must be retained' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function aems_internal.guard_last_admin() from public, anon, authenticated;
drop trigger if exists aems_last_admin_guard on public.profiles;
create trigger aems_last_admin_guard before update or delete on public.profiles for each row execute function aems_internal.guard_last_admin();
commit;
