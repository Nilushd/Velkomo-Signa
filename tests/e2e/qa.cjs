// Full-app QA: the everyday request → approval → print/verify flow, permissions, cancel, e-mail approval, and a phone-width layout scan.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const pg = require('/home/user/velkomo-signa/node_modules/postgres'); const sql = (pg.default || pg)('postgres://postgres:postgres@localhost:5432/signa');
const B = 'http://localhost:3000', S = __dirname + '/../shots/qa-';
const results = []; const ok = (c, m) => { results.push([!!c, m]); console.log((c ? 'PASS ' : 'FAIL ') + m); };
const HTL = sql`(select id from properties where property_code = 'HTL01')`;
async function login(ctx, user, code = 'HTL01') {
  const p = ctx.pages()[0] || await ctx.newPage(); await ctx.clearCookies(); await p.goto(B + '/login');
  if (await p.locator('#change-property').count()) await p.click('#change-property');
  await p.fill('#property', code); await p.fill('#username', user); await p.fill('#password', 'Welcome123'); await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 8000 }).catch(() => {});
  if (p.url().includes('change-password')) throw new Error(user + ' must change password');
  return p;
}
async function fillLeave(p, reason) {
  await p.selectOption('select', { index: 1 });
  const dates = p.locator('input[type=date]'); await dates.nth(0).fill('2027-01-10'); await dates.nth(1).fill('2027-01-12');
  await p.fill('input[type=number]', '3');
  const ta = p.locator('textarea'); if (await ta.count()) await ta.first().fill(reason);
  const file = p.locator('input[type=file]:not([capture])'); if (await file.count()) { fs.writeFileSync('/tmp/qa-note.pdf', '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'); await file.first().setInputFiles('/tmp/qa-note.pdf'); await p.waitForTimeout(800); }
  const c = p.locator('canvas'); if (await c.count()) { await c.scrollIntoViewIfNeeded(); const bx = await c.boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + 40); await p.mouse.down(); for (let i = 0; i < 10; i++) await p.mouse.move(bx.x + 20 + i * 18, bx.y + 40 - Math.sin(i) * 20, { steps: 2 }); await p.mouse.up(); }
}
(async () => {
  await sql`delete from rate_limits`; await sql`update users set failed_logins = 0, locked_until = null, must_change_password = false where property_id = ${HTL}`;
  await sql`update delegations set cancelled_at = now() where cancelled_at is null`;
  const [form] = await sql`select id, short_code from forms where property_id = ${HTL} and title = 'Leave Request'`;
  await sql`update forms set status = 'published' where id = ${form.id}`;
  const b = await chromium.launch(); const errs = [];
  const mk = async () => { const c = await b.newContext({ viewport: { width: 1360, height: 950 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return c; };
  const john = await mk(), sup = await mk(), adm = await mk(), mgr = await mk();

  // 1. submit
  let jp = await login(john, 'john'); await jp.goto(B + '/f/' + form.short_code); await fillLeave(jp, 'QA family event');
  await jp.click('button:has-text("Submit")'); await jp.waitForSelector('text=reference number', { timeout: 10000 });
  const ref = (await jp.locator('.font-mono').first().innerText()).trim();
  const [s1] = await sql`select id, status, current_level, version from submissions where ref_no = ${ref} and property_id = ${HTL}`;
  ok(s1 && s1.status === 'pending' && s1.current_level === 1, `john submitted ${ref}; waiting at level 1`);
  const [att] = await sql`select count(*)::int n from files where property_id = ${HTL} and attached_at is not null and created_at > now() - interval '2 minutes'`; ok(att.n >= 1, 'attachment stored with the request');
  const l1 = await sql`select u.username, a.decision from approvals a join users u on u.id = a.approver_user_id where a.submission_id = ${s1.id} and a.level = 1`;
  ok(l1.length >= 1 && l1.every((x) => x.decision === 'pending'), `level 1 approvers notified: ${l1.map((x) => x.username).join(', ')}`);
  const [mail] = await sql`select count(*)::int n from email_log where created_at > now() - interval '2 minutes'`; ok(mail.n >= 1, `e-mails queued/logged (${mail.n})`);

  // 2. level 1 approves from the app (supervisor), others closed
  const sp = await login(sup, 'supervisor'); await sp.goto(B + '/approvals'); await sp.click(`text=${ref}`); await sp.waitForSelector('text=Your decision');
  await sp.click('button:has-text("Approve")'); await sp.fill('#cm', 'Fine by me'); await sp.click('button:has-text("Confirm")'); await sp.waitForTimeout(1500);
  const [s2] = await sql`select current_level, status from submissions where id = ${s1.id}`; ok(s2.current_level === 2 && s2.status === 'pending', 'level 1 approved → moved to level 2');
  const closed = await sql`select decision, closed_note from approvals where submission_id = ${s1.id} and level = 1 and decision = 'closed'`;
  ok(l1.length < 2 || closed.length >= 1, 'other level-1 approvers closed ("first to act decides")');

  // 3. level 2 rejects with comment
  const ap = await login(adm, 'admin'); await ap.goto(B + '/approvals'); await ap.click(`text=${ref}`); await ap.waitForSelector('text=Your decision');
  await ap.click('button:has-text("Reject")'); const confirmBtn = ap.locator('button:has-text("Confirm")');
  ok(await confirmBtn.isDisabled(), 'reject needs a comment'); await ap.fill('#cm', 'Dates clash with stock count'); await confirmBtn.click(); await ap.waitForTimeout(1500);
  const [s3] = await sql`select status from submissions where id = ${s1.id}`; ok(s3.status === 'rejected', 'level 2 rejected');

  // 4. john resubmits
  jp = await login(john, 'john'); await jp.goto(B + '/requests/' + s1.id); await jp.waitForSelector('text=rejected');
  await jp.click('button:has-text("Edit")'); await jp.waitForSelector('button:has-text("Resubmit")'); const ta = jp.locator('textarea'); if (await ta.count()) await ta.first().fill('QA moved dates');
  await jp.click('button:has-text("Resubmit")'); await jp.waitForTimeout(2000);
  const [s4] = await sql`select status, version, current_level from submissions where id = ${s1.id}`; ok(s4.status === 'pending' && s4.version === 2 && s4.current_level === 1, 'resubmitted as version 2, back to level 1');
  const [vers] = await sql`select count(*)::int n from submission_versions where submission_id = ${s1.id}`; ok(vers.n >= 1, 'previous version kept in history');

  // 5. quick approve (supervisor) then bulk approve (admin) with a second request
  await sp.goto(B + '/approvals'); await sp.click(`button[aria-label="Approve ${ref}"]`); await sp.waitForTimeout(1500);
  jp = await login(john, 'john'); await jp.goto(B + '/f/' + form.short_code); await fillLeave(jp, 'QA second'); await jp.click('button:has-text("Submit")'); await jp.waitForSelector('text=reference number');
  const ref2 = (await jp.locator('.font-mono').first().innerText()).trim();
  await sp.goto(B + '/approvals'); await sp.click(`button[aria-label="Approve ${ref2}"]`); await sp.waitForTimeout(1500);
  await ap.goto(B + '/approvals'); await ap.check(`input[aria-label="Select ${ref}"]`); await ap.check(`input[aria-label="Select ${ref2}"]`);
  await ap.click('button:has-text("Approve 2")'); await ap.waitForTimeout(2500);
  const both = await sql`select ref_no, status from submissions where ref_no in (${ref}, ${ref2}) and property_id = ${HTL}`;
  ok(both.length === 2 && both.every((x) => x.status === 'approved'), 'quick approve + bulk approve → both approved');

  // 6. print, PDF, verify, export
  await ap.goto(B + '/print/' + s1.id); ok(await ap.locator('text=Approval record').count() > 0 && await ap.locator(`text=${ref}`).count() > 0, 'printable document shows ref and approval record');
  const pdf = await ap.request.get(B + `/api/pdf?ids=${s1.id}`); ok(pdf.ok() && (pdf.headers()['content-type'] || '').includes('pdf'), `PDF download (${pdf.status()})`);
  const [vc] = await sql`select verify_code from submissions where id = ${s1.id}`;
  const anon = await b.newContext(); const vp = await anon.newPage(); await vp.goto(B + '/v/' + vc.verify_code);
  const vt = await vp.locator('body').innerText(); ok(/genuine|verified|approved/i.test(vt) && vt.includes(ref), 'QR verification page confirms the document');
  ok(!vt.includes('QA moved dates'), 'verification page does not reveal answers');
  const xl = await ap.request.get(B + `/api/export/${form.id}`); ok(xl.ok(), `Excel export for admin (${xl.status()})`);

  // 7. permissions
  jp = await login(john, 'john');
  await jp.goto(B + '/users'); ok(!jp.url().endsWith('/users'), 'general user cannot open Users');
  const xj = await jp.request.get(B + `/api/export/${form.id}`); ok(!xj.ok(), `general user cannot export (${xj.status()})`);
  const [other] = await sql`select s.id from submissions s where s.property_id = (select id from properties where property_code = 'HTL02') limit 1`;
  if (other) { await jp.goto(B + '/requests/' + other.id); ok((await jp.locator('body').innerText()).match(/not found|404|doesn/i) || !jp.url().includes(other.id), 'cannot open another hotel\'s request'); }
  const notes = await sql`select count(*)::int n from notifications n join users u on u.id = n.user_id where u.username = 'john' and u.property_id = ${HTL} and n.created_at > now() - interval '5 minutes'`;
  ok(notes[0].n >= 1, 'requester got in-app notifications');

  // 8. cancel before anyone acts
  await jp.goto(B + '/f/' + form.short_code); await fillLeave(jp, 'QA to cancel'); await jp.click('button:has-text("Submit")'); await jp.waitForSelector('text=reference number');
  const ref3 = (await jp.locator('.font-mono').first().innerText()).trim(); const [s5] = await sql`select id from submissions where ref_no = ${ref3} and property_id = ${HTL}`;
  await jp.goto(B + '/requests/' + s5.id); jp.once('dialog', (d) => d.accept()); await jp.click('button:has-text("Cancel request")'); await jp.waitForTimeout(1500);
  const [s6] = await sql`select status from submissions where id = ${s5.id}`; ok(s6.status === 'withdrawn', 'requester cancelled before any approval');

  // 9. e-mail approval link (no sign-in)
  await jp.goto(B + '/f/' + form.short_code); await fillLeave(jp, 'QA e-mail approval'); await jp.click('button:has-text("Submit")'); await jp.waitForSelector('text=reference number');
  const ref4 = (await jp.locator('.font-mono').first().innerText()).trim();
  const [em] = await sql`select html from email_log where html like ${'%' + ref4 + '%'} and html like '%/a/%' order by created_at desc limit 1`;
  const link = em && (em.html.match(/https?:\/\/[^"'\s]+\/a\/[A-Za-z0-9_-]+/) || [])[0];
  ok(!!link, 'approval e-mail contains a one-time link');
  if (link) {
    const ep = await (await b.newContext()).newPage(); await ep.goto(link.replace(/^https?:\/\/[^/]+/, B));
    await ep.click('button:has-text("Approve")'); await ep.click('button:has-text("Confirm")'); await ep.waitForTimeout(1500);
    const [s7] = await sql`select current_level, status from submissions where ref_no = ${ref4} and property_id = ${HTL}`; ok(s7.current_level === 2 || s7.status === 'approved', 'approved from the e-mail without signing in');
    await ep.goto(link.replace(/^https?:\/\/[^/]+/, B)); ok(/already|no action/i.test(await ep.locator('body').innerText()), 'the same link cannot be used twice');
  }

  // 10. phone-width layout scan
  const phone = await b.newContext({ ...devices['iPhone 13'] }); const pp = await phone.newPage();
  const scan = async (who, paths) => { await login(phone, who); for (const path of paths) { await pp.goto(B + path); await pp.waitForLoadState('networkidle');
    const r = await pp.evaluate(() => { const W = document.documentElement.clientWidth; const bad = []; document.querySelectorAll('main *').forEach((e) => { const b = e.getBoundingClientRect(); if (b.width > 0 && b.right > W + 2 && getComputedStyle(e).position !== 'fixed') bad.push((e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName) + '@' + Math.round(b.right)); }); return { over: document.documentElement.scrollWidth - W, bad: bad.slice(0, 3) }; });
    ok(r.over <= 0, `phone layout ${who} ${path}${r.over > 0 ? ' overflows ' + r.over + 'px ' + r.bad.join(' ') : ''}`); } };
  await scan('admin', ['/', '/forms', '/forms/studio', '/my-forms', '/requests', '/approvals', '/submissions', '/users', '/users/groups', '/users/access', '/settings', '/notifications', '/requests/' + s1.id, '/submissions/' + s1.id, '/forms/' + form.id + '/edit']);
  await pp.goto(B + '/approvals'); await pp.screenshot({ path: S + 'phone-approvals.png' });
  await scan('john', ['/', '/my-forms', '/requests', '/f/' + form.short_code]);

  console.log('page errors:', errs.length ? errs : 'none');
  const fails = results.filter((r) => !r[0]); console.log(`\n${results.length - fails.length}/${results.length} passed`);
  await b.close(); await sql.end();
})().catch(async (e) => { console.error('STOPPED', e.message); console.log(`${results.filter((r) => r[0]).length}/${results.length} passed before stop`); process.exit(1); });
