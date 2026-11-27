-- Each user chooses whether approval requests (and reminders) also come by e-mail.
-- Off = app only (My Approvals, Dashboard, notifications/push). Default on.
alter table users add column if not exists email_approvals boolean not null default true;
