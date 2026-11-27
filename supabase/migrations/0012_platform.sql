-- Platform module (Super Admin): subscription end date per hotel, notes, and a log of platform actions.
alter table properties add column if not exists subscription_ends date;   -- last day the hotel can use the app; null = no end date
alter table properties add column if not exists notes text;               -- Super Admin's own notes (contact, plan, invoice no.)

create table if not exists platform_log (
  id bigserial primary key,
  at timestamptz not null default clock_timestamp(),
  actor_id uuid references users(id) on delete set null,
  actor_name text not null,
  property_code text not null,
  property_name text not null,
  action text not null,
  detail text
);
create index if not exists platform_log_at on platform_log (at desc);
-- platform_log is only read and written with the privileged connection; the app role gets no access.
