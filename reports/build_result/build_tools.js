// 간판떼고 설문·인터뷰 도구 생성 스크립트
// 입력: tool_meta.js(문안), cards_regional.json·cards_metro.json(카드), interview_q.json(기업별 질문)
const fs = require('fs');
const path = require('path');
const {
  D, FONT, W, C, cw, p, bullet, h1, h2, h3, lead, note, gap, tbl, mk, exact,
} = require('./lib');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat,
} = D;
const T = require('./tool_meta');
const REP = require('./report_meta').rep;

const OUT = process.argv[2] || path.join(__dirname, 'tools.docx');
const CENTER = AlignmentType.CENTER;
const ORDER = ['조광요턴', '동화엔텍', '태광후지킨', '파나시아', '송원산업',
  '지엠비코리아', '해성디에스', '넥센타이어', 'BHI', 'TKG태광'];
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const FIELDS = ['직무와 업무', '고용형태와 요건', '확인된 보상', '근무·복지 조건', '사업과 경력 정보'];

const load = (f) => (fs.existsSync(path.join(__dirname, f)) ? JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf-8')) : null);
const REG = load('cards_regional.json');
const MET = load('cards_metro.json');
const IQ = load('interview_q.json') || {};

const lab = (t, o = {}) => ({ t, fill: C.label, bold: true, align: CENTER, ...o });
const headc = (t, o = {}) => ({ t, fill: C.head, bold: true, align: CENTER, ...o });
const qTable = (rows) => tbl(cw([8, 46, 46]), [[headc('번호'), headc('문항'), headc('응답')], ...rows.map(([n, q, a]) => [{ t: n, align: CENTER, bold: true, fill: C.gray }, q, { t: a, size: 16 }])], { size: 17, padV: 40 });
const numbered = (arr, size = 18) => arr.map((t, i) => p(`${i + 1}. ${t}`, { size, after: 40, indent: { left: 300, hanging: 260 } }));

// ───────── 표지 ─────────
function cover() {
  const out = [];
  out.push(new Paragraph({ alignment: CENTER, spacing: { before: 400, after: 60, ...exact(34, 1.35) }, children: [mk('설문·인터뷰 도구', { size: 34, bold: true, color: C.navy })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 300, ...exact(22, 1.4) }, children: [mk('2026학년도 PNU Student Choice Awards · 연구팀 간판떼고', { size: 22, color: C.sub })] }));
  out.push(tbl(cw([16, 84]), T.overview.map(([k, v]) => [lab(k), v]), { size: 18, padV: 60 }));
  out.push(gap(8));
  out.push(note('이 문서는 연구계획서 Ⅳ-3(학생 설문)과 Ⅳ-4(인터뷰)를 실제로 쓸 수 있게 옮긴 것이다. 설문 카드는 결과보고서의 기업별 사실 노트와 공식 채용 공고를 근거로 만들었다.'));
  return out;
}

// ───────── Ⅰ. 설문 설계 ─────────
function design() {
  const out = [h1('Ⅰ. 설문 설계와 배정', { pageBreak: true })];
  out.push(tbl(cw([16, 84]), T.design.map(([k, v]) => [lab(k), v]), { size: 18, padV: 50 }));
  out.push(h3('무작위 배정 4개 조건'));
  out.push(tbl(cw([34, 33, 33]), T.cells.map((r, i) => r.map((c, j) => (i === 0 || j === 0 ? { t: c, fill: i === 0 ? C.head : C.label, bold: true, align: CENTER } : { t: c, align: CENTER }))), { size: 17, padV: 50 }));
  out.push(h3('제외 기준'));
  T.exclude.forEach((t) => out.push(bullet(t, { size: 18 })));
  out.push(h3('분석 계획'));
  T.analysis.forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

// ───────── Ⅱ. 설문지 전문 ─────────
function survey() {
  const out = [h1('Ⅱ. 설문지 전문', { pageBreak: true })];
  out.push(h3('안내문 (첫 화면)', { before: 0 }));
  out.push(tbl([W], [[{ t: [`**${T.intro.title}**`, ...T.intro.body.map((x) => `- ${x}`)], fill: C.gray }]], { size: 18, padV: 80, padH: 160 }));
  out.push(h3('선별 문항'));
  out.push(qTable(T.screen));
  for (const [title, part] of [['A. 카드별 지원 의향 (15장 반복)', T.partA], ['B. 가림 점검 (비공개군만)', T.partB], ['C. 응답자 정보와 필요 정보', T.partC], ['D. 기업명·근무지역 공개 후', T.partD]]) {
    out.push(h3(title));
    out.push(p(part.lead, { size: 18, keepNext: true }));
    out.push(qTable(part.q));
  }
  out.push(h3('마침 화면'));
  out.push(tbl([W], [[{ t: T.closing, fill: C.gray }]], { size: 18, padV: 70, padH: 160 }));
  return out;
}

// ───────── Ⅲ. 설문 카드 ─────────
function cardTable(cd, kind) {
  const title = kind === 'M' ? `${cd.code} · ${cd.set}세트 · ${cd.job}` : `${cd.code} · ${cd.job}`;
  const rows = [
    [{ t: `**${title}**`, span: 3, fill: C.title, align: AlignmentType.LEFT }],
    [{ t: '기업·근무지역', fill: C.label, bold: true, align: CENTER }, { t: `**공개형** ${cd.open.company} · ${cd.open.region}` }, { t: '**비공개형** 비공개 · 비공개' }],
    ...FIELDS.map((f) => [{ t: f, fill: C.gray, bold: true, align: CENTER }, { t: cd.fields[f] || '공개 정보 없음', span: 2 }]),
    [{ t: '근거', align: CENTER, size: 14, color: C.sub }, { t: `${cd.basis}${cd.url ? ` ${cd.url}` : ''}${cd.checked ? ` (확인 ${cd.checked})` : ''}`, span: 2, size: 14, color: C.sub }],
  ];
  return [tbl(cw([18, 41, 41]), rows, { size: 17, padV: 40, keepNext: true }), gap(10)];
}
function cards() {
  const out = [h1('Ⅲ. 설문 카드 20장', { pageBreak: true })];
  out.push(p(T.cardFrame, { size: 18 }));
  out.push(h2('지역기업 카드 10장 (R01~R10, 모든 응답자)', { before: 120 }));
  if (REG) REG.forEach((cd) => out.push(...cardTable(cd, 'R')));
  else out.push(p('(카드 작성 중)'));
  out.push(h2('수도권 대기업 카드 10장 (M01~M10, A·B 세트 중 하나)', { pageBreak: true, before: 0 }));
  if (MET) {
    if (MET.setNote) out.push(p(`**세트 구성** ${MET.setNote}`, { size: 18 }));
    MET.cards.forEach((cd) => out.push(...cardTable(cd, 'M')));
  } else out.push(p('(비교군 카드 작성 중)'));
  return out;
}

// ───────── Ⅳ. 인터뷰 ─────────
function interview() {
  const out = [h1('Ⅳ. 인터뷰 도구', { pageBreak: true })];
  out.push(lead('인사담당자 3명, 현직자 3명, 전문가 3명(회계사·세무사·관세사)을 목표로 한다. 공개자료로 확인하기 어려운 실제 업무와 처우를 보완한다.'));
  T.ivPrinciples.forEach((t) => out.push(bullet(t, { size: 18 })));

  out.push(h2('1  인사팀 공통 질의 메일 (10개 기업, 같은 날 발송)'));
  out.push(tbl([W], [[{ t: [`**제목** ${T.mail.subject}`, '', ...T.mail.body, '', '**질문**', ...T.common6.map(([k, q]) => `${k}: ${q}`)], fill: C.gray }]], { size: 17, padV: 80, padH: 160 }));

  out.push(h2('2  공통 질문 6개 (인사담당자 인터뷰)'));
  out.push(tbl(cw([24, 76]), [[headc('항목'), headc('질문')], ...T.common6.map(([k, q]) => [{ t: k, fill: C.gray, bold: true }, q])], { size: 17, padV: 40 }));

  out.push(h2('3  기업별 추가 질문'));
  out.push(note('공개자료에서 채우지 못한 칸(결과보고서의 노란 상자)을 우선한다. \'주의\' 기업은 평판 사안의 현재 상황, 재발 방지 조치, 신입 근무에 미치는 영향을 함께 묻고 회사 답변과 공개자료를 구분해 적는다.', { before: 0 }));
  ORDER.forEach((k, i) => {
    const q = IQ[k];
    out.push(h3(`${NUM[i]} ${k}  (평판 ${REP[k]})`, { before: 120 }));
    if (!q) { out.push(p('(작성 중)', { size: 17 })); return; }
    const rows = [];
    (q.hr || []).forEach((x) => rows.push(['인사담당자', x]));
    (q.staff || []).forEach((x) => rows.push(['현직자', x]));
    (q.rep || []).forEach((x) => rows.push(['평판 확인', x]));
    out.push(tbl(cw([14, 86]), rows.map(([a, b], j) => [{ t: a, fill: a === '평판 확인' ? C.yellow : C.gray, bold: true, align: CENTER }, `${j + 1}. ${b}`]), { size: 16, padV: 30 }));
  });

  out.push(h2('4  현직자 질문지 (공통)', { pageBreak: true, before: 0 }));
  out.push(...numbered(T.staffCommon));
  out.push(note('기업별 현직자 질문은 3절의 \'현직자\' 행을 함께 쓴다.'));

  out.push(h2('5  전문가 자문 질문'));
  out.push(tbl([W], [[{ t: T.coi, fill: C.yellow }]], { size: 17, padV: 60, padH: 140 }));
  T.experts.forEach((e) => {
    out.push(h3(`${e.field} — ${e.role}`));
    out.push(...numbered(e.q, 17));
  });

  out.push(h2('6  인터뷰 기록 양식'));
  const blank = Array.from({ length: 6 }, () => T.logCols.map(() => ' '));
  out.push(tbl(cw([16, 12, 13, 9, 22, 14, 14]), [T.logCols.map((c) => headc(c)), ...blank], { size: 15, padV: 120 }));
  return out;
}

const doc = new Document({
  creator: '간판떼고',
  title: '간판떼고 설문·인터뷰 도구',
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
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1020, left: 1020, right: 1020, header: 567, footer: 510 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk('간판떼고 설문·인터뷰 도구', { size: 16, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children: [...cover(), ...design(), ...survey(), ...cards(), ...interview()],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| cards', REG ? REG.length : 0, '+', MET ? MET.cards.length : 0, '| interview', Object.keys(IQ).length);
});
