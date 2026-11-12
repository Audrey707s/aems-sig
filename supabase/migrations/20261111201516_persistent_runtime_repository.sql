-- Request-scoped normalized Postgres repository for all AEMS API operations.
-- Additive migration. Existing master data, auth accounts, and ledgers are preserved.
begin;
create schema if not exists aems_internal;
revoke all on schema aems_internal from public, anon, authenticated;
grant usage on schema aems_internal to service_role;
create table if not exists aems_internal.revision (
  id boolean primary key default true check (id),
  version bigint not null default 0
);
insert into aems_internal.revision(id) values(true) on conflict do nothing;
alter table aems_internal.revision enable row level security;
revoke all on aems_internal.revision from public, anon, authenticated;
grant select, update on aems_internal.revision to service_role;

-- Snapshot labels keep historical descriptions stable when master names change.
alter table public.mapping_change_requests add column if not exists requester_name text;
alter table public.mapping_change_requests add column if not exists requester_role text;
alter table public.mapping_change_requests add column if not exists reviewer_name text;
alter table public.mapping_change_items add column if not exists equipment_no text;
alter table public.mapping_change_items add column if not exists equipment_name text;
alter table public.mapping_change_items add column if not exists from_parent_no text;
alter table public.mapping_change_items add column if not exists from_root_asset_no text;
alter table public.mapping_change_items add column if not exists to_parent_no text;
alter table public.mapping_change_items add column if not exists to_root_asset_no text;
alter table public.mapping_history add column if not exists equipment_no text;
alter table public.mapping_history add column if not exists equipment_name text;
alter table public.mapping_history add column if not exists request_code text;
alter table public.mapping_history add column if not exists from_parent_no text;
alter table public.mapping_history add column if not exists to_parent_no text;
alter table public.mapping_history add column if not exists from_asset_no text;
alter table public.mapping_history add column if not exists to_asset_no text;
alter table public.mapping_history add column if not exists actor_name text;
alter table public.mapping_history add column if not exists approver_name text;
alter table public.import_batches add column if not exists uploader_name text;
alter table public.import_batches add column if not exists uploader_role text;
alter table public.import_rows add column if not exists display_key text;
alter table public.audit_logs add column if not exists actor_name text;
alter table public.audit_logs add column if not exists entity_code text;
alter table public.reconciliation_findings add column if not exists entity_name text;
alter table public.reconciliation_findings add column if not exists resolver_name text;

-- Close the unprotected import-profile table exposed by the original migration.
alter table public.import_mapping_profiles enable row level security;
revoke all on public.import_mapping_profiles from anon;

-- Every writer, including dashboard edits, participates in the same database lock.
create or replace function aems_internal.bump_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('aems.persist.v1', 0));
  update aems_internal.revision set version = version + 1 where id;
  return null;
end;
$$;
revoke all on function aems_internal.bump_revision() from public, anon, authenticated;
grant execute on function aems_internal.bump_revision() to service_role;
drop trigger if exists aems_revision_trg on public.profiles;
create trigger aems_revision_trg before insert or update or delete on public.profiles
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.asset_categories;
create trigger aems_revision_trg before insert or update or delete on public.asset_categories
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.equipment_categories;
create trigger aems_revision_trg before insert or update or delete on public.equipment_categories
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.locations;
create trigger aems_revision_trg before insert or update or delete on public.locations
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.assets;
create trigger aems_revision_trg before insert or update or delete on public.assets
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.equipment;
create trigger aems_revision_trg before insert or update or delete on public.equipment
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.import_batches;
create trigger aems_revision_trg before insert or update or delete on public.import_batches
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.mapping_change_requests;
create trigger aems_revision_trg before insert or update or delete on public.mapping_change_requests
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.asset_equipment_mappings;
create trigger aems_revision_trg before insert or update or delete on public.asset_equipment_mappings
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.equipment_relationships;
create trigger aems_revision_trg before insert or update or delete on public.equipment_relationships
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.equipment_active_parent;
create trigger aems_revision_trg before insert or update or delete on public.equipment_active_parent
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.equipment_spec_items;
create trigger aems_revision_trg before insert or update or delete on public.equipment_spec_items
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.mapping_change_items;
create trigger aems_revision_trg before insert or update or delete on public.mapping_change_items
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.import_rows;
create trigger aems_revision_trg before insert or update or delete on public.import_rows
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.mapping_history;
create trigger aems_revision_trg before insert or update or delete on public.mapping_history
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.audit_logs;
create trigger aems_revision_trg before insert or update or delete on public.audit_logs
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.reconciliation_findings;
create trigger aems_revision_trg before insert or update or delete on public.reconciliation_findings
for each statement execute function aems_internal.bump_revision();
drop trigger if exists aems_revision_trg on public.app_settings;
create trigger aems_revision_trg before insert or update or delete on public.app_settings
for each statement execute function aems_internal.bump_revision();

