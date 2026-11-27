-- Out of office per form: a delegation can cover only some forms. No rows = all forms.
create table delegation_forms (
  property_id uuid not null references properties(id) on delete cascade,
  delegation_id uuid not null references delegations(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  primary key (delegation_id, form_id)
);
alter table delegation_forms enable row level security;
create policy property_isolation on delegation_forms to signa_app using (property_id = signa_prop()) with check (property_id = signa_prop());
grant select, insert, update, delete on delegation_forms to signa_app;
