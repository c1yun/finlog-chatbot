// 구글 폼 생성 스크립트(.gs) 만들기
// 사용: node build_form_gs.js pilot|launch
// 입력: form_text.js(문안), survey_spec.json(설계), ../build_result/cards_*.json(카드), secrets.local.json(연락처·완료코드, 커밋 안 함)
// 출력: dist/form_builder.<mode>.gs(사용자가 script.google.com에 붙여넣음), spec.lock.json(배정·순서·해시, 커밋)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MODE = process.argv[2] || 'pilot';
if (!['pilot', 'launch'].includes(MODE)) { console.error('mode는 pilot 또는 launch'); process.exit(1); }
const HERE = __dirname;
const T = require('./form_text');
const SPEC = JSON.parse(fs.readFileSync(path.join(HERE, 'survey_spec.json'), 'utf-8'));
const REG = JSON.parse(fs.readFileSync(path.join(HERE, '../build_result/cards_regional.json'), 'utf-8'));
const MET = JSON.parse(fs.readFileSync(path.join(HERE, '../build_result/cards_metro.json'), 'utf-8')).cards;
const FIELDS = ['직무와 업무', '고용형태와 요건', '확인된 보상', '근무·복지 조건', '사업과 경력 정보'];

// ── 비밀값(공개 저장소에 두지 않음) ──
const SECRETS = path.join(HERE, 'secrets.local.json');
const code6 = () => Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
let secrets = fs.existsSync(SECRETS) ? JSON.parse(fs.readFileSync(SECRETS, 'utf-8')) : {};
let changed = false;
if (!secrets.contact) { secrets.contact = '연구팀 대표 이메일 ( 기재 )'; changed = true; }
if (!secrets.pilotCode) { secrets.pilotCode = code6(); changed = true; }
if (!secrets.launchCode) { secrets.launchCode = code6(); changed = true; }
if (changed) fs.writeFileSync(SECRETS, JSON.stringify(secrets, null, 2) + '\n');
const CODE = MODE === 'launch' ? secrets.launchCode : secrets.pilotCode;

const fill = (s) => s.replace(/\{contact\}/g, secrets.contact).replace(/\{prize\}/g, SPEC.prize)
  .replace(/\{minutes\}/g, SPEC.minutes).replace(/\{deadline\}/g, SPEC.deadline);

// ── 카드 ──
const CARD = {};
REG.forEach((c) => { CARD[c.code] = { ...c, type: 'R' }; });
MET.forEach((c) => { CARD[c.code] = { ...c, type: 'M' }; });
for (const c of Object.values(CARD)) {
  if (!c.label) throw new Error(`${c.code} label 없음`);
  for (const f of FIELDS) if (!c.fields[f]) throw new Error(`${c.code} ${f} 없음`);
}
if (/07:00~16:00/.test(CARD.R04.fields['근무·복지 조건'])) throw new Error('R04 미확인 출퇴근 시각이 남아 있음');
if (!/영어 회화·이메일 능력 필수/.test(CARD.R10.fields['고용형태와 요건'])) throw new Error('R10 영어 필수 표기 확인');

// 이름·지역 노출 검사용 단어
const ALIAS = {
  R01: ['요턴', 'Jotun', 'JOTUN', '조광페인트'], R02: ['동화엔텍'], R03: ['후지킨', 'Fujikin', 'FUJIKIN'], R04: ['파나시아', 'Panasia'],
  R05: ['송원'], R06: ['지엠비', 'GMB'], R07: ['해성'], R08: ['넥센', 'Nexen', 'NEXEN'], R09: ['BHI', '비에이치아이'], R10: ['TKG', '태광실업', '나이키', 'Nike'],
  M01: ['하이닉스', 'hynix'], M02: ['현대차', '현대자동차'], M03: ['카카오', 'Kakao'], M04: ['올리브영'], M05: ['삼성물산'],
  M06: ['삼성전자'], M07: ['바이오로직스'], M08: ['네이버', 'NAVER'], M09: ['ENM'], M10: ['제일제당'],
};
const REGION_WORDS = ['부산', '울산', '경남', '창원', '김해', '양산시', '함안', '녹산', '강서구', '서울', '경기', '수도권', '판교', '이천', '성남', '분당', '화성', '기흥', '평택', '인천', '송도', '용인', '마곡', '수원', '부울경'];
const leakWords = [];
for (const c of Object.values(CARD)) {
  leakWords.push(c.key, c.open.company.replace(/\(주\)|주식회사|㈜/g, '').trim(), ...(ALIAS[c.code] || []));
}
const allLeak = [...new Set([...leakWords, ...REGION_WORDS])].filter((w) => w && w.length >= 2);
for (const c of Object.values(CARD)) {
  const text = FIELDS.map((f) => c.fields[f]).join(' ');
  for (const w of allLeak) if (text.includes(w)) throw new Error(`${c.code} 카드 본문에 '${w}'가 있음(공개형·비공개형 공통 본문에는 기업명·지역을 쓰지 않는다)`);
}

