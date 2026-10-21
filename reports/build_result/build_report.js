// 간판떼고 「지역기업 TOP10」 결과보고서(붙임3 양식) 생성 스크립트
// 입력: companies/<기업>.json(원고), scores.json(score.py), report_meta.js(고정 문안), 조사지침(평가 기준표)
const fs = require('fs');
const path = require('path');
// 공통 헬퍼(lib.js)는 같은 폴더에 있다
const {
  D, FONT, W, C, cw, p, bullet, h1, h2, h3, lead, note, gap, tbl, mk, exact, runs,
} = require('./lib');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat, PageBreak,
} = D;
const META = require('./report_meta');

const OUT = process.argv[2] || path.join(__dirname, 'out.docx');
const CENTER = AlignmentType.CENTER;
const NOTES = '/home/user/finlog-chatbot/research_notes/결과보고서 기업 분석/';
const ORDER = ['조광요턴', '동화엔텍', '태광후지킨', '파나시아', '송원산업',
  '지엠비코리아', '해성디에스', '넥센타이어', 'BHI', 'TKG태광'];
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const GREEN = 'E2EFDA';

const SC = JSON.parse(fs.readFileSync(path.join(__dirname, 'scores.json'), 'utf-8'));
const COMP = {};
ORDER.forEach((k) => {
  const f = path.join(__dirname, 'companies', `${k}.json`);
  if (fs.existsSync(f)) COMP[k] = JSON.parse(fs.readFileSync(f, 'utf-8'));
});

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
const fmt = (x, d = 1) => (x === null || x === undefined ? '–' : Number(x).toFixed(d));
const fmtJ = (j) => (j === null || j === undefined ? '–' : (Number.isInteger(j) ? String(j) : j.toFixed(1)));
const pct = (x) => `${Math.round(x * 100)}%`;
const final = (k) => SC[k] && SC[k].final;
const hasB = (k) => !!(SC[k] && SC[k].B);
const shortJob = (s) => s.split('(')[0].trim();

function circ(title, tail) {
  const kids = [mk('○ ', { size: 20, bold: true, color: C.navy }), mk(title, { size: 20, bold: true, color: C.navy })];
  if (tail) kids.push(mk(`  ${tail}`, { size: 16, color: C.sub }));
  return new Paragraph({ children: kids, spacing: { before: 150, after: 50, ...exact(20, 1.45) }, keepNext: true, keepLines: true });
}
function dash(t, o = {}) {
  return new Paragraph({
    children: runs(`- ${t}`, { size: o.size || 18 }),
    indent: { left: 300, hanging: 170 },
    spacing: { before: 0, after: 30, ...exact(o.size || 18, 1.48) },
    keepLines: true, keepNext: o.keepNext,
  });
}
function dot(t) {
  return new Paragraph({
    children: runs(`· ${t}`, { size: 17, color: '404040' }),
    indent: { left: 560, hanging: 150 },
    spacing: { before: 0, after: 24, ...exact(17, 1.45) },
    keepLines: true,
  });
}
const lab = (t, o = {}) => ({ t, fill: o.fill || C.label, bold: true, align: CENTER, ...o });
const headc = (t, o = {}) => ({ t, fill: C.head, bold: true, align: CENTER, ...o });

