// 민간경상보조금 신청서 4쪽 '프로그램 계획서' 1쪽 요약(연구계획서 내용을 줄임). 신청서 양식 칸에 옮겨 쓰는 초안이다.
// 사용: node build_grant_summary.js out.docx → python3 ../build_result/postprocess.py out.docx → python3 ../build_result/render_pdf.py out.docx out.pdf
const fs = require('fs');
const path = require('path');
const { D, FONT, W, C, cw, p, tbl, mk, exact } = require('../build_result/lib');
const { Document, Packer, Paragraph, AlignmentType } = D;

const OUT = process.argv[2] || path.join(__dirname, 'grant_summary.docx');
const lab = (t) => ({ t, fill: C.label, bold: true, align: AlignmentType.CENTER });

const rows = [
  ['프로그램명', '간판을 떼고 다시 본 부울경 기업 10곳 — 부산대 학생이 일하기 좋은 지역기업의 발굴·비교분석과 「지역기업 TOP3」 선정'],
  ['운영 기간', '2026. 10. 9. ~ 11. 30. (대상 확정 10. 9.~10. 25. · 기업조사 10. 28.~11. 18. · 결과보고서 제출 11. 18. · 발표대회 11. 30.)'],
  ['참여 인원', '부산대 재학생 5명(연구팀 \'간판떼고\'): 정시윤(팀장, 경영학), 강현민(영어영문학·통계학), 김채현(실내환경디자인학), 고종범(사학·경제학), 권민재(전기공학)'],
  ['목적', '지역에 남고 싶은 학생도 기업명과 근무지역이라는 \'간판\'에 가려 지역기업의 실제 직무와 처우를 비교하기 어렵다. 부울경 기업 10곳을 같은 기준으로 분석해 부산대 학생에게 권할 기업과 전공별 준비 방법을 제시한다.'],
  ['주요 활동', [
    '① 발굴(10. 9.~10. 25.): 공모 자격·본점 소재·학사 신입 직무·평판(결격 사유)을 확인해 부산 4곳, 울산·경남 6곳 확정',
    '② 비교(10. 28.~11. 10.): 공시·채용 공고·공식 자료로 6개 영역 100점 공통 평가(두 명이 따로 채점), 기업명·근무지역을 가린 블라인드 설문(재학생 목표 100명), 인사담당자 서면 질의·현직자·전문가 인터뷰',
    '③ 선정(11. 11.~11. 18.): 기업 평가 70% + 학생 선호 30%로 TOP3 선정, 전공별 직무 카드·8주 취업 준비 안내 작성, 학생 10명 사용 과제로 직무 카드 검증',
  ]],
  ['결과물', '결과보고서(기업 분석 10건, 종합 비교표, TOP3 선정 근거, 설문 결과), 설문조사지, 인터뷰지, 발표자료'],
  ['기대 효과', [
    '학생: 전공별로 지원할 수 있는 지역 직무와 조건, 준비 방법을 한곳에서 확인한다.',
    '기업·대학: 학생이 지원 전에 찾는 정보(신입 보상, 근무시간, 전환 조건, 통근·주거)를 \'부울경 신입 공고 표준 카드\'로 제안한다.',
  ]],
  ['지원금 사용 계획(예정)', '설문 응답 사례(커피 쿠폰 10명 추첨), 팀 회의비(식비), 결과보고서·발표자료 인쇄비. 10. 28. 이후 지출만 쓰고 영수증 실물을 보관해 결과보고서와 함께 정산한다.'],
];

const doc = new Document({
  creator: '간판떼고',
  title: '프로그램 계획서 요약(민간경상보조금 신청서 4쪽)',
  styles: { default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276 } } } } },
  numbering: { config: [{ reference: 'cellbullets', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 180, hanging: 160 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1020, left: 1134, right: 1134 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60, ...exact(30, 1.35) }, children: [mk('프로그램 계획서(요약)', { size: 30, bold: true, color: C.navy })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240, ...exact(20, 1.4) }, children: [mk('2026학년도 PNU Student Choice Awards 「가장 일하고 싶은 지역기업 TOP10」 · 연구팀 간판떼고', { size: 20, color: C.sub })] }),
      tbl(cw([20, 80]), rows.map(([k, v]) => [lab(k), Array.isArray(v) ? v.map((x) => `- ${x}`) : v]), { size: 18, padV: 70, padH: 120 }),
      p('제출한 연구계획서(2026. 10. 26.)의 내용을 1쪽으로 줄였다. 신청서 양식의 칸 이름이 다르면 같은 내용을 해당 칸에 옮겨 쓴다.', { size: 15, color: C.sub, before: 120 }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, buf.length); });
