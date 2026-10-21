// 연구계획서 docx 생성용 공통 헬퍼
const D = require('docx');
const {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  ShadingType, VerticalAlign, HeadingLevel, TableLayoutType, PageBreak,
} = D;

const FONT = '맑은 고딕';
const W = 9866; // A4(11906) - 좌우 여백 1020*2

const C = {
  navy: '1F3864', blue: '2F5597', sub: '595959', red: 'C00000',
  head: 'D9E2F3', label: 'DEEAF6', title: 'B4C6E7',
  line: 'A6A6A6', yellow: 'FFF2CC', gray: 'F2F2F2', bar: '8EAADB', star: 'F4B183',
};

// 줄 간격 고정값(exact): 글꼴이 바뀌어도(맑은 고딕↔대체 글꼴) 쪽 나눔이 같도록
function exact(sizeHalf, mult) {
  return { line: Math.round((sizeHalf / 2) * mult * 20), lineRule: D.LineRuleType.EXACT };
}

// 비율 배열을 W(또는 total)에 정확히 맞춘 DXA 폭으로 변환
function cw(arr, total = W) {
  const s = arr.reduce((a, b) => a + b, 0);
  const res = arr.map((x) => Math.floor((x * total) / s));
  res[res.length - 1] += total - res.reduce((a, b) => a + b, 0);
  return res;
}

function mk(text, o) {
  return new TextRun({
    text, font: FONT, size: o.size || 20, bold: !!o.bold, italics: !!o.italics,
    color: o.color || undefined,
  });
}

// **굵게**, {{파란 굵게}} 마크업을 TextRun 배열로 변환
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\{\{[^}]+\}\})/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(mk(text.slice(last, m.index), base));
    const t = m[0];
    if (t.startsWith('**')) out.push(mk(t.slice(2, -2), { ...base, bold: true }));
    else out.push(mk(t.slice(2, -2), { ...base, bold: true, color: C.blue }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(mk(text.slice(last), base));
  return out;
}

function p(text, o = {}) {
  return new Paragraph({
    children: runs(text, { size: o.size, bold: o.bold, color: o.color }),
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 80, ...exact(o.size || 20, 1.5) },
    indent: o.indent,
    keepNext: o.keepNext,
    keepLines: true,
    numbering: o.bullet !== undefined ? { reference: o.ref || 'bullets', level: o.bullet } : undefined,
  });
}

const bullet = (text, o = {}) => p(text, { ...o, bullet: o.level ?? 0, after: o.after ?? 50 });

function h1(text, o = {}) {
  const kids = [mk(text, { size: 28, bold: true, color: C.navy })];
  if (o.tag) kids.push(mk(`   ${o.tag}`, { size: 19, bold: true, color: C.blue }));
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: kids,
    spacing: { before: o.before ?? 0, after: 100, ...exact(28, 1.4) },
    keepNext: true,
    pageBreakBefore: !!o.pageBreak,
  });
}

function h2(text, o = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [mk(text, { size: 23, bold: true })],
    spacing: { before: o.before ?? 220, after: 50, ...exact(23, 1.45) },
    keepNext: true,
    pageBreakBefore: !!o.pageBreak,
  });
}

function h3(text, o = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [mk(text, { size: 21, bold: true })],
    spacing: { before: o.before ?? 140, after: 30, ...exact(21, 1.45) },
    keepNext: true,
    pageBreakBefore: !!o.pageBreak,
  });
}

// 각 절의 첫 줄 요지 문장(파란 굵은 글씨)
const lead = (text, o = {}) => p(text, { bold: true, color: C.blue, after: o.after ?? 100, keepNext: true, size: o.size });
const note = (text, o = {}) => p(text, { size: 17, color: C.sub, before: o.before ?? 40, after: o.after ?? 60 });
const gap = (pt = 4) => new Paragraph({ children: [], spacing: { before: 0, after: 0, line: pt * 20, lineRule: D.LineRuleType.EXACT } });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const LINE = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

// 셀 내용: 문자열 또는 문자열 배열. '- '로 시작하면 셀 안 글머리표
function cellParas(t, o) {
  const arr = Array.isArray(t) ? t : [t];
  return arr.map((s) => {
    const isB = typeof s === 'string' && s.startsWith('- ');
    const text = isB ? s.slice(2) : s;
    return new Paragraph({
      children: runs(text, { size: o.size || 18, bold: o.bold, color: o.color }),
      alignment: isB ? AlignmentType.LEFT : o.align,
      spacing: { before: 0, after: o.pAfter ?? 20, ...exact(o.size || 18, o.mult || 1.36) },
      numbering: isB ? { reference: 'cellbullets', level: 0 } : undefined,
      keepNext: o.keepNext,
    });
  });
}

/**
 * 표 생성. rows: 행 배열, 각 행은 셀 배열.
 * 셀: 문자열 | { t, fill, bold, align, span, rowSpan, size, color, v, noBorder }
 * o.header: 첫 행을 머리글(파란 배경·굵게·가운데)로, o.labelCol: 첫 열을 라벨 열로
 */
function tbl(widths, rows, o = {}) {
  const occupied = new Array(widths.length).fill(0);
  const total = widths.reduce((a, b) => a + b, 0);
  const borders = o.noBorder
    ? { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }
    : { top: LINE, bottom: LINE, left: LINE, right: LINE, insideHorizontal: LINE, insideVertical: LINE };
  const trs = rows.map((row, ri) => {
    const isHead = o.header && ri === 0;
    let ci = 0;
    const cells = [];
    row.forEach((spec, k) => {
      while (ci < widths.length && occupied[ci] > 0) ci += 1;
      const s = typeof spec === 'object' && !Array.isArray(spec) ? spec : { t: spec };
      const span = s.span || 1;
      const width = widths.slice(ci, ci + span).reduce((a, b) => a + b, 0);
      const isLabel = !isHead && o.labelCol && k === 0 && ci === 0;
      const fill = s.fill || (isHead ? C.head : isLabel ? C.label : undefined);
      const bold = s.bold ?? (isHead || isLabel);
      const align = s.align || (isHead || isLabel ? AlignmentType.CENTER : o.align || AlignmentType.LEFT);
      cells.push(new TableCell({
        children: s.paras || cellParas(s.t ?? '', { size: s.size || o.size, bold, color: s.color, align, line: o.line, pAfter: o.pAfter, keepNext: s.keepNext ?? o.keepNext }),
        width: { size: width, type: WidthType.DXA },
        columnSpan: span > 1 ? span : undefined,
        rowSpan: s.rowSpan && s.rowSpan > 1 ? s.rowSpan : undefined,
        shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
        verticalAlign: s.v || o.v || VerticalAlign.CENTER,
        margins: { top: o.padV ?? 50, bottom: o.padV ?? 50, left: o.padH ?? 90, right: o.padH ?? 90 },
        borders: s.noBorder ? { top: NONE, bottom: NONE, left: NONE, right: NONE } : undefined,
      }));
      if (s.rowSpan && s.rowSpan > 1) {
        for (let j = ci; j < ci + span; j += 1) occupied[j] = s.rowSpan; // 이번 행 포함
      }
      ci += span;
    });
    for (let j = 0; j < occupied.length; j += 1) if (occupied[j] > 0) occupied[j] -= 1;
    return new TableRow({ children: cells, cantSplit: o.cantSplit !== false, tableHeader: isHead });
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows: trs,
  });
}

module.exports = { exact, D, FONT, W, C, cw, runs, p, bullet, h1, h2, h3, lead, note, gap, pageBreak, tbl, mk, NONE, LINE };