// ───────── 표지와 요약 ─────────
function ranking() {
  const ks = ORDER.filter((k) => final(k));
  const byScaled = [...ks].sort((a, b) => final(b).scaled - final(a).scaled || final(b).low - final(a).low);
  const byLow = [...ks].sort((a, b) => final(b).low - final(a).low || final(b).scaled - final(a).scaled);
  const eligible = byScaled.filter((k) => final(k).fill >= 0.7);
  const top3 = eligible.slice(0, 3);
  const lowRank = Object.fromEntries(byLow.map((k, i) => [k, i + 1]));
  const rank = Object.fromEntries(byScaled.map((k, i) => [k, i + 1]));
  return { byScaled, eligible, top3, rank, lowRank };
}
const R = ranking();

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
  out.push(lead(`부산·울산·경남 지역기업 10곳을 공개자료로 분석하고 6개 영역 100점 기준으로 평가했다. 기업 평가만으로 정한 잠정 TOP3는 ${t3.join('·')}다. 학생 설문과 인터뷰를 마치면 학생 선호(30%)를 더해 확정한다.`));
  out.push(tbl([W], [[{ t: META.status, fill: C.yellow, size: 18 }]], { padV: 70, padH: 120 }));
  out.push(gap(8));

  const rows = [[headc('번호'), headc('기업 (본점)'), headc('업종'), headc('대표 학사 신입 직무'), headc('잠정 점수 (범위)'), headc('충족률'), headc('평판')]];
  ORDER.forEach((k, i) => {
    const c = COMP[k];
    const f = final(k);
    const jobs = c ? c.jobs.map((j) => shortJob(j.name)).join(', ') : '작성 중';
    const isTop = t3.includes(k);
    rows.push([
      { t: NUM[i], align: CENTER, fill: isTop ? C.yellow : undefined },
      { t: [`**${k}**`, INFO[k] ? INFO[k].place : ''], align: CENTER, fill: isTop ? C.yellow : undefined },
      { t: INFO[k] ? INFO[k].sector.replace(/\s*\(.*\)$/, '') : '', size: 15 },
      { t: jobs, size: 15 },
      { t: f ? [`**${fmt(f.scaled)}**`, `(${fmt(f.low)}~${fmt(f.high)})`] : '–', align: CENTER },
      { t: f ? pct(f.fill) : '–', align: CENTER },
      { t: META.rep[k], align: CENTER, fill: META.rep[k] === '적합' ? GREEN : C.yellow },
    ]);
  });
  out.push(tbl(cw([6, 15, 22, 25, 13, 8, 8]), rows, { size: 16, padV: 35, padH: 60 }));
  out.push(note('잠정 점수는 기업 평가 환산점수(100점)다. 노란 칸은 잠정 TOP3다. 평판은 연구계획서 Ⅳ-2 관문의 판정이며, \'주의\'는 결격은 아니지만 사실과 회사 입장을 함께 적은 기업이다.'));

  out.push(h3('연구 방법'));
  META.method.forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

