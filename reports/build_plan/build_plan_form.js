// 간판떼고 연구계획서 — 주최 측 「[붙임2] 연구계획서」 공식 양식 모양
// 본문은 모두 content.js(DATA)에서 가져온다. 이 파일은 표시 방식(상자·라벨 칸·색·제목 글꼴)만 양식에 맞춘다.
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const {
  D, FONT, W, C, cw: cw0, p, bullet, h2, h3, lead, note, gap, tbl, mk, exact, LINE,
} = L;
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber,
  LevelFormat, VerticalAlign, Table, TableRow, TableCell, WidthType, TableLayoutType, ShadingType,
} = D;
const DATA = require('./content');

const OUT = process.argv[2] || path.join(__dirname, 'out_form.docx');
const CENTER = AlignmentType.CENTER;

// ───────── 양식의 색·선 (원본 붙임2: 라벨 칸 C1D5EC, 가는 검정 실선) ─────────
const FORM_BLUE = 'C1D5EC';
C.label = FORM_BLUE;
C.head = FORM_BLUE;
LINE.color = '000000';
// 내용 데이터에 들어 있는 칸 색(서식)도 양식 파랑으로 통일한다. 글자는 바꾸지 않는다.
(function recolor(o) {
  if (Array.isArray(o)) { o.forEach(recolor); return; }
  if (o && typeof o === 'object') {
    if (['DEEAF6', 'D9E2F3'].includes(o.fill)) o.fill = FORM_BLUE;
    Object.values(o).forEach(recolor);
  }
}(DATA));

// 상자 안에 들어가는 표는 상자 안쪽 폭에 맞춘다
let CUR_W = W;
const cw = (arr) => cw0(arr, CUR_W);
const BOX_PAD = 110;
const IW = W - 2 * BOX_PAD - 30;

const SERIF = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman', eastAsia: '바탕' };
// 양식의 장 제목: 굵은 바탕체, 검정
function fh1(text, o = {}) {
  const kids = [new TextRun({ text, font: SERIF, size: 26, bold: true, color: '000000' })];
  if (o.tag) kids.push(mk(`   ${o.tag}`, { size: 19, bold: true, color: C.blue }));
  return new Paragraph({
    heading: D.HeadingLevel.HEADING_1,
    children: kids,
    spacing: { before: o.before ?? 0, after: 100, ...exact(26, 1.4) },
    keepNext: o.keepNext !== false,
    pageBreakBefore: !!o.pageBreak,
  });
}

const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE, insideHorizontal: LINE, insideVertical: LINE };
const dxa = (n) => ({ size: n, type: WidthType.DXA });

// 양식의 큰 상자(Ⅱ·Ⅲ·Ⅳ): 테두리 1칸 표. 내용이 길면 쪽을 넘어 이어진다.
function box(kids) {
  kids.push(gap(2)); // 칸은 문단으로 끝나야 한다
  return new Table({
    width: dxa(W),
    columnWidths: [W],
    layout: TableLayoutType.FIXED,
    borders: BORDERS,
    rows: [new TableRow({
      cantSplit: false,
      children: [new TableCell({ width: dxa(W), margins: { top: 90, bottom: 60, left: BOX_PAD, right: BOX_PAD }, children: kids })],
    })],
  });
}

// 양식의 '파란 라벨 칸 + 내용 상자'(Ⅴ 선정기준)
function labelBox(label, kids, labelW) {
  kids.push(gap(2));
  return new Table({
    width: dxa(W),
    columnWidths: [labelW, W - labelW],
    layout: TableLayoutType.FIXED,
    borders: BORDERS,
    rows: [new TableRow({
      cantSplit: false,
      children: [
        new TableCell({
          width: dxa(labelW),
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: FORM_BLUE },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ alignment: CENTER, children: [mk(label, { size: 20, bold: true })] })],
        }),
        new TableCell({ width: dxa(W - labelW), margins: { top: 80, bottom: 40, left: 90, right: 90 }, children: kids }),
      ],
    })],
  });
}

