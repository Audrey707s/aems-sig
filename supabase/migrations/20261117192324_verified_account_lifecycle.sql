begin;
alter table public.profiles add column if not exists email_verified_at timestamptz;
-- Only Auth owns verification status. Preserve all existing business records.
update public.profiles p set email_verified_at=u.email_confirmed_at from auth.users u where u.id=p.id;
create or replace function aems_internal.check_organization() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.manager_id is null then return null; end if;
 -- Auth confirmation/email synchronization cannot alter organization relationships.
 if tg_op='UPDATE' and (new.role,new.account_level,new.manager_id,new.is_active) is not distinct from (old.role,old.account_level,old.manager_id,old.is_active) then return null; end if;
 if exists(select 1 from public.profiles p left join public.profiles m on m.id=p.manager_id where p.is_active and p.manager_id is not null and (p.account_level<>'STAFF' or m.account_level<>'MANAGER' or not m.is_active or p.role is distinct from m.role or p.id=m.id)) then
  raise exception 'Atasan harus Manajer aktif pada bagian yang sama' using errcode='23514';
 end if;
 return null;
end; $$;
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is null then return new; end if;
 insert into public.profiles(id,email,full_name,role,is_active,email_verified_at)
 values(new.id,coalesce(new.email,''),coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),split_part(coalesce(new.email,'Pengguna'),'@',1)),null,true,new.email_confirmed_at)
 on conflict(id) do update set email_verified_at=excluded.email_verified_at,email=excluded.email
 where (public.profiles.email_verified_at,public.profiles.email) is distinct from (excluded.email_verified_at,excluded.email);
 return new;
end; $$;
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;
create trigger on_auth_user_verified after update of email,email_confirmed_at on auth.users for each row when (new.email_confirmed_at is not null) execute function public.handle_new_auth_user();

create table public.account_notification_outbox (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id),
 profile_updated_at timestamptz not null,
 recipient text not null,
 full_name text not null,
 role text not null,
 account_level text not null,
 manager_name text,
 status text not null default 'PENDING' check(status in ('PENDING','SENDING','SENT','FAILED','CANCELLED')),
 attempts integer not null default 0,
 lease_id uuid,
 attempted_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 unique(profile_id,profile_updated_at)
);
alter table public.account_notification_outbox enable row level security;
revoke all on public.account_notification_outbox from public,anon,authenticated;
grant select,insert,update on public.account_notification_outbox to service_role;
create index account_notification_profile_idx on public.account_notification_outbox(profile_id,created_at desc);
-- Runs inside the same service-only transaction that saves the assignment.
create function aems_internal.enqueue_account_notification() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.role is not null and new.is_active and
  (new.role,new.account_level,new.manager_id,new.is_active) is distinct from (old.role,old.account_level,old.manager_id,old.is_active) then
  if new.email_verified_at is null then raise exception 'Email harus diverifikasi sebelum penetapan akun' using errcode='23514'; end if;
  if new.role::text<>'ADMIN' and new.account_level='STAFF' and new.manager_id is null then raise exception 'Staff harus memiliki Manajer aktif' using errcode='23514'; end if;
  update public.account_notification_outbox set status='CANCELLED' where profile_id=new.id and status in ('PENDING','FAILED');
  insert into public.account_notification_outbox(profile_id,profile_updated_at,recipient,full_name,role,account_level,manager_name)
  values(new.id,new.updated_at,new.email,new.full_name,new.role::text,new.account_level,(select full_name from public.profiles where id=new.manager_id)) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function aems_internal.enqueue_account_notification() from public,anon,authenticated;
grant execute on function aems_internal.enqueue_account_notification() to service_role;
create trigger enqueue_account_notification after update on public.profiles for each row execute function aems_internal.enqueue_account_notification();

create function public.aems_claim_account_notification(p_profile_id uuid) returns setof public.account_notification_outbox
language sql security invoker set search_path='' as $$
 update public.account_notification_outbox n set status='SENDING',attempts=n.attempts+1,attempted_at=now(),lease_id=gen_random_uuid()
 where n.id=(select o.id from public.account_notification_outbox o join public.profiles p on p.id=o.profile_id
 where o.profile_id=p_profile_id and p.is_active and p.email_verified_at is not null and p.role::text=o.role and p.account_level=o.account_level
 and p.email=o.recipient and coalesce((select m.full_name from public.profiles m where m.id=p.manager_id),'')=coalesce(o.manager_name,'')
 and (o.status in ('PENDING','FAILED') or (o.status='SENDING' and o.attempted_at<now()-interval '5 minutes'))
 order by o.created_at desc limit 1 for update of o skip locked) returning n.*;
$$;
revoke all on function public.aems_claim_account_notification(uuid) from public,anon,authenticated;
grant execute on function public.aems_claim_account_notification(uuid) to service_role;
alter policy profiles_read on public.profiles using ((select auth.uid())=id or (email_verified_at is not null and (select public.auth_role()) is not null));
notify pgrst,'reload schema';
commit;
