-- File bytes move out of the database into object storage (Supabase Storage) when it is configured.
-- files keeps only metadata; data stays only for the local/dev fallback.
alter table files alter column data drop not null;
alter table files add column if not exists storage_key text unique;
-- 'ready' once the upload is checked; 'uploading' while the browser sends it straight to storage
alter table files add column if not exists state text not null default 'ready' check (state in ('uploading', 'ready'));
-- set when a submission uses the file; unused uploads are cleaned up after a day
alter table files add column if not exists attached_at timestamptz;
update files set attached_at = created_at where attached_at is null and (is_public or form_id is null);
update files f set attached_at = f.created_at where attached_at is null and exists (
  select 1 from submissions s where s.data::text like '%' || f.id::text || '%'
  union all select 1 from submission_versions v where v.data::text like '%' || f.id::text || '%');
create index if not exists files_cleanup_idx on files (created_at) where attached_at is null;
