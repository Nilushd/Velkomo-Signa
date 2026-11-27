# Data protection in Velkomo Signa

> This is a product description, not legal advice. Laws and their regulations change; check the current text
> with a qualified adviser in each country before relying on this document. Status as understood in late 2026.

## Roles

| Who | Role | In practice |
|---|---|---|
| Each organisation using Signa (a "property") | **Data controller** | Decides which forms exist, what they ask, who approves, how long records are kept. |
| Velkomo (operator of the Signa service) | **Data processor** | Hosts and runs the service on the organisation's instructions. Needs a data processing agreement (DPA) with each organisation. |
| Hosting and e-mail providers (e.g. Supabase, Render/Vercel, Resend or your SMTP provider) | **Sub-processors** | Store data, send e-mail. List them in the DPA. |
| Anthropic (only if `ANTHROPIC_API_KEY` is set) | Sub-processor for **Form Studio AI design** | Receives the *sample form* an admin uploads (usually a blank template), never submissions. Leave the key empty to avoid this transfer. |

## What the app does

| Principle (common to all the laws below) | How Signa supports it |
|---|---|
| **Transparency / notice** | Every organisation has a privacy notice (standard text, or its own) at `/f/<form>/privacy`, linked from every form; the login page links to `/privacy`. The notice names the controller, purposes, recipients, storage location (`DATA_LOCATION`), retention and rights, plus the organisation's **privacy contact / DPO**. Each change to the notice gets a new **version number**. |
| **Lawful basis / consent** | People using a public link must tick a consent box before submitting; the time and the notice version are stored with the request (`consent_at`, `consent_version`). Organisations can require it from signed-in staff too (Settings → Privacy → *Ask staff to agree too*). Staff forms otherwise rely on the employment relationship / legitimate purpose — the organisation decides. |
| **Purpose limitation & minimisation** | Forms only collect the fields the organisation defines; no advertising, profiling or tracking cookies. Only essential cookies (session, two-factor step, remembered organisation code). Verification pages show status and approvers, never the answers. |
| **Access & portability** | Each person can download everything held about them as JSON (Settings → *Your data* → *Download a copy of my data*): profile, requests with answers and versions, decisions, notifications, privacy requests, sign-ins. |
| **Correction, erasure, objection, withdrawal** | Settings → *Ask about your information* logs a request (correction / deletion / copy / other), notifies the admins and e-mails the privacy contact. Admins answer in Settings → *Privacy requests*; open requests show their age (most laws: reply within one month; Sri Lanka: 21 working days). Admins can **erase a person's identity** (name, username, e-mail, sign-in history, notifications, access, two-factor) while keeping approval records valid, and optionally delete every request they submitted with attachments. Requesters can cancel or delete their own requests before anyone acts. |
| **Storage limitation / retention** | Settings → Privacy → *Keep requests for* (1–10 years). Every night, finished requests older than that are deleted with all attachments of every version; an audit entry records how many. Unused uploads, old e-mail bodies (30 days), notifications (90/180 days), expired sessions and links are cleaned automatically. |
| **Security** | Row-level security keeps each organisation's data separate in the database; passwords hashed (bcrypt); optional two-factor sign-in with encrypted keys (AES-256-GCM) and hashed backup codes; account lock after 5 failed sign-ins; rate limits on sign-in, public forms and links; single-use, expiring e-mail approval links stored only as hashes; private file storage with short-lived signed links; HTTPS. |
| **Accountability** | Full history on every request (who submitted, approved, rejected, changed, cancelled, deleted — and when); per-person sign-in history with a **shortened IP address** (`203.94.12.0`) and device; Platform actions logged; privacy requests kept with their replies. |
| **Cross-border transfers** | Data stays in the region you host it in (choose the database/storage region and set `DATA_LOCATION` so the notice says where). E-mail and optional AI providers may process outside that region — cover them in the DPA and, where required, a transfer assessment. |
| **Breach response** | The audit history, sign-in history and Platform log help establish what happened. Notifying the authority and affected people is the controller's process (see below). |

