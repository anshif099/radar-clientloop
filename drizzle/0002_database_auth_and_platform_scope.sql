create schema if not exists auth;

create table auth.users (
  id text primary key,
  name text not null,
  email text not null,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  role text not null default 'user',
  banned boolean not null default false,
  ban_reason text,
  ban_expires timestamptz,
  constraint auth_users_email_uq unique (email),
  constraint auth_users_role_ck check (role in ('admin', 'user'))
);

create table auth.sessions (
  id text primary key,
  expires_at timestamptz not null,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references auth.users(id) on delete cascade,
  impersonated_by text,
  constraint auth_sessions_token_uq unique (token)
);
create index auth_sessions_user_idx on auth.sessions(user_id);

create table auth.accounts (
  id text primary key,
  issuer text not null,
  account_id text not null,
  provider_id text not null,
  user_id text not null references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_accounts_issuer_account_uq unique (issuer, account_id)
);
create index auth_accounts_user_idx on auth.accounts(user_id);

create table auth.verifications (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auth_verifications_identifier_idx on auth.verifications(identifier);

alter table users
  add constraint users_auth_identity_fk foreign key (identity_provider_id)
    references auth.users(id) on delete cascade;

create or replace function app.current_is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.current_is_super_admin', true), '')::boolean, false)
$$;

drop policy agencies_tenant_isolation on agencies;
create policy agencies_tenant_isolation on agencies
  using (app.current_is_super_admin() or id = app.current_agency_id())
  with check (app.current_is_super_admin() or id = app.current_agency_id());

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
    execute format('drop policy tenant_isolation on %I', table_name);
    execute format(
      'create policy tenant_isolation on %I using (app.current_is_super_admin() or agency_id = app.current_agency_id()) with check (app.current_is_super_admin() or agency_id = app.current_agency_id())',
      table_name
    );
  end loop;
end
$$;

alter table users enable row level security;
alter table users force row level security;
create policy users_tenant_isolation on users
  using (
    app.current_is_super_admin()
    or exists (
      select 1
      from agency_memberships membership
      where membership.user_id = users.id
        and membership.agency_id = app.current_agency_id()
    )
  )
  with check (app.current_is_super_admin());