// ── 묶음(경로)별 카드 순서 ──
const slots = Array.from({ length: 15 }, (_, i) => i + 1);
const regSlots = slots.filter((s) => !SPEC.metroSlots.includes(s));
function sequence(set) {
  const reg = set === 'A' ? SPEC.regionalOrder : [...SPEC.regionalOrder].reverse();
  const met = SPEC.metroOrder[set];
  const seq = new Array(15);
  regSlots.forEach((s, i) => { seq[s - 1] = reg[i]; });
  SPEC.metroSlots.forEach((s, i) => { seq[s - 1] = met[i]; });
  return seq;
}
const ROUTES = SPEC.routes.map((r) => ({ ...r, seq: sequence(r.set) }));
// 균형 확인: 지역 카드 p ↔ 16−p
for (const code of SPEC.regionalOrder) {
  const pa = sequence('A').indexOf(code) + 1; const pb = sequence('B').indexOf(code) + 1;
  if (pa + pb !== 16) throw new Error(`${code} 자리 균형 오류 ${pa}/${pb}`);
}

// ── 생일(일) → 묶음 ──
const STRATA = Object.keys(SPEC.strata);
const dayRoute = {};
for (const s of STRATA) {
  const off = SPEC.dayOffset[s];
  dayRoute[s] = Array.from({ length: 31 }, (_, i) => {
    const d = i + 1;
    return d <= 28 ? ((d - 1 + off) % 4) + 1 : ((d - 29 + off) % 4) + 1;
  });
}

// ── 문항 계획(plan): 폼에 만드는 순서 그대로, 한 항목 = 폼 문항 하나 ──
const plan = [];
const add = (e) => { if (plan.some((x) => x.key === e.key)) throw new Error('key 중복 ' + e.key); plan.push(e); return e; };
const cardText = (c, arm) => {
  const head = arm === 'open' ? `기업: ${c.open.company} · 근무지역: ${c.open.region}` : '기업: 비공개 · 근무지역: 비공개';
  return [head, '', ...FIELDS.flatMap((f) => [`■ ${f}`, c.fields[f], ''])].join('\n').trim();
};

