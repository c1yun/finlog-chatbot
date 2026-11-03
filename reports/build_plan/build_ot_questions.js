// 11. 9.(월) 오리엔테이션 질문지 1쪽. 팀장·총무가 들고 가서 답을 적는다.
// 사용: node build_ot_questions.js out.docx → postprocess.py → render_pdf.py
const fs = require('fs');
const path = require('path');
const { D, FONT, C, cw, p, tbl, mk, exact } = require('../build_result/lib');
const { Document, Packer, Paragraph, AlignmentType } = D;

const OUT = process.argv[2] || path.join(__dirname, 'ot_questions.docx');
const CENTER = AlignmentType.CENTER;
const headc = (t) => ({ t, fill: C.head, bold: true, align: CENTER });

const Q = [
  ['결과보고서 제출', '11. 18.(수) 13:00 대면 제출 때 인쇄본 부수와 제본 방식은? 파일(PDF·한글·워드)도 따로 내는가, 낸다면 어디로?'],
  ['결과보고서 양식', '「붙임 3」 양식의 칸(1-1, 1-2, 2-1, 2-2) 외에 부록·표·그림을 붙여도 되는가? 분량 제한이 있는가?'],
  ['심사기준', '안내된 5개 기준(다각적 기업연구, 핵심가치 및 직무분석, 지역기업 가치 재발견, 지역정주형 취업전략, 논리성 및 구성)의 배점은? 2차(서면)와 3차(발표)에 모두 쓰는가?'],
  ['TOP3 기재', '양식 마지막 쪽 TOP 3 칸에 순위와 함께 점수·근거를 적어도 되는가? 10곳 모두 분석해야 하는가?'],
  ['발표대회(11. 30.)', '발표 시간과 질의응답 시간, 발표 순서 정하는 방법, 발표 인원(전원/대표), 장소와 장비(노트북·포인터·화면 비율)'],
  ['발표자료 제출', 'PPT를 미리 내는가(마감 시각·형식: PPTX/PDF), 현장 파일 교체가 되는가?'],
  ['지원금', '1차 선정팀 지원금 금액(팀별 30만 원 유지 여부)과 입금 시기. 설문 응답 사례(커피 쿠폰 추첨)·회의 식비·인쇄비가 정산 대상인가?'],
  ['정산서류', '영수증 실물 외에 필요한 서류(카드 전표, 사용 내역서 양식), 개인 카드 결제 인정 여부'],
  ['기업 접촉', '기업 인사팀 질의·인터뷰 때 공모전 참가팀임을 밝혀도 되는가? 주최 측 협조 공문이 있는가?'],
  ['공개 범위', '결과보고서·발표자료가 백서·홈페이지에 공개되는가? 기업 평판 서술의 표현 기준이 있는가?'],
];

const doc = new Document({
  creator: '간판떼고',
  title: '오리엔테이션 질문지(2026. 11. 9.)',
  styles: { default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276 } } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1020, bottom: 900, left: 1020, right: 1020 } } },
    children: [
      new Paragraph({ alignment: CENTER, spacing: { after: 40, ...exact(28, 1.35) }, children: [mk('오리엔테이션 질문지', { size: 28, bold: true, color: C.navy })] }),
      new Paragraph({ alignment: CENTER, spacing: { after: 200, ...exact(18, 1.4) }, children: [mk('2026. 11. 9.(월) 17:30 · 「가장 일하고 싶은 지역기업 TOP10」 · 연구팀 간판떼고(팀장·총무 참석)', { size: 18, color: C.sub })] }),
      tbl(cw([5, 17, 50, 28]), [[headc('번호'), headc('주제'), headc('질문'), headc('답(현장 기록)')],
        ...Q.map(([a, b], i) => [{ t: String(i + 1), align: CENTER }, { t: a, bold: true, fill: C.gray }, b, ' '])], { size: 16, padV: 90, padH: 80 }),
      p('기록한 답은 팀 단톡방과 「간판떼고 인터뷰 기록」 시트 안내 탭에 옮겨 적고, 결과보고서·발표자료 일정에 바로 반영한다.', { size: 15, color: C.sub, before: 120 }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, buf.length); });
