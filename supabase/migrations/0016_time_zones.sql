-- Each hotel works in its own time zone (chosen when the hotel is created): dates and times shown, PDFs,
-- "today" for subscriptions, out-of-office ranges and daily billing all follow it.
alter table properties add column if not exists time_zone text not null default 'Asia/Colombo';

-- Today's date for a hotel, in its own time zone.
create or replace function signa_today(pid uuid) returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select time_zone from properties where id = pid), 'UTC'))::date
$$;
grant execute on function signa_today(uuid) to signa_app;

-- Billing usage is recorded against the hotel's own calendar day.
create or replace function signa_record_form_usage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' then
    insert into form_usage (property_id, form_id, day, title) values (new.property_id, new.id, signa_today(new.property_id), new.title)
    on conflict (form_id, day) do update set title = excluded.title;
  end if;
  return new;
end $$;
