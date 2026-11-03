// 모의 Apps Script 환경에서 생성된 dist/usage_task.gs 를 끝까지 돌려 본다.
// 사용: node reports/usage_task/test/test_usage_gs.js   (먼저 node reports/usage_task/build_usage_gs.js)
// 1) build: 시간 제한으로 끊기고 쪽 중간에서 실패해도 이어서 끝까지 만든다 → verify 0건, 설정
// 2) 경로: 동의 안 함 → 바로 제출, G1(동화엔텍 카드 → 태광후지킨 공고 → 마무리), G2(공고 → 카드 → 마무리), 자료 글이 파일과 같음
// 3) 퀴즈: 경로마다 12문항, 배점 1, 정답 1개(usage.lock.json 과 같은 자리)
// 4) 참가자 10명(+시험 1, 동의 안 함 1, 재응답 1) 제출 → exportTidy → 점수·시간·형식이 기대와 같음
// 5) tidy·원 응답 시트 CSV를 analyze_usage.py 로: --draft 없으면 거절(2), --draft 면 usage 블록, 두 입력의 결과가 같음
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { makeEnv, walk, submit, ItemType } = require('./mock_gas');

const HERE = path.join(__dirname, '..');
const LOCK = JSON.parse(fs.readFileSync(path.join(HERE, 'usage.lock.json'), 'utf-8'));
const SPEC = JSON.parse(fs.readFileSync(path.join(HERE, 'usage_spec.json'), 'utf-8'));
const GS = fs.readFileSync(path.join(HERE, 'dist', 'usage_task.gs'), 'utf-8');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const plain = (x) => JSON.parse(JSON.stringify(x)); // vm 안에서 만든 배열은 프로토타입이 달라 깊은 비교 전에 바꾼다

function load(opts = {}) {
  const M = makeEnv();
  let now = Date.parse('2026-11-11T01:00:00Z');
  const FakeDate = class extends Date {
    constructor(...a) { if (a.length) super(...a); else super(now); }
    static now() { now += opts.tick || 0; return now; }
  };
  M.env.Date = FakeDate;
  const ctx = vm.createContext({ ...M.env });
  vm.runInContext(GS, ctx, { filename: 'usage_task.gs' });
  return { M, ctx };
}
const pagesOf = (form) => {
  const pages = [[]];
  form.items.forEach((it) => { if (it.type === ItemType.PAGE_BREAK) pages.push([it]); else pages[pages.length - 1].push(it); });
  return pages;
};

// ── 1) build ──
const { M, ctx } = load({ tick: 60000 });
const origAdd = ctx.addEntry_;
let added = 0; let failed = false;
ctx.addEntry_ = function (form, e) {
  added += 1;
  if (!failed && added === 20) { failed = true; throw new Error('모의 실패(쪽 중간)'); }
  return origAdd(form, e);
};
let runs = 0;
for (;;) {
  runs += 1;
  try { ctx.build(); } catch (err) { if (!/모의 실패/.test(err.message)) throw err; }
  if (M.props.FINALIZED === '1') break;
  if (runs > 30) throw new Error('build 가 끝나지 않음');
}
const form = Object.values(M.forms)[0];
assert.strictEqual(Object.keys(M.forms).length, 1, '폼은 하나만');
assert.strictEqual(form.items.length, LOCK.n_items, '문항 수');
assert(runs >= 3, '시간 제한으로 나눠 실행되어야 함');
console.log(`build ${runs}회 실행으로 완료(시간 제한 이어 하기 + 쪽 중간 실패 1회 복구) · 문항 ${form.items.length} · 쪽 ${pagesOf(form).length}`);
const errs = ctx.verify();
assert.strictEqual(errs.length, 0, 'verify 오류: ' + errs.join(', '));
const S = form.settings;
assert(form.quiz && !S.email && !S.login && !S.one && !S.shuffle && !S.progress && S.accepting && !S.again && !S.edits && !S.summary, '설정 ' + JSON.stringify(S));
assert.strictEqual(form.confirmation, SPEC.form.confirmation);
assert(form.description.includes('2026. 12. 31.') && form.description.includes('참가 번호'), '첫 쪽 안내');
assert(!/@/.test(form.description), '안내에 이메일 없음');
const ss = M.sheets[M.props.SS_ID];
assert(ss.sheets.codebook && ss.sheets.meta, '코드북·메타 시트');
assert(M.logs.some((l) => l.startsWith('응답 링크(참가자용): https://')) && M.logs.some((l) => l.startsWith('수정 링크(팀용): https://')), '링크 로그');
assert(M.logs.some((l) => l.includes('점검(verify) 통과')), 'verify 통과 로그');
assert(M.logs.filter((l) => l.startsWith('직접 할 일')).length === SPEC.form.manual_steps.length, '직접 할 일 로그');
console.log('verify 통과 · 설정(퀴즈 켬, 이메일·로그인·1회 제한·섞기 끔) · 링크와 직접 할 일 로그 확인');