// ───────── Ⅰ. 기업별 분석 ─────────
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
    pageBreakBefore: i > 0,
  }));
  if (!c) {
    out.push(p('(원고 작성 중)'));
    return out;
  }
  out.push(lead(c.summary, { size: 19 }));

  // n-1) 기업 기본정보 (양식 표)
  out.push(h3(`${n}-1) 기업 기본정보`, { before: 60 }));
  const introRows = [[
    { t: '기업 소개', rowSpan: c.intro.length + 1, fill: C.label, bold: true, align: CENTER },
    headc('항목'), headc('내용'),
  ]];
  c.intro.forEach(([label, val]) => introRows.push([{ t: label, fill: C.gray, bold: true, align: CENTER }, { t: val }]));
  out.push(tbl(cw([967, 1655, 6980]), introRows, { size: 17, padV: 40 }));

  const F = c.finance;
  if (F && F.rows && F.rows.length) {
    out.push(gap(6));
    const fr = [[headc(`재무 요약 (${F.unit}, ${F.basis.split('(')[0].trim()})`), ...F.years.map((y) => headc(`${y}년`))]];
    F.rows.forEach((r) => fr.push([{ t: r[0], fill: C.gray, bold: true, align: CENTER }, ...r.slice(1).map((v) => ({ t: v || '–', align: CENTER }))]));
    out.push(tbl(cw([31, 23, 23, 23]), fr, { size: 17, padV: 30 }));
    const fn = [F.basis.includes('(') ? `기준: ${F.basis}.` : '', F.note || ''].filter(Boolean).join(' ');
    if (fn) out.push(note(fn));
  }

  // n-2) 분석내용
  out.push(h3(`${n}-2) 분석내용`));
  c.analysis.forEach((b) => {
    out.push(circ(b.title, b.items));
    b.points.forEach((pt, j) => {
      out.push(dash(pt.t, { keepNext: j === 0 && (pt.sub || []).length === 0 && b.points.length > 1 }));
      (pt.sub || []).forEach((s) => out.push(dot(s)));
    });
  });

  // 대표 신입 직무
  out.push(circ('대표 학사 신입 직무', '⑤ 직무 분석 · ⑪ 필요역량'));
  const J = c.jobs;
  const jw = J.length > 1 ? cw([14, 43, 43]) : cw([14, 86]);
  const jrows = [[headc('구분'), ...J.map((j) => headc(j.name))]];
  [['업무', 'work'], ['요건', 'req'], ['근무지', 'place'], ['고용형태', 'type'], ['보상', 'pay'], ['공고', 'when']].forEach(([l, f]) => {
    jrows.push([{ t: l, fill: C.gray, bold: true, align: CENTER }, ...J.map((j) => ({ t: j[f] || '–' }))]);
  });
  out.push(tbl(jw, jrows, { size: 16, padV: 30 }));

  // 평가 점수
  const S = final(k);
  if (S) {
    out.push(circ('평가 점수 (잠정)', hasB(k) ? '두 평가자 평균 · 부록 2' : '1차 평가 · 부록 2'));
    const sr = [[headc('영역 (배점)'), headc('확인 배점'), headc('득점'), headc('영역 환산'), headc('미확인 항목')]];
    S.areas.forEach((a) => {
      const miss = a.items.filter((x) => x.j === null).map((x) => `${x.name}(${x.w})`).join(', ');
      sr.push([
        { t: `${a.name} (${a.w})`, fill: C.gray, bold: true, align: CENTER },
        { t: String(a.conf), align: CENTER },
        { t: fmt(a.got), align: CENTER },
        { t: a.conf ? `${Math.round((a.got / a.conf) * 100)}%` : '–', align: CENTER },
        { t: miss || '없음', size: 15 },
      ]);
    });
    sr.push([
      { t: '합계', fill: C.label, bold: true, align: CENTER },
      { t: String(S.conf), align: CENTER, bold: true },
      { t: fmt(S.got), align: CENTER, bold: true },
      { t: `**환산 ${fmt(S.scaled)}점**`, align: CENTER, fill: C.yellow },
      { t: `범위 ${fmt(S.low)}~${fmt(S.high)}점 · 정보 충족률 ${pct(S.fill)}`, size: 15, fill: C.yellow },
    ]);
    out.push(tbl(cw([22, 12, 11, 15, 40]), sr, { size: 16, padV: 28 }));
  }

  // SWOT
  out.push(circ('SWOT 분석', '⑬ SWOT'));
  const sw = c.swot;
  const swCell = (title, arr, fill) => ({ paras: undefined, t: [`**${title}**`, ...arr.map((x) => `- ${x}`)], fill, v: D.VerticalAlign.TOP });
  out.push(tbl(cw([50, 50]), [
    [swCell('강점 (S)', sw.S, 'EAF1FB'), swCell('약점 (W)', sw.W, 'FBEDEA')],
    [swCell('기회 (O)', sw.O, 'EEF6EA'), swCell('위협 (T)', sw.T, 'FDF6E3')],
  ], { size: 16, padV: 50 }));

  // 개선 아이디어
  out.push(circ('개선 아이디어 (제안)', '⑩ 개선 아이디어'));
  const I = c.ideas;
  const iw = I.length > 1 ? cw([14, 43, 43]) : cw([14, 86]);
  const irows = [[headc('구분'), ...I.map((x) => headc(x.title))]];
  [['문제', 'problem'], ['대상', 'target'], ['필요한 정보', 'info'], ['실행 주체', 'owner'], ['예시', 'example'], ['확인 지표', 'metric']].forEach(([l, f]) => {
    irows.push([{ t: l, fill: C.gray, bold: true, align: CENTER }, ...I.map((x) => ({ t: x[f] || '–' }))]);
  });
  out.push(tbl(iw, irows, { size: 16, padV: 28 }));

  // 8주 준비 전략
  out.push(circ('직무군별 8주 준비 전략', '⑭ 취업 준비 전략'));
  const P8 = c.plan8;
  const tr = P8.tracks.length;
  const pw = tr > 1 ? cw([14, 43, 43]) : cw([14, 86]);
  const prows = [[headc('기간'), ...P8.tracks.map((t) => headc(t))]];
  P8.rows.forEach((r) => prows.push([{ t: r[0], fill: C.gray, bold: true, align: CENTER }, ...r.slice(1, 1 + tr).map((x) => ({ t: x || '–' }))]));
  out.push(tbl(pw, prows, { size: 16, padV: 28 }));

  // 설문·인터뷰 후 반영
  out.push(gap(8));
  out.push(tbl([W], [[{ t: ['**설문·인터뷰 후 반영**', ...c.pending.map((x) => `- ${x}`)], fill: C.yellow }]], { size: 16, padV: 60, padH: 120 }));
  out.push(p(`**평판 점검(${META.rep[k]})** ${c.reputation}`, { size: 16, before: 80, after: 60 }));

  // 출처
  out.push(new Paragraph({ children: [mk('출처', { size: 16, bold: true })], spacing: { before: 80, after: 20, ...exact(16, 1.4) }, keepNext: true }));
  c.sources.forEach(([title, desc, url], j) => {
    const kids = [mk(`[${j + 1}] `, { size: 14, bold: true }), mk(title, { size: 14, bold: true }), mk(`  ${desc}`, { size: 14, color: C.sub })];
    if (url) kids.push(mk(`  ${url}`, { size: 13, color: '7F7F7F' }));
    out.push(new Paragraph({ children: kids, spacing: { before: 0, after: 16, ...exact(14, 1.35) }, indent: { left: 280, hanging: 280 } }));
  });
  return out;
}