// 양식의 상자 첫 줄 라벨: "- 연구 주제"
const dashLabel = (t, o = {}) => new Paragraph({
  children: [mk(`- ${t}`, { size: 21, bold: true })],
  spacing: { before: o.before ?? 0, after: 50, ...exact(21, 1.45) },
  keepNext: true,
});

// ───────── 연구 요약(표지) ─────────
function summaryPage() {
  const out = [];
  out.push(p('[붙임2] PNU Student Choice Awards(가장 일하고 싶은 지역기업 TOP10) 연구계획서', { bold: true, after: 80 }));

  const titleParas = [
    new Paragraph({ alignment: CENTER, spacing: { before: 60, after: 0, ...exact(32, 1.35) }, children: [mk('2026학년도 PNU Student Choice Awards', { size: 32, bold: true })] }),
    new Paragraph({ alignment: CENTER, spacing: { before: 0, after: 40, ...exact(32, 1.35) }, children: [mk('(가장 일하고 싶은 지역기업 TOP10) 연구계획서', { size: 28, bold: true })] }),
  ];
  out.push(tbl(cw([16, 34, 16, 34]), [
    [{ span: 4, fill: C.title, paras: titleParas }],
    [{ t: '응시번호', fill: C.label, bold: true, align: CENTER }, { t: '( 담당자 기재 )', align: CENTER }, { t: '팀명', fill: C.label, bold: true, align: CENTER }, { t: '간판떼고', bold: true, align: CENTER }],
  ], { size: 20 }));

  out.push(h2('연구 요약', { before: 200 }));
  out.push(lead(DATA.summaryLead));

  out.push(tbl(cw([17, 83]), [[
    { t: '핵심 질문', fill: C.yellow, bold: true, align: CENTER },
    { t: DATA.coreQuestion, fill: C.yellow, bold: true },
  ]], { size: 19 }));
  out.push(gap(6));

  const rows = DATA.fiveW.map(([k, v]) => [{ t: k, fill: k.includes('(') ? C.label : C.gray, bold: true, align: CENTER }, { t: v }]);
  out.push(tbl(cw([17, 83]), rows, { size: 19, padV: 60 }));
  out.push(gap(8));

  out.push(p('**연구 흐름**', { after: 40, keepNext: true }));
  const step = (title, when, line1, line2) => ({
    fill: C.label,
    paras: [
      new Paragraph({ alignment: CENTER, spacing: { after: 10, ...exact(20, 1.45) }, children: [mk(title, { size: 20, bold: true, color: C.navy }), mk(`  ${when}`, { size: 16, color: C.sub })] }),
      new Paragraph({ alignment: CENTER, spacing: { after: 10, ...exact(18, 1.45) }, children: [mk(line1, { size: 18, bold: true })] }),
      new Paragraph({ alignment: CENTER, spacing: { after: 0, ...exact(16, 1.45) }, children: [mk(line2, { size: 16, color: C.sub })] }),
    ],
  });
  const arrow = { t: '▶', align: CENTER, color: C.blue, size: 22 };
  out.push(tbl([3000, 433, 3000, 433, 3000], [[
    step(...DATA.flow[0]), arrow, step(...DATA.flow[1]), arrow, step(...DATA.flow[2]),
  ]], { noBorder: true, padV: 70 }));
  return out;
}

// ───────── Ⅰ. 팀 구성 및 기업선정 (누가) ─────────
function sec1() {
  const out = [fh1('Ⅰ. 팀 구성 및 기업선정', { pageBreak: true, tag: '| 누가 (Who)' })];
  out.push(lead(DATA.s1.lead));
  const teamRows = [
    [{ t: '팀소개', fill: C.label, bold: true, align: CENTER }, { t: DATA.s1.intro, span: 5, align: AlignmentType.LEFT }],
    ...DATA.s1.team.map((r, i) => r.map((c, j) => (i === 0 ? { t: c, fill: j === 0 ? C.label : C.head, bold: true, align: CENTER } : (j === 0 ? { t: c, fill: C.label, bold: true, align: CENTER } : { t: c, align: CENTER })))),
  ];
  out.push(tbl(cw([13, 17.4, 17.4, 17.4, 17.4, 17.4]), teamRows, { size: 18 }));
  out.push(gap(6));
  DATA.s1.rules.forEach((r) => out.push(bullet(r)));
  return out;
}

