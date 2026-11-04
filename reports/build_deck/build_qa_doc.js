// 발표 예상 질문과 답변(Word). qa.json(질문·30초 답변·근거·주의)을 읽어 만든다.
// 사용: node build_qa_doc.js out.docx [qa.json]
//       → python3 ../build_result/postprocess.py out.docx → python3 ../build_result/render_pdf.py out.docx out.pdf
// 표기: ［빈칸］은 분홍 바탕(설문·인사 질의 결과가 나온 뒤에만 채운다), [slide: id]는 파란 글씨, **굵게**.
const fs = require('fs');
const path = require('path');
const { D, FONT, C, cw, h1, tbl, mk, exact } = require('../build_result/lib');

const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat, ShadingType,
} = D;

const OUT = process.argv[2] || path.join(__dirname, 'qa.docx');
const SRC = process.argv[3] || path.join(__dirname, 'qa.json');
const QA = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

const CENTER = AlignmentType.CENTER;
const PINK = 'FDE9E7';
const ANSWER = 'FFF9E6';
const CAUTION = 'FBE5D6';
const BODY = 18;
const SMALL = 16;

// 문자열 → TextRun 배열
function qruns(text, o = {}) {
  const out = [];
  const base = { font: FONT, size: o.size || BODY, bold: !!o.bold, color: o.color };
  const re = /(［[^］]*］|\[slide: [^\]]+\]|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    const t = m[0];
    if (t.startsWith('［')) {
      out.push(new TextRun({ ...base, text: t, bold: true, color: C.red, shading: { type: ShadingType.CLEAR, color: 'auto', fill: PINK } }));
    } else if (t.startsWith('[slide')) {
      out.push(new TextRun({ ...base, text: t, color: C.blue }));
    } else {
      out.push(new TextRun({ ...base, text: t.slice(2, -2), bold: true }));
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out;
}

function para(text, o = {}) {
  return new Paragraph({
    children: qruns(text, o),
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 30, ...exact(o.size || BODY, o.mult || 1.45) },
    numbering: o.bullet ? { reference: o.inCell === false ? 'bullets' : 'cellbullets', level: 0 } : undefined,
    indent: o.indent,
    keepNext: o.keepNext,
    keepLines: true,
  });
}

const bullets = (arr, o = {}) => arr.map((t) => para(t, { ...o, bullet: true }));
const lab = (t, o = {}) => ({ t, fill: o.fill || C.label, bold: true, align: CENTER, size: 17, keepNext: o.keepNext });
const headc = (t) => ({ t, fill: C.head, bold: true, align: CENTER, size: 17 });
const section = (t, o = {}) => h1(t, { before: o.before ?? 320, pageBreak: o.pageBreak });

// ───────── 머리 ─────────
function cover() {
  return [
    new Paragraph({ alignment: CENTER, spacing: { after: 60, ...exact(32, 1.35) }, children: [mk(QA.title, { size: 32, bold: true, color: C.navy })] }),
    new Paragraph({ alignment: CENTER, spacing: { after: 40, ...exact(19, 1.45) }, children: [mk(QA.subtitle, { size: 19, color: C.navy })] }),
    new Paragraph({ alignment: CENTER, spacing: { after: 240, ...exact(16, 1.45) }, children: [mk(QA.meta, { size: 16, color: C.sub })] }),
    section('이 문서를 쓰는 법', { before: 0 }),
    ...QA.usage.map((t) => para(t, { bullet: true, inCell: false, after: 50 })),
    section('답할 때 지킬 표현', { before: 260 }),
    tbl(cw([18, 82]), [[headc('항목'), headc('이렇게 말한다')],
      ...QA.rules.map(([k, v]) => [lab(k), { paras: [para(v, { size: 17 })] }])], { padV: 40, padH: 90 }),
  ];
}

