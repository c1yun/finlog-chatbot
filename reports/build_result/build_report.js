// 간판떼고 「지역기업 TOP10」 결과보고서(붙임3 양식) 생성 스크립트
// 입력: companies/<기업>.json(원고), scores.json(score.py), survey_results.json(설문 분석, 집계만),
//       followup.json(인사 질의·인터뷰·팀원 대조·사용 과제 집계), report_meta.js(고정 문안), 조사지침(평가 기준표)
// 사용: node build_report.js out.docx            ← 제출용(설문·질의 결과가 모두 있어야 함)
//       node build_report.js out.docx --draft    ← 미리보기(빠진 자료는 표시만 하고 '제출 금지' 머리말)
//       node build_report.js out.docx --desk     ← 공개자료만으로 쓴 제출본(설문·인터뷰 미반영, TOP3는 기업 평가로)
const fs = require('fs');
const path = require('path');
const {
  D, FONT, W, C, cw, p, bullet, h1, h2, h3, lead, note, gap, tbl, mk, exact, runs, img,
} = require('./lib');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat,
} = D;
const META = require('./report_meta');

const ARGS = process.argv.slice(2);
const DRAFT = ARGS.includes('--draft');
const DESK = ARGS.includes('--desk'); // 공개자료만으로 쓴 제출본(설문·인터뷰 결과를 반영하지 않음)
if (DESK && DRAFT) throw new Error('--desk와 --draft는 함께 쓸 수 없다.');
const OUT = ARGS.find((a) => !a.startsWith('--')) || path.join(__dirname, 'out.docx');
const CENTER = AlignmentType.CENTER;
const NOTES = path.join(__dirname, '..', '..', 'research_notes', '결과보고서 기업 분석') + '/';
const ORDER = ['조광요턴', '동화엔텍', '태광후지킨', '파나시아', '송원산업',
  '지엠비코리아', '해성디에스', '넥센타이어', 'BHI', 'TKG태광'];
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const GREEN = 'E2EFDA';
const PINK = 'FDE9E7';

const SC = JSON.parse(fs.readFileSync(path.join(__dirname, 'scores.json'), 'utf-8'));
const COMP = {};
ORDER.forEach((k) => {
  const f = path.join(__dirname, 'companies', `${k}.json`);
  if (fs.existsSync(f)) COMP[k] = JSON.parse(fs.readFileSync(f, 'utf-8'));
});

// ───────── 설문·후속 자료 ─────────
const MISSING = [];
const miss = (what) => { MISSING.push(what); return `［${what} 입력 예정］`; };
function loadJSON(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null; }
// 본조사 결과는 analyze_survey.py가 reports/survey/results/에 쓴다(집계·그림만). 미리보기는 합성 결과로 대신한다.
const SV_LIVE_DIR = path.join(__dirname, '..', 'survey', 'results');
const SV_SYN_DIR = path.join(__dirname, '..', 'survey', 'out_nonlive', 'synthetic');
let SV = DESK ? null : loadJSON(path.join(SV_LIVE_DIR, 'survey_results.json'));
let SV_DIR = SV_LIVE_DIR;
let SV_NONLIVE = false;
const NO_SYN = process.argv.includes('--no-synth'); // 미완성본: 합성 설문 결과 없이 빈 자리로 둔다
if (!SV && DRAFT && !NO_SYN) {
  SV = loadJSON(path.join(SV_SYN_DIR, 'survey_results.json'));
  SV_DIR = SV_SYN_DIR;
  SV_NONLIVE = !!SV;
}
if (SV && SV.meta && SV.meta.data_source !== 'live') SV_NONLIVE = true;
if (SV_NONLIVE && !DRAFT) throw new Error('시험·합성 설문 자료로는 제출용 보고서를 만들 수 없다(--draft로만 미리보기).');
const FUP = loadJSON(path.join(__dirname, 'followup.json')) || {};
const MD = DESK ? META.desk : null; // 제출본(공개자료 단독) 문안
const CH = { improve: 'Ⅳ', card: 'Ⅳ장', plan: DESK ? 'Ⅴ장' : 'Ⅳ장', apxChange: DESK ? '부록 4' : '부록 6', apxRefs: '부록 7', apxSens: DESK ? '부록 3' : '부록 4', apxXv: '부록 5' };

// 조사지침에서 기업 기본 정보(본점·업종)와 18개 세부 항목 기준표를 읽는다
const GUIDE = fs.readFileSync(NOTES + '_조사지침.md', 'utf-8').split('\n');
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
const INFO = {};
GUIDE.filter((l) => /^\| [①-⑩] \|/.test(l)).forEach((l) => {
  const [, name, place, sector] = cells(l);
  INFO[name] = { place, sector };
});
const ANCHORS = [];
{
  const i = GUIDE.findIndex((l) => l.startsWith('| 영역(배점) | 세부 항목(배점) | 1점'));
  for (let j = i + 2; j < GUIDE.length && GUIDE[j].startsWith('|'); j += 1) ANCHORS.push(cells(GUIDE[j]));
}

// ───────── 공통 서식 ─────────
const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? '–' : Number(x).toFixed(d));
const fmtJ = (j) => (j === null || j === undefined ? '–' : (Number.isInteger(j) ? String(j) : j.toFixed(1)));
const pct = (x) => `${Math.round(x * 100)}%`;
const final = (k) => SC[k] && SC[k].final;
const hasB = (k) => !!(SC[k] && SC[k].B);
const shortJob = (s) => s.split('(')[0].trim();
const ci = (a) => (a && a.length === 2 ? `${fmt(a[0])}~${fmt(a[1])}` : '–');
const stripCircled = (s) => (s || '').replace(/[①-⑭]\s*/g, '').trim();
const BODY = 19; // 본문 9.5pt
const TABLE = 17; // 표 8.5pt

function circ(title, tail) {
  const kids = [mk('○ ', { size: 20, bold: true, color: C.navy }), mk(title, { size: 20, bold: true, color: C.navy })];
  if (tail) kids.push(mk(`  ${tail}`, { size: 16, color: C.sub }));
  return new Paragraph({ children: kids, spacing: { before: 150, after: 50, ...exact(20, 1.45) }, keepNext: true, keepLines: true });
}
function dash(t, o = {}) {
  return new Paragraph({
    children: runs(`- ${t}`, { size: o.size || BODY }),
    indent: { left: 300, hanging: 170 },
    spacing: { before: 0, after: 30, ...exact(o.size || BODY, 1.48) },
    keepLines: true, keepNext: o.keepNext,
  });
}
function dot(t) {
  return new Paragraph({
    children: runs(`· ${t}`, { size: 18, color: '404040' }),
    indent: { left: 560, hanging: 150 },
    spacing: { before: 0, after: 24, ...exact(18, 1.45) },
    keepLines: true,
  });
}
const lab = (t, o = {}) => ({ t, fill: o.fill || C.label, bold: true, align: CENTER, ...o });
const headc = (t, o = {}) => ({ t, fill: C.head, bold: true, align: CENTER, ...o });

// {자리} 채우기: 설문·질의 결과가 없으면 미리보기에서는 표시, 제출용에서는 멈춘다
function fillText(t) {
  const m = SV ? SV.meta : null;
  const vals = {
    n_valid: m ? String(m.n_valid) : null,
    n_open: m ? String(m.n_open) : null,
    n_closed: m ? String(m.n_closed) : null,
    field: m && m.field_period ? m.field_period : (FUP.survey && FUP.survey.field) || null,
    verification: FUP.verification ? FUP.verification.text : null,
    verification_short: FUP.verification ? FUP.verification.short : null,
    followup: FUP.hr ? FUP.hr.text : null,
    hr_sent: FUP.hr ? FUP.hr.short : null,
    interviews: FUP.interviews ? FUP.interviews.short : null,
  };
  return t.replace(/\{(\w+)\}/g, (_, k) => (vals[k] ? vals[k] : miss(k)));
}

// ───────── 순위 ─────────
function ranking() {
  const ks = ORDER.filter((k) => final(k));
  if (SV && SV.ranking) {
    const rows = SV.ranking.by_w['0.7'];
    const by = Object.fromEntries(rows.map((r) => [r.company, r]));
    const byFinal = [...ks].sort((a, b) => by[b].final - by[a].final);
    const top3 = SV.ranking.top3;
    const rank = Object.fromEntries(byFinal.map((k, i) => [k, i + 1]));
    return { mode: 'final', by, byFinal, top3, rank, eligible: byFinal.filter((k) => final(k).fill >= 0.7) };
  }
  const byFinal = [...ks].sort((a, b) => final(b).scaled - final(a).scaled || final(b).low - final(a).low);
  const eligible = byFinal.filter((k) => final(k).fill >= 0.7);
  const rank = Object.fromEntries(byFinal.map((k, i) => [k, i + 1]));
  if (DESK) return { mode: 'desk', by: {}, byFinal, top3: eligible.slice(0, 3), rank, eligible };
  miss('설문 결과(학생 선호)');
  return { mode: 'eval', by: {}, byFinal, top3: eligible.slice(0, 3), rank, eligible };
}
const R = ranking();
const pref = (k) => (SV ? SV.preference.find((x) => x.company === k) : null);
const finalScore = (k) => (R.by[k] ? R.by[k].final : null);

// ───────── 표지와 요약 ─────────
function cover() {
  const out = [];
  out.push(p('[붙임3] 「지역기업 TOP10」 결과보고서', { bold: true, after: 80 }));
  const titleParas = [
    new Paragraph({ alignment: CENTER, spacing: { before: 60, after: 0, ...exact(32, 1.35) }, children: [mk('2026학년도 PNU Student Choice Awards', { size: 32, bold: true })] }),
    new Paragraph({ alignment: CENTER, spacing: { before: 0, after: 40, ...exact(28, 1.35) }, children: [mk('(가장 일하고 싶은 지역기업 TOP10) 결과보고', { size: 28, bold: true })] }),
  ];
  out.push(tbl(cw([1374, 3689, 1130, 3428]), [
    [{ span: 4, fill: C.title, paras: titleParas }],
    [lab('응시번호'), { t: '( 담당자 기재 )', align: CENTER }, lab('팀명'), { t: META.team, bold: true, align: CENTER }],
  ], { size: 20 }));

  out.push(h2('보고서 요약', { before: 220 }));
  const t3 = R.top3;
  if (DESK) return [...out, ...coverDesk()];
  if (SV) {
    const kr = SV.kanban.regional;
    const dir = kr.diff >= 0 ? '높았다' : '낮았다';
    out.push(lead(`부산·울산·경남 지역기업 10곳을 공개자료로 분석해 6개 영역 100점으로 평가(70%)하고, 부산대 재학생 ${SV.meta.n_valid}명이 기업명·근무지역을 가린 카드로 답한 지원 의향을 학생 선호(30%)로 더해 「지역기업 TOP 3」를 ${t3.join('·')}로 정했다. 같은 카드에 기업명과 근무지역을 보여 주면 지역기업 10곳의 평균 지원 의향이 가린 경우보다 ${fmt(Math.abs(kr.diff), 2)}점(5점 척도) ${dir}(95% 신뢰구간 ${fmt(kr.ci_welch[0], 2)}~${fmt(kr.ci_welch[1], 2)}).`));
  } else {
    out.push(lead(`부산·울산·경남 지역기업 10곳을 공개자료로 분석해 6개 영역 100점으로 평가했다. 기업 평가만으로 본 상위 3곳은 ${t3.join('·')}다. ${miss('설문 결과 요약')}`));
  }
  if (DRAFT) out.push(tbl([W], [[{ t: `**미리보기(제출 금지)** ${SV_NONLIVE ? '설문 수치는 분석 코드 시험용 합성 자료라 실제 결과가 아니다. ' : ''}아직 채우지 못한 자리는 분홍 칸과 ［ ］로 표시했다.`, fill: PINK, size: 17 }]], { padV: 60, padH: 120 }));
  out.push(gap(4));

  const rows = [[headc('번호'), headc('기업 (본점)'), headc('대표 학사 신입 직무'), headc(['기업 평가', '(범위)']), headc(['학생 선호', '(95% CI)']), headc('종합'), headc('충족률'), headc('평판')]];
  ORDER.forEach((k, i) => {
    const c = COMP[k];
    const f = final(k);
    const pf = pref(k);
    const isTop = t3.includes(k);
    rows.push([
      { t: NUM[i], align: CENTER, fill: isTop ? C.yellow : undefined },
      { t: [`**${k}**${isTop ? ' ★' : ''}`, INFO[k] ? INFO[k].place : ''], align: CENTER, fill: isTop ? C.yellow : undefined },
      { t: c ? c.jobs.map((j) => shortJob(j.name)).join(', ') : '작성 중', size: 15 },
      { t: f ? [`**${fmt(f.scaled)}**`, `(${fmt(f.low)}~${fmt(f.high)})`] : '–', align: CENTER },
      { t: pf ? [`**${fmt(pf.pref)}**`, `(${ci(pf.ci)})`] : '–', align: CENTER },
      { t: finalScore(k) !== null ? `**${fmt(finalScore(k))}**` : '–', align: CENTER, fill: isTop ? C.yellow : undefined },
      { t: f ? pct(f.fill) : '–', align: CENTER },
      { t: META.rep[k], align: CENTER, fill: META.rep[k] === '적합' ? GREEN : C.yellow },
    ]);
  });
  out.push(tbl(cw([6, 15, 25, 12, 13, 9, 9, 9]), rows, { size: 16, padV: 32, padH: 55 }));
  out.push(note('기업 평가는 환산점수(100점), 학생 선호는 기업명·근무지역을 가린 카드의 평균 지원 의향을 0~100으로 바꾼 값, 종합 = 기업 평가 × 0.7 + 학생 선호 × 0.3이다. ★와 노란 칸은 TOP3다. 평판 \'주의\'는 결격은 아니지만 사실과 회사 입장을 함께 적은 기업이다.'));

  out.push(h3('연구 방법'));
  META.method.forEach((t) => out.push(bullet(fillText(t), { size: 18 })));
  if (META.criteriaMap) {
    out.push(h3('심사기준과 보고서 위치'));
    out.push(tbl(cw([22, 78]), [[headc('심사기준(2026. 11. 3. 안내)'), headc('이 보고서에서 다룬 곳')], ...META.criteriaMap.map(([a, b]) => [{ t: a, bold: true, fill: C.gray }, b])], { size: 16, padV: 22, padH: 60 }));
  }
  return out;
}

