-- Hotel groups (clusters), managed only by Super Admins in the Platform.
-- A user keeps one account at their home hotel; their admin can give them access to other hotels in the same group.
-- In each extra hotel they start as a regular user — that hotel's own admin sets their role and form access.
create table if not exists hotel_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists hotel_groups_name_uq on hotel_groups (lower(name));
alter table properties add column if not exists group_id uuid references hotel_groups(id) on delete set null;

create table if not exists user_properties (
  user_id uuid not null references users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  is_admin boolean not null default false,
  can_build_forms boolean not null default false,
  granted_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

-- Signed-in hotel for cluster users (null = home hotel).
alter table sessions add column if not exists active_property_id uuid references properties(id) on delete set null;

-- Both hotels are in the same group (access ends the moment either leaves it).
create or replace function signa_same_group(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from properties x join properties y on y.group_id = x.group_id where x.id = a and y.id = b and x.group_id is not null)
$$;

-- Is this user a cluster member of the current hotel?
create or replace function signa_is_member(uid uuid, pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_properties up join users u on u.id = up.user_id
    where up.user_id = uid and up.property_id = pid and u.active and signa_same_group(u.property_id, pid))
$$;

-- Users: a hotel sees its own users plus cluster members; only the home hotel can change the account itself.
drop policy if exists property_isolation on users;
create policy users_read on users for select to signa_app using (property_id = signa_prop() or signa_is_member(id, signa_prop()));
create policy users_insert on users for insert to signa_app with check (property_id = signa_prop());
create policy users_update on users for update to signa_app using (property_id = signa_prop()) with check (property_id = signa_prop());
create policy users_delete on users for delete to signa_app using (property_id = signa_prop());

-- Memberships: visible to and managed by the home hotel (grant/remove) and the member hotel (role/remove).
grant select, insert, update, delete on user_properties to signa_app;
alter table user_properties enable row level security;
create policy up_access on user_properties to signa_app
  using (property_id = signa_prop() or exists (select 1 from users u where u.id = user_id and u.property_id = signa_prop()))
  with check (signa_same_group((select u.property_id from users u where u.id = user_id), property_id)
    and (property_id = signa_prop() or exists (select 1 from users u where u.id = user_id and u.property_id = signa_prop())));
grant execute on function signa_same_group(uuid, uuid) to signa_app;
grant execute on function signa_is_member(uuid, uuid) to signa_app;
