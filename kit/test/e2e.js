#!/usr/bin/env node
/*
 * 브라우저 테스트(선택): Playwright 가 설치된 환경에서만 돌아갑니다.
 *   npm i -D playwright && npx playwright install chromium   (처음 한 번)
 *   node kit/test/e2e.js
 * 먼저 node kit/build.js 로 kit/dist 와 kit/builder.html 을 만들어 두세요.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let pw;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) {
  try { pw = require(p); break; } catch (e) { /* 다음 후보 */ }
}
if (!pw) { console.log('Playwright 가 없어 브라우저 테스트를 건너뜁니다.'); process.exit(0); }

const KIT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
const HOST_PAGE = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>가게 홈페이지</title></head>' +
  '<body style="font-family:sans-serif;padding:40px"><h1>온기 커피 로스터스</h1><p>매일 볶는 커피</p>' +
  '<script src="/dist/cafe/widget.js" data-color="#5b3a29" data-label="궁금한 건 챗봇에게!" defer></script></body></html>';

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/host.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end(HOST_PAGE); }
  const file = path.join(KIT, url);
  if (!file.startsWith(KIT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let pass = 0, fail = 0;
async function step(name, fn) {
  try { await fn(); pass++; console.log('✔ ' + name); } catch (err) { fail++; console.log('✖ ' + name + '\n   ' + err.message); }
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  const errors = [];
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));

  async function ask(page, q) {
    const n = await page.locator('.msg.bot').count();
    await page.fill('#inp', q);
    await page.press('#inp', 'Enter');
    await page.waitForFunction((k) => document.querySelectorAll('.msg.bot').length > k && !document.getElementById('typing'), n);
    return page.locator('.msg.bot').last();
  }

  const demos = { cafe: ['주차 돼요?', '주차할 수 있나요?'], pension: ['바베큐 얼마예요', '바베큐를 할 수 있나요?'],
    academy: ['학원비 얼마예요', '수강료는 얼마인가요?'], club: ['악기 못 쳐도 돼요?', '악기를 못 쳐도 들어갈 수 있나요?'] };
  for (const [slug, [q, want]] of Object.entries(demos)) {
    await step(`${slug}: 첫 화면·답변·후보·모름·전체 질문`, async () => {
      const page = await ctx.newPage();
      await page.goto(`${base}/dist/${slug}/index.html`);
      await page.waitForSelector('.msg.bot .greet');
      assert.ok((await page.locator('#bname').textContent()).length > 0, '이름 없음');
      let last = await ask(page, q);
      assert.strictEqual((await last.locator('.q').textContent()).trim(), want);
      last = await ask(page, '양자역학 설명해줘');
      assert.ok((await last.textContent()).length > 10);
      assert.ok(await last.locator('.lnk').count() > 0, '못 찾았을 때 문의 버튼이 없음');
      await page.locator('.quick .chip').first().click();
      await page.waitForSelector('.all details');
      await page.locator('.all .chip').first().click();
      await page.waitForFunction(() => document.querySelectorAll('.msg.bot .q').length >= 2);
      await page.close();
    });
  }

  await step('cafe: 오타는 "혹시 ○○?"로 되묻고, 누르면 답한다', async () => {
    const page = await ctx.newPage();
    await page.goto(`${base}/dist/cafe/index.html`);
    const last = await ask(page, '주처 돼요?');
    assert.ok(/혹시 ‘주차’/.test(await last.textContent()));
    await last.locator('.chip').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('.msg.bot .q')].some((n) => n.textContent === '주차할 수 있나요?'));
    await page.close();
  });

  await step('cafe: 답변 속 링크 버튼·키보드 조작', async () => {
    const page = await ctx.newPage();
    await page.goto(`${base}/dist/cafe/index.html`);
    const last = await ask(page, '매장 위치');
    const href = await last.locator('.lnk').first().getAttribute('href');
    assert.ok(/^https:\/\/map\.naver\.com/.test(href), href);
    await page.locator('.quick .chip').nth(1).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /관련 질문이에요/.test(document.querySelector('.msg.bot:last-child').textContent));
    await page.close();
  });

  await step('위젯: 홈페이지 버튼 → 챗봇 열기 → Esc 로 닫기', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/host.html`);
    await page.click('.fbw-btn');
    const frame = page.frameLocator('.fbw-panel iframe');
    await frame.locator('.msg.bot .greet').waitFor();
    assert.ok(await page.locator('.fbw-panel.open').isVisible());
    assert.strictEqual(await page.getAttribute('.fbw-btn', 'aria-expanded'), 'true');
    const embedded = await page.frames()[1].evaluate(() => document.documentElement.classList.contains('embed'));
    assert.ok(embedded, '?embed=1 이 적용되지 않음');
    await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'IFRAME');
    await page.keyboard.press('Escape'); // 챗봇(iframe) 안에서 누른 Esc
    await page.waitForFunction(() => !document.querySelector('.fbw-panel.open'));
    assert.strictEqual(await page.getAttribute('.fbw-btn', 'aria-expanded'), 'false');
    await page.close();
  });

  await step('제작 도구: 미리보기·검증·내려받기', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/builder.html`);
    const frame = page.frameLocator('#preview');
    await frame.locator('.msg.bot .greet').waitFor();
    await page.fill('#f-name', '테스트 가게');
    await page.waitForFunction(() => {
      const d = document.getElementById('preview').contentDocument;
      const n = d && d.getElementById('bname');
      return n && n.textContent === '테스트 가게';
    });
    await page.fill('#f-test', '주차 돼요?');
    assert.ok(/주차할 수 있나요/.test(await page.locator('#testOut').textContent()));
    await page.fill('#f-csv', '질문,답변\n주차?,\n');
    await page.waitForFunction(() => document.getElementById('csvStatus').classList.contains('bad'));
    await page.click('#exBtns button:has-text("펜션")');
    await page.waitForFunction(() => /✔ 질문 17개/.test(document.getElementById('csvStatus').textContent));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dlHtml')]);
    const html = fs.readFileSync(await dl.path(), 'utf8');
    assert.ok(/숲속별빛 펜션/.test(html) && /window\.BOT=/.test(html));
    await page.close();
  });

  await step('페이지 오류 없음', async () => { assert.deepStrictEqual(errors, []); });

  await browser.close();
  server.close();
  console.log(`\n${fail ? '✖' : '✔'} 브라우저 테스트 통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