// 첫 쪽(머리글 + S1)
const sc = T.screen;
add({ type: 'mc', key: 'S1', var: 'S1', title: sc[0].title, choices: sc[0].choices, required: true, nav: sc[0].choices.map((_, j) => (sc[0].end.includes(j) ? 'END' : 'CONTINUE')) });
add({ type: 'page', key: 'P1', title: '참여 대상 확인' });
add({ type: 'mc', key: 'S2', var: 'S2', title: sc[1].title, choices: sc[1].choices, required: true, nav: sc[1].choices.map((_, j) => (sc[1].end.includes(j) ? 'END' : 'CONTINUE')) });
add({ type: 'page', key: 'P2', title: '참여 대상 확인' });
add({ type: 'mc', key: 'S3', var: 'S3', title: sc[2].title, choices: sc[2].choices, required: true, nav: sc[2].choices.map((_, j) => (sc[2].end.includes(j) ? 'END' : 'CONTINUE')) });
const A = T.assign;
add({ type: 'page', key: 'P3', title: A.pageTitle });
const stratumOf = A.C1.choices.map((c) => STRATA.find((s) => SPEC.strata[s].c1.includes(c)));
if (stratumOf.some((x) => !x)) throw new Error('계열 층 매핑 누락');
add({ type: 'mc', key: 'C1', var: 'C1', title: A.C1.title, choices: A.C1.choices, required: true, nav: stratumOf.map((s) => 'P4' + s) });
add({ type: 'mc', key: 'C2', var: 'C2', title: A.C2.title, choices: A.C2.choices, required: true });
add({ type: 'time', key: 'T0', var: 'T0', title: A.T0.title, help: A.T0.help, required: true });
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
for (const s of STRATA) {
  add({ type: 'page', key: 'P4' + s, title: A.birth.pageTitle });
  add({ type: 'list', key: 'BD_' + s, var: 'birth_day', stratum: s, title: A.birth.title, help: A.birth.help, choices: DAYS, required: true, nav: dayRoute[s].map((r) => `R${r}_C1`) });
}
// 묶음별 카드
const PA = T.partA;
for (const r of ROUTES) {
  const a2 = r.arm === 'open' ? [...PA.A2.base, ...PA.A2.openExtra] : PA.A2.base;
  r.seq.forEach((code, i) => {
    const n = i + 1; const c = CARD[code];
    const meta = { route: r.id, arm: r.arm, set: r.set, pos: n, card_id: code, card_type: c.type };
    add({ type: 'page', key: `R${r.id}_C${n}`, title: PA.cardTitle.replace('{n}', n), help: cardText(c, r.arm), goTo: n === 1 && r.id > 1 ? 'PC' : undefined, ...meta });
    add({ type: 'mc', key: `R${r.id}_C${n}_A1`, var: 'A1', title: PA.A1.title, choices: PA.A1.choices, required: true, ...meta });
    add({ type: 'mc', key: `R${r.id}_C${n}_A2`, var: 'A2', title: PA.A2.title, choices: a2, required: true, ...meta });
    if (n === SPEC.attentionAfter) {
      add({ type: 'page', key: `R${r.id}_AC`, title: PA.AC.pageTitle, route: r.id, arm: r.arm, set: r.set });
      add({ type: 'mc', key: `R${r.id}_AC_Q`, var: 'AC', title: PA.AC.title, choices: PA.AC.choices, required: true, route: r.id, arm: r.arm, set: r.set });
    }
  });
  if (r.arm === 'closed') {
    const PB = T.partB;
    add({ type: 'page', key: `R${r.id}_B`, title: PB.pageTitle, route: r.id, arm: r.arm, set: r.set });
    add({ type: 'grid', key: `R${r.id}_B1`, var: 'B1', title: PB.B1.title, rows: r.seq.map((code, i) => `카드 ${i + 1} · ${CARD[code].label}`), cols: PB.B1.cols, required: true, route: r.id, arm: r.arm, set: r.set, rowCards: r.seq });
    add({ type: 'paragraph', key: `R${r.id}_B2`, var: 'B2', title: PB.B2.title, help: PB.B2.help, required: false, route: r.id, arm: r.arm, set: r.set });
    add({ type: 'mc', key: `R${r.id}_B3`, var: 'B3', title: PB.B3.title, choices: PB.B3.choices, required: true, route: r.id, arm: r.arm, set: r.set });
  }
}
// 공통 마무리
const PC = T.partC;
add({ type: 'page', key: 'PC', title: PC.pageTitle });
add({ type: 'mc', key: 'C3', var: 'C3', title: PC.C3.title, choices: PC.C3.choices, required: true });
add({ type: 'mc', key: 'C4', var: 'C4', title: PC.C4.title, choices: PC.C4.choices, required: true });
add({ type: 'grid', key: 'C5', var: 'C5', title: PC.C5.title, rows: PC.C5.rows, cols: PC.C5.cols, required: true });
add({ type: 'checkbox', key: 'C6', var: 'C6', title: PC.C6.title, choices: PC.C6.choices, other: true, max: PC.C6.max, required: true });
add({ type: 'mc', key: 'C7', var: 'C7', title: PC.C7.title, choices: PC.C7.choices, required: true });
const PD = T.partD;
const regCards = REG.map((c) => CARD[c.code]);
const metCards = MET.map((c) => CARD[c.code]);
const reveal = [
  PD.lead, '',
  '■ 부산·울산·경남 기업 카드 (모든 응답자)',
  ...regCards.map((c) => `· ${c.label} — ${c.open.company} · ${c.open.region}`), '',
  '■ 수도권 대기업 카드 (묶음에 따라 5장)',
  ...metCards.map((c) => `· ${c.label} — ${c.open.company} · ${c.open.region}`),
].join('\n');
add({ type: 'page', key: 'PD', title: PD.pageTitle, help: reveal });
const d1 = [...regCards, ...metCards].map((c) => c.open.company);
add({ type: 'checkbox', key: 'D1', var: 'D1', title: PD.D1.title, choices: [...d1, PD.D1.none], required: true, cards: [...regCards, ...metCards].map((c) => c.code) });
add({ type: 'grid', key: 'D2', var: 'D2', title: PD.D2.title, rows: regCards.map((c) => c.open.company), cols: PD.D2.cols, required: true, rowCards: regCards.map((c) => c.code) });
add({ type: 'paragraph', key: 'D3', var: 'D3', title: PD.D3.title, help: PD.D3.help, required: false });
add({ type: 'page', key: 'END', title: T.end.pageTitle, help: T.end.help, goTo: 'SUBMIT' });