// 제출본(공개자료 단독)의 요약: 결론, 핵심 결과, 순위표, 방법
function deskText(t) {
  // 설문을 반영하지 않는 제출본에서는 '설문 결과를 보기 전' 같은 말을 뺀다
  return t.replace(/, 설문 결과를 보기 전\)/g, ')').replace(/\(설문 결과를 보기 전\)/g, '').replace(/ 모두 설문 결과를 보기 전에 정했다\./g, '').replace(/, 모두 설문 결과를 보기 전에 정했다\./g, '.').replace(/\s*\{verification\}/g, '').replace(/\{chChange\}/g, CH.apxChange).replace(/\{apxSens\}/g, CH.apxSens);
}
// ───────── Ⅰ. 기업별 분석 ─────────
function eligibilityTable() {
  const out = [h3('참가 요건 확인 (2026. 11. 3.)', { before: 0 })];
  const rows = [[headc('기업'), headc('등기 본점'), headc('신입 근무지'), headc(['주최 측', '리스트']), headc('규모 근거'), headc('비고')],
    ...META.eligibility.map(([a, b, c2, d, e, f]) => [{ t: a, bold: true, fill: C.gray, align: CENTER }, b, c2, { t: d, align: CENTER }, e, { t: f, size: 14 }])];
  out.push(tbl(cw([12, 13, 21, 8, 18, 28]), rows, { size: 15, padV: 22, padH: 50 }));
  out.push(note(META.eligibilityNote));
  return out;
}

// 제출본: 공개자료로 확인하지 못한 항목을 '지원 전에 확인할 질문'으로 싣는다(설문 관련 항목은 뺀다)
function pendingBoxDesk(c) {
  const items = (c.pending || []).filter((x) => !/^설문으로 확인/.test(x)).map((x) => x.replace(/^(인사 질의·인터뷰|인사 질의|인터뷰|자료)로 확인(\([^)]*\))?:\s*/, ''));
  if (!items.length) return null;
  return tbl([W], [[{ t: ['**공개자료로 확인하지 못한 것 — 지원 전에 회사에 확인할 질문**', ...items.map((x) => `- ${x}`)], fill: C.gray }]], { size: 15, padV: 36, padH: 110 });
}
function followupBox(k, c) {
  if (DESK) return pendingBoxDesk(c);
  const F = c.followup;
  if (!F) {
    return tbl([W], [[{ t: [`**회사 답변·인터뷰 확인**`, `- ${miss(`${k} 인사 질의·인터뷰 결과`)}`, ...(c.pending || []).map((x) => `- (확인할 항목) ${x}`)], fill: PINK }]], { size: 16, padV: 60, padH: 120 });
  }
  const lines = ['**회사 답변·인터뷰 확인**'];
  (F.answered || []).forEach((x) => lines.push(`- ${x.q}: ${x.a} — ${x.src}${x.vs_public ? ` (공개자료와 비교: ${x.vs_public})` : ''}`));
  (F.unanswered || []).forEach((x) => lines.push(`- ${x} — 확인하지 못함`));
  if (F.log) lines.push(`- ${F.log}`);
  return tbl([W], [[{ t: lines, fill: C.gray }]], { size: 16, padV: 60, padH: 120 });
}

function companySection(k, i) {
  const n = i + 1;
  const c = COMP[k];
  const info = INFO[k] || { place: '', sector: '' };
  const out = [];
  out.push(new Paragraph({
    heading: D.HeadingLevel.HEADING_2,
    children: [mk(`${NUM[i]} ${k}`, { size: 26, bold: true, color: C.navy }), mk(`   ${info.place} · ${info.sector.replace(/\s*\(.*\)$/, '')}`, { size: 18, bold: true, color: C.blue })],
    spacing: { before: 0, after: 80, ...exact(26, 1.4) },
    keepNext: true,
    pageBreakBefore: true,
  }));
  if (!c) {
    out.push(p('(원고 작성 중)'));
    return out;
  }
  out.push(lead(c.summary, { size: BODY + 1 }));

  // n-1) 기업 기본정보 (양식 표)
  out.push(h3(`${n}-1) 기업 기본정보`, { before: 60 }));
  const introRows = [[
    { t: '기업 소개', rowSpan: c.intro.length + 1, fill: C.label, bold: true, align: CENTER },
    headc('항목'), headc('내용'),
  ]];
  c.intro.forEach(([label, val]) => introRows.push([{ t: label, fill: C.gray, bold: true, align: CENTER }, { t: val }]));
  out.push(tbl(cw([967, 1655, 6980]), introRows, { size: TABLE + 1, padV: DESK ? 28 : 40 }));

  const F = c.finance;
  if (F && F.rows && F.rows.length) {
    out.push(gap(6));
    const fr = [[headc(`재무 요약 (${F.unit}, ${F.basis.split('(')[0].trim()})`), ...F.years.map((y) => headc(`${y}년`))]];
    F.rows.forEach((r) => fr.push([{ t: r[0], fill: C.gray, bold: true, align: CENTER }, ...r.slice(1).map((v) => ({ t: v || '–', align: CENTER }))]));
    out.push(tbl(cw([31, 23, 23, 23]), fr, { size: TABLE, padV: DESK ? 22 : 30 }));
    const fn = [F.basis.includes('(') ? `기준: ${F.basis}.` : '', F.note || ''].filter(Boolean).join(' ');
    if (fn) out.push(note(fn));
  }

  // n-2) 분석내용
  out.push(h3(`${n}-2) 분석내용`));
  c.analysis.forEach((b) => {
    out.push(circ(b.title, stripCircled(b.items)));
    b.points.forEach((pt, j) => {
      out.push(dash(pt.t, { keepNext: j === 0 && (pt.sub || []).length === 0 && b.points.length > 1 }));
      (pt.sub || []).forEach((s) => out.push(dot(s)));
    });
  });

  // 대표 신입 직무
  out.push(circ('대표 학사 신입 직무', '직무 분석 · 필요역량'));
  const J = c.jobs;
  const jw = J.length === 1 ? cw([14, 86]) : (J.length === 2 ? cw([14, 43, 43]) : cw([13, 29, 29, 29]));
  const jrows = [[headc('구분'), ...J.map((j) => headc(j.name))]];
  [['업무', 'work'], ['요건', 'req'], ['근무지', 'place'], ['고용형태', 'type'], ['보상', 'pay'], ['공고', 'when']].forEach(([l, f]) => {
    jrows.push([{ t: l, fill: C.gray, bold: true, align: CENTER }, ...J.map((j) => ({ t: j[f] || '–' }))]);
  });
  out.push(tbl(jw, jrows, { size: TABLE - 1, padV: DESK ? 22 : 30 }));

  // 핵심가치와 직무 · 지역 정주 조건 (2026. 11. 3. 안내 심사기준)
  if (c.values) {
    const V = c.values;
    out.push(circ('핵심가치와 직무', '핵심가치 및 직무분석'));
    out.push(dash(`${V.label}: ${V.items} (${V.basis}).`));
    if (V.hiring) out.push(dot(`채용·교육과의 연결: ${V.hiring}${/[.다]$/.test(V.hiring) ? '' : '.'}`));
    if (V.job) out.push(dot(`대표 직무와의 연결: ${V.job}`));
  }
  if (c.settle && c.settle.length) {
    out.push(circ('지역 정주 조건', '지역정주형 취업전략'));
    out.push(tbl(cw([13, 73, 14]), [[headc('항목'), headc('내용'), headc('확인')], ...c.settle.map(([a, b, st]) => [{ t: a, fill: C.gray, bold: true, align: CENTER }, b, { t: st, align: CENTER, size: 15 }])], { size: TABLE - 1, padV: 24 }));
  }

  // 평가 점수와 학생 선호
  const S = final(k);
  if (S && DESK) {
    const rate = S.areas.map((a) => `${a.name} ${a.conf ? Math.round((a.got / a.conf) * 100) : 0}%${a.conf < a.w ? '*' : ''}`).join(' · ');
    const missAll = S.areas.flatMap((a) => a.items.filter((x) => x.j === null).map((x) => `${x.name}(${x.w}점)`));
    out.push(circ('평가 점수', '세부 판정은 부록 2'));
    out.push(dash(`**기업 평가 ${fmt(S.scaled)}점 · 10곳 중 ${R.rank[k]}위${R.top3.includes(k) ? '(TOP 3)' : ''}.** 영역별 득점률: ${rate}.`));
    out.push(dot(missAll.length ? `확인하지 못해 점수에서 뺀 항목(*): ${missAll.join(', ')}. 이 항목을 0점~만점으로 넣으면 ${fmt(S.low)}~${fmt(S.high)}점이다.` : '18개 항목을 모두 확인해 뺀 항목이 없다.'));
  } else if (S) {
    out.push(circ(DESK ? '평가 점수' : '평가 점수와 학생 선호', hasB(k) ? '최종 판정 · 부록 2' : '1차 채점 · 부록 2'));
    const sr = [[headc('영역 (배점)'), headc('확인 배점'), headc('득점'), headc('영역 환산'), headc('미확인 항목')]];
    S.areas.forEach((a) => {
      const missItems = a.items.filter((x) => x.j === null).map((x) => `${x.name}(${x.w})`).join(', ');
      sr.push([
        { t: `${a.name} (${a.w})`, fill: C.gray, bold: true, align: CENTER },
        { t: String(a.conf), align: CENTER },
        { t: fmt(a.got), align: CENTER },
        { t: a.conf ? `${Math.round((a.got / a.conf) * 100)}%` : '–', align: CENTER },
        { t: missItems || '없음', size: 15 },
      ]);
    });
    sr.push([
      { t: '기업 평가', fill: C.label, bold: true, align: CENTER },
      { t: String(S.conf), align: CENTER, bold: true },
      { t: fmt(S.got), align: CENTER, bold: true },
      { t: `**환산 ${fmt(S.scaled)}점**`, align: CENTER, fill: C.yellow },
      { t: `범위 ${fmt(S.low)}~${fmt(S.high)}점 · 정보 충족률 ${pct(S.fill)}`, size: 15, fill: C.yellow },
    ]);
    const pf = pref(k);
    const card = SV ? SV.cards.find((x) => x.company === k) : null;
    if (pf && card) {
      sr.push([
        { t: '학생 선호', fill: C.label, bold: true, align: CENTER },
        { t: `${pf.n}명`, align: CENTER },
        { t: `${fmt(pf.mean, 2)}/5`, align: CENTER },
        { t: `**${fmt(pf.pref)}점**`, align: CENTER, fill: C.yellow },
        { t: `가린 카드 평균 지원 의향(95% CI ${ci(pf.ci)}점). 보여 준 카드는 ${fmt(card.open.mean, 2)}/5(${card.open.n}명)`, size: 15, fill: C.yellow },
      ]);
      sr.push([
        { t: '종합', fill: C.label, bold: true, align: CENTER },
        { t: '', align: CENTER }, { t: '', align: CENTER },
        { t: `**${fmt(finalScore(k))}점**`, align: CENTER, fill: C.yellow },
        { t: `기업 평가 × 0.7 + 학생 선호 × 0.3 · 전체 ${R.rank[k]}위`, size: 15, fill: C.yellow },
      ]);
    } else if (DESK) {
      sr.push([{ t: '순위', fill: C.label, bold: true, align: CENTER }, { t: `10곳 중 **${R.rank[k]}위**${R.top3.includes(k) ? ' (TOP 3)' : ''}`, span: 4 }]);
    } else {
      sr.push([{ t: '학생 선호', fill: C.label, bold: true, align: CENTER }, { t: miss('설문 결과(기업별)'), span: 4, fill: PINK }]);
    }
    out.push(tbl(cw([22, 12, 11, 15, 40]), sr, { size: TABLE - 1, padV: 28 }));
  }

  // SWOT
  out.push(circ('SWOT 분석', 'SWOT'));
  const sw = c.swot;
  const swCell = (title, arr, fill) => ({ t: [`**${title}**`, ...arr.map((x) => `- ${x}`)], fill, v: D.VerticalAlign.TOP });
  out.push(tbl(cw([50, 50]), [
    [swCell('강점 (S)', sw.S, 'EAF1FB'), swCell('약점 (W)', sw.W, 'FBEDEA')],
    [swCell('기회 (O)', sw.O, 'EEF6EA'), swCell('위협 (T)', sw.T, 'FDF6E3')],
  ], { size: TABLE - 1, padV: DESK ? 34 : 50 }));

  // 개선 아이디어: 공고 정보 공개형은 Ⅳ장 공통 제안(표준 카드)으로 묶고, 기업 고유 제안 하나를 자세히 싣는다
  out.push(circ('개선 아이디어 (제안)', '개선 아이디어 · 공통 제안은 Ⅳ장'));
  const I = c.ideas;
  const isTask = (x) => /과제|캡스톤|현장실습|설명회|교과/.test(x.title);
  const generic = (x) => /보상|근무 ?조건|조건표|조건 4줄/.test(x.title);
  let full = I.filter(isTask);
  if (!full.length) full = [I.find((x) => !generic(x)) || I[0]];
  const rest = I.filter((x) => !full.includes(x));
  const iw = full.length > 1 ? cw([14, 43, 43]) : cw([14, 86]);
  const irows = [[headc('구분'), ...full.map((x) => headc(x.title))]];
  [['문제', 'problem'], ['대상', 'target'], ['필요한 정보', 'info'], ['실행 주체', 'owner'], ['예시', 'example'], ['확인 지표', 'metric']].forEach(([l, f]) => {
    irows.push([{ t: l, fill: C.gray, bold: true, align: CENTER }, ...full.map((x) => ({ t: x[f] || '–' }))]);
  });
  out.push(tbl(iw, irows, { size: TABLE - 1, padV: DESK ? 20 : 28 }));
  rest.forEach((x) => out.push(note(`공고 정보 공개 제안 「${x.title.replace(/^제안:\s*|\(제안\)/g, '').trim()}」은 ${CH.card} 공통 제안 '${META.standardCard.title}'로 묶었다. 이 기업에서 특히 채울 항목: ${x.info}`)));

  // 8주 준비 전략
  out.push(circ('직무군별 8주 준비 전략', `취업 준비 전략 · 통합본은 ${CH.plan}`));
  const P8 = c.plan8;
  const tr = P8.tracks.length;
  const pw = tr > 1 ? cw([14, 43, 43]) : cw([14, 86]);
  const prows = [[headc('기간'), ...P8.tracks.map((t) => headc(t))]];
  P8.rows.forEach((r) => prows.push([{ t: r[0], fill: C.gray, bold: true, align: CENTER }, ...r.slice(1, 1 + tr).map((x) => ({ t: x || '–' }))]));
  out.push(tbl(pw, prows, { size: TABLE - 1, padV: DESK ? 20 : 28 }));

  // 회사 답변·인터뷰 확인
  out.push(gap(DESK ? 5 : 8));
  const fb = followupBox(k, c);
  if (fb) out.push(fb);
  out.push(p(`**평판 점검(${META.rep[k]})** ${c.reputation}`, { size: DESK ? 16 : 17, before: DESK ? 60 : 80, after: DESK ? 40 : 60 }));

  // 출처
  out.push(new Paragraph({ children: [mk('출처', { size: 16, bold: true })], spacing: { before: 80, after: 20, ...exact(16, 1.4) }, keepNext: true }));
  const srcPara = ([title, desc, url], j) => {
    const fs1 = DESK ? 13 : 14;
    const kids = [mk(`[${j + 1}] `, { size: fs1, bold: true }), mk(title, { size: fs1, bold: true }), mk(`  ${desc}`, { size: fs1, color: C.sub })];
    if (url) kids.push(mk(`  ${DESK ? shortUrl(url) : url}`, { size: fs1 - 1, color: '7F7F7F' }));
    return new Paragraph({ children: kids, spacing: { before: 0, after: DESK ? 8 : 16, ...exact(fs1, DESK ? 1.27 : 1.35) }, indent: { left: 260, hanging: 260 } });
  };
  if (DESK) {
    // 제출본: 두 단으로 놓아 기업마다 쪽이 넘치지 않게 한다
    const half = Math.ceil(c.sources.length / 2);
    const col = (arr, off) => ({ paras: arr.map((x, j) => srcPara(x, j + off)), v: D.VerticalAlign.TOP });
    out.push(tbl(cw([50, 50]), [[col(c.sources.slice(0, half), 0), col(c.sources.slice(half), half)]], { noBorder: true, padV: 0, padH: 50, cantSplit: false }));
  } else {
    c.sources.forEach((x, j) => out.push(srcPara(x, j)));
  }
  return out;
}

