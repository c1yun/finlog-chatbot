// 간판떼고 연구계획서(육하원칙 재구성본) 생성 스크립트
const fs = require('fs');
const path = require('path');
const {
  D, FONT, W, C, cw, p, bullet, h1, h2, h3, lead, note, gap, tbl, mk, exact,
} = require('./lib');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber,
  LevelFormat, VerticalAlign,
} = D;
const DATA = require('./content');

const OUT = process.argv[2] || path.join(__dirname, 'out.docx');
const CENTER = AlignmentType.CENTER;

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
  const out = [h1('Ⅰ. 팀 구성 및 기업선정', { pageBreak: true, tag: '| 누가 (Who)' })];
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
  const out = [h1('Ⅱ. 연구개요', { before: 300, tag: '| 무엇을 (What)' })];
  out.push(tbl(cw([14, 86]), DATA.s2.overview.map(([k, v]) => [{ t: k, fill: C.label, bold: true, align: CENTER }, { t: v, bold: k === '연구 주제' }]), { size: 19, padV: 60 }));
  out.push(gap(6));
  out.push(p(DATA.s2.body, { after: 100 }));
  out.push(tbl(cw([11, 17, 36, 14, 22]), DATA.s2.steps, { header: true, labelCol: true, size: 18 }));
  return out;
}

// ───────── Ⅲ. 연구배경 및 목적 (왜) ─────────
function sec3() {
  const out = [h1('Ⅲ. 연구배경 및 목적', { pageBreak: true, tag: '| 왜 (Why)' })];
  out.push(h2('1  연구배경 — 왜 이 연구가 필요한가', { before: 0 }));
  out.push(lead(DATA.s3.lead));
  out.push(tbl(cw([20, 80]), DATA.s3.problems, { labelCol: true, size: 18 }));
  out.push(gap(6));
  DATA.s3.after.forEach((t) => out.push(p(t)));
  out.push(tbl(cw([16, 21, 21, 21, 21]), DATA.s3.purposeMap.map((r, i) => r.map((c, j) => ({
    t: c, align: CENTER, bold: i === 0 || j === 0, fill: i === 0 ? C.head : j === 0 ? C.label : undefined,
  }))), { size: 17, padV: 45 }));
  out.push(note(DATA.s3.purposeNote));

  out.push(h2('2  연구 목적과 연구 질문'));
  out.push(lead(DATA.s3.purposeLead));
  out.push(tbl(cw([34, 38, 28]), DATA.s3.questions, { header: true, size: 18 }));
  out.push(note(DATA.s3.questionsNote));

  out.push(h2('3  심사기준과 연구의 연결'));
  out.push(lead(DATA.s3.criteriaLead));
  out.push(tbl(cw([27, 73]), DATA.s3.criteria, { header: true, labelCol: true, size: 18 }));
  out.push(note(DATA.s3.criteriaNote));
  return out;
}