-- One SQL statement gives one coherent MVCC snapshot, including the revision.
create or replace function public.aems_read_state() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('revision', (select version from aems_internal.revision where id),
    'tables', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.profiles r),
      'asset_categories', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.asset_categories r),
      'equipment_categories', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.equipment_categories r),
      'locations', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.locations r),
      'assets', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.assets r),
      'equipment', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.equipment r),
      'import_batches', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.import_batches r),
      'mapping_change_requests', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.mapping_change_requests r),
      'asset_equipment_mappings', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.asset_equipment_mappings r),
      'equipment_relationships', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.equipment_relationships r),
      'equipment_active_parent', (select coalesce(jsonb_agg(to_jsonb(r) order by equipment_id), '[]'::jsonb) from public.equipment_active_parent r),
      'equipment_spec_items', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.equipment_spec_items r),
      'mapping_change_items', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.mapping_change_items r),
      'import_rows', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.import_rows r),
      'mapping_history', (select coalesce(jsonb_agg(to_jsonb(r) order by occurred_at desc, id desc), '[]'::jsonb) from public.mapping_history r),
      'audit_logs', (select coalesce(jsonb_agg(to_jsonb(r) order by occurred_at desc, id desc), '[]'::jsonb) from public.audit_logs r),
      'reconciliation_findings', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.reconciliation_findings r),
      'app_settings', (select coalesce(jsonb_agg(to_jsonb(r) order by key), '[]'::jsonb) from public.app_settings r)
    ));
$$;
revoke all on function public.aems_read_state() from public, anon, authenticated;
grant execute on function public.aems_read_state() to service_role;

-- Apply only changed rows, with database types, constraints, and ledger triggers intact.
-- The revision comparison rejects stale writers across all Vercel instances.
create or replace function public.aems_apply_changes(p_revision bigint, p_changes jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v_table text;
  v_allowed text[] := ARRAY['profiles','asset_categories','equipment_categories','locations','assets','equipment','import_batches','mapping_change_requests','asset_equipment_mappings','equipment_relationships','equipment_active_parent','equipment_spec_items','mapping_change_items','import_rows','mapping_history','audit_logs','reconciliation_findings','app_settings'];
  v_key text;
  v_row jsonb;
  v_columns text;
  v_assignments text;
  v_exists boolean;
  v_current bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('aems.persist.v1', 0));
  select version into v_current from aems_internal.revision where id for update;
  if v_current is distinct from p_revision then
    raise exception 'AEMS_CONCURRENT_CHANGE' using errcode = '40001';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Invalid AEMS changes' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where not k = any(v_allowed)) then
    raise exception 'Unknown AEMS table' using errcode = '22023';
  end if;
  foreach v_table in array v_allowed loop
    if not p_changes ? v_table then continue; end if;
    v_key := case v_table when 'app_settings' then 'key' when 'equipment_active_parent' then 'equipment_id' else 'id' end;
    if jsonb_array_length(coalesce(p_changes->v_table->'remove','[]'::jsonb)) > 0 then
      if v_table <> 'equipment_active_parent' then raise exception 'Permanent delete forbidden'; end if;
      delete from public.equipment_active_parent
      where equipment_id in (select value::uuid from jsonb_array_elements_text(p_changes->v_table->'remove'));
    end if;
    -- Update existing rows before inserting new rows, so closed temporal slots are freed first.
    for v_row in select value from jsonb_array_elements(coalesce(p_changes->v_table->'upsert','[]'::jsonb)) loop
      if v_row->>v_key is null then raise exception 'Missing row identity'; end if;
      execute format('select exists(select 1 from public.%I where %I::text = $1)', v_table, v_key)
        into v_exists using v_row->>v_key;
      if not v_exists then continue; end if;
      if v_table in ('audit_logs','mapping_history') then raise exception 'Immutable ledger'; end if;
      select string_agg(format('%I = incoming.%I',a.attname,a.attname), ', ' order by a.attnum)
      into v_assignments from pg_attribute a
      where a.attrelid = format('public.%I',v_table)::regclass and a.attnum > 0 and not a.attisdropped
        and a.attgenerated = '' and a.attidentity = '' and a.attname <> v_key and v_row ? a.attname;
      if v_assignments is not null then
        execute format('update public.%I target set %s from jsonb_populate_record(null::public.%I, $1) incoming where target.%I = incoming.%I',v_table,v_assignments,v_table,v_key,v_key) using v_row;
      end if;
    end loop;
    for v_row in select value from jsonb_array_elements(coalesce(p_changes->v_table->'upsert','[]'::jsonb)) loop
      execute format('select exists(select 1 from public.%I where %I::text = $1)',v_table,v_key)
        into v_exists using v_row->>v_key;
      if v_exists then continue; end if;
      select string_agg(format('%I',a.attname), ', ' order by a.attnum)
      into v_columns from pg_attribute a
      where a.attrelid = format('public.%I',v_table)::regclass and a.attnum > 0 and not a.attisdropped
        and a.attgenerated = '' and v_row ? a.attname;
      execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_record(null::public.%I, $1)',v_table,v_columns,v_columns,v_table) using v_row;
    end loop;
  end loop;

  -- A single active parent must agree across both temporal relationship tables and slots.
  if exists (
    with links as (
      select equipment_id, 'ASSET'::text parent_kind, asset_id parent_id, id link_id from public.asset_equipment_mappings where valid_to is null
      union all
      select child_equipment_id, 'EQUIPMENT', parent_equipment_id, id from public.equipment_relationships where valid_to is null
    ) select 1 from links group by equipment_id having count(*) > 1
  ) then raise exception 'Multiple active parents' using errcode = '23505'; end if;
  if exists (
    with links as (
      select equipment_id, 'ASSET'::text parent_kind, asset_id parent_id, id link_id from public.asset_equipment_mappings where valid_to is null
      union all
      select child_equipment_id, 'EQUIPMENT', parent_equipment_id, id from public.equipment_relationships where valid_to is null
    ) select 1 from links l full join public.equipment_active_parent p using(equipment_id)
      where l.parent_kind is distinct from p.parent_kind or l.parent_id is distinct from p.parent_id or l.link_id is distinct from p.link_id
  ) then raise exception 'Inconsistent active parent'; end if;

  if p_changes ? 'audit_logs' then
    perform setval(pg_get_serial_sequence('public.audit_logs','id'), greatest(coalesce((select max(id) from public.audit_logs),1),1), true);
  end if;
  return (select version from aems_internal.revision where id);
