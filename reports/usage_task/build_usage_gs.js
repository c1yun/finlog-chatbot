// 학생 사용 과제(직무 카드 vs 기존 채용정보) 구글 폼 생성 스크립트(.gs) 만들기
// 사용: node build_usage_gs.js
// 입력: usage_spec.json(설계·문항·정답·폼 문안), materials/*_공고.txt(공고 원문 옮김),
//       ../build_result/companies/<기업>.json(카드 원본: jobs[0] + plan8 '과제' 행)
// 출력: materials/*_카드.txt(카드, 이 스크립트가 만든다. 직접 고치지 않는다)
//       usage.lock.json(문항·정답·열 이름·해시, analyze_usage.py가 읽는다. 커밋)
//       dist/usage_task.gs(script.google.com에 붙여넣는 파일, gitignored)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HERE = __dirname;
const SPEC = JSON.parse(fs.readFileSync(path.join(HERE, 'usage_spec.json'), 'utf-8'));
const COMPANIES = path.join(HERE, '..', 'build_result', 'companies');
const F = SPEC.form;
const NOT_IN = SPEC.not_in_material;
const CHUNK_MAX = F.chunk_max;

const fail = (m) => { throw new Error(m); };
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const wordCount = (s) => norm(s).split(' ').length;
const count = (hay, needle) => hay.split(needle).length - 1;
const fill = (s, company) => s.replace(/\{company\}/g, company);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ───────── 카드: companies JSON → 고정 양식 ─────────
const CARD_FIELDS = [['직무', 'name'], ['실제 업무', 'work'], ['필수·우대 요건', 'req'], ['근무지', 'place'],
  ['고용형태', 'type'], ['확인된 처우', 'pay'], ['준비 과제', 'prep'], ['공고·기준일', 'when']];
if (JSON.stringify(CARD_FIELDS.map((x) => x[0])) !== JSON.stringify(SPEC.card_layout)) fail('card_layout과 카드 칸 순서가 다름');
const stripCite = (s) => String(s || '').replace(/\s*(?:\[\d+\])+/g, '').trim();

function deriveCard(name) {
  const C = SPEC.companies[name];
  const src = JSON.parse(fs.readFileSync(path.join(COMPANIES, `${name}.json`), 'utf-8'));
  const j = src.jobs[0];
  const row = src.plan8.rows.find((r) => /과제/.test(r[0]));
  if (!row) fail(`${name}: plan8에 '과제' 행이 없음`);
  const f = { name: j.name, work: j.work, req: j.req, place: j.place, type: j.type, pay: j.pay, when: j.when, prep: row[1] };
  for (const k of Object.keys(f)) f[k] = stripCite(f[k]);
  for (const e of C.card.edits || []) {
    const n = count(f[e.field], e.find);
    if (n !== 1) fail(`${name} 카드 수정: '${e.find}'가 ${e.field}에 ${n}번 있음(1번이어야 함) — companies JSON이 바뀌었는지 확인`);
    f[e.field] = f[e.field].split(e.find).join(e.replace).replace(/\s{2,}/g, ' ').trim();
  }
  for (const [label, k] of CARD_FIELDS) if (!f[k]) fail(`${name} 카드 '${label}' 칸이 비었음`);
  const lines = [`직무 카드 — ${name}`];
  for (const [label, k] of CARD_FIELDS) lines.push('', `■ ${label}`, f[k]);
  const text = lines.join('\n') + '\n';
  if (/\[\d+\]/.test(text)) fail(`${name} 카드에 출처 번호가 남음`);
  return text;
}

// ───────── 자료 읽기·점검 ─────────
const MAT = {};
for (const name of SPEC.order) {
  const C = SPEC.companies[name];
  const card = deriveCard(name);
  const cardPath = path.join(HERE, C.card.file);
  fs.mkdirSync(path.dirname(cardPath), { recursive: true });
  if (!fs.existsSync(cardPath) || fs.readFileSync(cardPath, 'utf-8') !== card) fs.writeFileSync(cardPath, card);
  const posting = fs.readFileSync(path.join(HERE, C.posting.file), 'utf-8').replace(/\r\n/g, '\n');
  const head = `기존 채용정보 — 사람인 공고 ${C.posting.rec_idx} 본문을 그대로 옮김(`;
  const first = posting.split('\n')[0];
  if (!first.startsWith(head) || !/기준.*\)$/.test(first)) fail(`${name} 공고 첫 줄이 '${head}…기준…)' 형식이 아님: ${first}`);
  MAT[name] = { card, posting };
}
for (const name of SPEC.order) {
  for (const fmt of ['card', 'posting']) {
    const t = MAT[name][fmt];
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t)) fail(`${name} ${fmt}에 이메일 주소가 있음(개인정보)`);
    if (/01[016789]-?\d{3,4}-?\d{4}/.test(t)) fail(`${name} ${fmt}에 휴대전화 번호 형식이 있음`);
  }
}

