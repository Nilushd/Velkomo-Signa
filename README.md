<p align="center"><img src="brand/svg/velkomo-signa-logo-tagline.svg" alt="Velkomo Signa" height="72"></p>

# Velkomo Signa

Form builder and approval workflow for properties. People design a form (from scratch or from an Excel sheet), share it with a link or QR code, and every submission goes through that form's own approval levels. Approvers act **by e-mail with one click and no login**, or in the app.

## What's included (MVP)

| Area | What it does |
|---|---|
| **Login** | Property code + username + password · show password · **property code saved automatically** on the device after the first successful sign-in (shown as the hotel name with a **Change** link) · username kept after a wrong password · one generic error · 5 failed tries lock the account for 15 min · forced password change on first login · forgot-password e-mail (or "contact your admin") |
| **Two-factor sign-in** | Optional per user, in **Settings → Two-factor authentication**: scan a QR code with any authenticator app (Google / Microsoft Authenticator, Authy…), confirm with a code, get **8 one-time backup codes** (copy / download). Signing in then asks for the 6-digit code after the password (5 tries, 10-minute window, a code can't be used twice). Turning it off or making new backup codes needs a current code. Lost phone → an Admin turns it off from the user's page (also signs them out everywhere). Secrets are stored encrypted (AES-256-GCM), backup codes only as hashes |
| **Multi-property** | Every table carries `property_id`; Postgres Row Level Security isolates properties |
| **Platform (separate module)** | For Super Admins only, with its **own accounts, sessions and screens** (dark *Platform console*), completely apart from the hotels: Super Admins are not hotel users and never see the hotel app, and no hotel user can open the Platform. They sign in on the **same login page with property code `PLATFORM`** (reserved; the page remembers it like any other code; two-factor supported). **Hotels**: tiles for hotels / active / expiring in 30 days / expired / suspended, filter and search, recent activity. **New hotel** creates the hotel (name, property code, **subscription end date** with 1 month / 3 months / 1 year shortcuts, private notes) and its first Admin (temporary password typed or generated, shown once with *Copy sign-in details*). Each hotel row has **Edit**, opening a side panel to change the end date or **extend by 1/3/6/12 months**, **suspend / resume** (disable straight away), **reset an admin's password** (temporary, signs them out, unlocks, optionally turns off two-factor), **add admins**, rename and edit notes, and **delete the hotel** (type its code to confirm; removes all its data and stored files). After the end date or while suspended nobody at the hotel can sign in (a clear message, shown only after a correct password), sessions end, public forms and e-mail approval links stop and reminders pause — nothing is deleted, and a new date reopens it. Hotel admins see a renewal reminder 14 days before. **Contracts & billing** tab: hotels pay **per enabled form type, per day — never per submission** — each form costs the monthly rate ÷ days in the month for every day it was enabled (*form-months*; 1.00 = one form for a whole month). Usage is recorded every day (the daily cron, plus the moment a form is enabled), so figures update daily and a running month shows *to date*. Default pricing (currency, price per enabled form per month, minimum per hotel per month, tax %) and a **contract per hotel** (number, start date, cycle, own rate or minimum, discount %, billing contact, notes). The **bill calculator** takes a month or range of months and shows each hotel's forms billed (expand for each form's days), subtotal, discount, minimum, tax and total, with **CSV download** and **Print**. The Hotels list shows **Enabled forms** per hotel. **Super Admins** page: add Super Admins, reset their passwords, deactivate. **My account**: password and two-factor. Every Platform action is logged |
| **Users & permissions** | Admin creates users (username, temp password, name, department, optional e-mail), edits, deactivates, resets passwords, unlocks, groups users, and sets **No / General / Review** access per form from the user's page |
| **Data protection** | Built for Sri Lanka's PDPA, the GCC laws, India's DPDP Act and the ASEAN PDPAs (see [docs/DATA-PROTECTION.md](docs/DATA-PROTECTION.md)). Per organisation: privacy contact/DPO, standard or custom **privacy notice** (versioned) linked from every form, **consent box** on public forms (optionally for staff) stored with each request, **retention period** with nightly deletion of old requests and attachments. Per person: **download a copy of my data**, **privacy requests** (copy / correction / deletion) routed to the privacy contact and tracked with their age, **sign-in history** with shortened IP. Admins can **erase a former user's identity** (optionally with their requests) while approval records stay valid |
| **Hotel groups (clusters)** | On the Platform's Hotels page a Super Admin ticks hotels and clicks **Group…** (new or existing group name) or **Ungroup** — only Super Admins can group hotels. In a group, a hotel admin can give a user access to the other hotels when adding or editing them (*Other hotels in …*). The person keeps one account and password at their own hotel and uses the **hotel switcher** in the menu (with waiting approvals per hotel). In each other hotel they start as a regular user; **that hotel's admin** sets their role, form access and groups, or removes them — and sees them in Users marked *Cluster · HTL01*. Ungrouping stops cross-hotel access at once (sessions return home); regrouping restores it. Enforced with row-level security |
| **Hotel time zones** | Each hotel has its own **time zone**, chosen on *New hotel* (and changeable in Hotels → Edit → Hotel details); hotel admins see it in Settings. Every date and time in the app, printouts, PDFs, verification page and Excel export is shown in the hotel's zone; *today* for that hotel (subscription end, out-of-office ranges, daily billing usage, submission date filters) is its own calendar day (`signa_today()` in the database) |
| **Form type limit** | Each hotel's plan sets how many **form types** (Leave Request, Purchase Requisition…) may be **enabled at once** — set by the Super Admin on New hotel and in Hotels → Edit → *Plan · form types* (empty = unlimited). **Submissions are never limited.** Drafts and disabled forms don't count, so a hotel at its limit disables one form type to enable another; the Forms page shows *2 of 5 form types enabled*. Enforced in the app and by the database (race-safe); a form published from Form Studio over the limit is saved as a draft |
| **Enable / disable forms** | Hotel admins switch each form **Enabled / Disabled** in the Forms list (and Enable/Disable in the editor). Disabled forms stop taking submissions, keep all their data, and **aren't charged** from the next day; the Forms page shows how many are enabled |
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

### Storage on Vercel (keeping the server small)

- **Files live in Supabase Storage**, not in the database, when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set (create a *private* bucket, default name `signa-files`). The `files` table only keeps metadata.
- **Uploads go straight from the browser to storage** with a one-time signed URL (`/api/upload/start` → PUT → `/api/upload/finish`, where the server re-checks size and real file type). Nothing large passes through Vercel, so Vercel's 4.5 MB request limit doesn't apply.
- **Downloads and quick view** are short-lived signed links (60 s; logos 1 h) after the usual access check — file bytes don't flow through Vercel either.
- **Smaller files to begin with:** phone photos are resized in the browser to ≤ 2000 px JPEG before upload (a 22 MB photo became ~670 KB); drawn signatures are saved at ≤ 600 px (≈ 10–30 KB).
- **Nightly clean-up** (`lib/housekeeping.ts`, run by the Vercel cron): uploads nobody submitted (after 1 day), e-mail HTML copies (after 30 days), old notifications, expired sessions/links/rate-limit rows. Deleting a request removes its files from storage.
- Admins see **storage used** in Settings → Property.
- Without the Supabase Storage variables (local development) files are kept in the database as before.

Two deliberate simplifications versus the original plan, both easy to change later:

- **Sessions** are the app's own (random token, hashed in a `sessions` table, httpOnly cookie) instead of Supabase Auth with hidden internal e-mails. The login rules are exactly as specified; this just removes a moving part.

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
| `PLATFORM` | `superadmin` | Super Admin → Platform console (hotels, subscriptions) |
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
3. **Vercel**: import this repo, set the variables from `.env.example` (at least `DATABASE_URL`, `APP_URL`, `CRON_SECRET`, `AUTH_SECRET` (a long random string — keep it unchanged, it encrypts two-factor keys), plus e-mail and VAPID keys), deploy.
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