end;
$$;
revoke all on function public.aems_apply_changes(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.aems_apply_changes(bigint,jsonb) to service_role;

-- All application mutations run through the validated server unit of work, never direct browser DML.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to service_role;
revoke insert, update, delete, truncate on public.asset_categories from anon, authenticated;
grant select, insert, update, delete on public.asset_categories to service_role;
revoke insert, update, delete, truncate on public.equipment_categories from anon, authenticated;
grant select, insert, update, delete on public.equipment_categories to service_role;
revoke insert, update, delete, truncate on public.locations from anon, authenticated;
grant select, insert, update, delete on public.locations to service_role;
revoke insert, update, delete, truncate on public.assets from anon, authenticated;
grant select, insert, update, delete on public.assets to service_role;
revoke insert, update, delete, truncate on public.equipment from anon, authenticated;
grant select, insert, update, delete on public.equipment to service_role;
revoke insert, update, delete, truncate on public.import_batches from anon, authenticated;
grant select, insert, update, delete on public.import_batches to service_role;
revoke insert, update, delete, truncate on public.mapping_change_requests from anon, authenticated;
grant select, insert, update, delete on public.mapping_change_requests to service_role;
revoke insert, update, delete, truncate on public.asset_equipment_mappings from anon, authenticated;
grant select, insert, update, delete on public.asset_equipment_mappings to service_role;
revoke insert, update, delete, truncate on public.equipment_relationships from anon, authenticated;
grant select, insert, update, delete on public.equipment_relationships to service_role;
revoke insert, update, delete, truncate on public.equipment_active_parent from anon, authenticated;
grant select, insert, update, delete on public.equipment_active_parent to service_role;
revoke insert, update, delete, truncate on public.equipment_spec_items from anon, authenticated;
grant select, insert, update, delete on public.equipment_spec_items to service_role;
revoke insert, update, delete, truncate on public.mapping_change_items from anon, authenticated;
grant select, insert, update, delete on public.mapping_change_items to service_role;
revoke insert, update, delete, truncate on public.import_rows from anon, authenticated;
grant select, insert, update, delete on public.import_rows to service_role;
revoke insert, update, delete, truncate on public.mapping_history from anon, authenticated;
grant select, insert, update, delete on public.mapping_history to service_role;
revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated;
grant select, insert, update, delete on public.audit_logs to service_role;
revoke insert, update, delete, truncate on public.reconciliation_findings from anon, authenticated;
grant select, insert, update, delete on public.reconciliation_findings to service_role;
revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;
grant select, insert, update, delete on public.app_settings to service_role;
grant usage, select on all sequences in schema public to service_role;
notify pgrst, 'reload schema';
commit;
