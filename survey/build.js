// 부산은행 모바일뱅킹 경쟁력 강화 조사 설문지 생성 스크립트 (docx-js)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType, PageBreak, ShadingType, VerticalAlign, Footer,
  PageNumber, HeadingLevel,
} = require('docx');

const OUT = process.argv[2] || path.join(__dirname, '부산은행_모바일뱅킹_설문지_v3.docx');

const FONT = '맑은 고딕';
const CIRC = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳',
  '㉑','㉒','㉓','㉔','㉕','㉖','㉗','㉘','㉙','㉚','㉛','㉜','㉝','㉞','㉟'];
const TOTAL = 9640; // 본문 폭(DXA) = A4 11906 - 좌우 여백 1133*2
const NOB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NOB, bottom: NOB, left: NOB, right: NOB, insideHorizontal: NOB, insideVertical: NOB };
const THIN = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const THIN_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN, insideHorizontal: THIN, insideVertical: THIN };
const CELL_MARGIN = { top: 25, bottom: 25, left: 70, right: 70 };

// ---------- 기본 요소 ----------
function run(t, o = {}) {
  return new TextRun({ text: t, font: FONT, size: o.size || 20, bold: !!o.bold, color: o.color, italics: !!o.italics });
}
function P(children, o = {}) {
  return new Paragraph({
    children, alignment: o.align, keepNext: !!o.keepNext, keepLines: true,
    spacing: { before: o.before ?? 0, after: o.after ?? 80, line: o.line ?? 276 },
    indent: o.indent, shading: o.shading, border: o.border,
  });
}
const T = (t, o = {}) => P([run(t, o)], o);
const BLANK = (o = {}) => P([run('', o)], { after: o.after ?? 0 });

function partTitle(t) {
  return P([run(t, { bold: true, size: 26, color: '1F3864' })], {
    before: 240, after: 120, keepNext: true,
    shading: { type: ShadingType.CLEAR, fill: 'E8EEF7', color: 'auto' },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1F3864', space: 2 } },
  });
}
function subTitle(t) {
  return P([run(t, { bold: true, size: 22, color: '1F3864' })], { before: 180, after: 60, keepNext: true });
}
function note(t) {
  return P([run(t, { size: 18, color: '555555' })], { after: 60, keepNext: true });
}
function Q(num, t, extra) {
  const children = [run(num + '. ', { bold: true }), run(t)];
  if (extra) children.push(run(' ' + extra, { size: 18, color: '555555' }));
  return P(children, { before: 140, after: 60, keepNext: true });
}

// 보기 표(테두리 없음). cols: 열 수, start: 번호 시작 인덱스(0부터)
function opts(list, cols, start = 0) {
  const w = Math.floor(TOTAL / cols);
  const widths = Array(cols).fill(w);
  widths[cols - 1] = TOTAL - w * (cols - 1);
  const rows = [];
  for (let i = 0; i < list.length; i += cols) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const idx = i + c;
      const label = idx < list.length ? CIRC[start + idx] + ' ' + list[idx] : '';
      cells.push(new TableCell({
        width: { size: widths[c], type: WidthType.DXA }, borders: NO_BORDERS, margins: CELL_MARGIN,
        children: [P([run(label)], { after: 0, keepNext: true })],
      }));
    }
    rows.push(new TableRow({ children: cells, cantSplit: true }));
  }
  return new Table({ width: { size: TOTAL, type: WidthType.DXA }, columnWidths: widths, borders: NO_BORDERS, rows });
}
// 보기 그룹 라벨([온라인] 등)
function groupLabel(t) {
  return P([run(t, { bold: true, size: 19, color: '1F3864' })], { before: 40, after: 20, keepNext: true });
}
// 순위 기입란
function rank(labels) {
  const parts = [];
  labels.forEach((l, i) => {
    if (i) parts.push(run('      '));
    parts.push(run(l + ': ', { bold: true }));
    parts.push(run('________'));
  });
  return P(parts, { before: 60, after: 120, indent: { left: 300 } });
}
// 빈칸 기입 표(항목 ____)
function blanks(items, cols = 3) {
  const w = Math.floor(TOTAL / cols);
  const widths = Array(cols).fill(w);
  widths[cols - 1] = TOTAL - w * (cols - 1);
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const idx = i + c;
      const label = idx < items.length ? items[idx] + '  ______' : '';
      cells.push(new TableCell({
        width: { size: widths[c], type: WidthType.DXA }, borders: NO_BORDERS, margins: CELL_MARGIN,
        children: [P([run(label)], { after: 0, keepNext: true })],
      }));
    }
    rows.push(new TableRow({ children: cells, cantSplit: true }));
  }
  return new Table({ width: { size: TOTAL, type: WidthType.DXA }, columnWidths: widths, borders: NO_BORDERS, rows });
}
// 7점 척도 표
function likert(rows, extraCol) {
  const labelW = 3700, extraW = extraCol ? 1300 : 0;
  const scaleW = Math.floor((TOTAL - labelW - extraW) / 7);
  const widths = [labelW, ...Array(7).fill(scaleW)];
  if (extraCol) widths.push(TOTAL - labelW - scaleW * 7);
  else widths[7] = TOTAL - labelW - scaleW * 6;
  const cell = (t, w, o = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: THIN_BORDERS, margins: CELL_MARGIN, verticalAlign: VerticalAlign.CENTER,
    shading: o.head ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined,
    children: [P([run(t, { bold: !!o.head, size: 19 })], { after: 0, align: o.left ? AlignmentType.LEFT : AlignmentType.CENTER })],
  });
  const head = ['평가 항목', '1', '2', '3', '4', '5', '6', '7'];
  if (extraCol) head.push(extraCol);
  const trs = [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, widths[i], { head: true, left: i === 0 })) })];
  rows.forEach(r => {
    const cs = [cell(r, widths[0], { left: true })];
    for (let i = 1; i <= 7; i++) cs.push(cell('○', widths[i]));
    if (extraCol) cs.push(cell('○', widths[8]));
    trs.push(new TableRow({ cantSplit: true, children: cs }));
  });
  return new Table({ width: { size: TOTAL, type: WidthType.DXA }, columnWidths: widths, borders: THIN_BORDERS, rows: trs });
}
// 일반 표(테두리 있음)
function gridTable(widths, rowsData, opt = {}) {
  const cell = (t, w, o = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: THIN_BORDERS, margins: CELL_MARGIN, verticalAlign: VerticalAlign.CENTER,
    rowSpan: o.rowSpan, shading: o.head ? { type: ShadingType.CLEAR, fill: 'E8EEF7', color: 'auto' } : undefined,
    children: (Array.isArray(t) ? t : [t]).map(line => P([run(line, { bold: !!o.head || !!o.bold, size: o.size || opt.fontSize || 19 })], { after: 0, align: o.center ? AlignmentType.CENTER : AlignmentType.LEFT })),
  });
  const trs = rowsData.map((r, ri) => new TableRow({
    cantSplit: true, tableHeader: ri === 0 && !!opt.header,
    children: r.filter(c => c !== null).map(c => cell(c.t, widths[c.col], { head: ri === 0 && !!opt.header, bold: c.bold, rowSpan: c.rowSpan, center: c.center, size: c.size })),
  }));
  return new Table({ width: { size: TOTAL, type: WidthType.DXA }, columnWidths: widths, borders: THIN_BORDERS, rows: trs });
}
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ---------- 보기 목록(여러 문항에서 공유) ----------
const BANKS = ['부산은행', '국민은행', '신한은행', '하나은행', '우리은행', 'NH농협은행', '카카오뱅크', '토스뱅크',
  '케이뱅크', 'IBK기업은행', '경남은행', 'iM뱅크', '지역 농·축협', '수협은행·지역 수협', '새마을금고', '신협',
  '우체국', '저축은행', '증권회사(          )', '보험회사(          )', '기타 금융기관(          )'];
