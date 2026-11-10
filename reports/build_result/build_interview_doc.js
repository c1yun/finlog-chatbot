// 간판떼고 인터뷰지 생성 — 인사팀 서면 질의, 인사담당자·현직자·전문가 질문지, 동의 안내, 기록지
// 입력: tool_meta.js(문안), interview_q.json(기업별 질문), report_meta.js(평판 판정)
// 사용: node build_interview_doc.js out.docx && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf
const fs = require('fs');
const path = require('path');
const { D, FONT, W, C, cw, p, bullet, h1, h2, h3, lead, note, gap, tbl, mk, exact } = require('./lib');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat } = D;
const T = require('./tool_meta');
const REP = require('./report_meta').rep;
const IQ = JSON.parse(fs.readFileSync(path.join(__dirname, 'interview_q.json'), 'utf-8'));

const OUT = process.argv[2] || path.join(__dirname, 'interview.docx');
const CENTER = AlignmentType.CENTER;
const ORDER = ['조광요턴', '동화엔텍', '태광후지킨', '파나시아', '송원산업', '지엠비코리아', '해성디에스', '넥센타이어', 'BHI', 'TKG태광'];
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const lab = (t, o = {}) => ({ t, fill: C.label, bold: true, align: CENTER, ...o });
const headc = (t, o = {}) => ({ t, fill: C.head, bold: true, align: CENTER, ...o });
const numbered = (arr, size = 18) => arr.map((t, i) => p(`${i + 1}. ${t}`, { size, after: 40, indent: { left: 300, hanging: 260 } }));

function cover() {
  const out = [];
  out.push(new Paragraph({ alignment: CENTER, spacing: { before: 400, after: 60, ...exact(34, 1.35) }, children: [mk('인터뷰지', { size: 34, bold: true, color: C.navy })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 300, ...exact(22, 1.4) }, children: [mk('2026학년도 PNU Student Choice Awards · 연구팀 간판떼고', { size: 22, color: C.sub })] }));
  out.push(tbl(cw([14, 86]), T.ivOverview.map(([k, v]) => [lab(k), v]), { size: 18, padV: 60 }));
  out.push(gap(8));
  out.push(h3('진행 원칙'));
  T.ivPrinciples.forEach((t) => out.push(bullet(t, { size: 17 })));
  return out;
}