function shortUrl(url) {
  if (!url) return '';
  let m;
  if ((m = /dart\.fss\.or\.kr.*rcpNo=(\d+)/.exec(url))) return `DART 접수번호 ${m[1]}`;
  if ((m = /saramin\.co\.kr.*rec_idx=(\d+)/.exec(url))) return `사람인 공고 ${m[1]}`;
  if ((m = /jobkorea\.co\.kr\/Recruit\/GI_Read\/(\d+)/i.exec(url))) return `잡코리아 공고 ${m[1]}`;
  if (/work24\.go\.kr|work\.go\.kr/.test(url)) return '고용24';
  if (/blind\.com|teamblind\.com/.test(url)) return '블라인드';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}
function sec1() {
  const out = [h1('Ⅰ. 기업별 분석', { pageBreak: true })];
  out.push(note('기업마다 양식의 \'기업 기본정보\' 표와 \'분석내용\'을 두고, 분석내용은 공식 분석 항목 14개를 7개 묶음으로 정리했다(묶음 제목 옆 회색 글자가 그 묶음의 분석 항목). 문장 끝 [n]은 그 기업 분석 끝의 출처 번호다.', { before: 0, after: 120 }));
  out.push(...eligibilityTable());
  ORDER.forEach((k, i) => out.push(...companySection(k, i)));
  return out;
}

// ───────── Ⅱ. 종합 비교표 ─────────
const COLS = [['성장성', '성장·지속성'], ['기술력', '기술·경쟁력'], ['직무매력', '직무 연계'], ['근무환경', '보상·근무'], ['글로벌', '해외·경력']];
const AREA_W = { '성장·지속성': 20, '기술·경쟁력': 15, '직무 연계': 25, '보상·근무': 25, '해외·경력': 5 };
function areaCell(f, name) {
  const a = f.areas.find((x) => x.name === name);
  return { t: `${fmt(a.got)}/${a.conf}${a.conf < a.w ? '*' : ''}`, align: CENTER };
}
// 양식 예시의 '적합성' 열: 부산대 전공 연결(8점)과 지역 고용·대학 연계(3점) 두 항목을 다시 보인다(총점에 이미 들어 있음)
function fitCell(f) {
  const pick = (area, item) => f.areas.find((x) => x.name === area).items.find((x) => x.name === item);
  const a = pick('직무 연계', '전공·교과 연결과 요건 명확성');
  const b = pick('ESG·지역', '지역 고용·대학 연계');
  const got = (a.s || 0) + (b.s || 0);
  const conf = (a.j === null ? 0 : a.w) + (b.j === null ? 0 : b.w);
  return { t: `${fmt(got)}/${conf}${conf < a.w + b.w ? '*' : ''}`, align: CENTER };
}
function sec2() {
  if (DESK) return sec2Desk();
  const out = [h1('Ⅱ. 기업 10개 종합 비교표', { pageBreak: true })];
  out.push(lead(META.compareLead));
  const head = [headc('기업'), ...COLS.map(([c, a]) => headc([c, `(${AREA_W[a]})`])), headc(['적합성', '(학생 선호)']), headc(['기타', '(ESG 10·평판)']), headc(['총점', '(종합·기업 평가)'])];
  const rows = [head];
  R.byFinal.forEach((k, i) => {
    const f = final(k);
    const top = R.top3.includes(k);
    const e = f.areas.find((x) => x.name === 'ESG·지역');
    const pf = pref(k);
    rows.push([
      { t: [`**${i + 1}. ${k}**`, `(${NUM[ORDER.indexOf(k)]})`], fill: top ? C.yellow : C.gray, align: CENTER },
      ...COLS.map(([, a]) => areaCell(f, a)),
      { t: pf ? [`**${fmt(pf.pref)}**`, `(${ci(pf.ci)})`] : miss('학생 선호'), align: CENTER, fill: pf ? undefined : PINK },
      { t: [`${fmt(e.got)}/${e.conf}${e.conf < e.w ? '*' : ''}`, META.rep[k]], align: CENTER, fill: META.rep[k] === '적합' ? undefined : 'FFF8E1' },
      { t: [finalScore(k) !== null ? `**${fmt(finalScore(k))}**` : '–', `기업 ${fmt(f.scaled)}`, `(${fmt(f.low)}~${fmt(f.high)})`], align: CENTER, fill: top ? C.yellow : undefined },
    ]);
  });
  out.push(tbl(cw([1600, 900, 900, 900, 900, 900, 1110, 1080, 1210]), rows, { size: 16, padV: 32, padH: 50 }));
  META.compareNotes.forEach((t) => out.push(note(t)));
  out.push(...agreementTable());
  return out;
}
function agreementTable() {
  const out = [];
  // 영역별 일치율(2인 평가)
  const withB = ORDER.filter((k) => hasB(k));
  if (withB.length) {
    out.push(h3('두 채점안의 영역별 일치율'));
    const names = SC[withB[0]].final.areas.map((a) => a.name);
    const ar = [[headc('영역'), headc('두 채점 모두 확인한 항목'), headc('판정 같음'), headc('차이 1점 이내'), headc('원문 재대조·규칙 통일 조정')]];
    names.forEach((nm) => {
      let items = 0; let same = 0; let near = 0; let adj = 0;
      withB.forEach((k) => {
        const g = SC[k].agree[nm];
        items += g.items; same += g.same; near += g.near;
        const subs = SC[k].final.areas.find((a) => a.name === nm).items.map((x) => x.name);
        adj += (SC[k].adjusted || []).filter((x) => subs.includes(x)).length;
      });
      ar.push([{ t: nm, fill: C.gray, bold: true, align: CENTER }, { t: String(items), align: CENTER },
        { t: items ? `${same} (${Math.round((same / items) * 100)}%)` : '–', align: CENTER },
        { t: items ? `${near} (${Math.round((near / items) * 100)}%)` : '–', align: CENTER },
        { t: String(adj), align: CENTER }]);
    });
    out.push(tbl(cw([22, 22, 18, 18, 20]), ar, { size: 16, padV: 30 }));
    const agNote = `${withB.length}개 기업 × 세부 항목 기준이다. 판정은 0~5점이며, 영역 득점 차가 2점 이상이거나 한쪽만 확인한 항목은 원문을 다시 대조해 정했고, 2026. 11. 3.에는 자료 부재로 낮춘 판정 8건을 규칙에 맞게 고쳤고, 같은 날 재조사에서 나온 새 사실(공고 재게시·요건 변경 등) 10건은 두 번 따로 다시 판정해 평균했다(부록 2의 †). 모두 설문 결과를 보기 전에 정했다.`;
    out.push(note(DESK ? `${deskText(agNote)} 2026. 11. 10. 교차검증과 2차 출처 보강에서 근거가 바뀐 11건도 같은 방식으로 다시 판정했다(3건 수정, 2건은 두 채점안이 갈려 기존 판정 유지).` : agNote));
  }
  return out;
}

