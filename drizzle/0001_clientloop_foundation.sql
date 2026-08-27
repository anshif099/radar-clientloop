create extension if not exists pgcrypto;
create schema if not exists app;

create type agency_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');
create type membership_status as enum ('INVITED', 'ACTIVE', 'DISABLED');
create type role_key as enum ('ADMIN', 'PROJECT_MANAGER', 'CONTRIBUTOR', 'SOCIAL');
create type workspace_status as enum ('ACTIVE', 'ARCHIVED');
create type work_item_status as enum (
  'DRAFT',
  'AWAITING_CLIENT_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'ARCHIVED'
);
create type version_status as enum ('DRAFT', 'PROCESSING', 'READY', 'PUBLISHED');
create type asset_status as enum (
  'PENDING_UPLOAD',
  'QUARANTINED',
  'PROCESSING',
  'READY',
  'REJECTED',
  'DELETED'
);
create type review_decision as enum ('APPROVE', 'REQUEST_CHANGES', 'REJECT');
create type feedback_kind as enum ('TEXT', 'VOICE', 'REFERENCE_FILE', 'REFERENCE_URL');
create type visibility as enum ('CLIENT_VISIBLE', 'INTERNAL_ONLY');
create type outbox_status as enum ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

create table agencies (
  id uuid primary key default gen_random_uuid(),
  name varchar(180) not null,
  slug varchar(80) not null,
  status agency_status not null default 'ACTIVE',
  timezone varchar(64) not null default 'Asia/Kolkata',
  locale varchar(16) not null default 'en-IN',
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_slug_uq unique (slug)
);

create table users (
  id uuid primary key default gen_random_uuid(),
  identity_provider_id varchar(255) not null,
  email varchar(320) not null,
  display_name varchar(160) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_identity_provider_id_uq unique (identity_provider_id)
);

create table agency_memberships (
  agency_id uuid not null references agencies(id),
  user_id uuid not null references users(id),
  role role_key not null,
  status membership_status not null default 'INVITED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_memberships_user_idx on agency_memberships(user_id);

create table client_workspaces (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  name varchar(180) not null,
  slug varchar(110) not null,
  status workspace_status not null default 'ACTIVE',
  showcase_consent boolean not null default false,
  require_otp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_workspaces_agency_slug_uq unique (agency_id, slug),
  constraint client_workspaces_agency_id_uq unique (agency_id, id)
);
create index client_workspaces_agency_status_idx on client_workspaces(agency_id, status);

create table workspace_memberships (
  agency_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null references users(id),
  can_view_all_items boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, workspace_id, user_id),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id),
  foreign key (agency_id, user_id) references agency_memberships(agency_id, user_id)
);
create index workspace_memberships_user_idx on workspace_memberships(agency_id, user_id);

create table portal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  workspace_id uuid not null,
  token_hash varchar(128) not null,
  label varchar(120),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint portal_access_tokens_hash_uq unique (token_hash),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id)
);
create index portal_access_tokens_workspace_idx on portal_access_tokens(agency_id, workspace_id);

create table divisions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  name varchar(100) not null,
  slug varchar(80) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint divisions_agency_slug_uq unique (agency_id, slug),
  constraint divisions_agency_id_uq unique (agency_id, id)
);

create table work_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  workspace_id uuid not null,
  division_id uuid,
  owner_user_id uuid references users(id),
  title varchar(220) not null,
  description text,
  status work_item_status not null default 'DRAFT',
  current_version_id uuid,
  first_published_at timestamptz,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_items_agency_id_uq unique (agency_id, id),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id),
  foreign key (agency_id, division_id) references divisions(agency_id, id),
  foreign key (agency_id, owner_user_id) references agency_memberships(agency_id, user_id)
);
create index work_items_workspace_status_idx on work_items(agency_id, workspace_id, status);
create index work_items_owner_idx on work_items(agency_id, owner_user_id);

create table work_item_versions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  work_item_id uuid not null,
  version_number integer not null check (version_number > 0),
  status version_status not null default 'DRAFT',
  note text,
  created_by_user_id uuid references users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_item_versions_number_uq unique (agency_id, work_item_id, version_number),
  constraint work_item_versions_agency_id_uq unique (agency_id, id),
  foreign key (agency_id, work_item_id) references work_items(agency_id, id),
  foreign key (agency_id, created_by_user_id) references agency_memberships(agency_id, user_id)
);
create index work_item_versions_item_status_idx on work_item_versions(agency_id, work_item_id, status);

alter table work_items
  add constraint work_items_current_version_fk
  foreign key (agency_id, current_version_id)
  references work_item_versions(agency_id, id)
  deferrable initially deferred;