function sec1() {
  const out = [h1('Ⅰ. 기업별 분석', { pageBreak: true })];
  out.push(note('기업마다 양식의 \'기업 기본정보\' 표와 \'분석내용\'을 두고, 분석내용은 공식 분석 항목 14개(①~⑭)를 7개 묶음으로 정리했다. 문장 끝 [n]은 그 기업 분석 끝의 출처 번호다.', { before: 0, after: 120 }));
  ORDER.forEach((k, i) => out.push(...companySection(k, i)));
  return out;
}

// ───────── Ⅱ. 종합 비교표 ─────────
const COLS = [['성장성', '성장·지속성'], ['기술력', '기술·경쟁력'], ['직무매력', '직무 연계'], ['근무환경', '보상·근무'], ['글로벌', '해외·경력']];
function areaCell(f, name) {
  const a = f.areas.find((x) => x.name === name);
  return { t: `${fmt(a.got)}/${a.conf}${a.conf < a.w ? '*' : ''}`, align: CENTER };
}
function sec2() {
  const out = [h1('Ⅱ. 기업 10개 종합 비교표', { pageBreak: true })];
  out.push(lead(META.compareLead));
  const head = [headc('기업'), ...COLS.map(([c, a]) => headc([c, `(${f0(a)})`])), headc(['적합성', '(학생 선호)']), headc(['기타', '(ESG 10·평판)']), headc(['총점', '(환산·범위)'])];
  function f0(a) { return { '성장·지속성': 20, '기술·경쟁력': 15, '직무 연계': 25, '보상·근무': 25, '해외·경력': 5 }[a]; }
  const rows = [head];
  R.byScaled.forEach((k, i) => {
    const f = final(k);
    const top = R.top3.includes(k);
    const e = f.areas.find((x) => x.name === 'ESG·지역');
    rows.push([
      { t: [`**${i + 1}. ${k}**`], fill: top ? C.yellow : C.gray, align: CENTER },
      ...COLS.map(([, a]) => areaCell(f, a)),
      { t: '설문 후', align: CENTER, color: C.sub },
      { t: [`${fmt(e.got)}/${e.conf}${e.conf < e.w ? '*' : ''}`, META.rep[k]], align: CENTER, fill: META.rep[k] === '적합' ? undefined : 'FFF8E1' },
      { t: [`**${fmt(f.scaled)}**`, `(${fmt(f.low)}~${fmt(f.high)})`, `충족 ${pct(f.fill)}`], align: CENTER, fill: top ? C.yellow : undefined },
    ]);
  });
  out.push(tbl(cw([1700, 920, 920, 920, 920, 920, 920, 1080, 1230]), rows, { size: 16, padV: 32, padH: 50 }));
  META.compareNotes.forEach((t) => out.push(note(t)));

  // 영역별 일치율(2인 평가)
  const withB = ORDER.filter((k) => hasB(k));
  if (withB.length) {
    out.push(h3('두 평가자의 영역별 일치율'));
    const names = SC[withB[0]].final.areas.map((a) => a.name);
    const ar = [[headc('영역'), headc('두 사람 모두 확인한 항목'), headc('판정 같음'), headc('차이 1점 이내'), headc('제3 평가자 조정 항목')]];
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
    out.push(note(`${withB.length}개 기업 × 세부 항목 기준이다. 판정은 0~5점이며, 영역 득점 차가 2점 이상이거나 한 사람만 확인한 항목은 원문을 다시 대조해 제3 평가자가 정했다.`));
  }
  return out;
}

