-- Contracts & billing (Platform). Hotels are billed per active form type (a published form) per month.

-- Which forms were active on which day. A form counts for a billing period if it was active on any day in it,
-- so closing a form mid-month doesn't drop it from that month's bill. Kept after the form is deleted.
create table if not exists form_usage (
  property_id uuid not null references properties(id) on delete cascade,
  form_id uuid not null,
  day date not null,
  title text not null,
  primary key (form_id, day)
);
create index if not exists form_usage_property_day on form_usage (property_id, day);

-- Recorded the moment a form is published (whatever code path did it) and daily by the cron job.
create or replace function signa_record_form_usage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' then
    insert into form_usage (property_id, form_id, day, title) values (new.property_id, new.id, current_date, new.title)
    on conflict (form_id, day) do update set title = excluded.title;
  end if;
  return new;
end $$;
drop trigger if exists forms_usage on forms;
create trigger forms_usage after insert or update of status, title on forms for each row execute function signa_record_form_usage();

insert into form_usage (property_id, form_id, day, title)
select property_id, id, current_date, title from forms where status = 'published' on conflict do nothing;

-- Platform-wide default pricing (one row).
create table if not exists billing_settings (
  id int primary key default 1 check (id = 1),
  currency text not null default 'LKR',
  rate_per_form numeric(12,2) not null default 0,     -- per active form type per month
  minimum_monthly numeric(12,2) not null default 0,   -- lowest monthly charge per hotel
  tax_pct numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into billing_settings (id) values (1) on conflict do nothing;

-- One contract per hotel; empty rate/minimum = use the defaults.
create table if not exists hotel_contracts (
  property_id uuid primary key references properties(id) on delete cascade,
  contract_no text,
  starts_on date,
  cycle text not null default 'monthly' check (cycle in ('monthly','quarterly','annual')),
  rate_per_form numeric(12,2),
  minimum_monthly numeric(12,2),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  contact_name text,
  contact_email text,
  notes text,
  updated_at timestamptz not null default now()
);
