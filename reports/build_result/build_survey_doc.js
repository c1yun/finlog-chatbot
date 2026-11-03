// 간판떼고 설문조사지(인쇄본) 생성 — 구글 폼 배포본과 같은 문안·카드·배정을 읽는다
// 입력: ../survey/form_text.js(문항), ../survey/survey_doc_meta.js(설명), ../survey/spec.lock.json(배정·순서), cards_*.json
// 사용: node build_survey_doc.js out.docx && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf
const fs = require('fs');
const path = require('path');
const { D, FONT, W, C, cw, p, bullet, h1, h2, h3, note, gap, tbl, mk, exact } = require('./lib');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat } = D;

const T = require('../survey/form_text');
const M = require('../survey/survey_doc_meta');
const LOCK = JSON.parse(fs.readFileSync(path.join(__dirname, '../survey/spec.lock.json'), 'utf-8'));
const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '../survey/survey_spec.json'), 'utf-8'));
const REG = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards_regional.json'), 'utf-8'));
const MET = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards_metro.json'), 'utf-8'));
const OUT = process.argv[2] || path.join(__dirname, 'survey.docx');
const CENTER = AlignmentType.CENTER;
const FIELDS = ['직무와 업무', '고용형태와 요건', '확인된 보상', '근무·복지 조건', '사업과 경력 정보'];
const CIR = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳', '㉑'];
const fill = (s) => s.replace(/\{contact\}/g, '연구팀 이메일(폼 화면에 표시)').replace(/\{prize\}/g, SPEC.prize)
  .replace(/\{minutes\}/g, SPEC.minutes).replace(/\{deadline\}/g, SPEC.deadline).replace(/\{url\}/g, '(배포 링크)');
const opts = (arr, mark = {}) => arr.map((c, i) => `${CIR[i]} ${c}${mark[i] ? ` ${mark[i]}` : ''}`).join('  ');

const lab = (t, o = {}) => ({ t, fill: C.label, bold: true, align: CENTER, ...o });
const headc = (t, o = {}) => ({ t, fill: C.head, bold: true, align: CENTER, ...o });
const qTable = (rows) => tbl(cw([9, 45, 46]), [[headc('번호'), headc('문항'), headc('응답')], ...rows.map(([n, q, a]) => [{ t: n, align: CENTER, bold: true, fill: C.gray }, q, { t: a, size: 16 }])], { size: 17, padV: 40 });
const CARD = Object.fromEntries([...REG.map((c) => [c.code, c]), ...MET.cards.map((c) => [c.code, c])]);

function cover() {
  const out = [];
  out.push(new Paragraph({ alignment: CENTER, spacing: { before: 400, after: 60, ...exact(34, 1.35) }, children: [mk('설문조사지', { size: 34, bold: true, color: C.navy })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 80, ...exact(22, 1.4) }, children: [mk(`「${T.title}」 · 연구팀 간판떼고`, { size: 22, color: C.sub })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 300, ...exact(18, 1.4) }, children: [mk('2026학년도 PNU Student Choice Awards(가장 일하고 싶은 지역기업 TOP10)', { size: 18, color: C.sub })] }));
  out.push(tbl(cw([16, 84]), M.overview.map(([k, v]) => [lab(k), v.replace('{hash}', LOCK.spec_hash)]), { size: 18, padV: 60 }));
  out.push(gap(8));
  out.push(note('이 문서는 연구계획서 Ⅳ-3(학생 설문)을 실제 배포본으로 옮긴 것이다. 카드는 결과보고서의 기업별 사실 노트와 공식 채용 공고를 근거로 만들었다.'));
  return out;
}