// ── 2)·3) 경로와 자료, 퀴즈 정답 ──
const pages = pagesOf(form);
const QBY = Object.fromEntries(LOCK.questions.map((q) => [q.title, q]));
const material = (name, fmt) => fs.readFileSync(path.join(HERE, fmt === 'card' ? SPEC.companies[name].card.file : SPEC.companies[name].posting.file), 'utf-8');
function answerer(p) {
  // p: {consent, group, pid, ans: {DH: [..6], TK: [..6]} (선택지 번호), time: {DH, TK}, ease: {DH, TK}, more: {DH, TK}}
  return (it) => {
    if (it.title === LOCK.consent.title) return p.consent;
    if (it.title === LOCK.group_title) return p.group;
    if (QBY[it.title]) { const q = QBY[it.title]; return q.choices[p.ans[q.code][Number(q.key.slice(2)) - 1] - 1]; }
    if (it.title === LOCK.pid.title) return p.pid;
    for (const code of Object.values(LOCK.codes)) {
      const C = LOCK.closing[code];
      if (it.title === C.ease) return String(p.ease[code]);
      if (it.title === C.more) return p.more ? p.more[code] : undefined;
      if (it.title === C.time) return String(p.time[code]);
    }
    throw new Error('모르는 문항 ' + it.title);
  };
}
const allRight = { DH: LOCK.questions.filter((q) => q.code === 'DH').map((q) => q.correct), TK: LOCK.questions.filter((q) => q.code === 'TK').map((q) => q.correct) };
const pathInfo = {};
for (const g of Object.keys(SPEC.groups)) {
  const res = walk(form, answerer({ consent: LOCK.consent.yes, group: g, pid: '시험(연습 응답)', ans: allRight, time: { DH: 1, TK: 1 }, ease: { DH: 3, TK: 3 } }));
  const seen = res.visited.map((k) => pages[k]);
  const titles = seen.map((pg) => (pg[0].type === ItemType.PAGE_BREAK ? pg[0].title : '(첫 쪽)'));
  const want = ['(첫 쪽)', SPEC.form.group.page_title, ...SPEC.order.map((n) => SPEC.form.material_page_title.replace('{company}', n)), SPEC.form.closing.page_title];
  assert.deepStrictEqual(titles, want, `${g} 쪽 순서`);
  SPEC.order.forEach((name, i) => {
    const pg = seen[2 + i];
    const fmt = SPEC.groups[g][name];
    const secs = pg.filter((it) => it.type === ItemType.SECTION_HEADER);
    const quiz = pg.filter((it) => it.type === ItemType.MULTIPLE_CHOICE);
    const text = material(name, fmt);
    assert.strictEqual(secs[0].title, text.split('\n')[0], `${g} ${name} 자료 첫 줄(${fmt})`);
    assert.strictEqual(norm([secs[0].title, ...secs.map((s) => s.help)].join('\n')), norm(text), `${g} ${name} 자료 글이 파일과 같음`);
    secs.forEach((s) => assert(s.help.length <= SPEC.form.chunk_max, '설명 칸 길이'));
    assert.strictEqual(quiz.length, 6, `${g} ${name} 문항 6개`);
    quiz.forEach((it) => {
      const q = QBY[it.title];
      assert(q && q.company === name, '문항 기업');
      assert.strictEqual(it.points, 1, '배점 1');
      assert(it.required, '필수');
      assert.deepStrictEqual(plain(it.choices.map((c) => c.value)), q.choices, '선택지');
      const right = plain(it.choices.map((c, n) => (c.isCorrectAnswer() ? n + 1 : 0)).filter(Boolean));
      assert.deepStrictEqual(right, [q.correct], `${q.key} 정답 자리`);
    });
    // 자료가 문항보다 위에 있다
    assert(pg.indexOf(secs[secs.length - 1]) < pg.indexOf(quiz[0]), '자료가 문항 위');
  });
  pathInfo[g] = SPEC.order.map((n) => SPEC.groups[g][n]).join('→');
}
const noC = walk(form, answerer({ consent: LOCK.consent.no }));
assert.deepStrictEqual(noC.visited, [0], '동의 안 함 → 바로 제출');
assert.strictEqual(noC.answers.length, 1);
console.log(`경로 확인: G1 ${pathInfo.G1}, G2 ${pathInfo.G2}, 동의 안 함 → 제출 · 자료 글 = 자료 파일 · 퀴즈 24문항(경로마다 12) 정답·배점 확인`);

