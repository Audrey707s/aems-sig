-- =============================================================================
-- AEMS (Asset & Equipment Management System)
-- Baseline: Blueprint R.02 (09-Nov-2026) & AGENTS.md
-- Migration: 0001_aems_schema_rls_rpc.sql
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- 1. Business Key Normalization Function (BR-ID-04)
create or replace function norm_key(t text) returns text
language sql immutable as $$
  select upper(regexp_replace(btrim(coalesce(t,'')), '\s+', '', 'g'))
$$;

-- 2. Enumerations (Bab 15.8)
do $$ begin
  create type app_role as enum ('ACCOUNTING', 'MAINTENANCE', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type equipment_kind as enum ('WHOLE_UNIT', 'COMPONENT', 'OTHER');
exception when duplicate_object then null; end $$;

-- 3. Reference & User Tables (Bab 14.3, 15.1, 15.7)
create table if not exists profiles (
  id             uuid primary key, -- matches auth.users.id
  email          text unique not null,
  full_name      text not null,
  role           app_role, -- null for newly created users until ADMIN assigns (BR-AC-06)
  is_active      boolean not null default true,
  department     text,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists asset_categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  parent_id  uuid references asset_categories(id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists equipment_categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  parent_id  uuid references equipment_categories(id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  parent_id  uuid references locations(id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- Seed default app_settings (A-03, A-04, A-05, A-08, A-09, Q-01..Q-10 configurable)
insert into app_settings(key, value) values
  ('hierarchy', '{"max_depth": 8, "require_approval_first_link": true, "maker_checker": true}'::jsonb),
  ('normalization', '{"pad_numeric_sap_asset": false, "sap_asset_pad_length": 12, "default_company_code": "MAIN", "default_sub_no": "0000", "default_source_system": "SAP_PM"}'::jsonb),
  ('imports', '{"max_file_mb": 10, "max_rows": 20000, "blank_overwrites": false}'::jsonb),
  ('security', '{"maintenance_can_view_financial_values": true, "audit_retention_years": 5}'::jsonb)
on conflict (key) do nothing;

-- 4. Master Assets Table (Bab 14.4, 15.2)
create table if not exists assets (
  id                 uuid primary key default gen_random_uuid(),
  company_code       text not null default 'MAIN',
  sap_asset_no       text not null,
  sap_sub_no         text not null default '0000',
  asset_key_norm     text generated always as (norm_key(sap_asset_no)) stored,
  name               text not null,
  description        text,
  asset_category_id  uuid references asset_categories(id),
  location_id        uuid references locations(id),
  cost_center        text,
  acquisition_date   date,
  acquisition_value  numeric(20,2),
  currency           char(3) not null default 'IDR',
  serial_no          text,
  manufacturer       text,
  model              text,
  status             text not null default 'ACTIVE'
                     check (status in ('ACTIVE','INACTIVE','DISPOSED')),
  attributes         jsonb not null default '{}'::jsonb,
  source_type        text not null default 'MANUAL',
  source_batch_id    uuid,
  row_version        integer not null default 1,
  created_at         timestamptz not null default now(),
  created_by         uuid references profiles(id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references profiles(id),
  deleted_at         timestamptz,
  deleted_by         uuid references profiles(id),
  delete_reason      text,
  constraint uq_assets_key unique (company_code, asset_key_norm, sap_sub_no)
);

-- 5. Master Equipment Table (Bab 14.4, 15.3)
create table if not exists equipment (
  id                    uuid primary key default gen_random_uuid(),
  source_system         text not null default 'SAP_PM',
  equipment_no          text not null,
  equipment_key_norm    text generated always as (norm_key(equipment_no)) stored,
  kind                  equipment_kind not null default 'OTHER',
  name                  text not null,
  specification         text,
  equipment_category_id uuid references equipment_categories(id),
  manufacturer          text,
  model                 text,
  serial_no             text,
  condition             text not null default 'BAIK'
                        check (condition in ('BAIK','RUSAK_RINGAN','RUSAK_BERAT','DALAM_PERBAIKAN','TIDAK_DIKETAHUI')),
  location_id           uuid references locations(id),
  install_date          date,
  status                text not null default 'ACTIVE'
                        check (status in ('ACTIVE','INACTIVE','RETIRED')),
  root_asset_id         uuid references assets(id),
  depth                 smallint not null default 0,
  path_ids              uuid[] not null default '{}',
  attributes            jsonb not null default '{}'::jsonb,
  source_type           text not null default 'MANUAL',
  source_batch_id       uuid,
  row_version           integer not null default 1,
  created_at            timestamptz not null default now(),
  created_by            uuid references profiles(id),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references profiles(id),
  deleted_at            timestamptz,
  deleted_by            uuid references profiles(id),
  delete_reason         text,
  constraint uq_equipment_key unique (source_system, equipment_key_norm)
);

-- 6. Temporal Relationships & Active Parent Slot (Bab 14.4, 14.6, 15.4, 15.5)
create table if not exists asset_equipment_mappings (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references assets(id) on delete restrict,
  equipment_id      uuid not null references equipment(id) on delete restrict,
  valid_from        timestamptz not null default now(),
  valid_to          timestamptz,
  end_reason        text,
  change_request_id uuid,
  created_by        uuid references profiles(id),
  ended_by          uuid references profiles(id),
  constraint ck_aem_period check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists uq_aem_active_equipment
  on asset_equipment_mappings(equipment_id) where valid_to is null;
create index if not exists ix_aem_active_asset
  on asset_equipment_mappings(asset_id) where valid_to is null;

create table if not exists equipment_relationships (
  id                  uuid primary key default gen_random_uuid(),
  parent_equipment_id uuid not null references equipment(id) on delete restrict,
  child_equipment_id  uuid not null references equipment(id) on delete restrict,
  valid_from          timestamptz not null default now(),
  valid_to            timestamptz,
  end_reason          text,
  change_request_id   uuid,
  created_by          uuid references profiles(id),
  ended_by            uuid references profiles(id),
  constraint ck_er_not_self check (parent_equipment_id <> child_equipment_id),
  constraint ck_er_period   check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists uq_er_active_child
  on equipment_relationships(child_equipment_id) where valid_to is null;
create index if not exists ix_er_active_parent
  on equipment_relationships(parent_equipment_id) where valid_to is null;

-- Single Active Parent Slot across both relationship tables (BR-HR-02, BR-HR-05)
create table if not exists equipment_active_parent (
  equipment_id uuid primary key references equipment(id) on delete cascade,
  parent_kind  text not null check (parent_kind in ('ASSET','EQUIPMENT')),
  parent_id    uuid not null,
  link_id      uuid not null
);

-- Unnumbered Specification Items (BR-ID-07, FR-EQP-08)
create table if not exists equipment_spec_items (
  id                    uuid primary key default gen_random_uuid(),
  asset_id              uuid references assets(id) on delete restrict,
  equipment_id          uuid references equipment(id) on delete restrict,
  spec_name             text not null,
  spec_value            text not null,
  spec_group            text,
  quantity              integer not null default 1,
  serial_no             text,
  promoted_equipment_id uuid references equipment(id) on delete restrict,
  promoted_at           timestamptz,
  promoted_by           uuid references profiles(id),
  created_at            timestamptz not null default now(),
  created_by            uuid references profiles(id),
  constraint ck_spec_owner check ((asset_id is not null and equipment_id is null) or (asset_id is null and equipment_id is not null))
);

-- 7. Mapping Requests & Immutable History (Bab 15.6)
create table if not exists mapping_change_requests (
  id            uuid primary key default gen_random_uuid(),
  request_code  text not null unique,
  request_type  text not null check (request_type in ('LINK','MOVE','UNLINK','BATCH')),
  status        text not null default 'SUBMITTED'
                check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','APPLIED','FAILED_VALIDATION','CANCELLED')),
  requested_by  uuid not null references profiles(id),
  reviewed_by   uuid references profiles(id),
  reason        text not null,
  review_note   text,
  effective_at  timestamptz not null default now(),
  batch_id      uuid,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

create table if not exists mapping_change_items (
  id                 uuid primary key default gen_random_uuid(),
  change_request_id  uuid not null references mapping_change_requests(id) on delete cascade,
  equipment_id       uuid not null references equipment(id) on delete restrict,
  action_type        text not null check (action_type in ('LINK','MOVE','UNLINK')),
  from_parent_kind   text check (from_parent_kind in ('ASSET','EQUIPMENT')),
  from_parent_id     uuid,
  from_root_asset_id uuid references assets(id),
  to_parent_kind     text check (to_parent_kind in ('ASSET','EQUIPMENT')),
  to_parent_id       uuid,
  to_root_asset_id   uuid references assets(id),
  descendant_count   integer not null default 0,
  status             text not null default 'OPEN'
                     check (status in ('OPEN','APPLIED','REJECTED','FAILED_VALIDATION','CANCELLED'))
);

-- Partial unique index: at most one open request per equipment (BR-MP-07, AE004)
create unique index if not exists uq_mci_open_equipment
  on mapping_change_items(equipment_id) where status = 'OPEN';

create table if not exists mapping_history (
  id                uuid primary key default gen_random_uuid(),
  equipment_id      uuid not null references equipment(id) on delete restrict,
  event_type        text not null check (event_type in ('LINK_ASSET','LINK_EQUIPMENT','MOVE','UNLINK','RETIRE_CLOSE')),
  change_request_id uuid references mapping_change_requests(id),
  from_parent_kind  text,
  from_parent_id    uuid,
  to_parent_kind    text,
  to_parent_id      uuid,
  from_asset_id     uuid references assets(id),
  to_asset_id       uuid references assets(id),
  actor_id          uuid references profiles(id),
  approved_by       uuid references profiles(id),
  reason            text,
  occurred_at       timestamptz not null default now()
);

-- 8. Import Staging, Audit Logs, and Reconciliation Findings (Bab 15.7)
create table if not exists import_mapping_profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  import_type text not null check (import_type in ('ASSET_MASTER','EQUIPMENT_MASTER','MAPPING')),
  column_map  jsonb not null,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists import_batches (
  id              uuid primary key default gen_random_uuid(),
  import_type     text not null check (import_type in ('ASSET_MASTER','EQUIPMENT_MASTER','MAPPING')),
  source_type     text not null default 'EXCEL',
  file_name       text not null,
  storage_path    text,
  file_sha256     text not null,
  idempotency_key text unique,
  status          text not null default 'UPLOADED'
                  check (status in ('UPLOADED','PARSING','PARSE_FAILED','VALIDATING','READY_FOR_REVIEW','READY','COMMITTING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED','CANCELLED')),
  commit_mode     text not null default 'ATOMIC' check (commit_mode in ('ATOMIC','PARTIAL')),
  default_action  text not null default 'SKIP' check (default_action in ('SKIP','REPLACE')),
  column_map      jsonb not null default '{}'::jsonb,
  total_count     integer not null default 0,
  new_count       integer not null default 0,
  dup_count       integer not null default 0,
  identical_count integer not null default 0,
  invalid_count   integer not null default 0,
  inserted_count  integer not null default 0,
  replaced_count  integer not null default 0,
  skipped_count   integer not null default 0,
  failed_count    integer not null default 0,
  uploaded_by     uuid not null references profiles(id),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create table if not exists import_rows (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null references import_batches(id) on delete cascade,
  row_number        integer not null,
  raw_data          jsonb not null,
  mapped_data       jsonb not null default '{}'::jsonb,
  key_norm          text,
  validation_status text not null default 'VALID' check (validation_status in ('VALID','INVALID')),
  errors            jsonb not null default '[]'::jsonb,
  match_status      text not null default 'NEW'
                    check (match_status in ('NEW','IDENTICAL','DUPLICATE_DIFF','DUPLICATE_IN_FILE')),
  action            text not null default 'INSERT' check (action in ('INSERT','SKIP','REPLACE','NONE')),
  diff              jsonb not null default '{}'::jsonb,
  base_row_version  integer,
  result_status     text check (result_status in ('INSERTED','REPLACED','SKIPPED','FAILED','CONFLICT','PENDING_APPROVAL')),
  result_message    text
);

create table if not exists audit_logs (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  actor_id        uuid references profiles(id),
  actor_role      text,
  entity_type     text not null,
  entity_id       uuid,
  action          text not null,
  old_values      jsonb,
  new_values      jsonb,
  changed_fields  text[],
  request_id      text,
  ip_address      text,
  user_agent      text,
  import_batch_id uuid references import_batches(id)
);

create table if not exists reconciliation_findings (
  id              uuid primary key default gen_random_uuid(),
  finding_type    text not null
                  check (finding_type in ('INACTIVE_ASSET_ACTIVE_EQUIPMENT','UNMAPPED_EQUIPMENT','INACTIVE_PARENT_ACTIVE_CHILD','SIMILAR_BUSINESS_KEY','STALE_ROOT_CACHE','MISSING_FROM_SAP_EXPORT')),
  severity        text not null default 'MEDIUM' check (severity in ('HIGH','MEDIUM','LOW')),
  entity_type     text not null check (entity_type in ('ASSET','EQUIPMENT','MAPPING')),
  entity_id       uuid not null,
  entity_code     text not null,
  description     text not null,
  details         jsonb not null default '{}'::jsonb,
  status          text not null default 'OPEN' check (status in ('OPEN','RESOLVED','IGNORED')),
  resolution_note text,
  resolved_by     uuid references profiles(id),
  resolved_at     timestamptz,
  detected_at     timestamptz not null default now()
);

create unique index if not exists uq_reconciliation_open
  on reconciliation_findings(finding_type, entity_id) where status = 'OPEN';

-- 9. Triggers for Cycle Prevention, Active Parent Slot, and Append-Only History (Bab 14.6, 14.7)
create or replace function trg_er_no_cycle() returns trigger language plpgsql as $$
declare
  v_max_depth int := coalesce(((select value->>'max_depth' from app_settings where key = 'hierarchy'))::int, 8);
begin
  if new.valid_to is null then
    perform pg_advisory_xact_lock(hashtext('aems.hierarchy'));
    if exists (
      with recursive sub as (
        select new.child_equipment_id as id, 1 as lvl
        union all
        select r.child_equipment_id, sub.lvl + 1
        from equipment_relationships r
        join sub on r.parent_equipment_id = sub.id
        where r.valid_to is null and sub.lvl < 50
      )
      select 1 from sub where id = new.parent_equipment_id
    ) then
      raise exception 'CYCLE_DETECTED' using errcode = 'AE001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists er_no_cycle_trg on equipment_relationships;
create trigger er_no_cycle_trg
  before insert or update on equipment_relationships
  for each row execute function trg_er_no_cycle();

-- Prevent mutation/deletion of append-only audit_logs and mapping_history
create or replace function trg_immutable_ledger() returns trigger language plpgsql as $$
begin
  raise exception 'IMMUTABLE_RECORD: audit_logs and mapping_history are append-only';
end $$;

drop trigger if exists audit_logs_immutable_trg on audit_logs;
create trigger audit_logs_immutable_trg
  before update or delete on audit_logs
  for each row execute function trg_immutable_ledger();

drop trigger if exists mapping_history_immutable_trg on mapping_history;
create trigger mapping_history_immutable_trg
  before update or delete on mapping_history
  for each row execute function trg_immutable_ledger();

-- 10. Row Level Security (RLS) Enforcement (Bab 20.2, 20.3)
create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active = true
$$;

alter table profiles enable row level security;
alter table profiles force row level security;
alter table asset_categories enable row level security;
alter table equipment_categories enable row level security;
alter table locations enable row level security;
alter table assets enable row level security;
alter table assets force row level security;
alter table equipment enable row level security;
alter table equipment force row level security;
alter table asset_equipment_mappings enable row level security;
alter table equipment_relationships enable row level security;
alter table equipment_active_parent enable row level security;
alter table equipment_spec_items enable row level security;
alter table mapping_change_requests enable row level security;
alter table mapping_change_items enable row level security;
alter table mapping_history enable row level security;
alter table import_batches enable row level security;
alter table import_rows enable row level security;
alter table audit_logs enable row level security;
alter table reconciliation_findings enable row level security;
alter table app_settings enable row level security;

-- Read policies for active authenticated users (using TO authenticated per Supabase best practices)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  to authenticated
  using ((select auth.uid()) = id or (select auth_role()) is not null);

drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update
  to authenticated
  using ((select auth_role()) = 'ADMIN')
  with check ((select auth_role()) = 'ADMIN');

drop policy if exists ref_asset_cat_read on asset_categories;
create policy ref_asset_cat_read on asset_categories for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists ref_eq_cat_read on equipment_categories;
create policy ref_eq_cat_read on equipment_categories for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists ref_loc_read on locations;
create policy ref_loc_read on locations for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists assets_read on assets;
create policy assets_read on assets for select
  to authenticated
  using ((select auth_role()) is not null and (deleted_at is null or (select auth_role()) = 'ADMIN'));

drop policy if exists assets_write on assets;
create policy assets_write on assets for insert
  to authenticated
  with check ((select auth_role()) in ('ACCOUNTING','ADMIN'));

drop policy if exists assets_update on assets;
create policy assets_update on assets for update
  to authenticated
  using ((select auth_role()) in ('ACCOUNTING','ADMIN'))
  with check ((select auth_role()) in ('ACCOUNTING','ADMIN'));

drop policy if exists equipment_read on equipment;
create policy equipment_read on equipment for select
  to authenticated
  using ((select auth_role()) is not null and (deleted_at is null or (select auth_role()) = 'ADMIN'));

drop policy if exists equipment_write on equipment;
create policy equipment_write on equipment for insert
  to authenticated
  with check ((select auth_role()) in ('MAINTENANCE','ADMIN'));

drop policy if exists equipment_update on equipment;
create policy equipment_update on equipment for update
  to authenticated
  using ((select auth_role()) in ('MAINTENANCE','ADMIN'))
  with check ((select auth_role()) in ('MAINTENANCE','ADMIN'));

drop policy if exists aem_read on asset_equipment_mappings;
create policy aem_read on asset_equipment_mappings for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists er_read on equipment_relationships;
create policy er_read on equipment_relationships for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists eap_read on equipment_active_parent;
create policy eap_read on equipment_active_parent for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists spec_read on equipment_spec_items;
create policy spec_read on equipment_spec_items for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists spec_write on equipment_spec_items;
create policy spec_write on equipment_spec_items for insert
  to authenticated
  with check ((select auth_role()) in ('MAINTENANCE','ADMIN'));

drop policy if exists mcr_read on mapping_change_requests;
create policy mcr_read on mapping_change_requests for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists mcr_insert on mapping_change_requests;
create policy mcr_insert on mapping_change_requests for insert
  to authenticated
  with check ((select auth_role()) is not null and (select auth.uid()) = requested_by);

drop policy if exists mcr_admin_update on mapping_change_requests;
create policy mcr_admin_update on mapping_change_requests for update
  to authenticated
  using ((select auth_role()) = 'ADMIN')
  with check ((select auth_role()) = 'ADMIN');

drop policy if exists mci_read on mapping_change_items;
create policy mci_read on mapping_change_items for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists mh_read on mapping_history;
create policy mh_read on mapping_history for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists ib_read on import_batches;
create policy ib_read on import_batches for select
  to authenticated
  using ((select auth_role()) = 'ADMIN' or (select auth.uid()) = uploaded_by);

drop policy if exists ir_read on import_rows;
create policy ir_read on import_rows for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists recon_read on reconciliation_findings;
create policy recon_read on reconciliation_findings for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists recon_admin_update on reconciliation_findings;
create policy recon_admin_update on reconciliation_findings for update
  to authenticated
  using ((select auth_role()) = 'ADMIN')
  with check ((select auth_role()) = 'ADMIN');

drop policy if exists settings_read on app_settings;
create policy settings_read on app_settings for select
  to authenticated
  using ((select auth_role()) is not null);

drop policy if exists settings_admin_update on app_settings;
create policy settings_admin_update on app_settings for update
  to authenticated
  using ((select auth_role()) = 'ADMIN')
  with check ((select auth_role()) = 'ADMIN');

drop policy if exists audit_admin_read on audit_logs;
create policy audit_admin_read on audit_logs for select
  to authenticated
  using ((select auth_role()) = 'ADMIN');

-- 11. Auto-sync auth.users -> public.profiles on sign-up
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'User'), '@', 1)),
    case
      when new.raw_app_meta_data->>'role' in ('ADMIN', 'ACCOUNTING', 'MAINTENANCE')
      then (new.raw_app_meta_data->>'role')::app_role
      else null
    end,
    true
  )
  on conflict (email) do update
    set id = excluded.id,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