// ───────── Ⅲ. 간판 뗀 설문 결과 ─────────
function figPath(key) {
  if (!SV || !SV.figs) return null;
  const f = SV.figs.find((x) => x.includes(key));
  if (!f) return null;
  const full = path.isAbsolute(f) ? f : path.join(SV_DIR, f);
  return fs.existsSync(full) ? full : null;
}
function sec3Survey() {
  const out = [h1('Ⅲ. 간판 뗀 설문 결과', { pageBreak: true })];
  if (!SV) {
    out.push(tbl([W], [[{ t: miss('설문 결과 전체'), fill: PINK }]], { size: 17, padV: 80, padH: 120 }));
    return out;
  }
  const m = SV.meta;
  const kr = SV.kanban.regional; const km = SV.kanban.metro;
  out.push(lead(`부산대 재학생 ${m.n_valid}명(보여 준 조건 ${m.n_open}명, 가린 조건 ${m.n_closed}명)의 유효 응답이다. 같은 직무 카드 15장을 기업명·근무지역을 보여 주거나 가린 조건으로 나누어 지원 의향(1 전혀 없다 ~ 5 매우 있다)을 물었다.${m.preference_status === 'provisional' ? ' 가린 조건 응답이 계획서 최소 기준(40명)에 못 미쳐 기업별 학생 선호는 신뢰구간과 함께 탐색적으로 읽는다.' : ''}`));
  out.push(h3('간판 효과: 기업명·근무지역을 보여 주면 지원 의향이 얼마나 달라지나'));
  const kRows = [[headc('카드'), headc('보여 준 조건'), headc('가린 조건'), headc('차이 (95% CI)'), headc('효과 크기 g')],
    [{ t: '부울경 기업 10장', bold: true, fill: C.gray }, { t: `${fmt(kr.mean_open, 2)} (${kr.n_open}명)`, align: CENTER }, { t: `${fmt(kr.mean_closed, 2)} (${kr.n_closed}명)`, align: CENTER }, { t: `**${fmt(kr.diff, 2)}** (${fmt(kr.ci_welch[0], 2)}~${fmt(kr.ci_welch[1], 2)})`, align: CENTER }, { t: `${fmt(kr.g, 2)}`, align: CENTER }],
    [{ t: '수도권 대기업 5장', bold: true, fill: C.gray }, { t: `${fmt(km.mean_open, 2)} (${km.n_open}명)`, align: CENTER }, { t: `${fmt(km.mean_closed, 2)} (${km.n_closed}명)`, align: CENTER }, { t: `**${fmt(km.diff, 2)}** (${fmt(km.ci_welch[0], 2)}~${fmt(km.ci_welch[1], 2)})`, align: CENTER }, { t: `${fmt(km.g, 2)}`, align: CENTER }],
  ];
  out.push(tbl(cw([22, 19, 19, 24, 16]), kRows, { size: TABLE, padV: 34 }));
  const fk = figPath('kanban');
  if (fk) out.push(img(fk, 14, { alt: '간판 효과: 조건별 평균 지원 의향과 95% 신뢰구간' }));
  const sig = (x) => (x.ci_welch[0] > 0 || x.ci_welch[1] < 0);
  out.push(p(`응답자마다 카드 평균을 구해 두 조건을 비교했다(웰치 t검정, 부트스트랩 구간 ${fmt(kr.ci_boot[0], 2)}~${fmt(kr.ci_boot[1], 2)}). 부울경 기업 카드의 차이는 ${sig(kr) ? '0을 포함하지 않아 통계적으로 구분되는 차이다' : '0을 포함해 이번 표본으로는 차이가 있다고 말하기 어렵다'}. 이 표본으로 찾아낼 수 있는 최소 차이(유의수준 5%, 검정력 80%)는 약 ${fmt(SV.kanban.mde.raw, 2)}점(효과 크기 ${fmt(SV.kanban.mde.d, 2)})이다. 보여 줌 효과의 지역·수도권 차이(이중차분)는 ${fmt(SV.kanban.did.est, 2)}점(${fmt(SV.kanban.did.ci[0], 2)}~${fmt(SV.kanban.did.ci[1], 2)})이다.`, { size: BODY }));
  if (META.literature) {
    // 부울경 카드 간판 효과의 방향(95% CI)으로 문장을 고른다: 유의한 하락 = discount, 유의한 상승 = local, 0 포함 = none
    const L = META.literature;
    const pat = kr.ci_welch[1] < 0 ? 'discount' : kr.ci_welch[0] > 0 ? 'local' : 'none';
    const P = L.patterns[pat];
    const metroUp = km.ci_welch[0] > 0 ? P.metroUp : '';
    out.push(h3('선행연구·지역 통계와 함께 읽기'));
    out.push(p(`${L.base} ${P.s1}.${metroUp ? `${metroUp}.` : ''} ${L.stats} ${P.s2}. ${L.limits} (출처는 부록 7)`, { size: BODY }));
  }

  out.push(h3('기업별 학생 선호 (가린 조건)'));
  const fp = figPath('pref');
  if (fp) out.push(img(fp, 14.5, { alt: '기업별 학생 선호와 95% 신뢰구간' }));
  const cr = [[headc('기업'), headc('가린 조건 평균'), headc('학생 선호 (95% CI)'), headc('보여 준 조건 평균'), headc('차이'), headc('몰랐던 학생')]];
  [...SV.preference].sort((a, b) => b.pref - a.pref).forEach((x) => {
    const card = SV.cards.find((y) => y.company === x.company);
    const d1 = SV.d1 && SV.d1[x.company] !== undefined ? pct(1 - SV.d1[x.company]) : '–';
    cr.push([{ t: x.company, bold: true, fill: C.gray, align: CENTER }, { t: `${fmt(x.mean, 2)} (${x.n}명)`, align: CENTER }, { t: `**${fmt(x.pref)}** (${ci(x.ci)})`, align: CENTER },
      { t: card ? `${fmt(card.open.mean, 2)} (${card.open.n}명)` : '–', align: CENTER }, { t: card ? fmt(card.diff.est, 2) : '–', align: CENTER }, { t: d1, align: CENTER }]);
  });
  out.push(tbl(cw([18, 17, 21, 17, 11, 16]), cr, { size: TABLE - 1, padV: 26 }));
  out.push(note('학생 선호 = (가린 조건 평균 지원 의향 − 1) × 25. \'몰랐던 학생\'은 공개 화면에서 그 회사 이름을 알고 있었다고 고르지 않은 응답자 비율이다. 기업별 값은 응답 수가 적어 탐색적으로 읽는다.'));

  out.push(h3('무엇이 판단을 좌우했나, 무엇이 부족했나'));
  const a2 = SV.a2 || {};
  const top = (o, n = 3) => Object.entries(o || {}).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k2, v]) => `${k2} ${pct(v)}`).join(', ');
  out.push(dash(`카드에서 판단에 가장 큰 영향을 준 조건: 보여 준 조건 ${top(a2.open)}, 가린 조건 ${top(a2.closed)}.`));
  out.push(dash(`지원 전에 더 알고 싶은 정보(최대 3개): ${top(SV.c6, 4)}. 이 결과를 Ⅳ장 \'부울경 신입 공고 표준 카드\'의 항목 순서에 반영했다.`));
  if (SV.blinding) out.push(dash(`가림 점검: 가린 조건에서 카드의 실제 근무지역을 맞힌 비율 ${pct(SV.blinding.b1_correct_region_share)}, 회사 이름을 짐작해 적은 비율 ${pct(SV.blinding.b2_guess_rate)}, 카드를 검색했다고 답한 비율 ${pct(SV.blinding.searched_share)}. 검색했다고 답한 응답자를 뺀 결과는 부록 4에 있다.`));
  out.push(h3('해석할 때 주의할 점'));
  ['기업별 결과는 응답 수가 적어 탐색적으로 보고한다. 유의하지 않은 결과를 \'효과 없음\'으로 해석하지 않는다.', '기업명과 근무지역을 함께 가렸으므로 두 정보의 영향을 따로 나눠 주장하지 않는다.', '자발적으로 응답한 부산대 재학생 표본이라 재학생 전체 의견으로 일반화하지 않는다.'].forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

// ───────── Ⅳ. 개선안과 학생 사용 검증 ─────────
function srcLink(c, text) {
  const m = /\[(\d+)\]/.exec(text || '');
  if (!m) return '';
  const s = c.sources[Number(m[1]) - 1];
  return s && s[2] ? s[2] : '';
}
function sec4Improve() {
  const out = [h1(DESK ? 'Ⅳ. 개선 아이디어와 취업 전략' : 'Ⅳ. 개선안과 학생 사용 검증', { pageBreak: true })];
  const S = META.standardCard;
  out.push(h2(`1  공통 제안: ${S.title}`, { before: 0 }));
  out.push(p(`**문제** ${S.problem}`, { size: BODY }));
  out.push(tbl(cw([30, 70]), [[headc('카드 항목'), headc('적는 내용')], ...S.fields.map((f, i) => [{ t: `${i + 1}`, align: CENTER, fill: C.gray }, f])], { size: TABLE, padV: 26 }));
  if (S.fieldsNote) out.push(note(S.fieldsNote));
  if (S.baseline) {
    const B = S.baseline;
    out.push(h3('지금 공고가 채운 칸(기준선, 대표 공고 10건)'));
    out.push(tbl(cw([16, ...B.head.map(() => 10.5), 10.5]), [[headc('기업'), ...B.head.map((x) => headc(x)), headc('점수(/7)')],
      ...B.rows.map((r) => [{ t: r[0], bold: true, fill: C.gray, align: CENTER }, ...r.slice(1, 8).map((x) => ({ t: x, align: CENTER })), { t: r[8], align: CENTER, bold: true }])], { size: 15, padV: 18, padH: 40 }));
    out.push(note(B.note));
  }
  out.push(p(`**실행 주체** ${S.owner}  **확인 지표** ${DESK ? MD.cardMetric : S.metric}`, { size: 18 }));

  out.push(h2('2  전공별 직무 카드 (TOP3와 경계 기업)'));
  const cand = [...R.top3, ...R.eligible.filter((k) => !R.top3.includes(k)).slice(0, 1)];
  cand.forEach((k) => {
    const c = COMP[k];
    if (!c) return;
    const j = c.jobs[0];
    const prep = (c.plan8.rows.find((r) => /과제/.test(r[0])) || [])[1] || '–';
    const link = srcLink(c, `${j.when} ${j.req}`);
    out.push(h3(`${k} · ${j.name}`));
    out.push(tbl(cw([18, 82]), [
      [lab('실제 업무'), j.work], [lab('필수·우대 요건'), j.req], [lab('근무지'), j.place], [lab('고용형태'), j.type],
      [lab('확인된 처우'), j.pay], [lab('준비 과제'), prep], [lab('공고·기준일'), `${j.when}${link ? `  ${link}` : ''}`],
    ], { size: TABLE - 1, padV: 24 }));
  });

  if (!DESK) {
  out.push(h2('3  학생 사용 과제 결과'));
  const U = FUP.usage;
  if (U && U.status !== 'final' && !DRAFT) throw new Error(`사용 과제 결과가 본실시 결과(status "final")가 아니다(status=${U.status}). 미리보기(--draft)로만 쓸 수 있다.`);
  if (U && U.text) {
    out.push(p(U.text, { size: BODY }));
    if (U.rows) out.push(tbl(cw([28, 24, 24, 24]), [[headc('구분'), headc('직무 카드'), headc('기존 채용정보'), headc('차이')], ...U.rows], { size: TABLE, padV: 26 }));
  } else {
    out.push(tbl([W], [[{ t: miss('학생 10명 사용 과제 결과'), fill: PINK }]], { size: 17, padV: 60, padH: 120 }));
  }
  }

  out.push(h2(`${DESK ? 3 : 4}  직무군별 8주 준비 안내 (통합본)`));
  (META.plan8Common || []).forEach((g) => {
    out.push(h3(`${g.family}  ·  ${g.companies}`));
    out.push(tbl(cw([16, 84]), g.rows.map(([a, b]) => [lab(a), b]), { size: TABLE - 1, padV: 24 }));
  });
  if (!META.plan8Common) out.push(p(miss('8주 안내 통합본'), { size: 18 }));

  // 5 지역정주형 취업전략: 10곳의 근무지·거리·통근·주거를 한 표로 모은다(기업 원고의 settle에서)
  const withSettle = ORDER.filter((k) => COMP[k] && COMP[k].settle && COMP[k].settle.length);
  if (withSettle.length) {
    out.push(h2(`${DESK ? 4 : 5}  지역정주형 취업전략`));
    if (META.settleLead) out.push(p(META.settleLead, { size: BODY }));
    const cell = (k, label) => { const r = COMP[k].settle.find((x) => x[0] === label); return r ? r[1].replace(/\s*\[\d+\](\[\d+\])*/g, '') : '–'; };
    const rows = [[headc('기업'), headc('부산대에서(자동차)'), headc('통근'), headc('주거')]];
    withSettle.forEach((k) => rows.push([{ t: k, bold: true, fill: C.gray, align: CENTER }, { t: cell(k, '거리'), size: 15 }, { t: cell(k, '통근'), size: 15 }, { t: cell(k, '주거'), size: 15 }]));
    out.push(tbl(cw([13, 21, 33, 33]), rows, { size: 15, padV: 22, padH: 50 }));
    out.push(note('출처와 확인 수준은 기업별 장의 \'지역 정주 조건\' 표에 있다. 거리·시간은 경로 계산 서비스(OSRM, 교통 상황 미반영)로 구한 대략값이다.'));
    ((DESK && MD.settleStrategy) || META.settleStrategy || []).forEach((t) => out.push(bullet(t, { size: 18 })));
  }
  return out;
}