// ───────── 질문 한눈에 보기 ─────────
function overview() {
  const rows = [[headc('번호'), headc('심사기준'), headc('질문'), headc('먼저 띄울 슬라이드')]];
  QA.groups.forEach((g) => {
    g.items.forEach((it, i) => {
      const row = [{ t: it.id, align: CENTER, bold: true, size: 17 }];
      if (i === 0) row.push({ t: g.criterion, rowSpan: g.items.length, fill: C.gray, bold: true, align: CENTER, size: 17 });
      row.push({ paras: [para(it.q, { size: 17 })] });
      row.push({ t: it.slides.join(' · '), size: 16, color: C.blue });
      rows.push(row);
    });
  });
  return [section('질문 한눈에 보기', { pageBreak: true, before: 0 }), tbl(cw([7, 15, 56, 22]), rows, { padV: 36, padH: 80 })];
}

// ───────── 질문 묶음 ─────────
function block(it, gi) {
  const head = new Paragraph({
    keepNext: true,
    keepLines: true,
    spacing: { before: 260, after: 70, ...exact(22, 1.4) },
    children: [
      mk(`${it.id}  `, { size: 22, bold: true, color: C.navy }),
      mk(it.short, { size: 22, bold: true }),
      mk(`    ${QA.groups[gi].criterion} · 슬라이드 ${it.slides.join(' · ')}`, { size: 15, color: C.blue }),
    ],
  });
  const rows = [
    [lab('질문', { keepNext: true }), { paras: [para(it.q, { bold: true, keepNext: true })] }],
    [lab('30초 답변', { fill: C.yellow, keepNext: true }), { paras: [para(it.a, { size: 19, mult: 1.5, keepNext: true })], fill: ANSWER }],
  ];
  // 한 질문의 표가 쪽을 넘어가지 않도록 마지막 행(주의) 앞까지 다음 행과 붙인다
  const K = { keepNext: true };
  if (it.alts && it.alts.length) {
    rows.push([lab('결과별 문장', { fill: C.yellow, ...K }), { paras: it.alts.map(([when, say]) => para(`**${when}** → ${say}`, { bullet: true, size: 17, ...K })), fill: ANSWER }]);
  }
  if (it.more && it.more.length) rows.push([lab('꼬리 질문', K), { paras: bullets(it.more, { size: 17, ...K }) }]);
  rows.push([lab('근거', K), { paras: bullets(it.basis, { size: SMALL, ...K }) }]);
  rows.push([lab('주의', { fill: CAUTION }), { paras: bullets(it.caution, { size: SMALL }) }]);
  return [head, tbl(cw([13, 87]), rows, { padV: 45, padH: 90 })];
}

function groups() {
  const out = [];
  QA.groups.forEach((g, gi) => {
    out.push(section(`${gi + 1}. ${g.criterion}`, { pageBreak: gi === 0, before: gi === 0 ? 0 : 360 }));
    g.items.forEach((it) => out.push(...block(it, gi)));
  });
  return out;
}

// ───────── 채울 칸·점검 ─────────
function tail() {
  const rows = [[headc('칸'), headc('채울 값의 출처'), headc('시점')],
    ...QA.blanks.map(([a, b, c]) => [{ paras: [para(a, { size: 16 })] }, { paras: [para(b, { size: 16 })] }, { t: c, size: 16, align: CENTER }])];
  return [
    section('채울 칸 ［ ］ 목록', { pageBreak: true, before: 0 }),
    para('값이 들어오면 분홍 칸을 지우고 숫자만 넣는다. 가상 수치는 넣지 않는다. 같은 칸 이름은 결과보고서의 ［… 입력 예정］ 자리와 맞췄다.', { size: 17, color: C.sub, after: 80 }),
    tbl(cw([34, 46, 20]), rows, { padV: 36, padH: 80 }),
    section('발표 전 점검', { before: 300 }),
    ...QA.checklist.map((t) => para(t, { bullet: true, inCell: false, after: 50 })),
  ];
}

const doc = new Document({
  creator: '간판떼고',
  title: QA.title,
  styles: {
    default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: C.navy }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } },
      ] },
      { reference: 'cellbullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 180, hanging: 160 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1020, left: 1020, right: 1020, header: 567, footer: 510 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk(`${QA.title} · 2026. 11. 4. 수정`, { size: 15, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17 })] })] }) },
    children: [...cover(), ...overview(), ...groups(), ...tail()],
  }],
});

const nQ = QA.groups.reduce((s, g) => s + g.items.length, 0);
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| 질문', nQ);
});