// ───────── Ⅱ. 연구개요 (무엇을) ─────────
function sec2() {
  const out = [fh1('Ⅱ. 연구개요', { before: 300, tag: '| 무엇을 (What)' })];
  CUR_W = IW;
  const k = [];
  DATA.s2.overview.forEach(([key, val]) => {
    k.push(dashLabel(key));
    k.push(p(`· ${val}`, { bold: key === '연구 주제', after: 80, indent: { left: 220, hanging: 160 } }));
  });
  k.push(gap(4));
  k.push(p(DATA.s2.body, { after: 100 }));
  k.push(tbl(cw([11, 17, 36, 14, 22]), DATA.s2.steps, { header: true, labelCol: true, size: 18 }));
  CUR_W = W;
  out.push(box(k));
  return out;
}

// ───────── Ⅲ. 연구배경 및 목적 (왜) ─────────
function sec3() {
  const out = [fh1('Ⅲ. 연구배경 및 목적', { pageBreak: true, tag: '| 왜 (Why)' })];
  CUR_W = IW;
  const k = [];
  k.push(dashLabel('연구 배경'));
  k.push(h2('1  연구배경 — 왜 이 연구가 필요한가', { before: 40 }));
  k.push(lead(DATA.s3.lead));
  k.push(tbl(cw([20, 80]), DATA.s3.problems, { labelCol: true, size: 18 }));
  k.push(gap(6));
  DATA.s3.after.forEach((t) => k.push(p(t)));
  k.push(tbl(cw([16, 21, 21, 21, 21]), DATA.s3.purposeMap.map((r, i) => r.map((c, j) => ({
    t: c, align: CENTER, bold: i === 0 || j === 0, fill: i === 0 ? C.head : j === 0 ? C.label : undefined,
  }))), { size: 17, padV: 45 }));
  k.push(note(DATA.s3.purposeNote));

  k.push(dashLabel('연구 목적', { before: 160 }));
  k.push(h2('2  연구 목적과 연구 질문', { before: 40 }));
  k.push(lead(DATA.s3.purposeLead));
  k.push(tbl(cw([34, 38, 28]), DATA.s3.questions, { header: true, size: 18 }));
  k.push(note(DATA.s3.questionsNote));

  k.push(h2('3  심사기준과 연구의 연결'));
  k.push(lead(DATA.s3.criteriaLead));
  k.push(tbl(cw([27, 73]), DATA.s3.criteria, { header: true, labelCol: true, size: 18 }));
  k.push(note(DATA.s3.criteriaNote));
  CUR_W = W;
  out.push(box(k));
  return out;
}

