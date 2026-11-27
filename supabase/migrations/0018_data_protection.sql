-- Data protection (Sri Lanka PDPA 2022, GCC laws, India DPDP 2023, ASEAN PDPAs …):
-- privacy notice + contact per organisation, consent on forms, retention period, sign-in history, privacy requests.
alter table properties add column if not exists privacy_contact_name text;
alter table properties add column if not exists privacy_contact_email text;
alter table properties add column if not exists privacy_notice text;            -- null = the standard notice
alter table properties add column if not exists privacy_version int not null default 1;
alter table properties add column if not exists privacy_updated_at timestamptz not null default now();
alter table properties add column if not exists retention_months int check (retention_months is null or retention_months between 6 and 600); -- null = keep
alter table properties add column if not exists consent_all_forms boolean not null default false; -- also ask signed-in staff
grant update (privacy_contact_name, privacy_contact_email, privacy_notice, privacy_version, privacy_updated_at, retention_months, consent_all_forms) on properties to signa_app;

alter table submissions add column if not exists consent_at timestamptz;
alter table submissions add column if not exists consent_version int;

-- Sign-in history (shown to each person; IP kept shortened).
create table if not exists login_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  at timestamptz not null default now(),
  ip_prefix text,
  user_agent text,
  method text not null default 'password'
);
create index if not exists login_events_user on login_events (user_id, at desc);

-- Requests from people about their data (copy, correction, erasure) — logged so they can be answered on time.
create table if not exists privacy_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  requester_name text not null,
  requester_email text,
  kind text not null check (kind in ('access','correction','erasure','other')),
  details text,
  status text not null default 'open' check (status in ('open','done','declined')),
  response text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null
);
grant select, insert, update on privacy_requests to signa_app;
alter table privacy_requests enable row level security;
create policy privacy_requests_access on privacy_requests to signa_app
  using (property_id = signa_prop() and (signa_is_system() or user_id = signa_uid()))
  with check (property_id = signa_prop());
