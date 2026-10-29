// usage: node geo_tbm.js places.json geo.json  — Google Maps search data endpoint, default headless UA, 2.5 s pacing
const { chromium } = require('playwright'); const fs = require('fs');
const [,, inp, outp] = process.argv; const items = JSON.parse(fs.readFileSync(inp, 'utf8'));
const prev = fs.existsSync(outp) ? JSON.parse(fs.readFileSync(outp, 'utf8')) : {};
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ locale: 'en-US' });
  for (const it of items) {
    if (prev[it.id] && prev[it.id].lat) continue;
    const res = { q: it.q };
    try {
      const r = await ctx.request.get('https://www.google.com/search?tbm=map&hl=en&q=' + encodeURIComponent(it.q), { timeout: 45000 });
      const t = (await r.text()).replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\"/g, '"');
      const m = t.match(/\[null,null,(1[4-7]\.\d{3,}),(10[6-9]\.\d{3,})\]/);
      if (m) { res.lat = +(+m[1]).toFixed(6); res.lng = +(+m[2]).toFixed(6);
        const win = t.slice(m.index, m.index + 3000); res.strings = [...win.matchAll(/"([^"\\]{3,70})"/g)].map(x => x[1]).filter(s => /[A-Za-zÀ-ỹ]/.test(s) && !/^(0x|http|\/g\/|ChIJ|SearchResult)/.test(s)).slice(0, 6); }
      res.status = r.status();
    } catch (e) { res.err = String(e).slice(0, 120); }
    prev[it.id] = res; fs.writeFileSync(outp, JSON.stringify(prev, null, 1));
    console.log(it.id.padEnd(14), res.lat, res.lng, '|', (res.strings || []).slice(0, 3).join(' / ').slice(0, 110));
    await new Promise(r => setTimeout(r, 2500));
  }
  await b.close(); })();
