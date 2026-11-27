-- How many form types a hotel may have enabled at once (its plan). null = unlimited.
-- Submissions (answers) are never limited. Drafts and disabled forms don't count.
alter table properties add column if not exists form_type_limit int check (form_type_limit is null or form_type_limit >= 0);

create or replace function signa_check_form_type_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform pg_advisory_xact_lock(hashtext('form-limit:' || new.property_id::text));
    select form_type_limit into lim from properties where id = new.property_id;
    if lim is not null then
      select count(*) into n from forms where property_id = new.property_id and status = 'published' and id <> new.id;
      if n >= lim then
        raise exception 'FORM_TYPE_LIMIT:%', lim using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists forms_type_limit on forms;
create trigger forms_type_limit before insert or update of status on forms for each row execute function signa_check_form_type_limit();
