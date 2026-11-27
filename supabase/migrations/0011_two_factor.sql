-- Optional two-factor sign-in with an authenticator app (TOTP, RFC 6238). Each user turns it on or off.
alter table users add column if not exists totp_secret text;            -- encrypted (AES-256-GCM)
alter table users add column if not exists totp_pending_secret text;    -- encrypted, during setup only
alter table users add column if not exists totp_enabled_at timestamptz;
alter table users add column if not exists totp_last_step bigint;       -- stops the same code being used twice
alter table users add column if not exists recovery_codes text[];       -- SHA-256 of unused backup codes

-- Password accepted, waiting for the 6-digit code.
create table if not exists login_challenges (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  attempts int not null default 0,
  expires_at timestamptz not null
);
