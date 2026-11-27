-- 1) Form access gets a fourth level. Per form, each user/group has:
--      general  : see and submit the form, see only their own requests
--      review   : also see every submission of the form (read-only)
--      approve  : review + can be chosen as an approver
--    Until now "review" also meant "can approve", so existing review grants become "approve" (no behaviour change).
alter table form_access drop constraint if exists form_access_access_check;
update form_access set access = 'approve' where access = 'review';
alter table form_access add constraint form_access_access_check check (access in ('general', 'review', 'approve'));

-- 2) One switch for designing forms: Form designer now includes Form Studio and AI design.
update users set can_use_studio = can_build_forms, can_use_ai = can_build_forms;

-- 3) RLS helpers understand the new level.
create or replace function signa_form_access(f uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when bool_or(access = 'approve') then 'approve'
    when bool_or(access = 'review') then 'review'
    when bool_or(access = 'general') then 'general' end
  from form_access fa
  where fa.form_id = f and (
    fa.user_id = signa_uid()
    or fa.group_id in (select gm.group_id from group_members gm where gm.user_id = signa_uid()))
$$;

create or replace function signa_can_see_submission(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from submissions sub join forms fo on fo.id = sub.form_id
    where sub.id = s and sub.property_id = signa_prop() and (
      signa_is_system()
      or sub.submitter_id = signa_uid()
      or fo.owner_id = signa_uid()
      or signa_form_access(sub.form_id) in ('review', 'approve')
      or exists (select 1 from approvals a where a.submission_id = sub.id and a.approver_user_id = signa_uid())))
$$;

drop policy if exists submissions_read on submissions;
create policy submissions_read on submissions for select to signa_app using (property_id = signa_prop() and (
  signa_is_system() or submitter_id = signa_uid() or signa_form_access(form_id) in ('review', 'approve') or signa_can_see_submission(id)));
