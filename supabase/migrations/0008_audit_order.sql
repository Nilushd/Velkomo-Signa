-- Several history entries can be written in one transaction (e.g. last level approved -> request approved).
-- now() is the transaction start time, so they tied; clock_timestamp() keeps them in the order they happened.
alter table audit_log alter column created_at set default clock_timestamp();
