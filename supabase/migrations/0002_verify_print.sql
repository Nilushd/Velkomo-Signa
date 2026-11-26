-- Printable documents: every submission gets a random verification code printed next to its
-- document number and encoded in the QR code (/v/<code>). Reference numbers are sequential and
-- guessable, so they are never enough on their own to look a document up.
alter table submissions add column if not exists verify_code text;
update submissions set verify_code = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 5) || '-' || substr(encode(gen_random_bytes(8), 'hex'), 1, 5))
  where verify_code is null;
alter table submissions alter column verify_code set not null;
create unique index if not exists submissions_verify_uq on submissions (verify_code);