// ───────── TOP3 ─────────
function top3() {
  const title = (R.mode === 'final' || DESK) ? '우리 팀이 선정한 「지역기업 TOP 3」' : '「지역기업 TOP 3」 (설문 반영 전)';
  const out = [h1(title, { pageBreak: true })];
  const rows = [[headc('순위'), headc('기업'), headc('점수'), headc('선정 이유')]];
  R.top3.forEach((k, i) => {
    const f = final(k);
    const pf = pref(k);
    const reason = META.top3Reasons[k] || miss(`${k} 선정 이유`);
    const surveyLine = pf ? ` 기업명·근무지역을 가린 카드의 평균 지원 의향은 ${fmt(pf.mean, 2)}점(학생 선호 ${fmt(pf.pref)}점, ${pf.n}명)이다.` : '';
    rows.push([
      { t: `${i + 1}위`, align: CENTER, bold: true, fill: C.yellow },
      { t: [`**${k}**`, INFO[k] ? INFO[k].place : ''], align: CENTER },
      { t: DESK ? [`**${fmt(f.scaled)}점**`, `(${fmt(f.low)}~${fmt(f.high)})`] : [finalScore(k) !== null ? `종합 **${fmt(finalScore(k))}**` : '', `기업 ${fmt(f.scaled)}`, pf ? `선호 ${fmt(pf.pref)}` : ''].filter(Boolean), align: CENTER },
      { t: reason + surveyLine },
    ]);
  });
  out.push(tbl(cw([9, 15, 14, 62]), rows, { size: TABLE + 1, padV: 50 }));
  if (SV && SV.ranking) {
    const tr = SV.ranking.tie_rule;
    const nxt = R.eligible.filter((k) => !R.top3.includes(k)).slice(0, 3).map((k) => `${k} ${fmt(finalScore(k))}점`).join(', ');
    out.push(note(`4~6위: ${nxt}. ${tr && tr.applied ? `3위 경계 규칙을 적용했다: ${tr.detail}` : '3위 경계 규칙은 적용되지 않았다.'}`));
    const p3 = SV.ranking.p_top3 || {};
    out.push(p(`설문 응답을 다시 뽑아 계산한 TOP3 포함 확률: ${R.top3.map((k) => `${k} ${pct(p3[k] || 0)}`).join(', ')}. 기업 평가 비중을 60%·80%로 바꾼 결과와 보상 미확인을 3점으로 둔 결과는 부록 4에 있다.`, { size: 18 }));
  }
  if (DESK) {
    const nxt = R.eligible.filter((k) => !R.top3.includes(k)).slice(0, 3).map((k) => `${k} ${fmt(final(k).scaled)}점`).join(', ');
    out.push(note(`4~6위: ${nxt}. 점수 옆 괄호는 미확인 항목을 0점·만점으로 둘 때의 범위다.`));
  }
  out.push(h3('선정 방법'));
  (DESK ? MD.selectionRule : META.selectionRule).forEach((t) => out.push(bullet(DESK ? deskText(t) : t, { size: 18 })));

  out.push(...signature());
  return out;
}

// ───────── 부록 ─────────
function rubricBlock() {
  const out = [h1('부록 1  평가 기준표 (세부 항목 18개)', { pageBreak: true })];
  out.push(p('각 세부 항목은 아래 1·3·5점 기준으로 0~5점을 판정한다. 2·4점은 양쪽 기준의 중간일 때 준다. 점수 = 배점 × 판정 ÷ 5. 자료를 찾지 못한 것은 감점 사유가 아니어서 0점이 아니라 \'미확인\'으로 남긴다. 일부만 확인되면 확인된 사실만으로 판정한다.', { size: 18 }));
  const rows = [[headc('영역'), headc('세부 항목 (배점)'), headc('1점'), headc('3점'), headc('5점')]];
  const spans = {};
  let lastArea = '';
  ANCHORS.forEach((r) => { if (r[0]) { lastArea = r[0]; spans[lastArea] = 0; } spans[lastArea] += 1; });
  ANCHORS.forEach((r) => {
    const row = [];
    if (r[0]) row.push({ t: r[0], rowSpan: spans[r[0]], fill: C.label, bold: true, align: CENTER });
    const fix = META.rubricFix[r[1]];
    row.push({ t: r[1], fill: C.gray, bold: true }, fix ? { t: `${fix}†` } : r[2], r[3], r[4]);
    rows.push(row);
  });
  out.push(tbl(cw([12, 19, 23, 23, 23]), rows, { size: 15, padV: 28, padH: 60 }));
  out.push(note(DESK ? '†는 2026. 11. 3.에 자료 부재가 1점으로 읽히지 않도록 확인 사실 조건으로 고친 문장이다.' : '†는 2026. 11. 3.에 자료 부재가 1점으로 읽히지 않도록 확인 사실 조건으로 고친 문장이다(설문 결과를 보기 전).'));
  return out;
}
function judgmentBlock() {
  const out = [h1('부록 2  기업별 세부 항목 판정', { pageBreak: true })];
  const anyB = ORDER.some((k) => hasB(k));
  out.push(p(`칸의 값은 세부 항목의 최종 판정(0~5점)이다. ${anyB ? '두 채점안 판정의 평균이고, 원문 재대조나 규칙 통일, 새 사실 재판정을 거친 항목(†)은 그 결과 값이다.' : '현재 1차 평가 값이다.'} '–'는 미확인이다.`, { size: 18 }));
  const ks = ORDER.filter((k) => final(k));
  const head = [headc('영역'), headc('세부 항목 (배점)'), ...ks.map((k) => headc(k, { size: 13 }))];
  const mrows = [head];
  const areas = final(ks[0]).areas;
  areas.forEach((a, ai) => {
    a.items.forEach((it, ii) => {
      const row = [];
      if (ii === 0) row.push({ t: `${a.name} (${a.w})`, rowSpan: a.items.length, fill: C.label, bold: true, align: CENTER, size: 14 });
      row.push({ t: `${it.name} (${it.w})`, fill: C.gray, size: 14 });
      ks.forEach((k) => {
        const x = final(k).areas[ai].items[ii];
        const adj = (SC[k].adjusted || []).includes(x.name);
        row.push({ t: fmtJ(x.j) + (adj ? '†' : ''), align: CENTER, fill: x.j === null ? 'F2F2F2' : undefined });
      });
      mrows.push(row);
    });
  });
  mrows.push([{ t: '환산점수', span: 2, fill: C.label, bold: true, align: CENTER }, ...ks.map((k) => ({ t: fmt(final(k).scaled), align: CENTER, bold: true, fill: C.yellow }))]);
  mrows.push([{ t: '정보 충족률', span: 2, fill: C.label, bold: true, align: CENTER }, ...ks.map((k) => ({ t: pct(final(k).fill), align: CENTER }))]);
  out.push(tbl(cw([10, 22, ...ks.map(() => 68 / ks.length)]), mrows, { size: 15, padV: 24, padH: 30 }));
  if (anyB) out.push(note(DESK ? '†는 원문을 다시 대조했거나(채점조정), 자료 부재 규칙을 통일했거나(2026. 11. 3. 재채점), 11. 3. 재조사와 11. 10. 교차검증에서 나온 새 사실로 다시 판정한 항목이다(판정이 그대로인 항목 포함). 근거는 연구 노트의 채점조정·재채점 파일에 있다.' : '†는 원문을 다시 대조했거나(채점조정), 자료 부재 규칙을 통일했거나(2026. 11. 3. 재채점), 11. 3. 재조사의 새 사실을 두 번 따로 다시 판정해(같은 날) 고친 항목이다. 근거는 연구 노트의 채점조정·재채점 파일에 있고, 모두 설문 결과를 보기 전에 정했다.'));
  return out;
}
function appendix() {
  const out = [...rubricBlock(), ...judgmentBlock()];
  out.push(h1('부록 3  공개 원칙과 이용 시 주의', { before: 360 }));
  (DESK ? MD.disclaimer : META.disclaimer).forEach((t) => out.push(bullet(t, { size: 18 })));

  // 부록 4 민감도
  out.push(h1('부록 4  순위 민감도', { pageBreak: true }));
  if (SV && SV.ranking) {
    const W6 = SV.ranking.by_w['0.6']; const W7 = SV.ranking.by_w['0.7']; const W8 = SV.ranking.by_w['0.8'];
    const get = (arr, k) => arr.find((x) => x.company === k);
    const rr = [[headc('기업'), headc('기업 평가'), headc('학생 선호'), headc('60% 순위'), headc('70% 순위(본)'), headc('80% 순위')]];
    R.byFinal.forEach((k) => {
      rr.push([{ t: k, bold: true, fill: R.top3.includes(k) ? C.yellow : C.gray, align: CENTER }, { t: fmt(final(k).scaled), align: CENTER }, { t: fmt(get(W7, k).pref), align: CENTER },
        { t: String(get(W6, k).rank), align: CENTER }, { t: String(get(W7, k).rank), align: CENTER, bold: true }, { t: String(get(W8, k).rank), align: CENTER }]);
    });
    out.push(tbl(cw([22, 15, 15, 16, 16, 16]), rr, { size: TABLE, padV: 26 }));
    const ew = SV.ranking.eff_weight || {};
    out.push(note(`실효 비중: 기업 평가 비중을 70%로 두었을 때 학생 선호가 종합 점수의 순위 차이에 실제로 미치는 비중은 약 ${pct(ew['0.7'] || 0)}다(두 점수의 기업 간 표준편차로 계산).`));
  } else {
    out.push(p(miss('민감도(설문 후)'), { size: 18 }));
  }
  if (FUP.payRule) out.push(p(FUP.payRule, { size: 18 }));

  // 부록 5 설문 운영
  out.push(h1('부록 5  설문 운영 기록', { before: 300 }));
  if (SV) {
    const fl = SV.meta.flow || [];
    out.push(tbl(cw([70, 30]), [[headc('단계'), headc('응답 수')], ...fl.map((x) => [x.step, { t: String(x.n), align: CENTER }])], { size: TABLE, padV: 24 }));
    const cellsN = SV.meta.cells || {};
    const strata = ['H', 'E', 'O']; const sname = { H: '인문·사회·상경·교육', E: '공학', O: '자연·예체능·기타' };
    const cr = [[headc('계열'), headc('묶음 1 공개A'), headc('묶음 2 공개B'), headc('묶음 3 가림A'), headc('묶음 4 가림B')], ...strata.map((s) => [{ t: sname[s], bold: true, fill: C.gray }, ...[1, 2, 3, 4].map((r) => ({ t: String(cellsN[`${r}-${s}`] || 0), align: CENTER }))])];
    out.push(tbl(cw([28, 18, 18, 18, 18]), cr, { size: TABLE, padV: 24 }));
    out.push(note(`조사 기간 ${SV.meta.field_period || '–'}. 구글 폼(부산대 계정 로그인, 1인 1회, 이메일 미수집). 배정은 계열을 먼저 묻고 생일(일)로 정한 준무작위 배정이며, 묶음은 실제로 답한 카드로 판정했다. 설계 해시 ${SV.meta.spec_hash}. 문항 전문과 배정표는 별도 문서 「간판떼고 설문조사지」에 있다.`));
  } else {
    out.push(p(miss('설문 운영 기록'), { size: 18 }));
  }

  // 부록 6 계획서 대비 변경
  out.push(h1('부록 6  연구계획서 대비 변경', { pageBreak: true }));
  out.push(tbl(cw([14, 20, 26, 22, 18]), [[headc('항목'), headc('계획'), headc('실제'), headc('이유'), headc('영향')], ...META.changes.map((r) => r.map((x, i) => (i === 0 ? { t: x, bold: true, fill: C.gray } : fillText(x))))], { size: 15, padV: 24, padH: 50 }));

  // 부록 7 선행연구·통계 출처(Ⅲ장 해석 단락)
  if (META.literature && META.literature.refs) {
    out.push(h1('부록 7  선행연구·통계 출처 (Ⅲ장 해석)', { before: 300 }));
    META.literature.refs.forEach((r) => out.push(p(r, { size: 16, after: 40, indent: { left: 300, hanging: 300 } })));
    out.push(note('7% 임금 양보는 원 논문(Cable & Turban, 2003)의 표를 직접 보지 못해 Lievens & Slaughter(2016)의 요약을 재인용했다. 동남지방통계청은 2025년 동남지방데이터청으로 이름이 바뀌어 자료별 표기를 따랐다.'));
  }
  return out;
}