// 쪽 단위 묶기(build 이어 하기 단위)
const units = [];
let start = 0;
plan.forEach((e, i) => { if (e.type === 'page' && i > 0) { units.push([start, i]); start = i; } });
units.push([start, plan.length]);

// 이동 대상 존재 확인
const keys = new Set(plan.map((e) => e.key));
for (const e of plan) {
  for (const t of [...(e.nav || []), e.goTo].filter(Boolean)) {
    if (!['CONTINUE', 'SUBMIT'].includes(t) && !keys.has(t)) throw new Error(`${e.key} 이동 대상 없음: ${t}`);
    if (!['CONTINUE', 'SUBMIT'].includes(t) && plan.find((x) => x.key === t).type !== 'page') throw new Error(`${t}는 쪽이 아님`);
  }
}
// 비공개 묶음 카드에 기업명·지역이 없는지
for (const e of plan) {
  if (e.type === 'page' && e.arm === 'closed' && e.card_id) {
    for (const w of allLeak) if (e.help.includes(w)) throw new Error(`${e.key} 비공개 카드에 '${w}' 노출`);
  }
}

// ── 해시와 잠금 파일 ──
const hashInput = JSON.stringify({ spec: SPEC, text: T, cards: Object.values(CARD).map((c) => [c.code, c.open, c.fields, c.label]), plan });
const specHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
const lock = {
  spec_hash: specHash,
  generated_at: new Date().toISOString(),
  n_items: plan.length,
  n_pages: plan.filter((e) => e.type === 'page').length + 1,
  routes: ROUTES.map((r) => ({ id: r.id, arm: r.arm, set: r.set, seq: r.seq })),
  dayRoute,
  strata: SPEC.strata,
  labels: Object.fromEntries(Object.values(CARD).map((c) => [c.code, c.label])),
  card_type: Object.fromEntries(Object.values(CARD).map((c) => [c.code, c.type])),
  company: Object.fromEntries(Object.values(CARD).map((c) => [c.code, c.key])),
  n_gap: Object.fromEntries(Object.values(CARD).map((c) => [c.code, FIELDS.reduce((k, f) => k + (/공개 정보 없음/.test(c.fields[f]) ? 1 : 0), 0)])),
  choices: {
    A1: PA.A1.choices, A2_open: [...PA.A2.base, ...PA.A2.openExtra], A2_closed: PA.A2.base, AC_pass: PA.AC.pass + 1,
    C1: A.C1.choices, C2: A.C2.choices, C3: PC.C3.choices, C4: PC.C4.choices, C5_rows: PC.C5.rows, C6: PC.C6.choices, C7: PC.C7.choices,
    B1: T.partB.B1.cols, B3: T.partB.B3.choices, D1: [...d1, PD.D1.none], D1_cards: [...regCards, ...metCards].map((c) => c.code), D2_rows: regCards.map((c) => c.code),
  },
  exclusions: SPEC.exclusions,
};
fs.writeFileSync(path.join(HERE, 'spec.lock.json'), JSON.stringify(lock, null, 1) + '\n');

