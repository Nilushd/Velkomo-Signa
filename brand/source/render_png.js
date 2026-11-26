// render.js <svgdir> <outdir> <jobs.json>: each job {svg, out, width, bg?}
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [dir, out, jobsFile] = process.argv.slice(2), jobs = JSON.parse(fs.readFileSync(jobsFile));
  const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); const pg = await b.newPage();
  for (const j of jobs) {
    const src = fs.readFileSync(path.join(dir, j.svg + '.svg'), 'utf8');
    const [, vw, vh] = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
    const w = j.width, h = Math.round(w * vh / vw);
    await pg.setViewportSize({width: w, height: h});
    await pg.setContent(`<html><body style="margin:0;background:${j.bg || 'transparent'}">${src.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`)}</body></html>`);
    fs.mkdirSync(path.dirname(path.join(out, j.out)), {recursive: true});
    await pg.screenshot({path: path.join(out, j.out), omitBackground: !j.bg, clip: {x: 0, y: 0, width: w, height: h}});
  }
  await b.close();
})();