## Country notes

| Country / region | Law | Points to note |
|---|---|---|
| **Sri Lanka** | Personal Data Protection Act No. 9 of 2022 | Rights requests answered within 21 working days; notice, lawful basis, retention, security, breach notification to the Data Protection Authority; cross-border transfers to adequate jurisdictions or with safeguards; appointment of a Data Protection Officer for many controllers. |
| **United Arab Emirates** | Federal Decree-Law No. 45 of 2021 (PDPL); DIFC Data Protection Law 2020; ADGM Data Protection Regulations 2021 | Free-zone companies follow DIFC/ADGM rules (DPO, records of processing, breach notification). Transfers outside the UAE need adequacy or safeguards. |
| **Saudi Arabia** | Personal Data Protection Law (Royal Decree M/19) and its Implementing and Transfer Regulations (SDAIA) | Breach notification to SDAIA within 72 hours; registration and DPO in some cases; strict cross-border transfer rules — **host in-Kingdom** where possible for Saudi organisations. |
| **Qatar** | Law No. 13 of 2016 | Notice and consent requirements, data controller obligations, breach notification to the authority. |
| **Bahrain** | Law No. 30 of 2018 (PDPL) | Notification/registration with the authority for certain processing; transfer restrictions. |
| **Oman** | Royal Decree 6/2022 (PDPL) and its Executive Regulations | Controller permits/registration in some cases; consent rules; breach notification. |
| **Kuwait** | Data Privacy Protection Regulation (CITRA) | Applies to telecom/IT service providers and their processing; notice, consent and breach notification. |
| **India** | Digital Personal Data Protection Act 2023 and the DPDP Rules | Notice in clear language; consent (or "legitimate uses" such as employment); grievance contact; breach intimation to the Data Protection Board and affected people; erasure when the purpose is served. |
| **Singapore** | PDPA 2012 | Consent/notification, DPO contact, access & correction within 30 days, retention limitation, mandatory breach notification (significant harm / scale). |
| **Malaysia** | PDPA 2010 (as amended 2024) | DPO appointment, mandatory breach notification, data portability, processors directly bound by security obligations. |
| **Thailand** | PDPA B.E. 2562 (2019) | GDPR-like rights; breach notification within 72 hours; DPO for some controllers. |
| **Philippines** | Data Privacy Act 2012 | Registration with the NPC for certain controllers, DPO, breach notification within 72 hours. |
| **Indonesia** | Law No. 27 of 2022 (PDP Law) | Rights similar to GDPR; breach notification within 3 x 24 hours; DPO for some processing. |
| **Vietnam** | Decree 13/2023 and the Personal Data Protection Law (from 2026) | Impact assessments and transfer impact assessments filed with the authority; consent rules. |

## What each organisation still has to do

The software gives you the tools; these steps are yours:

1. **Fill in Settings → Privacy & data protection**: privacy contact / DPO e-mail, retention period, and your own notice if the standard one doesn't fit.
2. **Decide the lawful basis** for each form (employment, contract, legal obligation, consent) and only ask for what you need.
3. **Sign a data processing agreement** with Velkomo listing the sub-processors and hosting region.
4. **Register / appoint a DPO** where your law requires it.
5. **Answer privacy requests on time** from Settings → *Privacy requests*; erase leavers' data when you no longer need it (user page → *Erase personal data*).
6. **Have a breach procedure**: who decides, who notifies the authority (often within 72 hours) and the people affected.
7. **Choose the hosting region** with transfer rules in mind (e.g. in-Kingdom hosting for Saudi organisations), and set `DATA_LOCATION` so notices say where data is stored.

## Settings for the operator (environment)

| Variable | Purpose |
|---|---|
| `DATA_LOCATION` | Shown in every privacy notice, e.g. `Supabase in Singapore (ap-southeast-1)`. |
| `PRIVACY_CONTACT_EMAIL` | Velkomo's own privacy contact, shown on `/privacy`. |
| `ANTHROPIC_API_KEY` | Leave empty if you don't want sample forms sent to the AI provider. |