const APPS = ['부산은행 모바일뱅킹', '토스', '카카오뱅크', 'KB스타뱅킹', '신한 SOL뱅크', '하나원큐', '우리WON뱅킹',
  'NH올원뱅크·NH스마트뱅킹', '케이뱅크', 'i-ONE Bank(기업은행)', '경남은행 모바일뱅킹', 'iM뱅크', '카카오페이', '네이버페이',
  '증권회사 앱(          )', '카드회사 앱(          )', '기타 금융 앱(          )'];
const TASKS = ['계좌·잔액·거래내역 조회', '이체·송금', '결제·공과금 납부', '예금·적금 가입 또는 관리', '대출 조회·신청·상환',
  '주식·펀드 등 투자', '여러 금융기관의 자산·소비내역 통합관리', '환전·외화 업무', '혜택·이벤트 확인 또는 참여', '기타(          )'];
const DAYS = ['0일', '1~3일', '4~7일', '8~15일', '16~23일', '24~30일', '기억나지 않음'];
const MONEY = ['10만원 미만', '10만원~30만원 미만', '30만원~50만원 미만', '50만원~100만원 미만', '100만원~200만원 미만', '200만원 이상', '잘 모르겠음'];
const REASONS_KEEP = ['급여·용돈 계좌나 자동이체가 연결되어 있어서', '오래 사용해서 익숙해서', '화면 구성과 메뉴가 이해하기 쉬워서',
  '로그인·본인확인·거래인증이 간편해서', '이체 과정이 간편해서', '처리 속도가 빨라서', '접속·거래 오류 없이 안정적이어서',
  '자산·개인정보 보호를 신뢰해서', '금리·수수료·할인·적립 혜택이 유용해서', '여러 금융기관 계좌·자산을 한곳에서 관리할 수 있어서',
  '문제 발생 시 안내·상담을 받기 쉬워서', '필요한 금융상품·기능이 있어서', '기타(          )', '특별한 장점은 없지만 대안이 없어서'];
const FACTORS = ['첫 화면을 이해하고 필요한 메뉴를 빠르게 찾을 수 있는 것', '로그인·본인확인·거래인증 절차가 간편한 것',
  '이체·송금 과정이 간편한 것', '앱 실행·조회·이체 등 처리 속도가 빠른 것', '접속 실패·앱 종료·거래 오류 없이 안정적인 것',
  '자산과 개인정보가 안전하게 보호된다고 믿을 수 있는 것', '수수료·금리 우대, 할인·적립 등 유용한 혜택이 있는 것',
  '여러 금융기관의 계좌·자산·소비내역을 한곳에서 관리할 수 있는 것', '문제 발생 시 안내를 찾거나 상담을 받기 쉬운 것',
  '예·적금, 대출, 투자 등 금융상품과 기능이 다양한 것', '지역 생활과 연계된 혜택·정보가 있는 것', '기타(          )'];
const AWARE_ON = ['포털 검색·블로그', '앱스토어 소개·평점·리뷰', '유튜브', '인스타그램·틱톡 등 SNS', '온라인 커뮤니티',
  '이용 중인 금융 앱·홈페이지의 안내·푸시 알림', '온라인 배너·동영상 광고', '금융상품 비교 서비스'];
const AWARE_OFF = ['은행 창구·계좌 개설 시 안내', '은행 직원·영업점 안내물', 'TV·옥외·교통 광고', '학교·직장 안내(등록금·급여 계좌 등)',
  '가족·지인', '신문·잡지 기사', '부산 지역 행사·캠퍼스 홍보', '기타(          )', '알게 된 경로 없음(처음 들어봄)'];

// ---------- 문서 내용 ----------
const children = [];
const add = (...els) => els.forEach(e => children.push(e));