function design() {
  const out = [h1('Ⅰ. 설계와 배정', { pageBreak: true })];
  out.push(tbl(cw([14, 86]), M.design.map(([k, v]) => [lab(k), v]), { size: 17, padV: 45 }));
  out.push(h3('4개 묶음'));
  out.push(tbl(cw([34, 33, 33]), M.cells.map((r, i) => r.map((c, j) => (i === 0 || j === 0 ? { t: c, fill: i === 0 ? C.head : C.label, bold: true, align: CENTER } : { t: c, align: CENTER }))), { size: 17, padV: 45 }));
  // 카드 순서
  out.push(h3('묶음별 카드 순서'));
  const A = LOCK.routes.find((r) => r.set === 'A').seq; const B = LOCK.routes.find((r) => r.set === 'B').seq;
  const cell = (code) => ({ t: `${code} ${LOCK.labels[code]}`, fill: code.startsWith('M') ? C.gray : undefined });
  out.push(tbl(cw([10, 45, 45]), [[headc('순서'), headc('A 세트 묶음(1·3)'), headc('B 세트 묶음(2·4)')],
    ...A.map((code, i) => [{ t: String(i + 1), align: CENTER, bold: true }, cell(code), cell(B[i])])], { size: 15, padV: 18 }));
  out.push(note('회색 칸은 수도권 대기업 카드다. 묶음 1·2는 기업명·근무지역을 보여 주고, 묶음 3·4는 가린다(카드 본문은 같다).'));
  // 생일 배정표
  out.push(h3('생일(일) → 묶음 배정표'));
  const S = Object.keys(LOCK.strata);
  const half = (from, to) => [[headc('일'), ...S.map((s) => headc(LOCK.strata[s].name))],
    ...Array.from({ length: to - from + 1 }, (_, k) => { const d = from + k; return [{ t: String(d), align: CENTER, bold: true }, ...S.map((s) => ({ t: `묶음 ${LOCK.dayRoute[s][d - 1]}`, align: CENTER }))]; })];
  const left = half(1, 16); const right = half(17, 31);
  right.push([{ t: '' }, ...S.map(() => ({ t: '' }))]);
  out.push(tbl(cw([6, 14, 14, 14, 4, 6, 14, 14, 14]), left.map((row, i) => [...row, { t: '' }, ...right[i]]), { size: 14, padV: 10 }));
  out.push(note('계열 안에서 묶음 인원이 5명 이상 벌어지면 밤에 배정표를 다시 나누고, 바꾼 시각과 새 배정을 응답 시트의 mapping_log에 남긴다.'));
  out.push(h3('제외 기준'));
  M.exclude.forEach((t) => out.push(bullet(t, { size: 17 })));
  out.push(h3('분석 계획'));
  M.analysis.forEach((t) => out.push(bullet(t, { size: 17 })));
  return out;
}

