-- Out of office: an approver forwards their approvals to a colleague for a date range.
create table delegations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  note text not null default '',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,        -- when waiting approvals were moved over
  cancelled_at timestamptz,
  check (from_user_id <> to_user_id),
  check (ends_on >= starts_on)
);
create index delegations_from_idx on delegations (from_user_id, starts_on, ends_on) where cancelled_at is null;

-- an approval row handled by a delegate remembers whose it was
alter table approvals add column on_behalf_of uuid references users(id) on delete set null;
alter table approvals add column delegation_id uuid references delegations(id) on delete set null;

alter table delegations enable row level security;
create policy property_isolation on delegations to signa_app using (property_id = signa_prop()) with check (property_id = signa_prop());
grant select, insert, update, delete on delegations to signa_app;