// === 표지: 조사 개요와 조사영역 ===
add(
  P([run('부산은행 모바일뱅킹 경쟁력 강화 조사', { bold: true, size: 36, color: '1F3864' })], { align: AlignmentType.CENTER, before: 60, after: 40 }),
  P([run('조사영역과 설문지', { bold: true, size: 28, color: '1F3864' })], { align: AlignmentType.CENTER, after: 80 }),
  P([run('글로벌시장조사론 1조 | 팀장 이메일: leesooyeon1337@naver.com | 참여팀원: 이수연(팀장) · 안명기 · 마가심 · 정시윤', { size: 20, color: '555555' })], { align: AlignmentType.CENTER, after: 160 }),
);
add(subTitle('1. 조사 개요'));
add(gridTable([1700, 7940], [
  [{ col: 0, t: '조사주제', bold: true }, { col: 1, t: '부산은행 모바일뱅킹 플랫폼의 핀테크 대비 경쟁력 강화 방안 도출을 위한 조사' }],
  [{ col: 0, t: '조사목적', bold: true }, { col: 1, t: '소비자의 금융서비스 이용행태와 부산은행·경쟁 금융 앱에 대한 인식·평가를 파악하여, 부산은행 모바일뱅킹의 이용 확대를 위한 개선 우선순위와 차별화 방향을 도출한다.' }],
  [{ col: 0, t: '조사대상', bold: true }, { col: 1, t: '부산에 거주하거나 부산 소재 학교·직장에 다니는 만 19세 이상 성인 중 최근 3개월간 금융 앱 이용 경험자' }],
  [{ col: 0, t: '비교 대상', bold: true }, { col: 1, t: '토스(핀테크 플랫폼), 카카오뱅크(인터넷전문은행)' }],
  [{ col: 0, t: '응답 방식', bold: true }, { col: 1, t: '모든 문항은 객관식 보기 선택 또는 7점 척도로 응답한다. 순위 문항은 보기 번호를 기입한다. 소요 시간 약 15~20분.' }],
]));
add(BLANK({ after: 120 }));
add(subTitle('2. 조사영역(대분류 → 세부 조사항목)'));
const AREA_W = [1900, 4740, 1100, 1900];
add(gridTable(AREA_W, [
  [{ col: 0, t: '대분류' }, { col: 1, t: '세부 조사항목' }, { col: 2, t: '문항', center: true }, { col: 3, t: '작성 가이드 범주' }],
  [{ col: 0, t: 'Ⅰ 금융서비스 이용 일반현황', rowSpan: 3, bold: true }, { col: 1, t: '1) 금융기관 이용현황: 주 이용 금융기관 순위, 이용 이유, 부산은행 계좌 보유' }, { col: 2, t: '문1~1-2', center: true }, { col: 3, t: '1 소비 일반현황', rowSpan: 3 }],
  [{ col: 1, t: '2) 금융거래 빈도와 금액: 월 거래 일수, 월평균 거래 금액' }, { col: 2, t: '문2~2-1', center: true }],
  [{ col: 1, t: '3) 금융 앱 이용현황: 이용 앱 순위, 앱별 이용 빈도' }, { col: 2, t: '문3~3-1', center: true }],
  [{ col: 0, t: 'Ⅱ 이용 금융서비스와 이용경로', rowSpan: 2, bold: true }, { col: 1, t: '1) 이용 금융서비스: 주요 금융업무, 주 이용 앱에서 이용한 금융기관과 기능' }, { col: 2, t: '문4~4-1', center: true }, { col: 3, t: '2 이용 제품(서비스)' }],
  [{ col: 1, t: '2) 금융업무 이용채널: 온·오프라인 채널 순위, 채널별 용도, 채널 선택 이유' }, { col: 2, t: '문5~5-3', center: true }, { col: 3, t: '5 이용 경로' }],
  [{ col: 0, t: 'Ⅲ 부산은행 모바일뱅킹 인식과 이용경험', rowSpan: 4, bold: true }, { col: 1, t: '1) 인지도·이미지·광고 접촉: 인지 수준, 인지 경로, 이미지, 알고 있는 기능, 광고 접촉 시 이용 욕구와 실제 연결' }, { col: 2, t: '문6~7-5', center: true }, { col: 3, t: '3 브랜드 인식 · 8 브랜드 마케팅 현황' }],
  [{ col: 1, t: '2) 이용경험: 이용 상태, 최초 이용 계기, 이용 기능, 이용 빈도·금액, 계속 이용 이유, 불편 경험' }, { col: 2, t: '문7~8-6', center: true }, { col: 3, t: '4 브랜드 이용경험·이유' }],
  [{ col: 1, t: '3) 미이용·중단 이유' }, { col: 2, t: '문8', center: true }, { col: 3, t: '4 비이용 요인' }],
  [{ col: 1, t: '4) 주 이용 앱 변경과 전환: 변경 경험·계기, 부산은행 계좌 업무 처리 경로' }, { col: 2, t: '문9~10-2', center: true }, { col: 3, t: '6 브랜드 충성도' }],
  [{ col: 0, t: 'Ⅳ 경쟁 플랫폼(토스·카카오뱅크) 비교 평가', rowSpan: 3, bold: true }, { col: 1, t: '1) 경쟁 앱 이용현황: 이용 앱, 이용 이유, 거래 금액, 인지 경로' }, { col: 2, t: '문10~11-3', center: true }, { col: 3, t: '경쟁 브랜드 조사' }],
  [{ col: 1, t: '2) 금융 앱 선택기준: 선택 요소의 중요 순위' }, { col: 2, t: '문11', center: true }, { col: 3, t: '7 선호·비선호 이유', rowSpan: 2 }],
  [{ col: 1, t: '3) 플랫폼별 장단점·만족도·선호: 자사 우위 요소, 경쟁사 우위 요소, 앱별 만족도, 선호 앱, 업무별 우선 앱' }, { col: 2, t: '문12~13-4', center: true }],
  [{ col: 0, t: 'Ⅴ 부산은행 모바일뱅킹 개선방안', rowSpan: 3, bold: true }, { col: 1, t: '1) 개선 우선순위' }, { col: 2, t: '문13', center: true }, { col: 3, t: '7 개선방안(경쟁전략)', rowSpan: 3 }],
  [{ col: 1, t: '2) 지역 연계·생활서비스 수요: 희망 서비스, 이용 시 우려사항' }, { col: 2, t: '문14~15-1', center: true }],
  [{ col: 1, t: '3) 향후 이용의향: 신규·재이용·확대·전환·추천 의향, 이용 확대의 걸림돌' }, { col: 2, t: '문15~16-1', center: true }],
  [{ col: 0, t: 'Ⅵ 응답자 일반현황', bold: true }, { col: 1, t: '성별, 신분·학년, 월 소득, 이용 금융 앱 수, 디지털 금융 자신감 (연령·부산 연관성은 응답자 확인 문항에서 확인)' }, { col: 2, t: '문16~20', center: true }, { col: 3, t: '9 응답자 일반현황' }],
], { header: true, fontSize: 18 }));