// ───────── Ⅳ. 세부 내용 및 추진계획 (어떻게·언제) ─────────
function sec4() {
  const S = DATA.s4;
  const out = [fh1('Ⅳ. 세부 내용 및 추진계획', { pageBreak: true, tag: '| 어떻게 (How) · 언제 (When)' })];
  CUR_W = IW;
  const k = [];
  k.push(dashLabel('연구방법, 추진계획, 기대효과 등'));
  k.push(lead(S.lead));

  k.push(h2('1  활동별 육하원칙 한눈에 보기', { before: 60 }));
  k.push(tbl(cw([10, 22.5, 22.5, 22.5, 22.5]), S.matrix, { header: true, labelCol: true, size: 17, padV: 40, padH: 70 }));

  k.push(h2('2  기업 분석과 공통 평가 (①)'));
  k.push(lead(S.analysis.lead));
  k.push(h3('(1) 먼저 거른다 — 평판·결격 점검', { before: 40 }));
  k.push(p(S.analysis.gate.intro, { size: 18, after: 60 }));
  k.push(tbl(cw([9, 61, 30]), S.analysis.gate.table, { header: true, labelCol: true, size: 16 }));
  k.push(gap(4));
  S.analysis.gate.notes.forEach((t) => k.push(bullet(t, { size: 18 })));
  k.push(h3('(2) 무엇을 조사하나 — 7개 조사 묶음'));
  k.push(tbl(cw([16, 19, 43, 22]), S.analysis.bundles, { header: true, labelCol: true, size: 16 }));
  k.push(h3('(3) 어떻게 평가하나 — 6개 영역 100점 평가표'));
  k.push(tbl(cw([25, 9, 66]), S.analysis.rubric, { header: true, labelCol: true, size: 17 }));
  k.push(note(S.analysis.rubricNote));
  k.push(p(S.analysis.benchmark, { size: 18, after: 60 }));
  k.push(h3('(4) 검증 원칙'));
  S.analysis.principles.forEach((t) => k.push(bullet(t)));

  k.push(h2('3  블라인드 학생 설문 (②)'));
  k.push(lead(S.survey.lead));
  k.push(h3('(1) 누구에게 — 대상과 모집', { before: 40 }));
  S.survey.sample.forEach((t) => k.push(bullet(t)));
  k.push(h3('(2) 어떻게 — 설계 5단계'));
  k.push(tbl(cw([16, 84]), S.survey.design, { labelCol: true, size: 17 }));
  k.push(gap(6));
  k.push(tbl(cw([38, 34, 28]), S.survey.cardInfo, { header: true, size: 17 }));
  k.push(h3('(3) 분석과 연구 윤리'));
  S.survey.analysis.forEach((t) => k.push(bullet(t)));

  k.push(h2('4  인터뷰 (③)'));
  k.push(lead(S.interview.lead));
  k.push(tbl(cw([24, 14, 62]), S.interview.table, { header: true, labelCol: true, size: 17 }));
  k.push(gap(6));
  S.interview.bullets.forEach((t) => k.push(bullet(t)));

  k.push(h2('5  TOP3 선정 방법 (④)'));
  k.push(lead(S.top3.lead));
  k.push(tbl([CUR_W], [[{ fill: C.yellow, t: S.top3.formula, size: 19 }]], { padV: 80, padH: 160 }));
  k.push(gap(6));
  S.top3.rules.forEach((t) => k.push(bullet(t)));

  k.push(h2('6  개선 아이디어 — 전공별 직무 카드와 학생 사용 검증'));
  k.push(lead(S.improve.lead));
  k.push(tbl(cw([14, 86]), S.improve.steps, { labelCol: true, size: 17 }));

  k.push(h2('7  결과물과 8주 취업 준비 전략'));
  k.push(lead(S.outputs.lead));
  k.push(h3('(1) 최종 결과물 5종', { before: 40 }));
  k.push(tbl(cw([29, 71]), S.outputs.table, { header: true, labelCol: true, size: 17 }));
  k.push(h3('(2) 기업별 8주 취업 준비 전략'));
  k.push(tbl(cw([10, 16, 74]), S.outputs.weeks, { header: true, labelCol: true, size: 17 }));
  k.push(note(S.outputs.weeksNote));

  k.push(h2('8  기대 효과'));
  k.push(lead(S.effects.lead));
  k.push(tbl(cw([16, 84]), S.effects.table, { header: true, labelCol: true, size: 17 }));

  k.push(h2('9  추진 일정 — 언제'));
  k.push(lead(S.schedule.lead, { after: 20 }));
  k.push(note(S.schedule.note, { before: 0, after: 60 }));
  k.push(gantt(S.schedule));

  k.push(h2('10  위험 요인과 대응 계획'));
  k.push(lead(S.risks.lead));
  k.push(tbl(cw([25, 50, 25]), S.risks.table, { header: true, labelCol: true, size: 17 }));
  CUR_W = W;
  out.push(box(k));
  return out;
}