// 긴 자료는 칸 하나에 너무 많이 넣지 않도록 문단 경계에서 나눈다(구글 폼 설명 칸 길이 여유)
function chunks(body) {
  const blocks = body.split(/\n[ \t]*\n/).map((b) => b.replace(/\s+$/, '')).filter((b) => b.trim());
  const pieces = [];
  for (const b of blocks) {
    if (b.length <= CHUNK_MAX) { pieces.push(b); continue; }
    let cur = '';
    for (const line of b.split('\n')) {
      if (line.length > CHUNK_MAX) fail(`한 줄이 ${CHUNK_MAX}자를 넘음: ${line.slice(0, 40)}…`);
      if (cur && cur.length + 1 + line.length > CHUNK_MAX) { pieces.push(cur); cur = line; } else cur = cur ? `${cur}\n${line}` : line;
    }
    if (cur) pieces.push(cur);
  }
  const out = [];
  let cur = '';
  for (const p of pieces) {
    if (cur && cur.length + 2 + p.length > CHUNK_MAX) { out.push(cur); cur = p; } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}
function display(text) {
  const lines = text.replace(/\s+$/, '').split('\n');
  const head = lines[0];
  const body = lines.slice(1).join('\n').replace(/^\s+/, '');
  const parts = chunks(body);
  // 나눈 조각을 다시 붙이면 원문과 같아야 한다(빈 줄 개수만 정리)
  const squash = (s) => s.replace(/\n[ \t]*\n(\s*\n)*/g, '\n\n').trim();
  if (squash(parts.join('\n\n')) !== squash(body)) fail('자료 나누기에서 글이 바뀜');
  return { head, parts };
}

// ───────── 문항 점검 ─────────
const QUESTIONS = {};
const REQUIRED_TOPICS = ['실제 업무', '필수 요건', '근무지', '고용형태·정규직 전환', '처우(초봉)'];
const SIXTH = ['전형 순서', '접수 마감', '어학 요건'];
for (const name of SPEC.order) {
  const C = SPEC.companies[name];
  const qs = SPEC.questions.filter((q) => q.company === name);
  if (qs.length !== 6) fail(`${name} 문항이 ${qs.length}개(6개여야 함)`);
  qs.forEach((q, i) => { if (q.key !== `${C.code}${i + 1}`) fail(`문항 키 순서 오류 ${q.key}`); });
  const topics = qs.map((q) => q.topic);
  for (const t of REQUIRED_TOPICS) if (!topics.includes(t)) fail(`${name}: '${t}' 문항이 없음`);
  if (topics.filter((t) => SIXTH.includes(t)).length !== 1) fail(`${name}: 전형 순서/접수 마감/어학 요건 중 하나만 있어야 함`);
  for (const q of qs) {
    if (q.choices.length !== 4) fail(`${q.key} 선택지가 4개가 아님`);
    if (q.choices[3] !== NOT_IN) fail(`${q.key} 마지막 선택지가 '${NOT_IN}'이 아님`);
    if (new Set(q.choices).size !== 4) fail(`${q.key} 선택지 중복`);
    if (!(q.correct >= 1 && q.correct <= 3)) fail(`${q.key} 정답은 1~3번이어야 함(두 자료 모두에 답이 있음)`);
    for (const fmt of ['card', 'posting']) {
      const ev = q.evidence[fmt];
      if (!ev || !ev.where || !ev.quotes || !ev.quotes.length) fail(`${q.key} ${fmt} 근거 없음`);
      const words = ev.quotes.reduce((k, s) => k + wordCount(s), 0);
      if (words > 20) fail(`${q.key} ${fmt} 근거 인용이 ${words}단어(20단어 이하)`);
      const text = norm(MAT[name][fmt]);
      let from = 0;
      if (ev.anchor) {
        from = text.indexOf(norm(ev.anchor));
        if (from < 0) fail(`${q.key} ${fmt} 기준 글 '${ev.anchor}'를 자료에서 찾지 못함`);
      }
      for (const s of ev.quotes) {
        const at = text.indexOf(norm(s), from);
        if (at < 0) fail(`${q.key} ${fmt} 근거 '${s}'를 자료에서 찾지 못함`);
        if (ev.anchor && at - from > ev.within) fail(`${q.key} ${fmt} 근거 '${s}'가 '${ev.anchor}'에서 ${at - from}자 떨어짐(최대 ${ev.within})`);
      }
    }
  }
  const pos = qs.map((q) => q.correct);
  if (new Set(pos).size < 3) fail(`${name}: 정답 위치가 한쪽에 몰림 ${pos}`);
  QUESTIONS[name] = qs;
}

// ───────── 폼 계획(plan): 폼에 만드는 순서 그대로, 한 항목 = 폼 문항 하나 ─────────
const plan = [];
const add = (e) => { if (plan.some((x) => x.key === e.key)) fail('key 중복 ' + e.key); plan.push(e); return e; };
const GROUPS = Object.keys(SPEC.groups);
const CODE = Object.fromEntries(SPEC.order.map((n) => [n, SPEC.companies[n].code]));
for (const g of GROUPS) for (const n of SPEC.order) if (!['card', 'posting'].includes(SPEC.groups[g][n])) fail(`${g} ${n} 형식 오류`);
for (const n of SPEC.order) if (new Set(GROUPS.map((g) => SPEC.groups[g][n])).size !== 2) fail(`${n}: 두 그룹의 형식이 같음`);

const C1 = F.consent;
add({ type: 'mc', key: 'CONSENT', title: C1.title, choices: C1.choices, required: true, nav: ['CONTINUE', 'SUBMIT'] });
add({ type: 'page', key: 'P_GROUP', title: F.group.page_title, help: F.group.help });
add({ type: 'mc', key: 'GROUP', title: F.group.title, choices: GROUPS, required: true, nav: GROUPS.map((g) => `${g}_${CODE[SPEC.order[0]]}`) });
const DISPLAY = {};
GROUPS.forEach((g, gi) => {
  SPEC.order.forEach((name, ci) => {
    const fmt = SPEC.groups[g][name];
    const code = CODE[name];
    const pk = `${g}_${code}`;
    const meta = { group: g, company: name, code, format: fmt };
    // 쪽 구분의 goTo는 '바로 앞 쪽'이 끝난 뒤 갈 곳: 두 번째 그룹의 첫 쪽에 걸어 첫 그룹의 마지막 쪽 → 마무리
    add({ type: 'page', key: pk, title: fill(F.material_page_title, name), help: F.material_page_help, goTo: gi > 0 && ci === 0 ? 'END' : undefined, ...meta });
    const D = DISPLAY[`${name}|${fmt}`] || (DISPLAY[`${name}|${fmt}`] = display(MAT[name][fmt]));
    D.parts.forEach((part, k) => add({
      type: 'section', key: `${pk}_M${k + 1}`, title: k === 0 ? D.head : `${F.continued} (${k + 1}/${D.parts.length})`, help: part, ...meta,
    }));
    QUESTIONS[name].forEach((q, n) => add({
      type: 'quiz', key: `${pk}_Q${n + 1}`, qkey: q.key, title: q.title, choices: q.choices, correct: q.correct, points: F.points, required: true, ...meta,
    }));
  });
});
const CL = F.closing;
const PR = F.proctor;
add({ type: 'page', key: 'END', title: CL.page_title, help: CL.help });
for (const name of SPEC.order) {
  add({ type: 'scale', key: `${CODE[name]}_EASE`, title: fill(CL.ease_title, name), low: 1, high: 5, lowLabel: CL.ease_low, highLabel: CL.ease_high, required: true, company: name, code: CODE[name] });
  add({ type: 'text', key: `${CODE[name]}_MORE`, title: fill(CL.more_title, name), required: false, company: name, code: CODE[name] });
}
add({ type: 'section', key: 'PROCTOR', title: PR.title, help: PR.help });
const PIDS = [...Array.from({ length: PR.pid_max }, (_, i) => String(i + 1)), PR.pid_test];
add({ type: 'list', key: 'PID', title: PR.pid_title, choices: PIDS, required: true });
for (const name of SPEC.order) {
  add({ type: 'text', key: `${CODE[name]}_TIME`, title: fill(PR.time_title, name), help: PR.time_help, pattern: PR.time_pattern, patternHelp: PR.time_pattern_help, required: true, company: name, code: CODE[name] });
}

// 이동 대상 점검
const keys = new Set(plan.map((e) => e.key));
for (const e of plan) {
  for (const t of [...(e.nav || []), e.goTo].filter(Boolean)) {
    if (['CONTINUE', 'SUBMIT'].includes(t)) continue;
    if (!keys.has(t)) fail(`${e.key} 이동 대상 없음: ${t}`);
    if (plan.find((x) => x.key === t).type !== 'page') fail(`${t}는 쪽이 아님`);
  }
  if (e.help && e.help.length > CHUNK_MAX) fail(`${e.key} 설명이 ${e.help.length}자(최대 ${CHUNK_MAX})`);
}
// 응답 시트의 열 이름은 문항 제목이다. 문항 12개는 두 경로에 한 번씩(같은 제목 두 열), 나머지는 한 번만 나와야 한다.
const qTitles = SPEC.questions.map((q) => q.title);
const otherTitles = plan.filter((e) => !['page', 'section', 'quiz'].includes(e.type)).map((e) => e.title);
if (new Set(qTitles).size !== qTitles.length) fail('문항 제목 중복');
if (new Set(otherTitles).size !== otherTitles.length || otherTitles.some((t) => qTitles.includes(t))) fail('문항 제목 중복(응답 시트 열 구분이 안 됨)');
for (const t of qTitles) if (plan.filter((e) => e.title === t).length !== GROUPS.length) fail(`'${t}'가 경로마다 한 번씩 있지 않음`);

// 쪽 단위 묶기(build 이어 하기 단위)
const units = [];
let start = 0;
plan.forEach((e, i) => { if (e.type === 'page' && i > 0) { units.push([start, i]); start = i; } });
units.push([start, plan.length]);

// ───────── 잠금 파일(분석용) ─────────
const lib = fs.readFileSync(path.join(HERE, 'gs', 'usage_lib.gs'), 'utf-8');
const specHash = sha(JSON.stringify({ spec: SPEC, materials: MAT, plan })).slice(0, 16);
const QCOLS = SPEC.order.flatMap((n) => QUESTIONS[n].map((q, i) => `${CODE[n].toLowerCase()}_q${i + 1}`));
const tidyHeader = ['resp_key', 'submitted_at', 'status', 'consent', 'group', 'pid']
  .concat(SPEC.order.map((n) => `${CODE[n].toLowerCase()}_format`))
  .concat(QCOLS)
  .concat(SPEC.order.map((n) => `${CODE[n].toLowerCase()}_score`))
  .concat(SPEC.order.map((n) => `${CODE[n].toLowerCase()}_time_s`))
  .concat(SPEC.order.map((n) => `${CODE[n].toLowerCase()}_ease`))
  .concat(['spec_hash']);
const textHeader = ['resp_key'].concat(SPEC.order.map((n) => `${CODE[n].toLowerCase()}_more`));
const lock = {
  spec_hash: specHash,
  order: SPEC.order,
  codes: CODE,
  jobs: Object.fromEntries(SPEC.order.map((n) => [n, SPEC.companies[n].job])),
  groups: SPEC.groups,
  format_names: SPEC.format_names,
  consent: { title: C1.title, yes: C1.choices[0], no: C1.choices[1] },
  group_title: F.group.title,
  pid: { title: PR.pid_title, choices: PIDS, test: PR.pid_test, max: PR.pid_max },
  questions: SPEC.questions.map((q) => ({ key: q.key, company: q.company, code: CODE[q.company], topic: q.topic, title: q.title, choices: q.choices, correct: q.correct })),
  closing: Object.fromEntries(SPEC.order.map((n) => [CODE[n], { ease: fill(CL.ease_title, n), more: fill(CL.more_title, n), time: fill(PR.time_title, n) }])),
  sessions: SPEC.sessions,
  tidy_header: tidyHeader,
  text_header: textHeader,
  materials: Object.fromEntries(SPEC.order.map((n) => [n, Object.fromEntries(['card', 'posting'].map((fmt) => [fmt, {
    file: fmt === 'card' ? SPEC.companies[n].card.file : SPEC.companies[n].posting.file,
    sha256_16: sha(MAT[n][fmt]).slice(0, 16), chars: MAT[n][fmt].length, sections: DISPLAY[`${n}|${fmt}`].parts.length,
  }]))])),
  n_items: plan.length,
  n_pages: plan.filter((e) => e.type === 'page').length + 1,
};
fs.writeFileSync(path.join(HERE, 'usage.lock.json'), JSON.stringify(lock, null, 1) + '\n');

// ───────── .gs 만들기 ─────────
const CONFIG = {
  specHash,
  title: F.title,
  sheetTitle: F.sheet_title,
  description: F.description.join('\n\n'),
  confirmation: F.confirmation,
  order: SPEC.order,
  codes: CODE,
  groups: SPEC.groups,
  consentYes: C1.choices[0],
  pidTest: PR.pid_test,
  tidyHeader,
  textHeader,
  manualSteps: F.manual_steps,
  plan,
  units,
};
const generatedAt = new Date().toISOString();
const header = `/**
 * 간판떼고 학생 사용 과제 — 구글 폼(퀴즈) 자동 생성 스크립트
 * 생성: ${generatedAt}  설계 해시: ${specHash}  문항 ${plan.length}개 · 쪽 ${lock.n_pages}개
 *
 * 쓰는 법 (PC 크롬, 팀 구글 계정으로 로그인)
 *  1. https://script.google.com 에서 [새 프로젝트]를 만든다.
 *  2. 편집기에 있던 코드를 모두 지우고 이 파일 내용 전체를 붙여넣은 뒤 저장(Ctrl+S)한다.
 *  3. 위쪽 함수 선택 칸에서 build 를 고르고 [실행]을 누른다. 권한 요청이 뜨면 계정을 고르고 허용한다.
 *     ('확인되지 않은 앱' 화면이 나오면 [고급] → [(프로젝트 이름)(으)로 이동]을 누른다. 본인이 만든 스크립트라서 나오는 안내다.)
 *     1~2분이면 끝난다. 로그에 '다시 실행하세요'가 나오면 build 를 한 번 더 실행한다(구글 6분 제한 대비).
 *  4. 실행 로그 끝의 '점검(verify) 통과', '응답 링크(참가자용)', '수정 링크(팀용)', '응답 시트'를 확인해 팀에 공유한다.
 *  5. 로그의 '직접 할 일'을 폼 수정 화면에서 한다(퀴즈 점수·정답 숨기기는 스크립트로 바꿀 수 없다).
 *  6. 응답 링크로 G1·G2를 한 번씩 연습 응답한다. 참가 번호는 '시험(연습 응답)'을 고른다(분석에서 빠진다).
 *  7. 과제(2026. 11. 12.~14.) 동안 status 를 실행하면 그룹별 완료 인원과 쓰인 참가 번호가 로그에 나온다.
 *  8. 끝나면 exportTidy 를 실행한다. 응답 시트에 'tidy'(1인 1행)와 'tidy_text'(자유 응답) 시트가 생긴다.
 *     'tidy' 시트를 연 채 [파일 → 다운로드 → 쉼표로 구분된 값(.csv)]으로 받아
 *     저장소의 reports/usage_task/private/tidy.csv 에 두고(커밋 금지) 아래를 실행한다.
 *       python3 reports/usage_task/analyze_usage.py --in reports/usage_task/private/tidy.csv
 *     ('설문지 응답 시트1'을 CSV로 받아 --in 에 줘도 된다.)
 *  9. 2026. 12. 31.에 폼 응답·응답 시트·private/ 파일을 지운다.
 *  같은 프로젝트에서 처음부터 다시 만들려면 resetProject 를 실행한 뒤 build 한다(이전 폼은 드라이브에 남는다).
 *
 * 이 파일은 저장소의 reports/usage_task/build_usage_gs.js 가 만든다. 직접 고치지 말고 원본을 고쳐 다시 만든다.
 */
`;
const out = header + 'var CONFIG = ' + JSON.stringify(CONFIG, null, 1) + ';\n\n' + lib;
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
const outPath = path.join(HERE, 'dist', 'usage_task.gs');
fs.writeFileSync(outPath, out);
const secs = Object.entries(DISPLAY).map(([k, d]) => `${k.replace('|', '·')} ${d.parts.length}칸`).join(', ');
console.log(`wrote ${path.relative(process.cwd(), outPath)} (${(out.length / 1024).toFixed(0)}KB) · 문항 ${plan.length}개 · 쪽 ${lock.n_pages}개 · 해시 ${specHash}`);
console.log(`자료 칸: ${secs}`);