// ── 4) 참가자 10명 ──
// 정답 패턴: 카드는 pid%4==0 이면 1문항 틀림, 공고는 (pid%3)+1 문항 틀림. 틀린 답은 '자료에 나와 있지 않음'(4번)이나 다른 오답.
const wrong = (q) => (q.correct === 1 ? 4 : 1);
function plan(pid) {
  const group = pid % 2 ? 'G1' : 'G2';
  const ans = {}; const exp = {};
  for (const [name, code] of Object.entries(LOCK.codes)) {
    const fmt = SPEC.groups[group][name];
    const qs = LOCK.questions.filter((q) => q.code === code);
    const nWrong = fmt === 'card' ? (pid % 4 === 0 ? 1 : 0) : (pid % 3) + 1;
    ans[code] = qs.map((q, i) => (((i + pid) % 6) < nWrong ? wrong(q) : q.correct));
    exp[code] = { format: fmt, score: 6 - nWrong };
  }
  const time = {}; const ease = {};
  for (const [name, code] of Object.entries(LOCK.codes)) {
    const card = SPEC.groups[group][name] === 'card';
    time[code] = card ? 80 + pid * 3 : 140 + pid * 7;
    ease[code] = card ? 4 + (pid % 2) : 2 + (pid % 2);
  }
  if (pid === 7) time.DH = 0;   // 못 잰 시간
  return { consent: LOCK.consent.yes, group, pid: String(pid), ans, time, ease, exp, more: pid === 2 ? { DH: '연봉 범위', TK: '' } : undefined };
}
const base = Date.parse('2026-11-12T01:00:00Z'); // 한국 10시
const people = Array.from({ length: 10 }, (_, i) => plan(i + 1));
people.forEach((p, i) => submit(form, walk(form, answerer(p)).answers, new Date(base + i * 4 * 3600000)));
// 뺄 응답: 시험 1, 동의 안 함 1, 참가 번호 5 재응답(모두 오답) 1
submit(form, walk(form, answerer({ ...plan(1), pid: '시험(연습 응답)' })).answers, new Date(base - 86400000));
submit(form, walk(form, answerer({ consent: LOCK.consent.no })).answers, new Date(base + 5 * 3600000));
const redo = plan(5); redo.ans = { DH: redo.ans.DH.map((v, i) => wrong(LOCK.questions[i])), TK: redo.ans.TK.map((v, i) => wrong(LOCK.questions[6 + i])) };
submit(form, walk(form, answerer(redo)).answers, new Date(base + 60 * 3600000));