// === 설문지 본문 ===
add(pageBreak());
add(P([run('부산은행 모바일뱅킹 경쟁력 강화 조사 설문지', { bold: true, size: 30, color: '1F3864' })], { align: AlignmentType.CENTER, after: 120 }));
add(T('안녕하십니까. 본 설문은 부산대학교 글로벌시장조사론 수업 과제로, 부산은행 모바일뱅킹과 경쟁 금융 앱에 대한 이용행태와 평가를 알아보기 위한 것입니다. 응답 내용은 통계 목적으로만 사용되며 이름·연락처·계좌번호 등 개인 식별정보는 수집하지 않습니다. 응답에는 약 15~20분이 걸리며, 원하지 않으면 언제든 중단할 수 있습니다.', { after: 100 }));
add(T('[용어] 금융기관은 계좌·금융상품을 거래하는 은행·증권·보험 등의 회사를, 금융 앱은 스마트폰으로 조회·이체·결제·금융상품 거래를 하는 앱을 뜻합니다.', { after: 60, size: 19 }));
add(T('[기입 방법] 순위 문항은 보기 번호를 적어 주시고, 같은 번호를 두 번 적지 않습니다. 이용 빈도가 비슷하면 더 최근에 이용한 것을 앞 순위로 적어 주세요.', { after: 160, size: 19 }));

// --- 응답자 확인 ---
add(partTitle('응답자 확인'));
add(Q('S1', '귀하의 연령대에 해당하는 보기 하나만 선택해 주세요.'));
add(opts(['만 19세 미만(→ 설문 종료)', '만 19~24세', '만 25~29세', '30대', '40대', '50대 이상'], 3));
add(Q('S2', '현재 부산과의 연관성에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['부산에 거주하며 학교·직장도 부산에 있음', '부산에 거주하며 학교·직장은 다른 지역에 있음', '다른 지역에 거주하며 부산 소재 학교에 다님',
  '다른 지역에 거주하며 부산 소재 직장에 다님', '부산 거주·학교·직장 모두 해당 없음(→ 설문 종료)', '기타(          )'], 2));
add(Q('S3', '최근 3개월 동안의 금융 앱 이용 상태에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['최근 3개월 동안 이용했고 지금도 이용함', '최근 3개월 동안 이용했지만 지금은 이용하지 않음', '3개월보다 전에 이용했고 최근 3개월은 이용하지 않음(→ 설문 종료)',
  '설치만 하고 이용한 적 없음(→ 설문 종료)', '금융 앱을 설치한 적 없음(→ 설문 종료)', '잘 모르겠음(→ 설문 종료)'], 2));

// --- Ⅰ ---
add(partTitle('Ⅰ. 금융서비스 이용 일반현황'));
add(subTitle('1) 금융기관 이용현황'));
add(Q('문1', '최근 3개월 동안 실제로 거래한 금융기관을 자주 이용한 순서대로 3곳 골라 보기 번호를 적어 주세요(3곳 미만이면 남은 순위에 \'없음\'이라고 적어 주세요).'));
add(opts(BANKS, 4));
add(rank(['1순위', '2순위', '3순위']));
add(Q('문1-1', '문1의 1순위 금융기관을 이용하는 이유를 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(['급여·용돈을 받는 계좌여서', '학교·직장에서 지정한 계좌여서', '자동이체·카드대금 등 기존 거래가 연결되어 있어서', '금리 조건이 유리해서',
  '수수료 부담이 적어서', '모바일 앱 이용이 편리해서', '영업점·ATM을 이용하기 쉬워서', '금융기관을 신뢰해서', '오래 사용하여 익숙해서',
  '가족·지인의 권유로', '부산 지역과 연관된 기관이어서', '기타(          )'], 2));