function gantt(S) {
  const periods = S.periods;
  const widths = cw([36, ...periods.map(() => 64 / periods.length)]);
  const head = ['활동 (산출물)', ...periods].map((t) => ({ t, size: 15 }));
  const rows = [head];
  S.rows.forEach(([act, out, , marks]) => {
    const cells = [
      { paras: [
        new Paragraph({ spacing: { after: 0, ...exact(16, 1.36) }, children: [mk(act, { size: 16, bold: true })] }),
        new Paragraph({ spacing: { after: 0, ...exact(14, 1.36) }, children: [mk(out, { size: 14, color: C.sub })] }),
      ] },
    ];
    periods.forEach((_, i) => {
      const m = marks[i];
      if (m === '★') cells.push({ t: '제출', fill: C.star, bold: true, size: 14, align: CENTER });
      else if (m) cells.push({ t: '', fill: C.bar });
      else cells.push({ t: '' });
    });
    rows.push(cells);
  });
  return tbl(widths, rows, { header: true, padV: 28, padH: 50 });
}

// ───────── Ⅴ. 대상 기업 선정 기준 및 현황 (어디서) ─────────
function sec5() {
  const S = DATA.s5;
  const out = [fh1('Ⅴ. 대상 기업 선정 기준 및 현황', { before: 360, tag: '| 어디서 (Where)' })];
  out.push(h2('1  선정 기준', { before: 0 }));
  out.push(lead(S.lead));

  // 양식의 '선정기준' 라벨 칸 + 내용 상자
  const LBL = 1380;
  CUR_W = W - LBL - 2 * 90 - 30;
  const crit = [tbl(cw([14, 33, 53]), S.criteria, { header: true, labelCol: true, size: 17 }), note(S.criteriaNote)];
  CUR_W = W;
  out.push(labelBox('선정기준', crit, LBL));
  out.push(gap(6));

  // 양식의 '기업 선정' 표: 부산·울산·경남 가로 3열(머리 / 개수 / 기업명)
  out.push(h3('기업 선정'));
  out.push(tbl(cw([14, 28.67, 28.67, 28.66]), [
    [{ t: '기업 선정', rowSpan: 3, fill: C.label, bold: true, align: CENTER }, ...S.selection.map(([r]) => ({ t: r, fill: C.head, bold: true, align: CENTER }))],
    S.selection.map(([, n]) => ({ t: n, align: CENTER, bold: true })),
    S.selection.map(([, , names]) => ({ t: names, align: CENTER })),
  ], { size: 18, keepNext: true }));

  out.push(h2('2  선정 기업 10곳 — 지역별 현황', { pageBreak: true }));
  out.push(lead(S.listLead));
  // 양식의 '선정기업명' 라벨 칸(왼쪽, 전체 행 병합) + 구분·기업명·주요업종·산업·선정이유·연구방법
  const head = S.companies[0].map((t) => ({ t, fill: C.head, bold: true, align: CENTER }));
  const cRows = [[{ t: '선정기업명', rowSpan: S.companies.length, fill: C.label, bold: true, align: CENTER }, ...head], ...S.companies.slice(1)];
  out.push(tbl(cw([10, 6, 11, 13, 37, 23]), cRows, { size: 16, padH: 60 }));
  out.push(note('※ 부산·울산·경남 각 지역 기업을 최소 1개 이상 포함하여 총 10개 기업을 선정'));
  out.push(note(S.companiesNote));
  out.push(h3('자격·평판 점검 결과'));
  out.push(lead(S.repLead, { size: 18, after: 60 }));
  out.push(tbl(cw([12, 15, 19, 8, 7, 39]), S.rep, { header: true, labelCol: true, size: 16, padH: 60 }));
  out.push(note(S.repNote));
  out.push(h3('선정 조정'));
  S.adjust.forEach((t) => out.push(bullet(t)));

  out.push(h2('3  예비후보 6곳'));
  out.push(lead(S.reserveLead));
  out.push(tbl(cw([17, 27, 56]), S.reserves, { header: true, labelCol: true, size: 17 }));
  out.push(note(S.reserveNote));

  out.push(h2('4  수도권 대기업 비교군 10곳 (설문 비교용)', { pageBreak: true }));
  out.push(lead(S.compLead));
  out.push(p(S.compBody, { size: 18, keepNext: true }));
  out.push(tbl(cw([7, 19, 37, 37]), S.comp, { header: true, size: 16, align: AlignmentType.LEFT }));
  out.push(h3('공정한 비교를 위한 원칙'));
  S.compRules.forEach((t) => out.push(bullet(t)));

  out.push(p('위 내용을 바탕으로', { align: CENTER, before: 360, after: 0, keepNext: true }));
  out.push(p('「2026학년도 PNU Student Choice Awards(가장 일하고 싶은 지역기업 TOP10)」', { align: CENTER, after: 0, keepNext: true }));
  out.push(p('참가를 신청합니다.', { align: CENTER, after: 200, keepNext: true }));
  out.push(p(S.signDate, { align: CENTER, after: 120, keepNext: true }));
  out.push(p('성  명(팀장) :  정시윤          (서명)', { align: AlignmentType.RIGHT }));
  return out;
}