create table assets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  workspace_id uuid not null,
  storage_key varchar(700) not null,
  original_name varchar(255) not null,
  declared_mime_type varchar(150),
  detected_mime_type varchar(150),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum_sha256 varchar(64),
  status asset_status not null default 'PENDING_UPLOAD',
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_storage_key_uq unique (storage_key),
  constraint assets_agency_id_uq unique (agency_id, id),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id),
  foreign key (agency_id, created_by_user_id) references agency_memberships(agency_id, user_id)
);
create index assets_workspace_status_idx on assets(agency_id, workspace_id, status);

create table version_assets (
  agency_id uuid not null references agencies(id),
  version_id uuid not null,
  asset_id uuid not null,
  purpose varchar(40) not null default 'PREVIEW',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (agency_id, version_id, asset_id),
  foreign key (agency_id, version_id) references work_item_versions(agency_id, id),
  foreign key (agency_id, asset_id) references assets(agency_id, id)
);

create table review_decisions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  workspace_id uuid not null,
  work_item_id uuid not null,
  version_id uuid not null,
  decision review_decision not null,
  reviewer_label varchar(160) not null,
  portal_session_id uuid,
  idempotency_key varchar(160) not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint review_decisions_idempotency_uq unique (agency_id, idempotency_key),
  constraint review_decisions_agency_id_uq unique (agency_id, id),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id),
  foreign key (agency_id, work_item_id) references work_items(agency_id, id),
  foreign key (agency_id, version_id) references work_item_versions(agency_id, id)
);
create index review_decisions_version_idx on review_decisions(agency_id, version_id, decided_at);

create table feedback_entries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  workspace_id uuid not null,
  review_decision_id uuid not null,
  kind feedback_kind not null,
  visibility visibility not null default 'CLIENT_VISIBLE',
  text_content text,
  reference_url text,
  asset_id uuid,
  original_language varchar(24),
  created_at timestamptz not null default now(),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id),
  foreign key (agency_id, review_decision_id) references review_decisions(agency_id, id),
  foreign key (agency_id, asset_id) references assets(agency_id, id),
  constraint feedback_entries_payload_ck check (
    (kind = 'TEXT' and text_content is not null) or
    (kind = 'VOICE' and asset_id is not null) or
    (kind = 'REFERENCE_FILE' and asset_id is not null) or
    (kind = 'REFERENCE_URL' and reference_url is not null)
  )
);
create index feedback_entries_review_idx on feedback_entries(agency_id, review_decision_id);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  workspace_id uuid,
  actor_type varchar(40) not null,
  actor_id varchar(160),
  action varchar(120) not null,
  resource_type varchar(80) not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id varchar(100),
  occurred_at timestamptz not null default now(),
  foreign key (agency_id, workspace_id) references client_workspaces(agency_id, id)
);
create index audit_events_workspace_time_idx on audit_events(agency_id, workspace_id, occurred_at);
create index audit_events_resource_idx on audit_events(agency_id, resource_type, resource_id);

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  event_type varchar(120) not null,
  aggregate_type varchar(80) not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  status outbox_status not null default 'PENDING',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index outbox_events_dispatch_idx on outbox_events(status, available_at);

create or replace function app.current_agency_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_agency_id', true), '')::uuid
$$;

alter table agencies enable row level security;
alter table agencies force row level security;
create policy agencies_tenant_isolation on agencies
  using (id = app.current_agency_id())
  with check (id = app.current_agency_id());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agency_memberships',
    'client_workspaces',
    'workspace_memberships',
    'portal_access_tokens',
    'divisions',
    'work_items',
    'work_item_versions',
    'assets',
    'version_assets',
    'review_decisions',
    'feedback_entries',
    'audit_events',
    'outbox_events'
  ]
  loop
    execute format('alter table %I enable row level security', table_name);
    execute format('alter table %I force row level security', table_name);
    execute format(
      'create policy tenant_isolation on %I using (agency_id = app.current_agency_id()) with check (agency_id = app.current_agency_id())',
      table_name
    );
  end loop;
end
$$;

create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit events are append-only';
end
$$;

create trigger audit_events_immutable
before update or delete on audit_events
for each row execute function app.reject_audit_mutation();

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agencies',
    'users',
    'agency_memberships',
    'client_workspaces',
    'workspace_memberships',
    'divisions',
    'work_items',
    'work_item_versions',
    'assets'
  ]
  loop
    execute format(
      'create trigger %I before update on %I for each row execute function app.touch_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );
  end loop;
end
$$;
