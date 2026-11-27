-- The Platform is its own module: Super Admins have their own accounts, sign-in and sessions,
-- separate from every hotel. They never appear as hotel users.
create table if not exists platform_admins (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  name text not null,
  email text,
  password_hash text not null,
  active boolean not null default true,
  must_change_password boolean not null default false,
  failed_logins int not null default 0,
  locked_until timestamptz,
  totp_secret text,
  totp_pending_secret text,
  totp_enabled_at timestamptz,
  totp_last_step bigint,
  recovery_codes text[],
  created_at timestamptz not null default now()
);
create unique index if not exists platform_admins_username_uq on platform_admins (lower(username));

create table if not exists platform_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_id uuid not null references platform_admins(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists platform_challenges (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_id uuid not null references platform_admins(id) on delete cascade,
  attempts int not null default 0,
  expires_at timestamptz not null
);

-- Move existing Super Admins over (same password, same two-factor).
insert into platform_admins (username, name, email, password_hash, active, totp_secret, totp_enabled_at, totp_last_step, recovery_codes)
select u.username, u.name, u.email, u.password_hash, u.active, u.totp_secret, u.totp_enabled_at, u.totp_last_step, u.recovery_codes
from users u where u.is_super_admin
on conflict do nothing;

-- The log now points at platform admins.
alter table platform_log drop constraint if exists platform_log_actor_id_fkey;
update platform_log l set actor_id = (select a.id from platform_admins a join users u on lower(u.username) = lower(a.username) and u.id = l.actor_id limit 1);
alter table platform_log add constraint platform_log_actor_id_fkey foreign key (actor_id) references platform_admins(id) on delete set null;

-- Remove the old "platform" property if it only held Super Admins and no forms.
delete from properties p
where exists (select 1 from users u where u.property_id = p.id and u.is_super_admin)
  and not exists (select 1 from users u where u.property_id = p.id and not u.is_super_admin)
  and not exists (select 1 from forms f where f.property_id = p.id);
-- Anywhere else, the old flag no longer grants anything.
update users set is_super_admin = false where is_super_admin;
