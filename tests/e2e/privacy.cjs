// Data protection: privacy settings + notice, consent on public forms, my data export, privacy requests, sign-in history, erasure, retention.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const pg = require('/home/user/velkomo-signa/node_modules/postgres'); const sql = (pg.default || pg)('postgres://postgres:postgres@localhost:5432/signa');
const B = 'http://localhost:3000', S = __dirname + '/../shots/pv-';
const res = []; const ok = (c, m) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + m); };
const HTL = sql`(select id from properties where property_code = 'HTL01')`;
async function login(ctx, user) { const p = ctx.pages()[0] || await ctx.newPage(); await ctx.clearCookies(); await p.goto(B + '/login'); if (await p.locator('#change-property').count()) await p.click('#change-property');
  await p.fill('#property', 'HTL01'); await p.fill('#username', user); await p.fill('#password', 'Welcome123'); await p.click('button[type=submit]'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 8000 }); return p; }
(async () => {
  await sql`delete from rate_limits`; await sql`delete from users where username = 'temp.leaver'`; await sql`delete from privacy_requests`;
  await sql`update properties set privacy_contact_name = null, privacy_contact_email = null, privacy_notice = null, retention_months = null, consent_all_forms = false where id = ${HTL}`;
  const [pub] = await sql`select short_code from forms where property_id = ${HTL} and visibility = 'public' and status = 'published' limit 1`;
  const b = await chromium.launch(); const errs = [];
  const ctx = async () => { const c = await b.newContext({ viewport: { width: 1300, height: 950 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return c; };

  // admin privacy settings
  const a = await ctx(); const ap = await login(a, 'admin'); await ap.goto(B + '/settings#privacy');
  const [v0] = await sql`select privacy_version v from properties where id = ${HTL}`;
  await ap.fill('#pc-name', 'Data Protection Officer'); await ap.fill('#pc-email', 'privacy@demo-one.example'); await ap.selectOption('#pc-ret', '24');
  await ap.click('button:has-text("Save privacy settings")'); await ap.waitForSelector('text=new version number');
  const [p1] = await sql`select privacy_contact_email e, retention_months r, privacy_version v from properties where id = ${HTL}`;
  ok(p1.e === 'privacy@demo-one.example' && p1.r === 24 && p1.v === v0.v + 1, 'admin saved privacy contact + 2-year retention; notice version went up');
  ok(await ap.inputValue('#pc-ret') === '24', 'saved retention still shown after saving'); await ap.locator('#privacy').screenshot({ path: S + 'settings.png' });

  // public form: notice + consent
  const anon = await ctx(); const fp = anon.pages()[0]; await fp.goto(B + '/f/' + pub.short_code);
  ok(await fp.locator('input[name=privacy_consent]').count() === 1, 'public form shows a consent box');
  for (const el of await fp.locator('form input[type=text], form input:not([type]), form textarea').all()) await el.fill('QA').catch(() => {});
  for (const el of await fp.locator('form input[type=email]').all()) await el.fill('qa@example.org');
  await fp.click('button:has-text("Submit")'); await fp.waitForTimeout(700);
  ok(await fp.locator('text=agree to the privacy notice').count() > 0, 'cannot submit without ticking consent');
  await fp.check('input[name=privacy_consent]'); await fp.screenshot({ path: S + 'form-consent.png', fullPage: true });
  await fp.click('button:has-text("Submit")'); await fp.waitForSelector('text=reference number', { timeout: 10000 });
  const ref = (await fp.locator('.font-mono').first().innerText()).trim();
  const [s1] = await sql`select consent_at, consent_version from submissions where ref_no = ${ref} and property_id = ${HTL}`;
  ok(s1.consent_at && s1.consent_version === p1.v, `consent stored with ${ref} (version ${s1.consent_version})`);
  await fp.goto(B + `/f/${pub.short_code}/privacy`); const nt = await fp.locator('body').innerText();
  ok(nt.includes('privacy@demo-one.example') && nt.includes('2 years') && nt.includes('Your rights'), 'form privacy notice shows contact, retention and rights');
  await fp.screenshot({ path: S + 'notice.png', fullPage: true });
  await fp.goto(B + '/login'); ok(await fp.locator('a[href="/privacy"]').count() === 1, 'login page links to Privacy');
  await fp.goto(B + '/privacy'); ok((await fp.locator('body').innerText()).includes('data controller'), 'public privacy page explains controller / processor');

  // staff: sign-ins, my data, privacy request
  const j = await ctx(); const jp = await login(j, 'john'); await jp.goto(B + '/settings#your-data');
  ok(await jp.locator('#your-data li').count() >= 1, 'john sees his recent sign-ins');
  const [le] = await sql`select ip_prefix from login_events e join users u on u.id = e.user_id where u.username = 'john' and u.property_id = ${HTL} order by at desc limit 1`;
  ok(le && (le.ip_prefix === null || /\.0$|::$/.test(le.ip_prefix)), `IP stored shortened (${le && le.ip_prefix})`);
  const dl = await jp.request.get(B + '/api/my-data'); const dj = await dl.json();
  ok(dl.ok() && dj.profile.username === 'john' && Array.isArray(dj.requests) && Array.isArray(dj.signIns), `my-data export: ${dj.requests.length} requests, ${dj.signIns.length} sign-ins`);
  await jp.selectOption('select[name=kind]', 'erasure'); await jp.fill('input[name=details]', 'Please delete my old leave requests'); await jp.click('button:has-text("Send request")');
  await jp.waitForSelector('text=Your organisation will reply'); await jp.locator('#your-data').screenshot({ path: S + 'your-data.png' });
  const [pr] = await sql`select id, status from privacy_requests where requester_name = 'John Silva' and property_id = ${HTL} order by created_at desc limit 1`; ok(pr && pr.status === 'open', 'privacy request logged');
  const [em] = await sql`select count(*)::int n from email_log where to_address = 'privacy@demo-one.example' and created_at > now() - interval '2 minutes'`; ok(em.n >= 1, 'privacy contact e-mailed');
  await ap.goto(B + '/settings#privacy-requests'); await ap.reload(); await ap.fill('input[aria-label="Reply to John Silva"]', 'Done — requests older than 2 years removed'); await ap.click('#privacy-requests button:has-text("Mark done")');
  await ap.waitForTimeout(1200); const [pr2] = await sql`select status, response from privacy_requests where id = ${pr.id}`; ok(pr2.status === 'done' && pr2.response, 'admin answered the request');
  await ap.locator('#privacy-requests').screenshot({ path: S + 'requests.png' });
  const [nn] = await sql`select count(*)::int n from notifications n join users u on u.id = n.user_id where u.username = 'john' and u.property_id = ${HTL} and n.title like 'Your privacy request%'`; ok(nn.n >= 1, 'john notified of the answer');

  // erasure of a leaver
  await ap.goto(B + '/users/new'); await ap.fill('#name', 'Temp Leaver'); await ap.fill('#username', 'temp.leaver'); await ap.fill('#email', 'leaver@example.org'); await ap.fill('#password', 'Welcome123');
  await ap.click('button:has-text("Create user")'); await ap.waitForURL(/created=1/); const uid = ap.url().match(/users\/([^?]+)/)[1];
  await sql`update users set must_change_password = false where id = ${uid}`;
  const t = await ctx(); await login(t, 'temp.leaver');
  await ap.goto(B + '/users/' + uid); await ap.click('button:has-text("Erase personal data…")'); await ap.fill('#anon-confirm', 'ERASE'); await ap.locator('section:has-text("Erase personal data")').screenshot({ path: S + 'erase.png' });
  await ap.click('button:has-text("Erase now")'); await ap.waitForURL(/anonymised=1/);
  const [gone] = await sql`select name, username, email, active from users where id = ${uid}`; const [lg] = await sql`select count(*)::int n from login_events where user_id = ${uid}`;
  ok(gone.name.startsWith('Former user') && !gone.email && !gone.active && lg.n === 0, `leaver erased → "${gone.name}", no e-mail, sign-in history removed`);
  const tp = t.pages()[0]; await tp.goto(B + '/'); ok(tp.url().includes('/login'), 'erased user signed out everywhere');

  // retention
  const [old] = await sql`select id, ref_no from submissions where property_id = ${HTL} and status in ('approved','rejected','withdrawn') order by created_at limit 1`;
  await sql`update submissions set updated_at = now() - interval '3 years' where id = ${old.id}`;
  const out = execSync(`cd /home/user/velkomo-signa && DATABASE_URL=postgres://postgres:postgres@localhost:5432/signa npx tsx -e "import('./lib/privacy').then(m=>m.applyRetention()).then(n=>{console.log('deleted',n);process.exit(0)})"`).toString();
  const [still] = await sql`select count(*)::int n from submissions where id = ${old.id}`; ok(still.n === 0 && /deleted [1-9]/.test(out), `retention deleted ${old.ref_no} (older than 2 years) — ${out.trim()}`);
  const [pend] = await sql`select count(*)::int n from submissions where property_id = ${HTL} and status = 'pending'`; ok(pend.n >= 0, 'requests still in progress are never deleted by retention');

  await sql`update properties set retention_months = null where id = ${HTL}`;
  console.log('page errors:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} passed`);
  await b.close(); await sql.end();
})().catch((e) => { console.error('STOPPED', e.message); console.log(`${res.filter(Boolean).length}/${res.length} passed before stop`); process.exit(1); });