function survey() {
  const out = [h1('Ⅱ. 설문지 전문 (구글 폼 배포본)', { pageBreak: true })];
  out.push(h3('첫 화면 안내문', { before: 0 }));
  out.push(tbl([W], [[{ t: [`**${T.title}**`, ...T.intro.map((x) => `- ${fill(x)}`)], fill: C.gray }]], { size: 17, padV: 70, padH: 150 }));
  out.push(h3('선별 문항'));
  out.push(qTable(T.screen.map((s) => [s.key, s.title, opts(s.choices, Object.fromEntries(s.end.map((e) => [e, '→ 종료'])))])));
  const A = T.assign;
  out.push(h3('응답자 정보와 묶음 배정 (카드보다 먼저)'));
  out.push(qTable([
    ['C1', A.C1.title, `${opts(A.C1.choices)}  (인문·사회·상경·교육 / 공학 / 자연·예체능·기타로 나누어 다음 쪽의 생일 문항으로 이동)`],
    ['C2', A.C2.title, opts(A.C2.choices)],
    ['T0', `${A.T0.title} (${A.T0.help})`, '시각 입력(시:분)'],
    ['생일', `${A.birth.title} ${A.birth.help}`, '1~31 중 선택 → 배정표에 따라 묶음 1~4의 첫 카드로 이동'],
  ]));
  const PA = T.partA;
  out.push(h3('A. 카드별 지원 의향 (카드 15장, 한 쪽에 한 장)'));
  out.push(p(`${PA.lead} 쪽 제목은 '카드 n / 15'이고, 카드 본문 아래에 두 문항이 있다.`, { size: 17, keepNext: true }));
  out.push(qTable([
    ['A1', PA.A1.title, opts(PA.A1.choices)],
    ['A2', PA.A2.title, `${opts([...PA.A2.base, ...PA.A2.openExtra])}  (⑥ ⑦은 기업명·근무지역을 보여 주는 묶음 1·2에만 있다)`],
    ['주의', `(8번째 카드 뒤, 한 쪽) ${PA.AC.title}`, `${opts(PA.AC.choices)}  (③이 아니면 분석 제외)`],
  ]));
  const PB = T.partB;
  out.push(h3('B. 가림 점검 (가린 묶음 3·4만)'));
  out.push(p(PB.lead, { size: 17, keepNext: true }));
  out.push(qTable([
    ['B1', PB.B1.title, `카드 1~15 각각(쪽 제목 '카드 n · 직무 라벨'): ${opts(PB.B1.cols)}`],
    ['B2', `${PB.B2.title} (${PB.B2.help})`, '자유 응답(선택)'],
    ['B3', PB.B3.title, opts(PB.B3.choices)],
  ]));
  const PC = T.partC;
  out.push(h3('C. 희망 진로와 필요한 정보 (모든 묶음)'));
  out.push(qTable([
    ['C3', PC.C3.title, opts(PC.C3.choices)],
    ['C4', PC.C4.title, opts(PC.C4.choices)],
    ['C5', PC.C5.title, `${PC.C5.rows.join(' / ')} — 각 1~5점`],
    ['C6', PC.C6.title, `${opts(PC.C6.choices)}  ⑨ 기타(직접 입력)`],
    ['C7', PC.C7.title, opts(PC.C7.choices)],
  ]));
  const PD = T.partD;
  out.push(h3('D. 카드의 실제 기업과 근무지역 공개 후 (모든 묶음)'));
  out.push(p(`${PD.lead} 화면에 카드 20장의 직무 라벨·기업명·근무지역 목록을 보여 준다.`, { size: 17, keepNext: true }));
  out.push(qTable([
    ['D1', PD.D1.title, `카드 20장의 기업 각각(복수 선택), '${PD.D1.none}'`],
    ['D2', PD.D2.title, '지역기업 10곳 각각 1~5점'],
    ['D3', `${PD.D3.title} (${PD.D3.help})`, '자유 응답(선택)'],
  ]));
  out.push(h3('마침 화면'));
  out.push(tbl([W], [[{ t: [T.closing, '', '완료코드: (배포 화면에 표시)', `${SPEC.prize} 응모: (추첨 폼 링크, 완료코드가 미리 채워짐)`], fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  out.push(h3('선별에서 끝난 응답자 화면'));
  out.push(tbl([W], [[{ t: [`**${T.end.pageTitle}**`, T.end.help], fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  return out;
}

function cardTable(cd) {
  const title = cd.set ? `${cd.code} · ${cd.set}세트 · ${cd.label}` : `${cd.code} · ${cd.label}`;
  const rows = [
    [{ t: `**${title}**`, span: 3, fill: C.title, align: AlignmentType.LEFT }],
    [{ t: '기업·근무지역', fill: C.label, bold: true, align: CENTER }, { t: `**보여 주는 묶음** ${cd.open.company} · ${cd.open.region}` }, { t: '**가린 묶음** 비공개 · 비공개' }],
    ...FIELDS.map((f) => [{ t: f, fill: C.gray, bold: true, align: CENTER }, { t: cd.fields[f] || '공개 정보 없음', span: 2 }]),
    [{ t: '근거', align: CENTER, size: 14, color: C.sub }, { t: `${cd.basis}${cd.url ? ` ${cd.url}` : ''}${cd.checked ? ` (확인 ${cd.checked})` : ''}`, span: 2, size: 14, color: C.sub }],
  ];
  return [tbl(cw([18, 41, 41]), rows, { size: 16, padV: 36, keepNext: true }), gap(8)];
}
function cards() {
  const out = [h1('Ⅲ. 설문 카드 20장', { pageBreak: true })];
  out.push(p('카드마다 같은 틀(기업·근무지역 + 5개 항목)과 비슷한 분량으로 썼다. 두 조건의 카드는 기업명·근무지역 줄만 다르다. 고유 제품명·고객사명·순위 문구는 일반 설명으로 바꿨고, 매출·직원 수는 구간으로 적었으며, 확인되지 않은 정보는 \'공개 정보 없음\'으로 적었다. \'근거\' 줄은 진행자용이며 설문 화면에 옮기지 않는다.', { size: 17 }));
  out.push(h2('지역기업 카드 10장 (R01~R10, 모든 응답자)', { before: 100 }));
  REG.forEach((cd) => out.push(...cardTable(cd)));
  out.push(h2('수도권 대기업 카드 10장 (M01~M10, A·B 세트 중 하나)', { pageBreak: true, before: 0 }));
  if (MET.setNote) out.push(p(`**세트 구성** ${MET.setNote}`, { size: 17 }));
  MET.cards.forEach((cd) => out.push(...cardTable(cd)));
  return out;
}

function recruit() {
  const out = [h1('Ⅳ. 모집 글과 추첨', { pageBreak: true })];
  const R = T.recruit;
  out.push(h3('에브리타임 게시글', { before: 0 }));
  out.push(tbl([W], [[{ t: [`**${fill(R.everytime.title)}**`, '', ...R.everytime.body.map(fill)], fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  out.push(h3('학과 단톡방'));
  out.push(tbl([W], [[{ t: R.kakao.body.map(fill), fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  out.push(h3('SNS 스토리(이미지 + QR)'));
  out.push(tbl([W], [[{ t: R.story.body.map(fill), fill: C.gray }]], { size: 17, padV: 60, padH: 150 }));
  const L = T.lottery;
  out.push(h3('추첨 응모 양식 (설문과 분리)'));
  out.push(qTable([
    ['L1', L.code, '설문 완료 화면에서 넘어오면 미리 채워짐(코드가 맞아야 제출 가능)'],
    ['L2', L.phone, '010-1234-5678 형식'],
    ['L3', L.consent.title, L.consent.choices[0]],
  ]));
  out.push(note(`${L.description.join(' ')} 추첨 응모 시트는 데이터 분석을 하지 않는 팀원 한 명이 관리하고, 발송이 끝나면 삭제한다.`));
  return out;
}

const doc = new Document({
  creator: '간판떼고',
  title: '간판떼고 설문조사지',
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
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [mk('간판떼고 설문조사지', { size: 16, color: C.sub })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 })] })] }) },
    children: [...cover(), ...design(), ...survey(), ...cards(), ...recruit()],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| 해시', LOCK.spec_hash);
});