// ───────── TOP3 ─────────
function top3() {
  const out = [h1('「지역기업 TOP 3」 (잠정)', { pageBreak: true })];
  out.push(lead('기업 평가 환산점수로 정한 잠정 순위다. 학생 선호(30%)를 더하면 바뀔 수 있다.'));
  const rows = [[headc('순위'), headc('기업'), headc('잠정 점수'), headc('선정 이유')]];
  R.top3.forEach((k, i) => {
    const f = final(k);
    const contested = R.lowRank[k] !== R.rank[k];
    rows.push([
      { t: `${i + 1}위`, align: CENTER, bold: true, fill: C.yellow },
      { t: [`**${k}**`, INFO[k] ? INFO[k].place : ''], align: CENTER },
      { t: [`${fmt(f.scaled)}점`, `(${fmt(f.low)}~${fmt(f.high)})`, contested ? '경합' : ''].filter(Boolean), align: CENTER },
      { t: META.top3Reasons[k] || '(선정 이유 작성 예정)' },
    ]);
  });
  out.push(tbl(cw([9, 15, 14, 62]), rows, { size: 17, padV: 50 }));
  const nxt = R.eligible.slice(3, 6).map((k) => `${k} ${fmt(final(k).scaled)}점(하한 ${R.lowRank[k]}위)`).join(', ');
  out.push(note(`'경합'은 하한 기준 순위가 환산점수 순위와 다른 기업이다. 4~6위: ${nxt}.`));
  META.top3Note.forEach((t) => out.push(p(t, { size: 18 })));
  out.push(h3('최종 확정 방법'));
  META.finalRule.forEach((t) => out.push(bullet(t, { size: 18 })));

  // 서명란 (양식 끝)
  out.push(gap(30));
  out.push(new Paragraph({ alignment: CENTER, spacing: { before: 200, after: 40, ...exact(21, 1.5) }, children: [mk('위 내용을 바탕으로', { size: 21 })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 240, ...exact(21, 1.5) }, children: [mk('「2026학년도 PNU Student Choice Awards(가장 일하고 싶은 지역기업 TOP10)」 최종 결과 보고를 제출합니다.', { size: 21 })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 200, ...exact(21, 1.5) }, children: [mk('2026년      월      일', { size: 21 })] }));
  out.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0, ...exact(21, 1.5) }, indent: { right: 600 }, children: [mk('성명(팀장) :                         (서명)', { size: 21, bold: true })] }));
  return out;
}

// ───────── 부록 ─────────
function appendix() {
  const out = [h1('부록 1  평가 기준표 (세부 항목 18개)', { pageBreak: true })];
  out.push(p('각 세부 항목은 아래 1·3·5점 기준으로 0~5점을 판정한다. 2·4점은 양쪽 기준의 중간일 때 준다. 점수 = 배점 × 판정 ÷ 5. 확인하지 못한 항목은 0점이 아니라 \'미확인\'으로 남긴다.', { size: 18 }));
  const rows = [[headc('영역'), headc('세부 항목 (배점)'), headc('1점'), headc('3점'), headc('5점')]];
  let lastArea = '';
  const spans = {};
  ANCHORS.forEach((r) => { if (r[0]) { lastArea = r[0]; spans[lastArea] = 0; } spans[lastArea] += 1; });
  lastArea = '';
  ANCHORS.forEach((r) => {
    const row = [];
    if (r[0]) { lastArea = r[0]; row.push({ t: r[0], rowSpan: spans[r[0]], fill: C.label, bold: true, align: CENTER }); }
    row.push({ t: r[1], fill: C.gray, bold: true }, r[2], r[3], r[4]);
    rows.push(row);
  });
  out.push(tbl(cw([12, 19, 23, 23, 23]), rows, { size: 15, padV: 28, padH: 60 }));

  out.push(h1('부록 2  기업별 세부 항목 판정', { pageBreak: true }));
  const anyB = ORDER.some((k) => hasB(k));
  out.push(p(`칸의 값은 세부 항목의 최종 판정(0~5점)이다. ${anyB ? '두 평가자 판정의 평균이고, 제3 평가자가 조정한 항목은 조정값이다.' : '현재 1차 평가 값이다.'} '–'는 미확인이다.`, { size: 18 }));
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
  if (anyB) out.push(note('†는 제3 평가자가 원문을 다시 대조해 정한 항목이다. 근거는 연구 노트의 기업별 채점조정 파일에 있다.'));

  out.push(h1('부록 3  공개 원칙과 이용 시 주의', { before: 360 }));
  META.disclaimer.forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

// ───────── 문서 조립 ─────────
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
        margin: { top: 1134, bottom: 1020, left: 1020, right: 1020, header: 567, footer: 510 },
      },
    },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk('간판떼고 「지역기업 TOP10」 결과보고서', { size: 16, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children: [...cover(), ...sec1(), ...sec2(), ...top3(), ...appendix()],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| TOP3', R.top3.join(', '));
});
