// 모의 Apps Script 환경에서 생성된 .gs를 끝까지 돌려 본다.
// 사용: node test/test_form.js   (먼저 node build_form_gs.js pilot && node build_form_gs.js launch)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { makeEnv, walk, submit, ItemType } = require('./mock_gas');

const DIST = path.join(__dirname, '..', 'dist');
const LOCK = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spec.lock.json'), 'utf-8'));

function load(mode, opts = {}) {
  const M = makeEnv();
  let now = Date.parse('2026-11-04T01:00:00Z');
  const FakeDate = class extends Date {
    constructor(...a) { if (a.length) super(...a); else super(now); }
    static now() { now += opts.tick || 0; return now; }
  };
  M.env.Date = FakeDate;
  const ctx = vm.createContext({ ...M.env });
  vm.runInContext(fs.readFileSync(path.join(DIST, `form_builder.${mode}.gs`), 'utf-8'), ctx, { filename: `form_builder.${mode}.gs` });
  return { M, ctx };
}

let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ── 1) 시험용: 시간 제한으로 끊기고, 중간에 실패해도 이어서 끝까지 만든다 ──
{
  const { M, ctx } = load('pilot', { tick: 20000 });
  let runs = 0;
  // 한 번은 쪽 중간에서 실패시킨다
  const origAdd = ctx.addEntry_;
  let added = 0; let failed = false;
  ctx.addEntry_ = function (form, e) {
    added++;
    if (!failed && added === 101) { failed = true; throw new Error('모의 실패(쪽 중간)'); }
    return origAdd(form, e);
  };
  for (;;) {
    runs++;
    try { ctx.build(); } catch (err) { if (!/모의 실패/.test(err.message)) throw err; }
    if (M.props.FINALIZED === '1') break;
    if (runs > 40) throw new Error('build가 끝나지 않음');
  }
  const form = Object.values(M.forms).find((f) => f.title.includes('[시험]') && !f.title.includes('추첨'));
  assert.strictEqual(form.items.length, LOCK.n_items, '문항 수');
  console.log(`build ${runs}회 실행으로 완료 (중간 실패 1회 복구) · 문항 ${form.items.length}`);
  const errs = ctx.verify();
  assert.strictEqual(errs.length, 0, 'verify 오류: ' + errs.join(', '));
  console.log('verify 통과');
  assert(form.settings.login && !form.settings.email && !form.settings.progress && form.settings.accepting && !form.settings.one, '설정');
  assert(form.confirmation.includes(M.env.FormApp.openById(M.props.LOTTERY_ID).id), '완료 화면에 추첨 링크');
  const code = form.confirmation.match(/완료코드: (\w+)/)[1];
  const lot = M.forms[M.props.LOTTERY_ID];
  assert(lot.items[0].validation.rules[0][1] === `^${code}$`, '추첨 폼 코드 검증');
  const ss = M.sheets[M.props.SS_ID];
  assert.strictEqual(ss.sheets.codebook.data.length - 1, form.items.filter((x) => x.type !== ItemType.PAGE_BREAK).length, 'codebook 행 수');

  // ── 2) 가상 응답자 300명이 폼을 따라간다 ──
  const expect = { complete: 0, screened: 0, byStratumRoute: {} };
  const c1ToStratum = {}; Object.entries(LOCK.strata).forEach(([s, v]) => v.c1.forEach((c) => { c1ToStratum[c] = s; }));
  for (let n = 0; n < 300; n++) {
    const start = Date.parse('2026-11-04T03:00:00Z') + n * 600000;
    const durMin = 6 + Math.floor(rnd() * 14);
    const screenOut = rnd() < 0.05;
    let c1 = null; let day = null; let routeSeen = null;
    const hhmm = new Date(start + 9 * 3600000).toISOString().slice(11, 16);
    const res = walk(form, (it) => {
      const t = it.title;
      if (it.type === ItemType.MULTIPLE_CHOICE) {
        const vals = it.choices.map((c) => c.value);
        if (t.startsWith('위 안내를')) return screenOut ? '동의하지 않음' : '동의함';
        if (t.startsWith('현재 부산대학교')) return '예';
        if (t.startsWith('이 조사의 시험 응답')) return '아니오';
        if (t === '소속 계열') { c1 = pick(vals); return c1; }
        if (t.includes("'보통이다'를 골라")) return rnd() < 0.9 ? '보통이다' : '매우 있다';
        return pick(vals);
      }
      if (it.type === ItemType.LIST) { day = pick(it.choices.map((c) => c.value)); return day; }
      if (it.type === ItemType.TIME) return hhmm;
      if (it.type === ItemType.GRID) return it.rows.map(() => pick(it.cols));
      if (it.type === ItemType.CHECKBOX) {
        const vals = it.choices.map((c) => c.value);
        const k = 1 + Math.floor(rnd() * 3);
        return [...new Set(Array.from({ length: k }, () => pick(vals.slice(0, -1))))];
      }
      if (it.type === ItemType.PARAGRAPH_TEXT) return rnd() < 0.3 ? '시험 응답' : undefined;
      return undefined;
    });
    // 이 응답자가 본 카드 쪽
    const cardPages = res.answers.filter((a) => a.item.title === '이 직무에 신입으로 지원할 의향이 얼마나 있습니까?');
    if (screenOut) { expect.screened++; assert.strictEqual(cardPages.length, 0); }
    else {
      expect.complete++;
      assert.strictEqual(cardPages.length, 15, '카드 15장');
      const s = c1ToStratum[c1];
      routeSeen = LOCK.dayRoute[s][Number(day) - 1];
      const k = `${s}-${routeSeen}`; expect.byStratumRoute[k] = (expect.byStratumRoute[k] || 0) + 1;
    }
    submit(form, res.answers, new Date(start + durMin * 60000));
  }
  const out = ctx.exportTidy();
  const tr = ss.sheets.tidy_resp.data; const tc = ss.sheets.tidy_cards.data;
  const H = tr[0]; const col = (name) => H.indexOf(name);
  const rows = tr.slice(1);
  const complete = rows.filter((r) => r[col('status')] === 'complete');
  assert.strictEqual(complete.length, expect.complete, '완료 수');
  assert.strictEqual(rows.filter((r) => r[col('status')] === 'screened_out').length, expect.screened, '선별 종료 수');
  assert.strictEqual(tc.length - 1, expect.complete * 15, '카드 행 수');
  const got = {}; complete.forEach((r) => { const k = `${r[col('stratum')]}-${r[col('route')]}`; got[k] = (got[k] || 0) + 1; });
  assert.deepStrictEqual(got, expect.byStratumRoute, '계열×묶음 배정');
  // 카드 순서가 잠금 파일과 같은지
  const seqOf = Object.fromEntries(LOCK.routes.map((r) => [r.id, r.seq]));
  tc.slice(1).forEach((r) => { assert.strictEqual(seqOf[r[1]][r[4] - 1], r[5], '카드 순서'); assert(r[7] >= 1 && r[7] <= 5, 'A1 코드'); });
  // 비공개 묶음만 B1이 있다
  complete.forEach((r) => {
    const arm = r[col('arm')]; const b1 = H.filter((h) => h.startsWith('B1_')).map((h) => r[col(h)]).filter((x) => x !== '');
    assert.strictEqual(b1.length, arm === 'closed' ? 15 : 0, 'B1 개수');
    const d = r[col('duration_min')]; assert(d >= 6 && d <= 20, '응답 시간 ' + d);
  });
  console.log(`가상 응답 300명: 완료 ${expect.complete}, 선별 종료 ${expect.screened}, 정리 시트 일치, 배정 ${JSON.stringify(got)}`);

  // ── 3) 칸 균형 다시 맞추기 후에도 verify 통과 ──
  ctx.rebalance();
  const errs2 = ctx.verify();
  assert.strictEqual(errs2.length, 0, 'rebalance 후 verify: ' + errs2.join(', '));
  console.log('rebalance 후 verify 통과');
  ctx.purgeTestResponses();
  assert.strictEqual(form.responses.length, 0);
  assert.throws(() => ctx.launch(), /시험용/);
  console.log('시험 응답 삭제, 시험용에서 launch 차단 확인');
}

// ── 4) 배포용: 만들기 → launch → 마감 ──
{
  const { M, ctx } = load('launch', { tick: 0 });
  ctx.build();
  assert.strictEqual(M.props.FINALIZED, '1');
  const form = Object.values(M.forms).find((f) => f.title === '지역·수도권 기업 직무 선호 조사');
  assert(form, '배포용 폼 제목');
  assert(!form.settings.accepting, 'launch 전에는 응답 받지 않음');
  ctx.launch();
  assert(form.settings.accepting && form.settings.one, 'launch 후 응답 받기·1인 1회');
  assert.strictEqual(M.triggers.length, 1, '정리 시트 트리거');
  ctx.closeSurvey();
  assert(!form.settings.accepting && M.triggers.length === 0, '마감');
  assert.throws(() => ctx.purgeTestResponses(), /배포용/);
  console.log('배포용: build → launch → closeSurvey 확인');
}
console.log('모든 시험 통과');