// ───────── Ⅳ. 세부 내용 및 추진계획 (어떻게·언제) ─────────
function sec4() {
  const S = DATA.s4;
  const out = [h1('Ⅳ. 세부 내용 및 추진계획', { before: 360, tag: '| 어떻게 (How) · 언제 (When)' })];
  out.push(lead(S.lead));

  out.push(h2('1  활동별 육하원칙 한눈에 보기', { before: 60 }));
  out.push(tbl(cw([10, 22.5, 22.5, 22.5, 22.5]), S.matrix, { header: true, labelCol: true, size: 17, padV: 40, padH: 70 }));

  out.push(h2('2  기업 분석과 공통 평가 (①)'));
  out.push(lead(S.analysis.lead));
  out.push(h3('(1) 먼저 거른다 — 평판·결격 점검', { before: 40 }));
  out.push(p(S.analysis.gate.intro, { size: 18, after: 60 }));
  out.push(tbl(cw([9, 61, 30]), S.analysis.gate.table, { header: true, labelCol: true, size: 16 }));
  out.push(gap(4));
  S.analysis.gate.notes.forEach((t) => out.push(bullet(t, { size: 18 })));
  out.push(h3('(2) 무엇을 조사하나 — 7개 조사 묶음'));
  out.push(tbl(cw([16, 19, 43, 22]), S.analysis.bundles, { header: true, labelCol: true, size: 16 }));
  out.push(h3('(3) 어떻게 평가하나 — 6개 영역 100점 평가표'));
  out.push(tbl(cw([25, 9, 66]), S.analysis.rubric, { header: true, labelCol: true, size: 17 }));
  out.push(note(S.analysis.rubricNote));
  out.push(p(S.analysis.benchmark, { size: 18, after: 60 }));
  out.push(h3('(4) 검증 원칙'));
  S.analysis.principles.forEach((t) => out.push(bullet(t)));

  out.push(h2('3  블라인드 학생 설문 (②)'));
  out.push(lead(S.survey.lead));
  out.push(h3('(1) 누구에게 — 대상과 모집', { before: 40 }));
  S.survey.sample.forEach((t) => out.push(bullet(t)));
  out.push(h3('(2) 어떻게 — 설계 5단계'));
  out.push(tbl(cw([16, 84]), S.survey.design, { labelCol: true, size: 17 }));
  out.push(gap(6));
  out.push(tbl(cw([38, 34, 28]), S.survey.cardInfo, { header: true, size: 17 }));
  out.push(h3('(3) 분석과 연구 윤리'));
  S.survey.analysis.forEach((t) => out.push(bullet(t)));

  out.push(h2('4  인터뷰 (③)'));
  out.push(lead(S.interview.lead));
  out.push(tbl(cw([24, 14, 62]), S.interview.table, { header: true, labelCol: true, size: 17 }));
  out.push(gap(6));
  S.interview.bullets.forEach((t) => out.push(bullet(t)));

  out.push(h2('5  TOP3 선정 방법 (④)'));
  out.push(lead(S.top3.lead));
  out.push(tbl([W], [[{ fill: C.yellow, t: S.top3.formula, size: 19 }]], { padV: 80, padH: 160 }));
  out.push(gap(6));
  S.top3.rules.forEach((t) => out.push(bullet(t)));

  out.push(h2('6  개선 아이디어 — 전공별 직무 카드와 학생 사용 검증'));
  out.push(lead(S.improve.lead));
  out.push(tbl(cw([14, 86]), S.improve.steps, { labelCol: true, size: 17 }));

  out.push(h2('7  결과물과 8주 취업 준비 전략'));
  out.push(lead(S.outputs.lead));
  out.push(h3('(1) 최종 결과물 5종', { before: 40 }));
  out.push(tbl(cw([29, 71]), S.outputs.table, { header: true, labelCol: true, size: 17 }));
  out.push(h3('(2) 기업별 8주 취업 준비 전략'));
  out.push(tbl(cw([10, 16, 74]), S.outputs.weeks, { header: true, labelCol: true, size: 17 }));
  out.push(note(S.outputs.weeksNote));

  out.push(h2('8  기대 효과'));
  out.push(lead(S.effects.lead));
  out.push(tbl(cw([16, 84]), S.effects.table, { header: true, labelCol: true, size: 17 }));

  out.push(h2('9  추진 일정 — 언제', { pageBreak: true }));
  out.push(lead(S.schedule.lead, { after: 20 }));
  out.push(note(S.schedule.note, { before: 0, after: 60 }));
  out.push(gantt(S.schedule));

  out.push(h2('10  위험 요인과 대응 계획'));
  out.push(lead(S.risks.lead));
  out.push(tbl(cw([25, 50, 25]), S.risks.table, { header: true, labelCol: true, size: 17 }));
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
  const out = [h1('Ⅴ. 대상 기업 선정 기준 및 현황', { before: 360, tag: '| 어디서 (Where)' })];
  out.push(h2('1  선정 기준', { before: 0 }));
  out.push(lead(S.lead));
  out.push(tbl(cw([14, 33, 53]), S.criteria, { header: true, labelCol: true, size: 17 }));
  out.push(note(S.criteriaNote));
  out.push(h3('기업 선정'));
  out.push(tbl(cw([10, 8, 82]), S.selection.map(([r, n, names]) => [{ t: r, fill: C.label, bold: true, align: CENTER }, { t: n, align: CENTER, bold: true }, names]), { size: 18, keepNext: true }));

  out.push(h2('2  선정 기업 10곳 — 지역별 현황'));
  out.push(lead(S.listLead));
  out.push(tbl(cw([6, 13, 14, 41, 26]), S.companies, { header: true, size: 16, padH: 60 }));
  out.push(note(S.companiesNote));
  out.push(h3('자격·평판 점검 결과', { pageBreak: true }));
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
  const out = [h1('부록 1  공통 평가의 판정 기준', { pageBreak: true })];
  A.intro.forEach((t) => out.push(bullet(t)));
  out.push(gap(4));
  out.push(tbl(cw([13, 29, 29, 29]), A.rubric, { header: true, labelCol: true, size: 16 }));
  out.push(h2('미확인 항목과 점수 범위'));
  out.push(lead(A.rangeLead));
  A.range.forEach((t) => out.push(bullet(t)));
  out.push(gap(4));
  out.push(tbl([W], [[{ fill: C.gray, t: A.example, size: 17 }]], { padV: 70, padH: 140 }));

  const P = A.process;
  out.push(h1('부록 2  대상 기업 선정 과정', { pageBreak: true }));
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

  out.push(h1('부록 3  주요 근거 자료', { pageBreak: true }));
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
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk('간판떼고 연구계획서', { size: 16, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children: [...summaryPage(), ...sec1(), ...sec2(), ...sec3(), ...sec4(), ...sec5(), ...appendix()],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length);
});
