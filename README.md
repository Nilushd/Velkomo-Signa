<p align="center"><img src="brand/svg/velkomo-signa-logo-tagline.svg" alt="Velkomo Signa" height="72"></p>

# Velkomo Signa

Form builder and approval workflow for properties. People design a form (from scratch or from an Excel sheet), share it with a link or QR code, and every submission goes through that form's own approval levels. Approvers act **by e-mail with one click and no login**, or in the app.

## What's included (MVP)

| Area | What it does |
|---|---|
| **Login** | Property code + username + password · show password · remember property code · one generic error · 5 failed tries lock the account for 15 min · forced password change on first login · forgot-password e-mail (or "contact your admin") |
| **Multi-property** | Every table carries `property_id`; Postgres Row Level Security isolates properties. Super Admin creates properties and their first Admin |
| **Users & permissions** | Admin creates users (username, temp password, name, department, optional e-mail), edits, deactivates, resets passwords, unlocks, groups users, and sets **No / General / Review** access per form from the user's page |
| **Form builder** | Drag-and-drop field list · text, long text, number, date, dropdown, radio, checkbox, e-mail, phone, file upload, signature, section heading · label / required / placeholder / help / options · desktop/mobile preview · draft → publish |
| **Header & branding** | Use the **hotel logo** (set once in Settings → Property), upload a form-specific logo, or none · logo position (left / centre / right) and size · show the hotel name · document-control **form code** (e.g. `HR-F-012 Rev 2`) · header colour, background, 3 fonts · thank-you message · print footer |
| **Attachments** | File fields can take one file or **several (up to 2–20)**; one click adds an "Attachments section" · PDF, images, Word, Excel, CSV · 10 MB each · approvers and reviewers see cards with **photo thumbnails**, **View** (quick view: images full size, PDFs rendered page by page with pdf.js — works on phones; ‹ › to step through) and **Download**, plus **Download all (ZIP)** · same on the no-login e-mail approval page and public status page · listed on the printout |
| **Printable documents** | A4 print / Save-as-PDF of any request: hotel header, document number, version, **verification code and QR**, status stamp, every answer (signatures as images, attachments listed), approval record (who, decision, date, comment), content fingerprint · **blank paper version** of any form with a "scan to fill online" QR and sign-off boxes per level |
| **PDF download** | Tick submissions in the Submissions list (or "select all") → **Download PDF** (one file, each form on its own pages), **ZIP** (one PDF per form, named by document number) or **Print**. Every request page also has **Download PDF**. Real PDF files generated on the server with the hotel logo, document number, verification QR, answers, signatures, approval record and page numbers; only submissions the user may see are included |
| **Verification** | QR opens `/v/<code>`; or anyone enters the document number + verification code at `/verify` · shows hotel, form, status, approvals and the fingerprint (never the answers) · rate-limited; reference numbers alone can't be looked up |
| **Form Studio** | Drop in a **sample form** — Excel (a laid-out form or a table of column headings), a **PDF** (fillable PDFs use their real form fields; typed PDFs are read line by line), or, with AI design on, a **photo or scan** — and the system designs the digital form: title, form code, instructions, sections, fields with types (text, number, date, e-mail, phone, long text, choices from ☐ boxes, file, signature), required marks, and **approval levels suggested from the sign-off block** ("Checked by HOD", "Approved by GM"). Review it side by side with the original, edit, preview, choose **who can fill it in**, **add levels and pick approvers**, then **Save & publish** (opens the Share window) or **Save as draft** |
| **Auto-save & editing** | Every change in the builder (fields, theme, access, approval levels) saves automatically a moment after you make it, with a clear "All changes saved" / "Not saved yet — reason" line. Every form has **Edit** and **Share** buttons in the Forms list, so it can be changed again any time |
| **Publish & share** | **Share window** (opens automatically on publish): copy link, WhatsApp, e-mail, phone share sheet, QR code PNG/SVG, **printable QR poster**, printable blank form · `/f/<short-code>` link · visibility Public / All users / Assigned users · close on a date or after N submissions |
| **Approvals** | 0–5 sequential levels per form · several approvers (users or groups) per level, picked from a searchable dropdown of everyone — anyone chosen gets Approval access to the form automatically · **first to act decides**, the others close as "Handled by …" · channel Email / App / Both · reminder after N days · no levels = auto-accept |
| **Out of office** | An approver (Settings → Out of office), or an admin for them (user page), forwards their approvals — **all, or only selected forms** (different forms can go to different colleagues) — to a colleague for a date range. New **and already-waiting** approvals go to the colleague, marked "for <name>", with the usual e-mail buttons and app notice; decisions are recorded as "<colleague> (for <name>)" in the history, printouts, PDFs and verification page. **Cancel** a whole forwarding, or stop just one form with its ✕; waiting approvals are handed straight back. Chains (A→B→C) are followed; the colleague doesn't need Approval access of their own |
| **Notification choice** | Each user decides in **Settings → Notifications** whether approval requests (and reminders) also come **by e-mail**; turned off, they arrive in My Approvals, on the Dashboard and as app/push notifications only. Phone/browser push is switched on per device there too |
| **E-mail approval** | Approve / Reject / View details buttons · 32-byte random token, stored as SHA-256 only, single use, 7-day expiry, bound to one approver and one level · confirm page (no change on GET, so link scanners can't approve) · comment required to reject |
| **Cancel & delete** | The submitter (in the app or via the public status link) and the property Admin can **Cancel** (kept on record as *Cancelled*) or **Delete** (removed with its attachments; an audit note keeps the reference number, who and when) — only **before any approver has acted** or **after a rejection**. Approvers' tasks and e-mail links close at once |
| **Requester** | Reference number `REQ-2026-0042` · e-mail receipt with status link · statuses Pending → Approved / Rejected → edit & resubmit (same ref, new version, restarts at level 1, old versions kept) · withdraw a rejected request |
| **Quick & bulk approve** | My Approvals → Pending: every row has **Approve** (one click) and **Reject** (asks for a reason) buttons and shows its key answers. Tick several (or select all, filtered by form) → **Approve n** (one click) / **Reject n** (one reason for all) / *Approve with comment…*. Each is decided individually — same checks, history, e-mails and "first to act" rule; ones already handled by someone else are skipped and listed |
| **In-app** | Dashboard · My Forms · My Requests · My Approvals (Pending / Done) · Submissions table with search, filters and Excel/CSV export (Review/Approval access and admins) · full history timeline · notifications + Web Push · installable PWA |
| **Security** | Server-side checks **and** RLS · rate limits on login, uploads and public submissions · optional hCaptcha · uploads ≤ 10 MB with extension, MIME and magic-byte checks · httpOnly session cookies |

## Tech stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS · dnd-kit · Postgres on **Supabase** (`postgres` driver, RLS) · Resend or SMTP behind one `sendEmail()` helper · Web Push (VAPID) · SheetJS (`xlsx`) · `qrcode` · Vercel hosting + Vercel Cron.

**AI design (optional).** Form Studio works without AI: rules in `lib/studio/parse.ts` read Excel and PDF samples in the browser. If `ANTHROPIC_API_KEY` is set, it can also read photos and scanned forms, and redo any design, by sending the sample to Claude (`app/actions/studio.ts`, model `claude-opus-5-5`, structured JSON output, rate-limited to 20 designs per user per hour). Nothing is sent to an AI service unless that key is set and the user clicks *Design with AI* (or uploads a photo/scan).

Two deliberate simplifications versus the original plan, both easy to change later:

- **Sessions** are the app's own (random token, hashed in a `sessions` table, httpOnly cookie) instead of Supabase Auth with hidden internal e-mails. The login rules are exactly as specified; this just removes a moving part.
- **Uploaded files** are stored in Postgres (`files.data`, max 10 MB each) instead of Supabase Storage, so the app needs only one service. Swap `app/api/upload` and `app/api/files` for Storage if files grow large.

### How isolation works

Every request runs in a transaction as the `signa_app` role with `app.property_id`, `app.user_id` and `app.is_admin` set (`lib/db.ts → tenant()`). RLS policies in `supabase/migrations/0001_init.sql` then limit:

Per-form access levels: **General** (fill in, see own requests) · **Review** (also see every submission, read-only) · **Approval** (Review + can be chosen as an approver). Admins see everything in their property.

- **all tables** to the current property;
- **forms** to ones the user owns, has access to, or that are open to all users;
- **submissions** to the user's own, forms they review, or ones they were asked to approve (admins see everything in their property).

The approval engine (`lib/approvals.ts`) runs in property-wide "system" scope after the app has checked who is acting.

## Run locally

Requirements: Node 20+, a Postgres 15+ database (local or Supabase).

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL and APP_URL=http://localhost:3000
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000 and sign in (password `Welcome123` for every demo account):

| Property code | Username | Role |
|---|---|---|
| `VELKOMO` | `superadmin` | Super Admin (creates properties) |
| `HTL01` / `HTL02` | `admin` | Admin, level-2 approver |
| `HTL01` / `HTL02` | `manager`, `supervisor` | Approval access, both level-1 approvers ("first wins") |
| `HTL01` / `HTL02` | `john`, `nimali`, `ravi` | General access |

The seed creates a **Leave Request** form in each property with 2 levels (level 1 has 2 approvers). Without e-mail keys, every e-mail is printed to the console and saved in the `email_log` table — open the latest approval e-mail's HTML from there to try the no-login approval link.

### Tests

```bash
npm test
```

Runs against `DATABASE_URL` (migrated + seeded): attachment limits, verification codes and fingerprints, header logo choice, approve path, reject → edit → resubmit (restarts at level 1 as version 2), two approvers racing on one level (first wins, second gets "Already handled by …"), single-use tokens, auto-approve with no levels, users without access can't read/submit/review, general users only see their own submissions, property isolation.

## Deploy (Vercel + Supabase)

1. **Supabase**: create a project. Copy the **Transaction pooler** connection string (port 6543).
2. Run the migration and (optionally) the seed once from your machine:
   ```bash
   DATABASE_URL="postgres://…pooler.supabase.com:6543/postgres" npm run db:migrate
   ```
   For production, create your Super Admin by running the seed, then change its password and deactivate the demo properties from **Properties** — or insert one property and one `is_super_admin` user by SQL.
3. **Vercel**: import this repo, set the variables from `.env.example` (at least `DATABASE_URL`, `APP_URL`, `CRON_SECRET`, plus e-mail and VAPID keys), deploy.
4. `vercel.json` schedules `/api/cron/reminders` daily at 03:00 UTC (sends reminders, cleans expired sessions).
5. Generate push keys with `npx web-push generate-vapid-keys`.
6. Turn on Supabase's daily backups (Database → Backups).

## Project layout

```
app/
  login, change-password, forgot-password, reset-password   sign-in flow
  (app)/            signed-in area with sidebar: dashboard, forms, my-forms, requests,
                    approvals, submissions, users, settings, super, notifications
  (app)/forms/studio  Form Studio: design a form from an Excel/PDF/photo sample
  f/[code]          public / shared form page
  s/[token]         requester status page (edit & resubmit for public requesters)
  a/[token]         e-mail approval confirm page (no login)
  print/[id]        printable document (signed-in users, or ?s=<status token>)
  print/form/[id]   printable blank form
  print/qr/[id]     printable QR poster
  verify, v/[code]  public document verification
  api/              upload, files, qr, export, push/subscribe, cron/reminders
  actions/          server actions (auth, forms, submit, users, property)
lib/
  approvals.ts      approval engine (submit, startLevel, decide, resubmit, withdraw, reminders)
  db.ts             Postgres + RLS tenant transactions
  auth.ts           sessions, login lockout, guards
  access.ts         per-form access rules
  studio/           Form Studio: sample → design rules (parse.ts), PDF reader (pdf.ts)
components/         builder, form renderer, signature pad, pickers, UI
supabase/migrations SQL schema + RLS policies
brand/              Velkomo Signa logo pack (SVG, PNG, favicons, social)
tests/              approval engine and access tests (Vitest)
```

## Brand

The Velkomo Signa mark is Velkomo's welcoming **V** on a blue tile with a cyan approval tick. Colours: Signa blue `#2563EB`, navy `#0B1F4D`, approval cyan `#22D3EE`. See `brand/README.md`.

## Later, only if needed

Parallel approvals, conditional routing (e.g. amount > 100,000 adds a level), PDF output of approved forms, WhatsApp notifications, native apps.