// ───────── 제출본(공개자료 단독) 부록 4~6 ─────────
// 순위 민감도: 미확인 항목 처리와 영역 배점을 바꿔 환산점수와 순위를 다시 계산한다(scores.json의 최종 판정만 사용)
function scenarioScores(opt) {
  // opt.fill: null(환산) | 숫자(미확인 항목 판정을 이 값으로 채움), opt.w: 영역 배점 바꿈({영역명: 배점})
  const res = {};
  ORDER.forEach((k) => {
    let got = 0; let conf = 0;
    (opt.src ? SC[k][opt.src] : final(k)).areas.forEach((a) => {
      const mul = opt.w ? opt.w[a.name] / a.w : 1;
      a.items.forEach((it) => {
        const ov = opt.override && opt.override[k] && Object.prototype.hasOwnProperty.call(opt.override[k], it.name) ? opt.override[k][it.name] : undefined;
        const base = ov === undefined ? it.j : ov;
        const j = base === null ? (opt.fill === null || opt.fill === undefined ? null : opt.fill) : base;
        if (j === null) return;
        got += it.w * mul * (j / 5);
        conf += it.w * mul;
      });
    });
    res[k] = (got / conf) * 100;
  });
  const order = [...ORDER].sort((a, b) => res[b] - res[a]);
  const rank = Object.fromEntries(order.map((k, i) => [k, i + 1]));
  return { res, rank, top3: order.slice(0, 3) };
}
// ───────── 제출본(공개자료 단독) 전용 장 ─────────
// 받침이 있으면 '이다', 없으면 '다'(한글 끝 글자 기준, 영문 약어는 '다')
const hasJong = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
const eun = (w) => `${w}${hasJong(w) ? '은' : '는'}`;
const ida = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0 ? '이다' : '다'; };
const itemOf = (k, area, name) => final(k).areas.find((x) => x.name === area).items.find((x) => x.name === name);
const lowOrder = () => [...R.eligible].sort((a, b) => final(b).low - final(a).low || final(b).scaled - final(a).scaled);
const sameSet = (a, b) => [...a].sort().join() === [...b].sort().join();
function writeDeskFigs() {
  const range = R.byFinal.map((k, i) => ({ name: k, rank: i + 1, scaled: final(k).scaled, low: final(k).low, high: final(k).high, top: R.top3.includes(k), rep: META.rep[k] }));
  const commute = MD.settleTable.map(([k, place, bus, dorm]) => ({ name: k, place, ...commuteOf(k), bus, dorm }));
  fs.mkdirSync(path.join(__dirname, 'figs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'figs', '_desk_fig_data.json'), JSON.stringify({ range, commute }, null, 1));
  require('child_process').execFileSync('python3', [path.join(__dirname, 'make_desk_figs.py')], { stdio: 'inherit' });
}
const FIG = (name) => path.join(__dirname, 'figs', name);
// 기업 원고의 '거리' 행(두 경로 계산기의 범위)에서 km·분을 읽는다
function commuteOf(k) {
  const row = COMP[k].settle.find((x) => x[0] === '거리');
  const m = /약 (\d+)~(\d+)km·약 (\d+)~(\d+)분/.exec(row ? row[1] : '');
  if (!m) throw new Error(`${k}: 거리 문장에서 km·분 범위를 읽지 못했다`);
  return { km1: Number(m[1]), km2: Number(m[2]), min1: Number(m[3]), min2: Number(m[4]) };
}
function commuteLead() {
  const rng = (ks) => { const a = ks.map(commuteOf); return `약 ${Math.min(...a.map((x) => x.min1))}~${Math.max(...a.map((x) => x.min2))}분`; };
  return MD.settleLead.replace('{near}', rng(['TKG태광', '넥센타이어'])).replace('{gangseo}', rng(['파나시아', '태광후지킨', '조광요턴', '동화엔텍']))
    .replace('{mid}', rng(['해성디에스', '지엠비코리아', '송원산업'])).replace('{far}', rng(['BHI']));
}
const XV = DESK ? loadJSON(path.join(__dirname, 'xv_summary.json')) : null;
function xvSentence() {
  if (!XV) return miss('교차검증 요약(xv_summary.json)');
  const T = XV.total;
  let s = `${XV.date}에 보고서의 객관적 사실 ${T.n}개를 출처를 다시 열어 대조했다. 서로 다른 출처 두 곳 이상에서 확인한 것이 ${T.two}개, 한 곳에서 확인한 것이 ${T.one}개였고, 틀렸거나 기준일이 지난 ${T.mismatch + T.stale}개는 고쳤다`;
  if (T.second) s += `. 한 곳에서만 확인한 사실은 두 번째 출처를 다시 찾아 ${T.second.confirmed}개를 더 확인했다`;
  return `${s}(${CH.apxXv}).`;
}

function coverDesk() {
  const out = [];
  const t3 = R.top3;
  const sc = (k) => fmt(final(k).scaled);
  const fourth = R.eligible.filter((k) => !t3.includes(k))[0];
  const gap34 = fmt(final(t3[2]).scaled - final(fourth).scaled);
  const gap12 = fmt(final(t3[0]).scaled - final(t3[1]).scaled);
  const low3 = lowOrder().slice(0, 3);
  const lowSentence = sameSet(low3, t3)
    ? (low3.join() === t3.join() ? '확인하지 못한 항목을 0점으로 쳐도 세 곳과 순서는 같다.' : `확인하지 못한 항목을 0점으로 치면 세 곳은 같고 순서가 ${low3.join('·')}로 바뀐다.`)
    : `확인하지 못한 항목을 0점으로 치면 3위 안의 기업이 ${low3.join('·')}로 바뀐다.`;
  out.push(p(`**질문** ${MD.question}`, { size: BODY + 1, after: 70 }));
  out.push(lead(deskText(MD.summaryLead).replace('{top3}다', `${t3.map((k, i) => `${i + 1}위 ${k}`).join(', ')}${ida(t3[2])}`)));
  const rows = [[headc('순위'), headc(['기업', '대표 학사 신입 직무']), headc(['점수', '(범위)']), headc('선정 이유(요약)'), headc('지원 전에 확인할 것')]];
  t3.forEach((k, i) => {
    const f = final(k); const c = COMP[k];
    rows.push([
      { t: `${i + 1}위`, align: CENTER, bold: true, fill: C.yellow },
      { t: [`**${k}** (${INFO[k].place})`, c.jobs.slice(0, 2).map((j) => shortJob(j.name)).join(', ')], size: 15 },
      { t: [`**${sc(k)}**`, `(${fmt(f.low)}~${fmt(f.high)})`], align: CENTER },
      { t: MD.top3Short[k] || miss(`${k} 선정 이유 요약`), size: 16 },
      { t: MD.top3Check[k] || miss(`${k} 지원 전 확인`), size: 16 },
    ]);
  });
  out.push(tbl(cw([7, 21, 10, 33, 29]), rows, { size: 16, padV: 44, padH: 60 }));
  out.push(note(MD.top3Note));
  out.push(h3('핵심 결과'));
  MD.keyFindings.forEach((t) => out.push(bullet(deskText(t).replace('{gap12}', gap12).replace('{gap34}', gap34).replace('{fourth}', `${fourth}(${sc(fourth)}점)`).replace('{lowSentence}', lowSentence), { size: 18 })));
  out.push(h3('연구계획서와 달라진 점'));
  out.push(tbl([W], [[{ t: deskText(MD.planBox).replace(/^\*\*연구계획서와 달라진 점\*\* /, ''), fill: C.gray }]], { size: 17, padV: 70, padH: 130 }));

  out.push(h3('10곳의 점수와 범위', { pageBreak: true, before: 0 }));
  out.push(img(FIG('desk_range.png'), 15.4, { alt: '10곳의 기업 평가 환산점수와 범위', keepNext: true, before: 40, after: 20 }));
  out.push(note(MD.figRangeCaption, { before: 0 }));
  out.push(h3('이 보고서를 읽는 법'));
  out.push(tbl(cw([17, 83]), MD.glossary.map(([a, b]) => [{ t: a, bold: true, fill: C.gray, align: CENTER }, b]), { size: 16, padV: 24, padH: 60 }));
  out.push(h3('연구 방법'));
  MD.method.forEach((t) => out.push(bullet(deskText(t).replace('{deskAsOf}', META.deskAsOf).replace('{xvSentence}', xvSentence()), { size: 18 })));
  out.push(h3('심사기준과 보고서 위치'));
  out.push(tbl(cw([22, 78]), [[headc('심사기준(2026. 11. 3. 안내)'), headc('이 보고서에서 다룬 곳')], ...MD.criteriaMap.map(([a, b]) => [{ t: a, bold: true, fill: C.gray }, b])], { size: 16, padV: 22, padH: 60 }));
  return out;
}

// Ⅱ. 종합 비교표: 영역 칸을 득점률로 색칠한다(한 색, 옅음→짙음)
const HEAT = [[0.8, 'A9C4EB'], [0.65, 'CFDFF5'], [0.5, 'EAF1FB']];
function heatFill(got, conf) {
  if (!conf) return undefined;
  const r = got / conf;
  const hit = HEAT.find(([th]) => r >= th);
  return hit ? hit[1] : undefined;
}
function sec2Desk() {
  const out = [h1('Ⅱ. 기업 10개 종합 비교표', { pageBreak: true })];
  out.push(lead(MD.compareLead));
  const head = [headc('기업'), ...COLS.map(([c, a]) => headc([c, `(${AREA_W[a]})`])), headc(['기타', '(ESG·지역 10)']), headc('평판'), headc(['적합성', '(참고, 11)']), headc(['총점', '(범위)'])];
  const rows = [head];
  R.byFinal.forEach((k, i) => {
    const f = final(k);
    const top = R.top3.includes(k);
    const e = f.areas.find((x) => x.name === 'ESG·지역');
    const ac = (name) => { const a = f.areas.find((x) => x.name === name); return { t: `${fmt(a.got)}/${a.conf}${a.conf < a.w ? '*' : ''}`, align: CENTER, fill: heatFill(a.got, a.conf) }; };
    rows.push([
      { t: [`**${i + 1}. ${k}**${top ? ' ★' : ''}`, `(${NUM[ORDER.indexOf(k)]})`], fill: top ? C.yellow : C.gray, align: CENTER },
      ...COLS.map(([, a]) => ac(a)),
      { t: `${fmt(e.got)}/${e.conf}${e.conf < e.w ? '*' : ''}`, align: CENTER, fill: heatFill(e.got, e.conf) },
      { t: META.rep[k], align: CENTER },
      fitCell(f),
      { t: [`**${fmt(f.scaled)}**`, `(${fmt(f.low)}~${fmt(f.high)})`], align: CENTER, fill: top ? C.yellow : undefined },
    ]);
  });
  out.push(tbl(cw([1600, 880, 880, 880, 880, 880, 1000, 800, 1000, 1200]), rows, { size: 16, padV: 32, padH: 50 }));
  MD.compareNotes.forEach((t) => out.push(note(t)));
  return out;
}

// Ⅲ. TOP 3 (양식: 비교표 바로 뒤)
function top3Desk() {
  const out = [h1('Ⅲ. 우리 팀이 선정한 「지역기업 TOP 3」', { pageBreak: true })];
  const t3 = R.top3;
  out.push(lead(MD.top3Lead));
  const rows = [[headc('순위'), headc('기업'), headc(['점수', '(범위)']), headc('선정 이유')]];
  t3.forEach((k, i) => {
    const f = final(k);
    rows.push([
      { t: `${i + 1}위`, align: CENTER, bold: true, fill: C.yellow },
      { t: [`**${k}**`, INFO[k] ? INFO[k].place : '', `평판 ${META.rep[k]}`], align: CENTER },
      { t: [`**${fmt(f.scaled)}점**`, `(${fmt(f.low)}~${fmt(f.high)})`], align: CENTER },
      { t: META.top3Reasons[k] || miss(`${k} 선정 이유`) },
    ]);
  });
  out.push(tbl(cw([9, 15, 14, 62]), rows, { size: TABLE + 1, padV: 50 }));
  const nxt = R.eligible.filter((k) => !t3.includes(k)).slice(0, 3).map((k) => `${k} ${fmt(final(k).scaled)}점`).join(', ');
  out.push(note(`4~6위: ${nxt}. 점수 옆 괄호는 미확인 항목을 0점·만점으로 둘 때의 범위다.`));

  out.push(h3('선정 방법'));
  const allFit = t3.every((k) => META.rep[k] === '적합');
  const repSentence = allFit ? '이번 TOP 3 세 곳은 모두 평판 점검 \'적합\'이다.' : `이번 TOP 3 가운데 ${eun(t3.filter((k) => META.rep[k] !== '적합').join('·'))} \'주의\'이며, 사실과 회사 입장은 기업별 분석의 평판 점검에 적었다.`;
  MD.selectionRule.forEach((t) => out.push(bullet(deskText(t).replace('{repSentence}', repSentence), { size: 18 })));

  out.push(h3(MD.robustTitle));
  const fourth = R.eligible.filter((k) => !t3.includes(k))[0];
  const g = (a, b) => fmt(final(a).scaled - final(b).scaled);
  out.push(bullet(`**접전** 1위 ${t3[0]}와 2위 ${t3[1]}의 차이는 ${g(t3[0], t3[1])}점, 3위 ${t3[2]}와 4위 ${fourth}의 차이는 ${g(t3[2], fourth)}점이다. 10점짜리 항목의 판정이 반 단계(0.5)만 달라져도 1점이 움직이므로, 이 차이는 순위를 확정할 만큼 크지 않다.`, { size: 18 }));
  const low = lowOrder();
  const low3 = low.slice(0, 3);
  const noPay = t3.filter((k) => itemOf(k, '보상·근무', '보상').j === null);
  if (low3.join() !== t3.join()) {
    out.push(bullet(`**경합** 미확인 항목을 0점으로 두는 하한 순위는 ${low3.map((k) => `${k}(${fmt(final(k).low)})`).join(', ')} 순이다. 환산점수 순위와 달라, 연구계획서 규칙에 따라 ${sameSet(low3, t3) ? '순서가' : '2·3위 자리가'} 경합임을 밝힌다.${noPay.length ? ` ${eun(noPay.join('·'))} 신입 보상(10점)을 확인하지 못해 하한이 낮다. 이 조건이 확인되면 순위가 달라질 수 있다.` : ''}`, { size: 18 }));
  }
  const rk = (src) => { const o = [...ORDER].sort((a, b) => SC[b][src].scaled - SC[a][src].scaled); return o; };
  if (hasB(t3[0])) {
    const oa = rk('A'); const ob = rk('B');
    const ra = oa.indexOf(t3[0]) + 1; const rb = ob.indexOf(t3[0]) + 1;
    const adj = SC[t3[0]].adjusted || [];
    out.push(bullet(`**채점안에 따른 차이** 두 채점안을 따로 계산하면 1~3위는 1차 채점안 ${oa.slice(0, 3).join('·')}, 2차 채점안 ${ob.slice(0, 3).join('·')}다. 최종 판정은 두 채점안의 평균에 원문 재대조와 새 사실 재판정을 반영한 값이다.${ra !== 1 || rb !== 1 ? ` ${eun(t3[0])} 두 채점안에서 각각 ${ra}위·${rb}위였고, 재대조·재판정으로 고친 항목(${adj.join(', ')})을 반영해 1위가 됐다.` : ''}`, { size: 18 }));
  }
  const pf = payFloorScenario();
  if (pf.length && pf[0][1].override) {
    const alt = scenarioScores(pf[0][1]);
    const ks = Object.keys(pf[0][1].override);
    const scored = ks.every((k) => itemOf(k, '보상·근무', '보상').j !== null);
    out.push(bullet(`**갈린 판정 하나** 부산시 청끌기업 목록은 ${ks.join('·')}을 '급여' 부문에 올리고 선정 근거로 '신입사원 평균초임 월 300만원 이상'을 적는다. 회사가 밝힌 금액이 아니고 같은 부문 20개 기업에 공통인 기준이어서, 이 사실을 보상 판정에 쓸지를 두고 두 채점안이 갈렸다(하나는 미확인 유지, 하나는 3점). ${scored ? '이 보고서는 3점으로 판정했다. 미확인으로 두면' : '합의되지 않아 이 보고서는 보상을 미확인으로 두었다. 3점으로 넣으면'} ${ks.map((k) => `${k} ${fmt(alt.res[k])}점`).join(', ')}이 되어 TOP 3가 ${alt.top3.join('·')}${sameSet(alt.top3, t3) ? '로 같다' : '로 바뀐다'}(${CH.apxSens}).`, { size: 18 }));
  }
  out.push(bullet(`**가정을 바꾸면** 미확인 처리와 영역 배점을 바꾼 결과는 ${CH.apxSens}에 있다. ${MD.robustTail}`, { size: 18 }));
  return out;
}

// Ⅳ. 지역기업 가치 재발견과 개선 아이디어
function pickIdeas(c) {
  const I = c.ideas;
  const isTask = (x) => /과제|캡스톤|현장실습|설명회|교과/.test(x.title);
  const generic = (x) => /보상|근무 ?조건|조건표|조건 4줄/.test(x.title);
  let full = I.filter(isTask);
  if (!full.length) full = [I.find((x) => !generic(x)) || I[0]];
  return { full, rest: I.filter((x) => !full.includes(x)) };
}
const ideaTitle = (x) => x.title.replace(/^제안:\s*/, '').replace(/\s*\(제안\)\s*$/, '').trim();
const noCite = (s) => (s || '').replace(/\s*\[\d+\](\[\d+\])*/g, '');
function sec4Desk() {
  const T = MD.rationale;
  const out = [h1(T.title, { pageBreak: true })];
  out.push(lead(T.lead));
  out.push(h2(T.h, { before: 0 }));
  T.blocks.forEach((b) => {
    out.push(h3(b.h));
    (b.p || []).forEach((t) => out.push(p(t.replace(/\{apxRefs\}/g, CH.apxRefs), { size: BODY })));
    (b.bullets || []).forEach((t) => out.push(bullet(t, { size: 18 })));
  });
  const S = META.standardCard;
  out.push(h2(`2  공통 제안: ${S.title}`));
  out.push(p(`**문제** ${S.problem}`, { size: BODY }));
  out.push(tbl(cw([8, 92]), [[headc('칸'), headc('공고에 적을 내용')], ...S.fields.map((f, i) => [{ t: `${i + 1}`, align: CENTER, fill: C.gray }, f])], { size: TABLE, padV: 22 }));
  if (S.fieldsNote) out.push(note(S.fieldsNote));
  const B = S.baseline;
  out.push(h3('지금 공고가 채운 칸(기준선, 대표 공고 10건)'));
  out.push(tbl(cw([16, ...B.head.map(() => 10.5), 10.5]), [[headc('기업'), ...B.head.map((x) => headc(x)), headc('점수(/7)')],
    ...B.rows.map((r) => [{ t: r[0], bold: true, fill: C.gray, align: CENTER }, ...r.slice(1, 8).map((x) => ({ t: x, align: CENTER, fill: x === '●' ? 'CFDFF5' : (x === '◐' ? 'EAF1FB' : undefined) })), { t: r[8], align: CENTER, bold: true }])], { size: 15, padV: 18, padH: 40, keepNext: true }));
  out.push(note(B.note));
  out.push(p(`**실행 주체** ${S.owner}  **확인 지표** ${MD.cardMetric}`, { size: 18 }));

  out.push(h2('3  기업별 개선 아이디어 한눈에'));
  out.push(p(MD.ideasLead, { size: 18 }));
  const rows = [[headc('기업'), headc('제안'), headc('풀려는 문제'), headc('확인 지표')]];
  ORDER.forEach((k) => {
    const x = pickIdeas(COMP[k]).full[0];
    rows.push([{ t: k, bold: true, fill: C.gray, align: CENTER }, { t: ideaTitle(x) }, { t: noCite(x.problem), size: 15 }, { t: noCite(x.metric), size: 15 }]);
  });
  out.push(tbl(cw([13, 27, 37, 23]), rows, { size: 16, padV: 24, padH: 50 }));
  out.push(note('제안마다 대상·필요한 정보·실행 주체·예시는 기업별 분석의 「개선 아이디어」 표에 있다.'));
  return out;
}

// Ⅴ. 지역정주형 취업전략
function sec5Desk() {
  const out = [h1('Ⅴ. 지역정주형 취업전략', { pageBreak: true })];
  out.push(lead(MD.settleIntro));
  out.push(h2('1  전공별 진입 직무', { before: 0 }));
  const jr = [[headc('전공 계열'), headc('기업'), headc('직무(전공 요건)'), headc('근무지'), headc('고용형태'), headc('신입 보상(공고 기준)')]];
  MD.jobTable.forEach(([fam, list]) => {
    list.forEach((r, i) => {
      const row = [];
      if (i === 0) row.push({ t: fam.split('\n'), rowSpan: list.length, fill: C.label, bold: true, align: CENTER, size: 15 });
      row.push({ t: r[0], bold: true, fill: R.top3.includes(r[0]) ? C.yellow : C.gray, align: CENTER }, r[1], { t: r[2], align: CENTER }, r[3], r[4]);
      jr.push(row);
    });
  });
  out.push(tbl(cw([14, 11, 29, 10, 19, 17]), jr, { size: 15, padV: 20, padH: 45 }));
  out.push(note(`${MD.jobTableNote} 노란 칸은 TOP 3다.`));

  out.push(h2('2  직무군별 8주 준비 안내'));
  const G = META.plan8Common;
  const steps = G[0].rows.map((r) => r[0]);
  const pr = [[headc('단계'), ...G.map((g) => headc([g.family.split('(')[0].trim(), `(${g.family.split('(')[1] || ''}`.replace(/\($/, '')]))]];
  pr.push([{ t: '해당 기업', fill: C.gray, bold: true, align: CENTER }, ...G.map((g) => ({ t: g.companies, size: 14 }))]);
  steps.forEach((s, i) => pr.push([{ t: s.replace(' ', '\n').split('\n'), fill: C.gray, bold: true, align: CENTER }, ...G.map((g) => ({ t: g.rows[i][1], size: 14 }))]));
  out.push(tbl(cw([10, 22.5, 22.5, 22.5, 22.5]), pr, { size: 15, padV: 22, padH: 45 }));
  out.push(note('기업별 8주 준비 전략은 기업별 분석에 있다. 주차는 공고가 올라온 날을 기준으로 거꾸로 세는 상대 일정이다.'));

  out.push(h2('3  통근·주거와 지역에 남는 경로'));
  out.push(p(commuteLead(), { size: BODY }));
  out.push(img(FIG('desk_commute.png'), 16.2, { alt: '부산대에서 10곳 근무지까지 자동차 소요 시간과 거리, 통근버스·기숙사 공개 여부' }));
  out.push(note(MD.figCommuteCaption, { before: 0 }));
  const sr = [[headc('기업'), headc('근무지'), headc(['통근', '버스']), headc('기숙사'), headc('그 밖의 통근·주거 지원'), headc('지역 채용 경로')]];
  MD.settleTable.forEach(([k, place, bus, dorm, etc, route]) => sr.push([{ t: k, bold: true, fill: C.gray, align: CENTER }, { t: place, align: CENTER }, { t: bus, align: CENTER }, { t: dorm, align: CENTER }, etc, route]));
  out.push(tbl(cw([13, 10, 7, 7, 32, 31]), sr, { size: 15, padV: 20, padH: 45 }));
  out.push(note(MD.settleTableNote));
  (MD.settleStrategy || []).forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

// 제출 문구와 서명(본문 끝)
function signature(o = {}) {
  const kn = { keepNext: true, keepLines: true };
  return [
    gap(o.gap ?? 30),
    new Paragraph({ alignment: CENTER, ...kn, spacing: { before: 200, after: 40, ...exact(21, 1.5) }, children: [mk('위 내용을 바탕으로', { size: 21 })] }),
    new Paragraph({ alignment: CENTER, ...kn, spacing: { after: 240, ...exact(21, 1.5) }, children: [mk('「2026학년도 PNU Student Choice Awards(가장 일하고 싶은 지역기업 TOP10)」 최종 결과 보고를 제출합니다.', { size: 21 })] }),
    new Paragraph({ alignment: CENTER, ...kn, spacing: { after: 200, ...exact(21, 1.5) }, children: [mk(META.submitDate, { size: 21 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, keepLines: true, spacing: { after: 0, ...exact(21, 1.5) }, indent: { right: 600 }, children: [mk(`성명(팀장) :   ${META.leader}            (서명)`, { size: 21, bold: true })] }),
  ];
}

// 부산시 청끌기업 '급여' 부문 선정 근거(신입 평균초임 월 300만 원 이상)를 보상 판정에 쓰느냐에 따른 차이
function payFloorScenario() {
  const ks = ['동화엔텍', '태광후지킨'];
  const cur = ks.map((k) => itemOf(k, '보상·근무', '보상').j);
  if (cur.every((j) => j === null)) return [['청끌기업 초임 하한선을 보상 3점으로', { override: Object.fromEntries(ks.map((k) => [k, { 보상: 3 }])) }]];
  if (cur.every((j) => j !== null)) return [['청끌기업 초임 하한선을 쓰지 않음(보상 미확인)', { override: Object.fromEntries(ks.map((k) => [k, { 보상: null }])) }]];
  return [];
}

// 제출본 부록: 1 기준표, 2 세부 판정과 일치율, 3 민감도, 4 계획 대비 변경, 5 사실 교차검증, 6 공개 원칙, 7 출처
function appendixDeskAll() {
  const out = [...rubricBlock(), ...judgmentBlock(), ...agreementTable()];

  out.push(h1('부록 3  순위 민감도', { pageBreak: true }));
  out.push(p(MD.sensLead, { size: 18 }));
  const names = final(ORDER[0]).areas.map((a) => a.name);
  const eq = Object.fromEntries(names.map((n) => [n, 100 / names.length]));
  const wOf = (o) => ({ '직무 연계': 25, '보상·근무': 25, '성장·지속성': 20, '기술·경쟁력': 15, '해외·경력': 5, 'ESG·지역': 10, ...o });
  const SCN = [
    ['기본(환산점수)', {}],
    ['미확인 = 3점(보통)', { fill: 3 }],
    ['미확인 = 0점(하한)', { fill: 0 }],
    ['직무 20 · 보상 30', { w: wOf({ '직무 연계': 20, '보상·근무': 30 }) }],
    ['6개 영역 같은 비중', { w: eq }],
    ...payFloorScenario(),
    ['1차 채점안만', { src: 'A' }],
    ['2차 채점안만', { src: 'B' }],
  ].map(([label, o]) => ({ label, ...scenarioScores(o) }));
  const show = R.byFinal.slice(0, 6);
  const rows = [[headc('바꾼 가정'), ...show.map((k) => headc(k, { size: 14 })), headc('TOP 3')]];
  SCN.forEach((sc, i) => {
    const same = sc.top3.join() === SCN[0].top3.join();
    const ss = sameSet(sc.top3, SCN[0].top3);
    rows.push([{ t: sc.label, bold: i === 0, fill: C.gray },
      ...show.map((k) => ({ t: `${fmt(sc.res[k])} (${sc.rank[k]})`, align: CENTER, fill: sc.rank[k] <= 3 ? C.yellow : undefined })),
      { t: same ? '같음' : (ss ? '세 곳 같고 순서만 다름' : sc.top3.join(' · ')), size: 14, align: CENTER, fill: ss ? undefined : 'FBEDEA' }]);
  });
  out.push(tbl(cw([19, ...show.map(() => 10.5), 18]), rows, { size: 15, padV: 24, padH: 40 }));
  out.push(note('칸의 값은 환산점수(순위)이고 노란 칸은 그 가정에서 3위 안이다. 영역 배점을 바꿀 때는 세부 항목 배점을 같은 비율로 늘리거나 줄였다. 채점안 행은 원문 재대조·재판정을 반영하기 전의 값이다. 표에는 기본 순위 1~6위만 실었고 순위는 10곳 전체에서 매겼다.'));
  const changed = SCN.filter((sc) => !sameSet(sc.top3, SCN[0].top3));
  const reordered = SCN.filter((sc) => sc.top3.join() !== SCN[0].top3.join() && sameSet(sc.top3, SCN[0].top3));
  out.push(bullet(`기본을 뺀 ${SCN.length - 1}가지 가정 가운데 TOP 3의 세 기업이 그대로인 경우는 ${SCN.length - 1 - changed.length}가지다${reordered.length ? `(이 가운데 ${reordered.map((x) => `'${x.label}'`).join(', ')}에서는 세 곳 안의 순서가 바뀐다)` : ''}.`, { size: 18 }));
  changed.forEach((sc) => out.push(bullet(`'${sc.label}'로 두면 TOP 3가 ${sc.top3.join(' · ')}가 된다.`, { size: 18 })));
  MD.sensNotes.forEach((t) => out.push(bullet(t, { size: 18 })));

  out.push(h1('부록 4  연구계획서 대비 변경', { before: 300 }));
  out.push(tbl(cw([14, 22, 26, 20, 18]), [[headc('항목'), headc('계획'), headc('실제'), headc('이유'), headc('영향')], ...MD.changes.map((r) => r.map((x, i) => (i === 0 ? { t: x, bold: true, fill: C.gray } : x)))], { size: 15, padV: 24, padH: 50 }));

  out.push(h1('부록 5  사실 교차검증 결과', { pageBreak: true }));
  out.push(p(MD.xvLead, { size: 18 }));
  if (XV) {
    const T = XV.total;
    const hasSecond = !!T.second;
    const head = [headc('대상'), headc('뽑은 사실'), headc(['두 곳 이상', '확인']), headc(['한 곳', '확인']), headc(['고침', '(불일치·기준일)']), headc('확인 불가')];
    if (hasSecond) head.push(headc(['한 곳 → 2차 확인', '(두 번째 출처)']), headc(['원천이', '한 곳뿐']), headc(['두 번째', '못 찾음']));
    const xr = [head];
    const line = (r, bold) => {
      const row = [{ t: r.label, bold: true, fill: C.gray, align: CENTER }, { t: String(r.n), align: CENTER, bold }, { t: String(r.two), align: CENTER, bold }, { t: String(r.one), align: CENTER, bold }, { t: String(r.mismatch + r.stale), align: CENTER, bold }, { t: String(r.na), align: CENTER, bold }];
      if (hasSecond) {
        const s = r.second;
        row.push({ t: s ? String(s.confirmed) : '–', align: CENTER, bold }, { t: s ? String(s.single_origin) : '–', align: CENTER, bold }, { t: s ? String(s.not_found + (s.unreviewed || 0)) : '–', align: CENTER, bold });
      }
      return row;
    };
    XV.rows.forEach((r) => xr.push(line(r, false)));
    xr.push(line({ ...T, label: '합계' }, true).map((c, i) => (i === 0 ? { ...c, fill: C.label } : { ...c, fill: C.yellow })));
    out.push(tbl(hasSecond ? cw([20, 9, 10, 9, 12, 9, 13, 9, 9]) : cw([28, 13, 15, 13, 18, 13]), xr, { size: 15, padV: 22, padH: 40 }));
    const pctOf = (x) => `${Math.round((x / T.n) * 100)}%`;
    let sum = `뽑은 사실 ${T.n}개 가운데 두 곳 이상에서 확인한 것은 ${T.two}개(${pctOf(T.two)}), 한 곳에서 확인한 것은 ${T.one}개(${pctOf(T.one)}), 고친 것은 ${T.mismatch + T.stale}개(${pctOf(T.mismatch + T.stale)}), 확인하지 못한 것은 ${T.na}개다.`;
    if (hasSecond) {
      const s = T.second;
      sum += ` 한 곳에서만 확인한 사실 가운데 ${s.n}개를 다시 보아, ${s.confirmed}개는 두 번째 출처에서 확인했고 ${s.single_origin}개는 성질상 1차 자료 한 곳에만 있는 사실이었다. 두 번째 출처를 찾지 못했거나 다시 보지 못한 것은 ${s.not_found + (s.unreviewed || 0)}개다${s.mismatch ? `. 이 과정에서 원고와 다른 ${s.mismatch}개를 더 찾아 고쳤다` : ''}. 그래서 두 곳 이상에서 확인한 사실은 모두 ${T.two + s.confirmed}개(${pctOf(T.two + s.confirmed)})다.`;
    }
    out.push(bullet(sum, { size: 18 }));
  } else {
    out.push(p(miss('교차검증 요약'), { size: 18 }));
  }
  MD.xvNotes.forEach((t) => out.push(bullet(t, { size: 18 })));

  out.push(h1('부록 6  공개 원칙과 이용 시 주의', { before: 300 }));
  MD.disclaimer.forEach((t) => out.push(bullet(t, { size: 18 })));

  out.push(h1('부록 7  선행연구·통계 출처 (Ⅳ장)', { before: 300 }));
  const refs = [...META.literature.refs.filter((r) => MD.refKeys.some((key) => r.startsWith(key))).map((r) => r.replace('동남지방데이터청. (2026. 2. 12.)', '동남지방데이터청. (2026a. 2. 12.)')), ...(MD.extraRefs || [])].sort((a, b) => a.localeCompare(b, 'ko'));
  refs.forEach((r) => out.push(p(r, { size: 16, after: 40, indent: { left: 300, hanging: 300 } })));
  out.push(note(MD.refNote));
  return out;
}

// ───────── 문서 조립 ─────────
if (DESK) writeDeskFigs();
const children = DESK
  ? [...cover(), ...sec1(), ...sec2(), ...top3Desk(), ...sec4Desk(), ...sec5Desk(), ...signature({ gap: 16 }), ...appendixDeskAll()]
  : [...cover(), ...sec1(), ...sec2(), ...sec3Survey(), ...sec4Improve(), ...top3(), ...appendix()];
const unresolved = [...new Set(MISSING)];
if (!DRAFT && unresolved.length) {
  console.error('제출용 빌드 중단 — 채우지 못한 자리:', unresolved.join(', '));
  process.exit(2);
}
const doc = new Document({
  creator: META.team,
  title: '2026학년도 PNU Student Choice Awards 결과보고서 — 간판떼고',
  styles: {
    default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: C.navy }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true }, paragraph: { outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 21, bold: true }, paragraph: { outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 220 } } } },
      ] },
      { reference: 'cellbullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 180, hanging: 160 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: DESK ? { top: 1020, bottom: 907, left: 1020, right: 1020, header: 510, footer: 454 } : { top: 1134, bottom: 1020, left: 1020, right: 1020, header: 567, footer: 510 },
      },
    },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk(DRAFT ? '미리보기 — 제출 금지' : '간판떼고 「지역기업 TOP10」 결과보고서', { size: 16, color: DRAFT ? C.red : C.sub, bold: DRAFT })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| TOP3', R.top3.join(', '), DRAFT ? `| 미리보기, 빈 자리 ${unresolved.length}개` : '');
});