add(rank(['1순위', '2순위']));
add(Q('문1-2', '부산은행 계좌 보유 상태에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['보유하고 있으며 주로 이용함', '보유하고 있으며 가끔 이용함', '보유하고 있지만 거의 이용하지 않음', '과거에 보유했으나 지금은 해지함', '보유한 적 없음', '잘 모르겠음'], 2));

add(subTitle('2) 금융거래 빈도와 금액'));
add(Q('문2', '지난 30일 동안 앱·인터넷·영업점 등 모든 경로를 합쳐 금융업무(조회·이체·결제·상품 거래 등)를 처리한 날은 며칠인지 하나만 선택해 주세요(같은 날 여러 번 처리해도 1일로 계산).'));
add(opts(DAYS, 4));
add(Q('문2-1', '최근 3개월을 기준으로 한 달 평균 이체·송금·결제에 쓴 금액(생활비·공과금·간편결제 포함)에 해당하는 보기 하나만 선택해 주세요.'));
add(opts(MONEY, 3));

add(subTitle('3) 금융 앱 이용현황'));
add(Q('문3', '최근 3개월 동안 금융업무에 실제로 이용한 앱을 자주 이용한 순서대로 3개 골라 보기 번호를 적어 주세요(설치만 한 앱은 제외하고, 3개 미만이면 남은 순위에 \'없음\').'));
add(opts(APPS, 3));
add(rank(['1순위', '2순위', '3순위']));
add(Q('문3-1', '문3에서 고른 각 순위의 앱을 지난 30일 동안 며칠 이용했는지 아래 보기에서 골라 순위별로 번호를 적어 주세요(같은 날 여러 번 이용해도 1일로 계산).'));
add(opts(DAYS, 4));
add(rank(['1순위 앱', '2순위 앱', '3순위 앱']));

// --- Ⅱ ---
add(partTitle('Ⅱ. 이용 금융서비스와 이용경로'));
add(subTitle('1) 이용 금융서비스'));
add(Q('문4', '최근 3개월 동안 처리한 금융업무를 자주 처리한 순서대로 3가지 골라 번호를 적어 주세요.'));
add(opts(TASKS, 2));
add(rank(['1순위', '2순위', '3순위']));
add(Q('문4-1', '문3의 1순위 앱에서 최근 3개월 동안 이용한 금융기관(계좌)과 처리한 기능을 각각 2개씩 골라 번호를 적어 주세요(금융기관은 문1의 보기 번호, 기능은 문4의 보기 번호를 사용).'));
add(P([run('(금융기관: ________  기능: ________)      (금융기관: ________  기능: ________)')], { before: 40, after: 120, indent: { left: 300 } }));

add(subTitle('2) 금융업무 이용채널'));
add(Q('문5', '최근 3개월 동안 금융업무에 가장 자주 이용한 경로를 순서대로 3가지 골라 번호를 적어 주세요.'));
add(groupLabel('[온라인 경로]'));
const CH_ON = ['은행 모바일 앱', '토스·카카오페이·네이버페이 등 핀테크·간편결제 앱', '증권회사·카드회사 앱', 'PC 인터넷뱅킹', '오픈뱅킹·마이데이터 통합조회 서비스', '앱·홈페이지의 챗봇·채팅상담', '금융기관 홈페이지'];
const CH_OFF = ['은행 영업점 창구', '은행 ATM·CD기', '편의점·지하철 등 공용 ATM', '전화상담·텔레뱅킹', '학교·직장 안의 출장소·자동화코너', '우체국·새마을금고·신협 등 창구', '기타(          )'];
add(opts(CH_ON, 2));
add(groupLabel('[오프라인 경로]'));
add(opts(CH_OFF, 2, CH_ON.length));
add(rank(['1순위', '2순위', '3순위']));
add(Q('문5-1', '문5에서 고른 1·2·3순위 경로를 어떤 업무에 이용하는지 아래 업무 옆 빈칸에 해당 순위 번호(1, 2, 3)를 적어 주세요(한 업무에 여러 순위를 함께 적어도 됩니다).'));
add(blanks(['계좌·잔액 조회', '이체·송금', '결제·공과금 납부', '예금·적금 가입·관리', '대출 조회·신청·상환', '주식·펀드 등 투자', '자산·소비내역 통합관리', '환전·외화 업무', '혜택·이벤트 확인', '상담·문의', '기타(          )'], 3));
add(Q('문5-2', '문5의 1순위 경로를 가장 자주 이용하는 이유를 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(['장소에 구애받지 않고 이용할 수 있어서', '원하는 시간에 이용할 수 있어서', '처리 속도가 빨라서', '직원의 설명이나 도움을 받을 수 있어서', '이용 방법이 익숙해서',
  '보안상 안전하다고 느껴서', '그 경로에서만 가능한 업무여서', '수수료·비용이 유리해서', '여러 금융기관 업무를 한 번에 처리할 수 있어서', '기타(          )'], 2));
add(rank(['1순위', '2순위']));
add(Q('문5-3', '영업점·ATM·전화상담 등 오프라인 경로를 이용하는 가장 큰 이유 하나만 선택해 주세요.'));
add(opts(['현금 입출금이 필요해서', '대출·상품 가입 등 복잡한 업무는 직원 설명이 필요해서', '앱 이용 중 오류·인증 문제가 생겨서', '앱 사용이 익숙하지 않아서',
  '오프라인이 더 안전하다고 느껴서', '영업점·ATM이 가까워서', '기타(          )', '오프라인 경로를 이용하지 않음'], 2));

// --- Ⅲ ---
add(partTitle('Ⅲ. 부산은행 모바일뱅킹에 대한 인식과 이용경험'));
add(subTitle('1) 인지도·이미지·광고 접촉'));
add(Q('문6', '부산은행 모바일뱅킹 앱에 대해 알고 있는 정도에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['주요 기능과 혜택까지 잘 알고 있음', '이용해 본 적이 있어 대략 알고 있음', '이름은 들어봤지만 기능은 잘 모름', '부산은행은 알지만 앱이 있는지는 몰랐음', '부산은행 자체를 잘 모름', '잘 모르겠음'], 2));
add(Q('문6-1', '부산은행 모바일뱅킹을 알게 된 경로를 먼저 접한 순서대로 2가지 골라 번호를 적어 주세요(처음 들어본 분은 1순위에 ' + CIRC[AWARE_ON.length + AWARE_OFF.length - 1] + '을 적어 주세요).'));
add(groupLabel('[온라인 경로]'));
add(opts(AWARE_ON, 2));
add(groupLabel('[오프라인 경로]'));
add(opts(AWARE_OFF, 2, AWARE_ON.length));
add(rank(['1순위', '2순위']));
add(Q('문6-2', '부산은행 모바일뱅킹 하면 떠오르는 이미지를 가까운 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(['편리한', '불편한', '익숙한', '낯선', '신뢰할 수 있는', '오래된·구식인', '부산 지역과 가까운', '혜택이 많은', '혜택이 적은', '젊은·트렌디한', '기타(          )', '떠오르는 이미지 없음'], 4));
add(rank(['1순위', '2순위']));
add(Q('문6-3', '부산은행 모바일뱅킹에서 제공한다고 알고 있는 기능·서비스를 3가지만 골라 번호를 적어 주세요(이용 여부와 관계없이 알고 있는 것 기준이며, 3가지 미만이면 남은 칸에 ⑫를 적어 주세요).'));
add(opts(['계좌 조회·이체(연락처 송금·클립송금 포함)', '예금·적금·대출 상품 가입', '지문·패턴·간편비밀번호 간편 로그인', '공과금·지방세 납부',
  '라이프 메뉴의 생활서비스(공연·영화·맛집·여행 예약·할인)', '라이프 스낵365 간식 쇼핑몰', '정부보조금·생활정보 안내', '청년 전용 적금·대출(청년미래적금 등)',
  '동백전(부산 지역화폐) 카드 신청·충전 연계', '챗봇 상품 추천·로보어드바이저 펀드', '기타(          )', '알고 있는 기능 없음'], 2));
add(rank(['1번째', '2번째', '3번째']));
add(Q('문6-4', '부산은행 모바일뱅킹의 광고·혜택 안내를 접했을 때 이용해 보고 싶은 마음이 어느 정도였는지 7점 척도에 표시해 주세요(접한 적이 없으면 \'접한 적 없음\'에 표시).'));
add(note('1 전혀 그렇지 않다 · 2 그렇지 않다 · 3 별로 그렇지 않다 · 4 보통이다 · 5 약간 그렇다 · 6 그렇다 · 7 매우 그렇다'));
add(likert(['광고·혜택 안내를 보고 부산은행 모바일뱅킹을 이용해 보고 싶었다'], '접한 적 없음'));
add(Q('문6-5', '부산은행 모바일뱅킹의 광고·혜택 안내를 접한 뒤 실제 행동에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['앱을 설치하거나 실제로 이용함', '정보를 더 찾아봤지만 이용하지는 않음', '관심은 있었지만 행동하지 않음', '특별한 관심 없이 지나침', '광고·안내를 접한 적 없음', '기억나지 않음'], 2));

add(subTitle('2) 이용경험 (문7에서 ①을 선택한 분은 문7-1~문7-6, 나머지는 문8로 가세요)'));
add(Q('문7', '부산은행 모바일뱅킹 이용 상태에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['최근 3개월 동안 이용함', '과거에 이용했지만 최근 3개월은 이용하지 않음', '설치만 하고 이용한 적 없음', '설치한 적 없음', '부산은행 계좌가 없어 이용할 수 없음', '잘 모르겠음'], 2));
add(Q('문7-1', '부산은행 모바일뱅킹을 처음 이용하게 된 가장 큰 계기 하나만 선택해 주세요.'));
add(opts(['부산은행 계좌 업무를 처리하려고', '학교·직장 연계 계좌(등록금·급여 등) 때문에', '혜택·이벤트 때문에', '은행 직원·창구 권유로', '가족·지인 권유로', '지역은행이라 믿을 만해서', '직접 찾아보고 설치함', '기타(          )'], 2));
add(Q('문7-2', '최근 3개월 동안 부산은행 모바일뱅킹에서 이용한 기능을 자주 이용한 순서대로 3가지 골라 번호를 적어 주세요(3가지 미만이면 남은 순위에 \'없음\').'));
add(opts(['계좌·잔액·거래내역 조회', '이체·송금', '공과금·지방세 납부', '예금·적금 가입·관리', '대출 조회·신청·상환', '환전·외화',
  '라이프 생활서비스(공연·영화·맛집·여행·스낵365)', '이벤트·혜택 응모', '마이페이지 자산·금융일정 확인', '동백전 카드·충전 연계', '푸시알림·안내 확인', '기타(          )'], 2));
add(rank(['1순위', '2순위', '3순위']));
add(Q('문7-3', '지난 30일 동안 부산은행 모바일뱅킹을 이용한 날은 며칠인지 하나만 선택해 주세요(같은 날 여러 번 이용해도 1일로 계산).'));
add(opts(DAYS, 4));
add(Q('문7-4', '최근 3개월을 기준으로 부산은행 모바일뱅킹에서 한 달 평균 거래한 금액(이체·결제·상품 거래 합계)에 해당하는 보기 하나만 선택해 주세요.'));
add(opts(MONEY, 3));
add(Q('문7-5', '부산은행 모바일뱅킹을 계속 이용하는 이유를 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(REASONS_KEEP.slice(0, 9).concat(['부산 지역 혜택·생활정보가 있어서'], REASONS_KEEP.slice(9)), 2));
add(rank(['1순위', '2순위']));
add(Q('문7-6', '최근 3개월 동안 부산은행 모바일뱅킹을 이용하면서 불편했던 점을 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(['필요한 메뉴를 찾기 어려움', '설명·조건을 이해하기 어려움', '로그인·인증·입력 절차가 많거나 복잡함', '처리 속도가 느림', '접속 실패·앱 종료·거래 오류',
  '혜택 적용 여부·조건 확인이 어려움', '다른 금융기관 계좌·자산 연결이 안 되거나 불편함', '안내·상담을 받기 어려움', '화면 디자인·가독성이 떨어짐',
  '알림이 너무 많거나 불필요함', '기타(          )', '불편한 점 없음'], 2));
add(rank(['1순위', '2순위']));

add(subTitle('3) 미이용·중단 이유 (문7에서 ②~⑥을 선택한 분만)'));
add(Q('문8', '부산은행 모바일뱅킹을 현재 이용하지 않는 이유를 큰 순서대로 2가지 골라 번호를 적어 주세요(과거 이용자는 이용을 중단한 이유를 기준으로).'));
add(opts(['부산은행 계좌가 없어서', '다른 앱으로 충분히 처리할 수 있어서', '부산은행 계좌도 다른 앱(토스·카카오뱅크 등)에서 관리할 수 있어서', '앱이 있는지 몰랐거나 기능을 몰라서',
  '과거 이용 시 불편했던 경험이 있어서', '혜택이 적다고 느껴서', '로그인·인증이 번거로울 것 같아서', '화면·디자인이 구식이라고 느껴서',
  '지역은행 앱이라 다른 지역에서 쓰기 불편할 것 같아서', '앱 개수를 더 늘리고 싶지 않아서', '기타(          )', '현재 이용 중이라 해당 없음'], 2));
add(rank(['1순위', '2순위']));

add(subTitle('4) 주 이용 앱 변경과 전환'));
add(Q('문9', '최근 6개월 동안 가장 자주 이용하는 금융 앱을 바꾼 경험에 가장 가까운 보기 하나만 선택하고, 바꾼 적이 있다면 이전 앱과 바꾼 뒤 앱의 문3 보기 번호를 적어 주세요.'));
add(opts(['바꾼 적 없음', '다른 앱으로 1회 바꿈', '2회 이상 바꿈', '바꿨다가 원래 앱으로 돌아옴', '자주 바뀌어 하나로 설명하기 어려움', '기억나지 않음'], 3));
add(P([run('(이전 앱: ________  →  바꾼 뒤 앱: ________)')], { before: 40, after: 120, indent: { left: 300 } }));
add(Q('문9-1', '문9에서 ②~④를 선택한 분은 주 이용 앱을 바꾸게 된 계기를 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(['새 앱의 화면·절차가 더 편리해서', '이전 앱의 로그인·인증이 번거로워서', '이전 앱의 속도가 느리거나 오류가 잦아서', '새 앱의 금리·수수료 조건이 유리해서',
  '새 앱의 할인·적립·이벤트 때문에', '여러 금융기관 계좌를 한곳에서 관리하려고', '급여·용돈 계좌나 학교·직장 연계가 바뀌어서', '이전 앱의 보안이 불안해서',
  '필요한 상품·기능이 새 앱에 있어서', '주변 사람의 권유로', '기타(          )', '바꾼 적 없음'], 2));
add(rank(['1순위', '2순위']));
add(Q('문9-2', '부산은행 계좌 관련 업무(조회·이체·결제 등)를 처리할 때 주로 이용하는 경로를 순서대로 2가지 골라 번호를 적어 주세요(부산은행 계좌가 없으면 1순위에 ⑧을 적어 주세요).'));
add(opts(['부산은행 모바일뱅킹 앱', '부산은행 인터넷뱅킹(PC)', '부산은행 영업점 창구', '부산은행 ATM', '토스·카카오뱅크 등 다른 금융 앱(오픈뱅킹)', '카카오페이·네이버페이 등 간편결제 앱', '기타(          )', '부산은행 계좌 없음'], 2));
add(rank(['1순위', '2순위']));

// --- Ⅳ ---
add(partTitle('Ⅳ. 경쟁 금융플랫폼(토스·카카오뱅크)과의 비교 평가'));
add(subTitle('1) 경쟁 앱 이용현황 (문10에서 ⑥을 선택한 분은 문11로 가세요)'));
add(Q('문10', '토스와 카카오뱅크 이용 상태에 가장 가까운 보기 하나만 선택해 주세요.'));
add(opts(['토스만 이용함', '카카오뱅크만 이용함', '둘 다 이용하며 토스를 더 자주 이용함', '둘 다 이용하며 카카오뱅크를 더 자주 이용함', '둘 다 비슷하게 이용함', '둘 다 이용하지 않음'], 2));
add(Q('문10-1', '문10에서 더 자주 이용한다고 답한 앱(토스 또는 카카오뱅크)을 이용하는 이유를 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(REASONS_KEEP, 2));
add(rank(['1순위', '2순위']));
add(Q('문10-2', '그 앱에서 최근 3개월을 기준으로 한 달 평균 거래한 금액(이체·결제·상품 거래 합계)에 해당하는 보기 하나만 선택해 주세요.'));
add(opts(MONEY, 3));
add(Q('문10-3', '그 앱을 알게 된 경로를 먼저 접한 순서대로 2가지 골라 문6-1의 보기 번호를 적어 주세요.'));
add(rank(['1순위', '2순위']));

add(subTitle('2) 금융 앱 선택기준'));
add(Q('문11', '금융 앱을 선택할 때 중요하게 생각하는 요소를 중요한 순서대로 3가지 골라 번호를 적어 주세요.'));
add(opts(FACTORS, 2));
add(rank(['1순위', '2순위', '3순위']));

add(subTitle('3) 플랫폼별 장단점·만족도·선호'));
add(Q('문12', '문11의 보기 중에서 부산은행 모바일뱅킹이 토스·카카오뱅크보다 우수하다고 생각하는 요소를 큰 순서대로 2가지 골라 번호를 적어 주세요(우수한 요소가 없으면 ⑬, 비교하기 어려우면 ⑭를 적어 주세요).'));
add(opts(['우수한 요소 없음', '비교하기 어려움'], 2, FACTORS.length));
add(rank(['1순위', '2순위']));
add(Q('문12-1', '문11의 보기 중에서 토스·카카오뱅크가 부산은행 모바일뱅킹보다 우수하다고 생각하는 요소를 큰 순서대로 2가지 골라 번호를 적어 주세요(우수한 요소가 없으면 ⑬, 비교하기 어려우면 ⑭를 적어 주세요).'));
add(rank(['1순위', '2순위']));
add(Q('문12-2', '다음 각 앱에 대한 전반적인 만족도를 7점 척도에 표시해 주세요(이용 경험이 없는 앱은 \'이용 경험 없음\'에 표시).'));
add(note('1 매우 불만족 · 2 불만족 · 3 약간 불만족 · 4 보통 · 5 약간 만족 · 6 만족 · 7 매우 만족'));
add(likert(['부산은행 모바일뱅킹', '토스', '카카오뱅크'], '이용 경험 없음'));
add(Q('문12-3', '세 앱 중 가장 선호하는 앱 하나만 선택해 주세요.'));
add(opts(['부산은행 모바일뱅킹', '토스', '카카오뱅크', '셋 다 비슷함', '셋 중 이용한 앱이 없음', '판단하기 어려움'], 3));
add(Q('문12-4', '다음 업무를 할 때 가장 먼저 여는 앱의 번호(① 부산은행 모바일뱅킹 ② 토스 ③ 카카오뱅크 ④ 그 외 다른 앱 ⑤ 앱이 아닌 경로(영업점·ATM 등) ⑥ 해당 업무를 하지 않음)를 각 빈칸에 적어 주세요.'));
add(blanks(['계좌·잔액 조회', '이체·송금', '결제·공과금 납부', '예금·적금 가입', '대출 조회·신청', '혜택·이벤트 확인', '자산·소비내역 관리', '환전·외화'], 4));

// --- Ⅴ ---
add(partTitle('Ⅴ. 부산은행 모바일뱅킹 개선방안'));
add(subTitle('1) 개선 우선순위'));
add(Q('문13', '부산은행 모바일뱅킹에서 가장 먼저 개선되어야 한다고 생각하는 부분을 순서대로 3가지 골라 번호를 적어 주세요(이용 경험이 없으면 이용하지 않는 이유를 기준으로 답해 주세요).'));
add(opts(['첫 화면·자주 쓰는 메뉴 설정', '로그인·인증 수단 간소화', '이체·자주 쓰는 계좌 관리', '처리 속도와 안정성', '다른 금융기관 계좌·자산 통합조회',
  '소비내역 분류·예산 관리', '금융상품 비교·조건 설명', '나에게 맞는 혜택 찾기와 조건 확인', '오류 해결·진행 상황 안내', '상담 연결과 상담 내용 확인',
  '화면 디자인·가독성', '알림 종류·빈도 설정', '청년·대학생 전용 혜택', '부산 지역 연계 혜택·정보', '기타(          )'], 2));
add(rank(['1순위', '2순위', '3순위']));

add(subTitle('2) 지역 연계·생활서비스 수요'));
add(Q('문14', '현재 제공 여부와 관계없이 부산은행 모바일뱅킹에서 이용하고 싶은 부산 지역 연계·생활 서비스를 순서대로 3가지 골라 번호를 적어 주세요.'));
add(opts(['부산 지역 상점·식당·카페 할인·적립', '동백전 충전·결제·캐시백 내역을 앱 안에서 바로 확인', '부산 공연·영화·스포츠 경기 제휴 혜택',
  '청년·주거·취업·창업 등 지역 금융지원과 정부보조금 정보 모아보기', '관심 분야에 맞춘 혜택·금융정보 안내', '앱에서 영업점 상담 예약과 필요 서류 안내',
  '대학생 전용 계좌·학자금·장학 정보와 캠퍼스 연계(모바일 학생증 등)', '부산 여행·관광지·축제 혜택', '지역 소상공인·동네 가게 응원 적립',
  '대중교통(동백패스)·생활요금 연계 결제와 환급 안내', '기타(          )', '필요한 서비스 없음'], 2));
add(rank(['1순위', '2순위', '3순위']));
add(Q('문14-1', '위와 같은 지역 연계 서비스를 이용할 때 가장 우려되는 점을 큰 순서대로 2가지 골라 번호를 적어 주세요.'));
add(opts(['알림이 너무 많아질 것', '위치정보 활용', '개인정보·소비내역 제공', '혜택 조건이 복잡하고 실제 적용이 어려울 것', '앱이 무거워지거나 느려질 것',
  '부산을 떠나면 쓸모없어질 것', '기타(          )', '우려되는 점 없음'], 2));
add(rank(['1순위', '2순위']));

add(subTitle('3) 향후 이용의향'));
add(Q('문15', '문13와 문14에서 선택한 개선과 서비스가 실제로 이루어진다면 다음 각 항목에 대한 의향을 7점 척도에 표시해 주세요.'));
add(note('1 전혀 없다 · 2 없다 · 3 별로 없다 · 4 보통이다 · 5 약간 있다 · 6 있다 · 7 매우 있다'));
add(likert(['부산은행 모바일뱅킹을 처음 또는 다시 이용할 의향', '지금보다 더 자주, 더 많은 업무에 이용할 의향', '가장 자주 쓰는 앱을 부산은행 모바일뱅킹으로 바꿀 의향', '주변 사람에게 추천할 의향']));
add(Q('문15-1', '개선되더라도 부산은행 모바일뱅킹 이용을 늘리기 어렵게 만드는 가장 큰 걸림돌 하나만 선택해 주세요.'));
add(opts(['지금 쓰는 앱이 익숙해서', '급여·용돈 계좌와 자동이체가 다른 은행에 있어서', '개선이 실제로 될지 믿기 어려워서', '부산은행 앱을 쓸 필요 자체가 없어서',
  '앱 개수를 늘리고 싶지 않아서', '졸업·이직 등으로 부산을 떠날 예정이어서', '기타(          )', '걸림돌 없음'], 2));

// --- Ⅵ ---
add(partTitle('Ⅵ. 응답자 일반현황'));
add(note('통계 분류를 위한 문항이며, 응답 내용은 개인을 식별하는 데 사용되지 않습니다.'));
add(Q('문16', '귀하의 성별을 하나만 선택해 주세요.'));
add(opts(['남성', '여성', '기타', '응답하지 않음'], 4));
add(Q('문17', '현재 신분 또는 학년에 해당하는 보기 하나만 선택해 주세요.'));
add(opts(['대학교 1학년', '대학교 2학년', '대학교 3학년', '대학교 4학년 이상(초과학기 포함)', '대학원생', '직장인', '자영업·프리랜서', '구직 중·무직', '기타(          )'], 3));
add(Q('문18', '아르바이트·용돈·급여·장학금 등을 모두 합한 월평균 소득에 해당하는 보기 하나만 선택해 주세요.'));
add(opts(['30만원 미만', '30만원~50만원 미만', '50만원~100만원 미만', '100만원~200만원 미만', '200만원~300만원 미만', '300만원 이상', '응답하지 않음'], 4));
add(Q('문19', '현재 스마트폰에 설치해 실제로 이용하는 금융 앱(은행·핀테크·증권·카드 앱 포함)의 개수를 하나만 선택해 주세요.'));
add(opts(['1개', '2개', '3개', '4~5개', '6개 이상', '잘 모르겠음'], 3));
add(Q('문20', '앱 설치·본인인증·이체 등 금융 앱 이용을 다른 사람의 도움 없이 처리할 수 있는 정도를 7점 척도에 표시해 주세요.'));
add(note('1 전혀 그렇지 않다 · 2 그렇지 않다 · 3 별로 그렇지 않다 · 4 보통이다 · 5 약간 그렇다 · 6 그렇다 · 7 매우 그렇다'));
add(likert(['금융 앱 이용을 다른 사람의 도움 없이 혼자 처리할 수 있다']));

add(BLANK({ after: 200 }));
add(P([run('설문이 모두 끝났습니다. 응답해 주셔서 감사합니다.', { bold: true, size: 22, color: '1F3864' })], { align: AlignmentType.CENTER, before: 200 }));

// ---------- 문서 조립 ----------
const doc = new Document({
  creator: '글로벌시장조사론 1조',
  title: '부산은행 모바일뱅킹 경쟁력 강화 조사 설문지',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1133, right: 1133 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run('부산은행 모바일뱅킹 경쟁력 강화 조사 설문지 · 글로벌시장조사론 1조 · ', { size: 16, color: '777777' }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '777777' })],
      })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('written', OUT, buf.length, 'bytes'); });
