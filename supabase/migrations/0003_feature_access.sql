-- Per-user feature access, switched on/off by the property Admin.
--   can_build_forms  : Form designer (create and edit their own forms)   — already exists
--   can_use_studio   : Form Studio (design a form from an Excel/PDF/photo sample)
--   can_use_ai       : AI design inside Form Studio (only when the server has an AI key)
-- Admins always have all three.
alter table users add column if not exists can_use_studio boolean not null default false;
alter table users add column if not exists can_use_ai boolean not null default false;
update users set can_use_studio = true where can_build_forms and not can_use_studio;