const t = ctx.exportTidy();
const tidy = ss.sheets.tidy.data;
const H = tidy[0];
assert.deepStrictEqual(plain(H), LOCK.tidy_header, 'tidy 머리글 = lock');
const col = (r, h) => r[H.indexOf(h)];
const rows = tidy.slice(1);
assert.strictEqual(rows.length, 13, 'tidy 13행');
const byStatus = rows.reduce((o, r) => { o[col(r, 'status')] = (o[col(r, 'status')] || 0) + 1; return o; }, {});
assert.deepStrictEqual(byStatus, { complete: 11, test: 1, no_consent: 1 }, 'status ' + JSON.stringify(byStatus));
for (const p of people) {
  const r = rows.filter((x) => String(col(x, 'pid')) === p.pid && col(x, 'status') === 'complete')[0];
  assert.strictEqual(col(r, 'group'), p.group);
  for (const code of ['DH', 'TK']) {
    const lc = code.toLowerCase();
    assert.strictEqual(col(r, `${lc}_format`), p.exp[code].format, `pid ${p.pid} ${code} 형식`);
    assert.strictEqual(col(r, `${lc}_score`), p.exp[code].score, `pid ${p.pid} ${code} 점수`);
    assert.strictEqual(col(r, `${lc}_time_s`), p.time[code], `pid ${p.pid} ${code} 시간`);
    assert.strictEqual(col(r, `${lc}_ease`), p.ease[code], `pid ${p.pid} ${code} 쉬움`);
    for (let k = 1; k <= 6; k++) assert.strictEqual(col(r, `${lc}_q${k}`), p.ans[code][k - 1], '선택지 번호');
  }
}
assert.deepStrictEqual(plain(ss.sheets.tidy_text.data.slice(1).map((r) => r.slice(1))), [['연봉 범위', '']], 'tidy_text');
const st = ctx.status();
assert(M.logs.some((l) => /완료: G1 6명 · G2 5명/.test(l)), 'status 그룹 인원(재응답 포함)');
assert(M.logs.some((l) => /두 번 이상 나온 참가 번호 5/.test(l)), 'status 중복 경고');
console.log(`가상 응답 13건(참가자 10, 시험 1, 동의 안 함 1, 재응답 1) → tidy 일치 ${JSON.stringify(byStatus)} · status 로그 확인`);