// ───────── 부록 ─────────
function appendix() {
  const A = DATA.app;
  const out = [fh1('부록 1  공통 평가의 판정 기준', { pageBreak: true })];
  A.intro.forEach((t) => out.push(bullet(t)));
  out.push(gap(4));
  out.push(tbl(cw([13, 29, 29, 29]), A.rubric, { header: true, labelCol: true, size: 16 }));
  out.push(h2('미확인 항목과 점수 범위'));
  out.push(lead(A.rangeLead));
  A.range.forEach((t) => out.push(bullet(t)));
  out.push(gap(4));
  out.push(tbl([W], [[{ fill: C.gray, t: A.example, size: 17 }]], { padV: 70, padH: 140 }));

  const P = A.process;
  out.push(fh1('부록 2  대상 기업 선정 과정', { pageBreak: true }));
  out.push(lead(P.lead));
  out.push(tbl(cw([15, 30, 55]), P.steps, { header: true, labelCol: true, size: 17 }));
  out.push(h3('선정하지 않은 기업과 사유 — 주최 측 참고목록 60행과 팀 후보'));
  out.push(p(P.listLead, { size: 18, keepNext: true }));
  const exRows = [['기업 (본점)', '선정하지 않은 사유']];
  P.groups.forEach((g) => {
    exRows.push([{ span: 2, t: g.title, fill: g.fill, bold: true, align: AlignmentType.LEFT, keepNext: true }]);
    g.rows.forEach((r) => exRows.push(r));
  });
  out.push(tbl(cw([22, 78]), exRows, { header: true, labelCol: true, size: 16, padH: 60 }));
  out.push(note(P.exNote));

  out.push(fh1('부록 3  주요 근거 자료', { pageBreak: true }));
  A.refIntro.forEach((t) => out.push(p(t, { size: 18 })));
  A.refs.forEach(([n, title, desc, url]) => {
    out.push(new Paragraph({
      spacing: { before: 50, after: 0, ...exact(17, 1.4) }, keepNext: true,
      children: [mk(`[${n}] `, { size: 17, bold: true }), mk(title, { size: 17, bold: true }), mk(`  ${desc}`, { size: 17 })],
    }));
    out.push(new Paragraph({ spacing: { after: 10, ...exact(14, 1.36) }, children: [mk(url, { size: 14, color: C.sub })] }));
  });
  return out;
}

// ───────── 문서 조립 ─────────
const doc = new Document({
  creator: '간판떼고',
  title: '2026학년도 PNU Student Choice Awards 연구계획서 — 간판떼고',
  styles: {
    default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { outlineLevel: 0 } },
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
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk('간판떼고 연구계획서', { size: 16, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children: [...summaryPage(), ...sec1(), ...sec2(), ...sec3(), ...sec4(), ...sec5(), ...appendix()],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length);
});