function outreach() {
  const out = [h1('Ⅰ. 섭외와 동의', { pageBreak: true })];
  out.push(h2('1  인사팀 서면 질의 메일(기업마다 같은 틀, 질문은 기업별)', { before: 0 }));
  out.push(tbl([W], [[{ t: [`**제목** ${T.mail.subject}`, '', ...T.mail.body.slice(0, 3), '', '(기업별 질문 1~4 — Ⅱ장의 \'인사담당자\' 행)', '', ...T.mail.body.slice(3), '부산대학교 학생 연구팀 \'간판떼고\' 드림 (팀장 이메일)'], fill: C.gray }]], { size: 17, padV: 70, padH: 150 }));
  out.push(note('메일은 기업마다 따로 보내고, 보낸 날짜와 받는 주소(채용 공고·홈페이지에서 확인한 공식 연락처)를 기록지에 적는다. 같은 날 같은 틀로 보내 회신 조건을 맞춘다.'));
  out.push(h2('2  현직자 섭외 메시지'));
  out.push(tbl([W], [[{ t: T.outreach.staff, fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  out.push(h2('3  전문가 섭외 메시지'));
  out.push(tbl([W], [[{ t: T.outreach.expert, fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  out.push(h2('4  인터뷰 시작 전 안내와 동의(읽어 드리기)'));
  out.push(tbl([W], [[{ t: T.consent.map((x) => `- ${x}`), fill: C.yellow }]], { size: 17, padV: 60, padH: 150 }));
  return out;
}

function companyQuestions() {
  const out = [h1('Ⅱ. 기업별 질문', { pageBreak: true })];
  out.push(lead('결과보고서 기업별 분석 끝의 \'공개자료로 확인하지 못한 것\'과 같은 항목을 질문으로 풀었다. \'인사담당자\' 행은 서면 질의 메일의 질문 1~4와 같다. \'평판 확인\'은 평판 \'주의\' 기업에만 있으며, 출처를 밝히고 회사 입장을 묻는다.'));
  ORDER.forEach((k, i) => {
    const q = IQ[k];
    out.push(h3(`${NUM[i]} ${k}  (평판 ${REP[k]})`, { before: 80 }));
    const rows = [];
    (q.hr || []).forEach((x) => rows.push(['인사담당자', x]));
    (q.staff || []).forEach((x) => rows.push(['현직자', x]));
    (q.rep || []).forEach((x) => rows.push(['평판 확인', x]));
    out.push(tbl(cw([14, 86]), rows.map(([a, b], j) => [{ t: a, fill: a === '평판 확인' ? C.yellow : C.gray, bold: true, align: CENTER }, `${j + 1}. ${b}`]), { size: 16, padV: 20 }));
  });
  return out;
}

function common() {
  const out = [h1('Ⅲ. 공통 질문지', { pageBreak: true })];
  out.push(h2('1  인사담당자 인터뷰 공통 질문 6개', { before: 0 }));
  out.push(tbl(cw([24, 76]), [[headc('항목'), headc('질문')], ...T.common6.map(([k, q]) => [{ t: k, fill: C.gray, bold: true }, q])], { size: 17, padV: 40 }));
  out.push(h2('2  현직자 공통 질문 5개'));
  out.push(...numbered(T.staffCommon));
  out.push(note('기업별 현직자 질문은 Ⅱ장의 \'현직자\' 행을 함께 쓴다. 회사와 직군까지만 적고 연차·팀·성별은 적지 않는다.'));
  out.push(h2('3  전문가 자문 질문'));
  out.push(tbl([W], [[{ t: T.coi, fill: C.yellow }]], { size: 17, padV: 60, padH: 140 }));
  T.experts.forEach((e) => {
    out.push(h3(`${e.field} — ${e.role}`));
    out.push(...numbered(e.q, 17));
  });
  return out;
}

function logs() {
  const out = [h1('Ⅳ. 기록지', { pageBreak: true })];
  out.push(h2('1  연락·인터뷰 기록', { before: 0 }));
  const blank = (n, cols) => Array.from({ length: n }, () => cols.map(() => ' '));
  out.push(tbl(cw([16, 12, 13, 9, 22, 14, 14]), [T.logCols.map((c) => headc(c)), ...blank(7, T.logCols)], { size: 15, padV: 100 }));
  out.push(h2('2  인사팀 질의 발송·회신 기록'));
  const sendCols = ['기업', '받는 주소(출처)', '보낸 날', '회신 날', '답한 질문', '보고서 반영'];
  out.push(tbl(cw([14, 30, 11, 11, 18, 16]), [sendCols.map((c) => headc(c)), ...ORDER.map((k) => [{ t: k, bold: true }, ' ', ' ', ' ', ' ', ' '])], { size: 15, padV: 70 }));
  out.push(h2('3  기업별 예상 면접 질문(인터뷰 뒤 3개씩)'));
  out.push(tbl(cw([16, 84]), [[headc('기업'), headc('예상 면접 질문과 근거(누가, 언제 말했는지)')], ...ORDER.map((k) => [{ t: k, bold: true }, ' '])], { size: 15, padV: 70 }));
  out.push(note('기록지는 구글 시트 \'간판떼고 인터뷰 기록\'에 같은 열로 만들어 팀원이 함께 적는다. 녹음 파일과 원문 메모는 저장소에 올리지 않는다.'));
  return out;
}

const doc = new Document({
  creator: '간판떼고',
  title: '간판떼고 인터뷰지',
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
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk('간판떼고 인터뷰지', { size: 16, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children: [...cover(), ...outreach(), ...companyQuestions(), ...common(), ...logs()],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| 기업', Object.keys(IQ).length);
});
