-- Velkomo Signa — schema, helper functions and Row Level Security.
-- Every tenant table carries property_id. Requests run as role signa_app with
-- app.property_id / app.user_id / app.is_admin set per transaction (see lib/db.ts).

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'signa_app') then
    create role signa_app nologin;
  end if;
end $$;
grant signa_app to current_user;

-- ---------- core ----------
create table properties (
  id uuid primary key default gen_random_uuid(),
  property_code text not null,
  name text not null,
  logo_file_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index properties_code_uq on properties (lower(property_code));

create table users (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  username text not null,
  name text not null,
  email text,
  department text,
  password_hash text not null,
  is_admin boolean not null default false,
  is_super_admin boolean not null default false,
  can_build_forms boolean not null default false,
  active boolean not null default true,
  must_change_password boolean not null default true,
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index users_username_uq on users (property_id, lower(username));

create table sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index groups_name_uq on groups (property_id, lower(name));

create table group_members (
  property_id uuid not null references properties(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (group_id, user_id)
);

create table files (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  form_id uuid,
  uploaded_by uuid,
  name text not null,
  mime text not null,
  size int not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

-- ---------- forms ----------
create table forms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  owner_id uuid references users(id) on delete set null,
  title text not null,
  description text not null default '',
  short_code text not null unique,
  schema jsonb not null default '[]',
  theme jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','closed')),
  visibility text not null default 'assigned' check (visibility in ('public','all_users','assigned')),
  closes_at timestamptz,
  max_submissions int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index forms_property_idx on forms (property_id);

create table form_access (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  access text not null check (access in ('general','review')),
  check ((user_id is null) <> (group_id is null))
);
create unique index form_access_user_uq on form_access (form_id, user_id) where user_id is not null;
create unique index form_access_group_uq on form_access (form_id, group_id) where group_id is not null;

create table approval_steps (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  level int not null check (level between 1 and 5),
  name text not null,
  channel text not null default 'both' check (channel in ('email','app','both')),
  reminder_days int,
  unique (form_id, level)
);

create table approval_step_approvers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  step_id uuid not null references approval_steps(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  check ((user_id is null) <> (group_id is null))
);

-- ---------- submissions & approvals ----------
create table ref_counters (
  property_id uuid not null references properties(id) on delete cascade,
  year int not null,
  last int not null default 0,
  primary key (property_id, year)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  ref_no text not null,
  data jsonb not null,
  submitter_id uuid references users(id) on delete set null,
  submitter_email text,
  submitter_name text,
  version int not null default 1,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  current_level int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index submissions_ref_uq on submissions (property_id, ref_no);
create index submissions_form_idx on submissions (form_id, created_at desc);

-- status / edit links e-mailed to requesters (public requesters have no account)
create table status_tokens (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table submission_versions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  version int not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  level int not null,
  step_name text not null,
  version int not null,
  approver_user_id uuid not null references users(id) on delete cascade,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected','closed')),
  comment text,
  closed_note text,
  decided_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);
create index approvals_user_idx on approvals (approver_user_id, decision);
create index approvals_sub_idx on approvals (submission_id);

create table action_tokens (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  approval_id uuid not null references approvals(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  form_id uuid,
  actor text not null,
  actor_user_id uuid,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_sub_idx on audit_log (submission_id, created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null default '',
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  to_address text not null,
  subject text not null,
  html text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- ---------- RLS helpers ----------
create or replace function signa_prop() returns uuid language sql stable as
$$ select nullif(current_setting('app.property_id', true), '')::uuid $$;
create or replace function signa_uid() returns uuid language sql stable as
$$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
-- "system" scope: server engine (no user) or a property Admin
create or replace function signa_is_system() returns boolean language sql stable as
$$ select signa_uid() is null or coalesce(current_setting('app.is_admin', true), '') = 'true' $$;

-- highest access the current user has on a form: 'review' > 'general' > null
create or replace function signa_form_access(f uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when bool_or(access = 'review') then 'review'
    when bool_or(access = 'general') then 'general' end
  from form_access fa
  where fa.form_id = f and (
    fa.user_id = signa_uid()
    or fa.group_id in (select gm.group_id from group_members gm where gm.user_id = signa_uid()))
$$;

create or replace function signa_can_see_form(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from forms where id = f and property_id = signa_prop() and (
      signa_is_system() or owner_id = signa_uid()
      or (visibility in ('all_users','public') and status <> 'draft')
      or signa_form_access(f) is not null))
$$;

create or replace function signa_can_see_submission(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from submissions sub join forms fo on fo.id = sub.form_id
    where sub.id = s and sub.property_id = signa_prop() and (
      signa_is_system()
      or sub.submitter_id = signa_uid()
      or fo.owner_id = signa_uid()
      or signa_form_access(sub.form_id) = 'review'
      or exists (select 1 from approvals a where a.submission_id = sub.id and a.approver_user_id = signa_uid())))
$$;

-- ---------- RLS ----------
grant usage on schema public to signa_app;
grant select on properties to signa_app;
grant update (name, logo_file_id) on properties to signa_app;
grant select, insert, update, delete on users, groups, group_members, files, forms, form_access,
  approval_steps, approval_step_approvers, ref_counters, submissions, status_tokens, submission_versions, approvals,
  action_tokens, audit_log, notifications, push_subscriptions, email_log to signa_app;
grant execute on all functions in schema public to signa_app;
-- sessions, password_resets and rate_limits are only touched by the privileged auth code.

do $$ declare t text; begin
  foreach t in array array['users','groups','group_members','files','form_access','approval_steps',
    'approval_step_approvers','ref_counters','status_tokens','submission_versions','action_tokens','audit_log',
    'push_subscriptions','email_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy property_isolation on %I to signa_app using (property_id = signa_prop()) with check (property_id = signa_prop())', t);
  end loop;
end $$;

alter table properties enable row level security;
create policy property_isolation on properties to signa_app using (id = signa_prop());

alter table forms enable row level security;
create policy forms_read on forms for select to signa_app using (property_id = signa_prop() and (
  signa_is_system() or owner_id = signa_uid() or (visibility in ('all_users','public') and status <> 'draft') or signa_form_access(id) is not null));
create policy forms_write on forms for insert to signa_app with check (property_id = signa_prop());
create policy forms_update on forms for update to signa_app using (property_id = signa_prop() and (signa_is_system() or owner_id = signa_uid()));
create policy forms_delete on forms for delete to signa_app using (property_id = signa_prop() and (signa_is_system() or owner_id = signa_uid()));

alter table submissions enable row level security;
create policy submissions_read on submissions for select to signa_app using (property_id = signa_prop() and (
  signa_is_system() or submitter_id = signa_uid() or signa_form_access(form_id) = 'review' or signa_can_see_submission(id)));
create policy submissions_insert on submissions for insert to signa_app with check (property_id = signa_prop());
create policy submissions_update on submissions for update to signa_app using (property_id = signa_prop() and (signa_is_system() or submitter_id = signa_uid()));

alter table approvals enable row level security;
create policy approvals_read on approvals for select to signa_app using (
  property_id = signa_prop() and (signa_is_system() or approver_user_id = signa_uid() or signa_can_see_submission(submission_id)));
create policy approvals_write on approvals for insert to signa_app with check (property_id = signa_prop() and signa_is_system());
create policy approvals_update on approvals for update to signa_app using (property_id = signa_prop() and signa_is_system());

alter table notifications enable row level security;
create policy notifications_read on notifications for select to signa_app using (property_id = signa_prop() and (signa_is_system() or user_id = signa_uid()));
create policy notifications_insert on notifications for insert to signa_app with check (property_id = signa_prop());
create policy notifications_update on notifications for update to signa_app using (property_id = signa_prop() and (signa_is_system() or user_id = signa_uid()));