// ── 5) 분석 스크립트로 ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usage_test_'));
const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const writeCsv = (p, data) => fs.writeFileSync(p, data.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
writeCsv(path.join(tmp, 'tidy.SYNTHETIC.csv'), tidy);
// 원 응답 시트 흉내: 타임스탬프·점수 뒤에 답하는 문항이 폼 순서대로(같은 제목 두 열)
const answerable = form.items.filter((it) => ![ItemType.PAGE_BREAK, ItemType.SECTION_HEADER].includes(it.type));
const fmtTs = (d) => {
  const k = new Date(d.getTime() + 9 * 3600000);
  const h = k.getUTCHours();
  return `${k.getUTCFullYear()}. ${k.getUTCMonth() + 1}. ${k.getUTCDate()} ${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${String(k.getUTCMinutes()).padStart(2, '0')}:00`;
};
const raw = [['타임스탬프', '점수', ...answerable.map((it) => it.title)]];
form.responses.forEach((resp) => {
  const got = new Map(resp.getItemResponses().map((ir) => [ir.getItem(), ir.getResponse()]));
  raw.push([fmtTs(resp.getTimestamp()), '', ...answerable.map((it) => (got.has(it) ? got.get(it) : ''))]);
});
writeCsv(path.join(tmp, 'raw.SYNTHETIC.csv'), raw);
const py = (args) => spawnSync('python3', [path.join(HERE, 'analyze_usage.py'), ...args], { encoding: 'utf-8' });
const fu = path.join(tmp, 'followup.json');
fs.writeFileSync(fu, JSON.stringify({ hr: { text: '그대로 둘 값' } }, null, 2));
let r = py(['--in', path.join(tmp, 'tidy.SYNTHETIC.csv'), '--followup', fu, '--private-dir', path.join(tmp, 'private')]);
assert.strictEqual(r.status, 2, '합성 자료 + --draft 없음 → 거절(2)\n' + r.stderr);
assert.deepStrictEqual(JSON.parse(fs.readFileSync(fu, 'utf-8')), { hr: { text: '그대로 둘 값' } }, '거절 때 followup 그대로');
assert(!fs.existsSync(path.join(tmp, 'private')), '거절 때 private 도 안 씀');
r = py(['--in', path.join(tmp, 'tidy.SYNTHETIC.csv'), '--followup', fu, '--private-dir', path.join(tmp, 'private'), '--draft', '--results', path.join(tmp, 'tidy_results.json')]);
assert.strictEqual(r.status, 0, r.stderr + r.stdout);
const FU = JSON.parse(fs.readFileSync(fu, 'utf-8'));
assert.deepStrictEqual(Object.keys(FU), ['hr', 'usage'], 'usage 키만 더함');
assert.strictEqual(FU.hr.text, '그대로 둘 값');
const U = FU.usage;
assert(U.text.startsWith('［미리보기: 합성 자료'), '미리보기 표시');
assert(U.status === 'draft' && U.data_source === 'synthetic' && U.n === 10, 'usage 메타');
assert(U.rows.length === 4 && U.rows.every((x) => x.length === 4), 'rows 4×4');
const A = JSON.parse(fs.readFileSync(path.join(tmp, 'tidy_results.json'), 'utf-8'));
const exp = { card: 0, posting: 0 };
people.forEach((p) => { for (const code of ['DH', 'TK']) exp[p.exp[code].format] += p.exp[code].score; });
assert(Math.abs(A.analysis.score.card_mean - exp.card / 10) < 1e-9 && Math.abs(A.analysis.score.posting_mean - exp.posting / 10) < 1e-9, '형식별 평균 정답 수');
assert.strictEqual(A.analysis.time.n, 9, '시간 0인 1명은 시간 비교에서만 빠짐');
assert.strictEqual(A.analysis.flow.duplicate_pid, 1);
assert.strictEqual(A.participants.find((p) => p.pid === 5).card_score, plan(5).exp[SPEC.groups.G1['동화엔텍'] === 'card' ? 'DH' : 'TK'].score, '재응답이 아니라 먼저 낸 응답을 씀');
// 원 응답 시트로도 같은 결과
r = py(['--in', path.join(tmp, 'raw.SYNTHETIC.csv'), '--dry-run', '--results', path.join(tmp, 'raw_results.json')]);
assert.strictEqual(r.status, 0, r.stderr + r.stdout);
const B = JSON.parse(fs.readFileSync(path.join(tmp, 'raw_results.json'), 'utf-8'));
const strip = (pp) => pp.map(({ resp_key, ...rest }) => rest);
assert.deepStrictEqual(strip(B.participants), strip(A.participants), '원 응답 시트 = tidy 시트(참가자별)');
assert.deepStrictEqual(B.analysis.score, A.analysis.score, '원 응답 시트 = tidy 시트(통계)');
// 본 결과가 있으면 미리보기로 덮지 않는다
fs.writeFileSync(fu, JSON.stringify({ usage: { text: '본 결과', rows: [], status: 'final' } }));
r = py(['--in', path.join(tmp, 'tidy.SYNTHETIC.csv'), '--followup', fu, '--private-dir', path.join(tmp, 'private'), '--draft']);
assert.strictEqual(r.status, 2, '본 결과 위에 미리보기 → 거절');
assert.strictEqual(JSON.parse(fs.readFileSync(fu, 'utf-8')).usage.text, '본 결과');
fs.rmSync(tmp, { recursive: true, force: true });
// 만든 뒤 폼을 손으로 고치면(문항 하나 삭제) 정리 시트를 만들지 않고, verify 가 알린다
const removed = form.items.splice(5, 1);
assert.throws(() => ctx.exportTidy(), /문항 수가 설계와 다릅니다/, '폼을 고친 뒤 exportTidy 멈춤');
assert(ctx.verify().length > 0, '폼을 고친 뒤 verify 오류');
form.items.splice(5, 0, ...removed);
form.items[7].title = '바뀐 제목';
assert.throws(() => ctx.exportTidy(), /제목이 설계와 다릅니다/, '제목을 바꾼 뒤 exportTidy 멈춤');
console.log('폼을 손으로 고치면 exportTidy 가 멈추고 verify 가 오류를 냄');
console.log(`분석 연결: 합성 거절(2) · --draft 미리보기(usage 키만 추가) · 원 응답 시트 = tidy 시트 · 본 결과 보호 · 카드 평균 ${A.analysis.score.card_mean.toFixed(1)} / 공고 평균 ${A.analysis.score.posting_mean.toFixed(1)}`);
console.log('모든 시험 통과');