// ── .gs 만들기 ──
const CONFIG = {
  mode: MODE,
  specHash,
  title: T.title + (MODE === 'pilot' ? ' [시험]' : ''),
  sheetTitle: '간판떼고 설문 응답' + (MODE === 'pilot' ? ' [시험]' : ''),
  description: T.intro.map(fill).join('\n\n'),
  closing: T.closing,
  prize: SPEC.prize,
  completionCode: CODE,
  strata: STRATA,
  dayRoute,
  routes: ROUTES.map((r) => ({ id: r.id, arm: r.arm, set: r.set, seq: r.seq })),
  cardType: lock.card_type,
  plan,
  units,
  lottery: {
    title: fill(T.lottery.title) + (MODE === 'pilot' ? ' [시험]' : ''),
    sheetTitle: '간판떼고 추첨 응모 (추첨·발송 후 삭제)' + (MODE === 'pilot' ? ' [시험]' : ''),
    description: T.lottery.description.join('\n'),
    code: T.lottery.code, phone: T.lottery.phone, consent: T.lottery.consent,
  },
  leakWords: allLeak,
};
const lib = fs.readFileSync(path.join(HERE, 'gs/form_lib.gs'), 'utf-8');
const header = `/**
 * 간판떼고 설문 — 구글 폼 자동 생성 스크립트 (${MODE === 'pilot' ? '시험용' : '배포용'})
 * 생성: ${lock.generated_at}  설계 해시: ${specHash}
 *
 * 쓰는 법 (PC 크롬 권장, 부산대 구글 계정으로 로그인)
 *  1. https://script.google.com 에서 [새 프로젝트]를 만든다.
 *  2. 편집기에 있던 코드를 모두 지우고 이 파일 내용 전체를 붙여넣은 뒤 저장(Ctrl+S)한다.
 *  3. 위쪽 함수 선택 칸에서 build 를 고르고 [실행]을 누른다. 권한 요청이 뜨면 계정을 고르고 허용한다.
 *     ('확인되지 않은 앱' 화면이 나오면 [고급] → [(프로젝트 이름)(으)로 이동]을 누른다. 본인이 만든 스크립트라서 나오는 안내다.)
 *  4. 실행 로그에 '다시 실행하세요'가 나오면 build 를 한 번 더 실행한다(구글이 한 번에 6분까지만 실행하게 해서 나눠 만든다).
 *  5. 로그 끝에 나온 '응답 링크'·'수정 링크'·'응답 시트'를 확인하고, 'verify 통과'가 나왔는지 본다.
 ${MODE === 'pilot'
    ? '*  6. 시험 응답이 끝나면 status 로 응답 수를 보고, 연구팀이 확인한 뒤 purgeTestResponses 로 시험 응답을 지운다.'
    : '*  6. 배포 준비가 끝나면 launch 를 실행한다(시험 응답 삭제, 1인 1회 제한, 응답 받기 시작, 1시간마다 정리 시트 갱신).\n *  7. 마감 때 closeSurvey 를 실행한다.'}
 *
 * 이 파일은 저장소의 reports/survey/build_form_gs.js 가 만든다. 직접 고치지 말고 원본을 고쳐 다시 만든다.
 */
`;
const out = header + 'var CONFIG = ' + JSON.stringify(CONFIG, null, 1) + ';\n\n' + lib;
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
const outPath = path.join(HERE, 'dist', `form_builder.${MODE}.gs`);
fs.writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${(out.length / 1024).toFixed(0)}KB) · 문항 ${plan.length}개 · 쪽 ${lock.n_pages}개 · 단위 ${units.length}개 · 해시 ${specHash}`);
