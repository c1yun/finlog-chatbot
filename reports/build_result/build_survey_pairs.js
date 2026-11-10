// 간판떼고 설문조사지(2026. 11. 10. 새 설계) — 부울경 10곳과 수도권 10곳을 한 쌍씩 놓고 고르는 비교 설문
// 입력: ../survey/pairs_spec.js(쌍 구성·수도권 카드), cards_regional.json(부울경 카드)
// 사용: node build_survey_pairs.js out.docx && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf
const fs = require('fs');
const path = require('path');
const { D, FONT, W, C, cw, p, bullet, h1, h2, h3, lead, note, gap, tbl, mk, exact } = require('./lib');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat } = D;

const S = require('../survey/pairs_spec');
const REG = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, 'cards_regional.json'), 'utf-8')).map((c) => [c.key, c]));
const OUT = process.argv[2] || path.join(__dirname, 'survey_pairs.docx');
const CENTER = AlignmentType.CENTER;
const CIR = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const lab = (t, o = {}) => ({ t, fill: C.label, bold: true, align: CENTER, ...o });
const headc = (t, o = {}) => ({ t, fill: C.head, bold: true, align: CENTER, ...o });
const BLUE = 'EAF1FB';

// ───────── 카드 준비와 검사 ─────────
function regCard(key) {
  const c = REG[key];
  if (!c) throw new Error(`부울경 카드가 없다: ${key}`);
  const fields = S.shortReg[key];
  if (!fields) throw new Error(`부울경 카드의 줄인 문안이 없다: ${key}`);
  return { company: c.open.company.replace(/\(주\)|주식회사|\(.*?\)/g, '').trim(), region: c.open.region, job: c.job, fields };
}
const PAIRS = S.pairs.map((x) => {
  const short = S.shortMetro[x.metro.company];
  if (!short) throw new Error(`수도권 카드의 줄인 문안이 없다: ${x.metro.company}`);
  return { ...x, reg: regCard(x.regional), metro: { ...x.metro, fields: short } };
});
const problems = [];
PAIRS.forEach((x) => {
  [['부울경', x.reg], ['수도권', x.metro]].forEach(([side, card]) => {
    S.fields.forEach((f) => {
      const v = card.fields[f];
      if (!v) { problems.push(`쌍 ${x.no} ${side} 카드에 '${f}' 칸이 없다`); return; }
      if (v.length > 70) problems.push(`쌍 ${x.no} ${side} 카드 '${f}'가 70자를 넘는다(${v.length}자)`);
    S.banned.forEach((w) => { if (v.includes(w)) problems.push(`쌍 ${x.no} ${side} 카드 '${f}'에 가려야 할 말 '${w}': …${v.slice(Math.max(0, v.indexOf(w) - 12), v.indexOf(w) + 14)}…`); });
    });
  });
});
if (problems.length) { console.error(problems.join('\n')); process.exit(2); }
// 순서 1: 홀수 쌍은 부울경이 A, 짝수 쌍은 수도권이 A. 순서 2는 반대.
const sideA = (x, order) => ((x.no % 2 === 1) === (order === 1) ? 'reg' : 'metro');

// ───────── 표지 ─────────
function cover() {
  const out = [];
  out.push(new Paragraph({ alignment: CENTER, spacing: { before: 360, after: 60, ...exact(34, 1.35) }, children: [mk('설문조사지', { size: 34, bold: true, color: C.navy })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 80, ...exact(22, 1.4) }, children: [mk(`「${S.title}」 · 연구팀 간판떼고`, { size: 22, color: C.sub })] }));
  out.push(new Paragraph({ alignment: CENTER, spacing: { after: 260, ...exact(18, 1.4) }, children: [mk('2026학년도 PNU Student Choice Awards(가장 일하고 싶은 지역기업 TOP10)', { size: 18, color: C.sub })] }));
  out.push(tbl(cw([17, 83]), [
    [lab('알고 싶은 것'), '기업명과 근무지역을 가리고 조건만 보여 주면, 부산대 학생은 부울경 기업과 수도권 기업 가운데 어느 쪽을 고르는가. 이름과 지역을 보여 주면 그 선택이 달라지는가.'],
    [lab('대상'), `부산대학교 학부 재학생·휴학생. 목표 ${S.target}명(연구계획서 기준)`],
    [lab('방법'), '온라인 설문(구글 폼). 응답자를 두 집단으로 나눈다. 가림 집단은 기업명과 근무지역을 보지 못하고, 공개 집단은 본다. 카드 본문은 두 집단이 같다.'],
    [lab('내용'), '부울경 기업 10곳을 같은 업종 또는 같은 직무의 수도권 기업 10곳과 한 쌍씩 놓고, 쌍마다 어느 쪽에 지원할지 5단계로 고른다(10쌍). 카드는 칸마다 한 줄이다. 이어서 공통 문항 4개에 답한다. 문항은 모두 20개 안팎이다.'],
    [lab('걸리는 시간'), `${S.minutes}(카드 20장의 글이 모두 약 4,000자). 배포 전 시험 응답으로 실제 시간을 재고, 10분을 넘으면 카드 문장을 더 줄인다.`],
    [lab('카드의 근거'), `채용 공고 원문과 회사 공식 자료, 공시(기준일 ${S.asOf}). 수도권 카드 10장은 공고 원문을 다시 열어 확인했고, 부울경 카드 10장은 결과보고서의 기업별 분석과 같은 자료다.`],
    [lab('이 문서의 위치'), '결과보고서 제출본에는 이 설문의 결과가 들어 있지 않다. 이 문서는 설문을 그대로 실시할 수 있도록 문항·카드·배정·분석 규칙을 정리한 조사 도구다.'],
    [lab('판'), `${S.version}. 연구계획서의 설문(카드 15장을 하나씩 평가)을 1:1 비교로 고친 설계다(바꾼 이유는 Ⅰ장 1).`],
  ], { size: 18, padV: 55 }));
  return out;
}

// ───────── Ⅰ. 설계 ─────────
function design() {
  const out = [h1('Ⅰ. 조사 설계', { pageBreak: true })];
  out.push(h2('1  왜 1:1 비교인가', { before: 0 }));
  out.push(p('연구계획서의 설문은 카드 15장(부울경 10장, 수도권 대기업 5장)을 한 장씩 보여 주고 지원 의향을 묻는 방식이었다. 이 방식은 부울경 카드와 수도권 카드의 직무가 서로 달라, 점수 차이가 이름·지역 때문인지 직무 때문인지 가르기 어렵다. 그래서 부울경 기업마다 같은 업종 또는 같은 직무의 수도권 기업을 하나씩 짝지어, 응답자가 둘 가운데 하나를 고르게 바꿨다.', { size: 19 }));
  out.push(bullet('**가림 집단** 두 회사를 \'A사\'·\'B사\'로만 보여 준다. 기업명과 근무지역이 없으므로 조건만 보고 고른다.', { size: 18 }));
  out.push(bullet('**공개 집단** 같은 카드에 기업명과 근무지역을 한 줄 더 보여 준다.', { size: 18 }));
  out.push(bullet('**간판 효과** 두 집단에서 부울경 기업을 고르는 정도의 차이다. 기업명과 근무지역을 함께 가리므로 둘의 효과를 따로 나눌 수는 없다.', { size: 18 }));

  out.push(h2('2  쌍 구성'));
  out.push(p('수도권 기업은 네 가지 기준으로 골랐다. ① 본사와 해당 직무의 근무지가 수도권(서울·경기·인천)이다. ② 부울경 기업과 업종 또는 직무군이 같다. ③ 최근 1년 안에 학사 신입이 지원할 수 있는 공고가 있다. ④ 규모는 되도록 비슷한 중견기업으로 하고, 같은 업종에 그런 회사가 없으면 대기업을 쓰되 밝힌다.', { size: 18 }));
  const rows = [[headc('쌍'), headc(['부울경 기업', '(카드 직무 · 근무지)']), headc(['수도권 기업', '(카드 직무 · 근무지)']), headc('짝지은 기준'), headc('유의점')]];
  PAIRS.forEach((x) => rows.push([
    { t: String(x.no), align: CENTER, bold: true, fill: C.gray },
    { t: [`**${x.regional}**`, `${x.reg.job} · ${x.reg.region}`], size: 15 },
    { t: [`**${x.metro.company}**`, `${x.metro.job} · ${x.metro.region}`], size: 15 },
    { t: x.basis, size: 15 },
    { t: x.metro.caveat, size: 14 },
  ]));
  out.push(tbl(cw([5, 21, 22, 20, 32]), rows, { size: 16, padV: 26, padH: 50 }));
  out.push(note('쌍 8·9의 수도권 기업은 공시대상기업집단 소속이다. 같은 업종·직무의 수도권 중견기업 가운데 조건에 맞는 공고를 찾지 못해 썼고, 카드의 \'회사 사업과 규모\' 칸에 소속을 적었다. 쌍마다 근거 공고와 확인 수준은 부록 A에 있다.'));

  out.push(h2('3  카드 작성 규칙'));
  [
    '두 카드는 같은 다섯 칸(직무와 업무, 고용형태와 요건, 보상, 근무·복지, 회사 사업과 규모)을 같은 순서로 쓴다. 칸마다 한 줄(70자 이내)로 줄여, 휴대폰에서 한 화면에 두 카드가 들어오게 한다.',
    '\'회사 사업과 규모\' 칸에는 두 쪽 모두 사업, 2025년 매출 구간, 직원 수 구간만 적는다. 실적 추세처럼 한쪽만 조사한 정보는 양쪽 모두 뺐다. 대기업집단 소속은 밝힌다.',
    '카드 본문은 두 집단이 같다. 공개 집단에는 맨 위에 기업명과 근무지역 한 줄만 더 보인다.',
    '본문에는 기업명·상표·지역명을 쓰지 않는다. 매출과 직원 수는 구간으로 적는다(예: 1천억~5천억 원대, 500~1,000명).',
    '공고나 공식 자료에 없는 조건은 지어내지 않고 \'공고에 없음\' 또는 \'공개 정보 없음\'으로 적는다. 두 표현 모두 회사가 밝히지 않았다는 뜻이다.',
    '전 직원 평균 급여는 신입 보상으로 쓰지 않는다. 인턴 급여와 전환 뒤 급여는 구분해 적는다.',
    '공고가 마감됐어도 그 공고의 조건을 쓴다. 응답자에게는 \'최근 1년 안팎에 실제로 나온 공고의 조건\'이라고 알린다.',
  ].forEach((t) => out.push(bullet(t, { size: 18 })));

  out.push(h2('4  집단 배정과 순서'));
  out.push(p('구글 폼은 무작위 배정 기능이 없어, 응답자의 생일(일)로 네 묶음에 나눈다. 생일은 묶음을 나누는 데만 쓰고 저장한 값은 분석에 쓰지 않는다.', { size: 18 }));
  const days = (r) => Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => d % 4 === r).join(', ');
  out.push(tbl(cw([14, 18, 30, 38]), [
    [headc('묶음'), headc('집단'), headc('A·B 자리'), headc('생일(일)')],
    [lab('묶음 1'), { t: '가림', align: CENTER }, '순서 1: 홀수 쌍은 부울경이 A, 짝수 쌍은 수도권이 A', days(1)],
    [lab('묶음 2'), { t: '공개', align: CENTER }, '순서 1', days(2)],
    [lab('묶음 3'), { t: '가림', align: CENTER }, '순서 2: 순서 1과 A·B가 반대', days(3)],
    [lab('묶음 4'), { t: '공개', align: CENTER }, '순서 2', days(0)],
  ], { size: 16, padV: 30 }));
  out.push(note('부울경 기업이 늘 같은 자리(A 또는 B)에 오지 않도록 쌍마다 자리를 번갈아 두고, 묶음 3·4는 자리를 뒤집었다. 쌍의 순서(1~10)는 네 묶음이 같다. 묶음 인원이 10명 이상 벌어지면 배정표를 다시 나누고 바꾼 시각을 기록한다.'));
  return out;
}

// ───────── Ⅱ. 설문지 ─────────
function qRow(n, q, a) {
  return [{ t: n, align: CENTER, bold: true, fill: C.gray }, q, { t: a, size: 16 }];
}
const qTable = (rows) => tbl(cw([9, 44, 47]), [[headc('번호'), headc('문항'), headc('응답')], ...rows.map((r) => qRow(...r))], { size: 17, padV: 34, padH: 60 });

function pairBlock(x) {
  const out = [];
  const a = sideA(x, 1) === 'reg' ? x.reg : x.metro;
  const b = sideA(x, 1) === 'reg' ? x.metro : x.reg;
  out.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 60, ...exact(21, 1.4) }, children: [mk(`쌍 ${x.no} / 10`, { size: 21, bold: true, color: C.navy }), mk(`   순서 1 기준(묶음 1·2). 묶음 3·4는 A와 B가 바뀐다`, { size: 15, color: C.sub })] }));
  const rows = [[headc('조건'), headc('A사'), headc('B사')]];
  rows.push([{ t: ['기업명 · 근무지역', '(공개 집단만)'], fill: BLUE, bold: true, align: CENTER, size: 14 }, { t: `${a.company} · ${a.region}`, fill: BLUE, size: 16 }, { t: `${b.company} · ${b.region}`, fill: BLUE, size: 16 }]);
  S.fields.forEach((f) => rows.push([{ t: f, fill: C.gray, bold: true, align: CENTER, size: 15 }, { t: a.fields[f], size: 16 }, { t: b.fields[f], size: 16 }]));
  out.push(tbl(cw([13, 43.5, 43.5]), rows, { size: 16, padV: 24, padH: 55, keepNext: true }));
  out.push(tbl(cw([9, 44, 47]), [
    qRow(`나-${x.no}`, '두 회사 가운데 한 곳에만 지원할 수 있다면 어느 쪽에 지원하겠습니까?', '① A사에 지원한다  ② A사 쪽에 가깝다  ③ 반반이다  ④ B사 쪽에 가깝다  ⑤ B사에 지원한다'),
  ], { size: 16, padV: 26, padH: 60 }));
  return out;
}

function questionnaire() {
  const out = [h1('Ⅱ. 설문지', { pageBreak: true })];
  out.push(note('응답자가 보는 순서대로 실었다. 파란 줄(기업명 · 근무지역)은 공개 집단에만 보이고, 가림 집단의 화면에는 없다.', { before: 0 }));
  out.push(h2('안내문', { before: 80 }));
  out.push(tbl([W], [[{ t: [
    `**${S.title}**`,
    '부산대학교 학생 연구팀이 2026학년도 PNU Student Choice Awards 공모전 연구로 하는 조사입니다. 실제 채용 공고의 조건으로 만든 회사 카드를 두 장씩 보고, 어느 쪽에 지원하고 싶은지 골라 주시면 됩니다.',
    `- 걸리는 시간은 ${S.minutes}입니다. 부산대학교 학부 재학생·휴학생만 응답해 주세요.`,
    '- 카드의 조건은 최근 1년 안팎에 실제로 나온 신입 채용 공고와 회사 공식 자료에서 가져왔습니다. 지금은 마감된 공고도 있습니다.',
    '- 내 전공과 맞지 않는 직무도 있습니다. 그럴 때는 지원 자격이 된다고 가정하고, 두 회사의 조건만 견주어 골라 주세요.',
    '- 응답하는 동안 카드 내용을 검색하지 말아 주세요. 정답은 없습니다.',
    `- 이름·학번·연락처를 묻지 않습니다. 학교 계정 로그인은 한 사람이 한 번만 응답하게 하는 데만 쓰고 이메일은 저장하지 않습니다. 응답은 통계로만 쓰고 원자료는 ${S.purgeDate}에 파기합니다.`,
    `- ${S.prize.replace('보낸다', '보내 드립니다').replace('않는다', '않습니다')}.`,
    '- 응답은 언제든 그만둘 수 있고, 그만두어도 불이익이 없습니다.',
  ], fill: C.gray }]], { size: 17, padV: 80, padH: 140 }));

  out.push(h2('가. 시작 문항'));
  out.push(qTable([
    ['가-1', '위 안내를 읽었고 조사 참여에 동의합니까?', '① 동의한다  ② 동의하지 않는다(설문 끝)'],
    ['가-2', '소속 계열을 고르세요.', '① 공학  ② 자연  ③ 인문·사회  ④ 상경  ⑤ 사범·예체능·기타'],
    ['가-3', '학년을 고르세요.', '① 1학년  ② 2학년  ③ 3학년  ④ 4학년 이상(졸업 유예 포함)  ⑤ 휴학 중'],
    ['가-4', '생일의 \'일\'을 고르세요(묶음을 나누는 데만 씁니다).', '1~31 가운데 하나(드롭다운). 고른 값에 따라 묶음 1~4로 넘어간다'],
  ]));

  out.push(h2('나. 회사 카드 비교 (10쌍)'));
  out.push(p('아래부터 한 화면에 한 쌍씩 보여 준다. 쌍 5 뒤에 주의 확인 문항 하나를 둔다.', { size: 18 }));
  PAIRS.forEach((x) => {
    out.push(...pairBlock(x));
    if (x.no === 5) {
      out.push(tbl(cw([9, 44, 47]), [qRow('확인', '이 문항은 설문을 주의 깊게 읽고 있는지 확인하는 문항입니다. 아래에서 \'③ 반반이다\'를 골라 주세요.', '① A사에 지원한다  ② A사 쪽에 가깝다  ③ 반반이다  ④ B사 쪽에 가깝다  ⑤ B사에 지원한다')], { size: 16, padV: 26, padH: 60 }));
    }
  });

  out.push(h2('다. 이름을 본 뒤 (가림 집단만)'));
  out.push(p('가림 집단에게는 10쌍을 모두 고른 뒤에 A사·B사가 어느 회사였는지와 근무지역을 한 표로 보여 주고 아래 한 문항을 묻는다. 앞의 응답은 고칠 수 없다.', { size: 18 }));
  out.push(qTable([
    ['다-1', '회사 이름과 근무지역을 보고 나니 선택을 바꾸고 싶은 쌍이 있습니까? 있으면 모두 고르세요.', '□ 쌍 1 … □ 쌍 10  □ 바꾸고 싶은 쌍이 없다'],
  ]));

  out.push(h2('라. 공통 문항 (모든 집단)'));
  out.push(qTable([
    ['라-1', '앞의 10쌍에서 회사를 고를 때 가장 크게 본 조건을 2개까지 고르세요.', '□ 직무와 업무  □ 고용형태와 요건  □ 보상  □ 근무·복지  □ 회사 사업과 규모  □ 기업명(공개 집단만)  □ 근무지역(공개 집단만)'],
    ['라-2', '졸업 뒤 일하고 싶은 지역은 어디입니까?', '① 부산·울산·경남  ② 수도권(서울·경기·인천)  ③ 그 밖의 지역  ④ 지역은 상관없다'],
    ['라-3', '임금과 근무 조건이 기대에 맞는다면 부울경의 중견·중소기업에 취업할 뜻이 있습니까?', '① 전혀 없다  ② 없는 편이다  ③ 반반이다  ④ 있는 편이다  ⑤ 매우 있다'],
    ['라-4', '아래 20개 회사 가운데 이 설문 전부터 이름을 알고 있던 회사를 모두 고르세요.', `□ ${PAIRS.map((x) => x.reg.company).join('  □ ')}  □ ${PAIRS.map((x) => x.metro.company).join('  □ ')}  □ 아는 회사가 없다`],
  ]));
  out.push(h2('마침 안내'));
  out.push(tbl([W], [[{ t: [
    '응답해 주셔서 감사합니다. 이 조사는 기업명과 근무지역을 보여 줄 때와 가릴 때 선택이 달라지는지를 보려는 연구입니다. 조사가 끝날 때까지 주변에 이 내용을 알리지 말아 주세요.',
    '추첨에 참여하려면 아래 완료 코드를 적어 두고 추첨 폼(별도 링크)에 입력해 주세요. 추첨 폼의 연락처는 이 설문의 응답과 연결되지 않습니다.',
  ], fill: C.gray }]], { size: 17, padV: 70, padH: 140 }));
  return out;
}

// ───────── Ⅲ. 분석 계획 ─────────
function analysis() {
  const out = [h1('Ⅲ. 분석 계획 (응답을 보기 전에 정한 규칙)', { pageBreak: true })];
  out.push(h2('1  지표', { before: 0 }));
  out.push(tbl(cw([20, 80]), [
    [lab('부울경 선택 점수'), '쌍마다 1~5점. 응답을 뒤집어 맞춰, 부울경 회사에 지원한다 = 5점, 수도권 회사에 지원한다 = 1점, 반반 = 3점으로 한다.'],
    [lab('학생 선호(기업별)'), '가림 집단의 부울경 선택 점수 평균을 0~100점으로 바꾼 값이다. (평균 − 1) × 25. 50점이면 수도권 짝과 반반, 그보다 높으면 조건만 볼 때 부울경 회사를 더 골랐다는 뜻이다.'],
    [lab('간판 효과(전체)'), '응답자마다 10쌍의 부울경 선택 점수를 평균한 뒤, 공개 집단 평균에서 가림 집단 평균을 뺀 값이다. 음수면 이름과 지역을 보여 줄 때 부울경 회사를 덜 골랐다는 뜻이다. 95% 신뢰구간(부트스트랩 2,000회)을 함께 적는다.'],
    [lab('간판 효과(쌍별)'), '쌍마다 두 집단의 평균 차이와 95% 신뢰구간. 탐색 분석이며, 쌍 하나의 차이만으로 결론을 내리지 않는다.'],
    [lab('선택 이유'), '라-1에서 고른 조건의 비율을 집단별로 본다. 공개 집단에서 \'기업명\'·\'근무지역\'을 고른 비율을 따로 적는다. 가림 집단의 다-1(이름을 본 뒤 바꾸고 싶은 쌍)은 쌍별 비율로 적는다.'],
  ], { size: 17, padV: 40 }));
  out.push(h2('2  제외 기준'));
  ['주의 확인 문항에서 \'③ 반반이다\'가 아닌 것을 고른 응답', '10쌍 모두 같은 번호만 고른 응답', '동의하지 않았거나 10쌍 가운데 3쌍 이상 답하지 않은 응답'].forEach((t) => out.push(bullet(t, { size: 18 })));
  out.push(note('제외한 응답 수는 사유별로 보고한다. 제외 기준은 응답을 열어 보기 전에 이 문서로 고정한다.'));
  out.push(h2('3  표본이 적을 때'));
  [
    '집단(가림·공개)마다 유효 응답이 30명 이상이면 간판 효과의 신뢰구간으로 해석한다.',
    '어느 한 집단이 30명에 못 미치면 평균과 신뢰구간은 적되, 차이가 있다·없다는 결론을 내리지 않는다.',
    '전체 유효 응답이 60명에 못 미치면 기업별 학생 선호는 참고 값으로만 싣고 TOP 3 선정에 쓰지 않는다.',
    '목표 인원을 채우려고 조사 기간 중에 문항이나 카드를 바꾸지 않는다.',
  ].forEach((t) => out.push(bullet(t, { size: 18 })));
  out.push(h2('4  결과보고서에 넣는 방법'));
  [
    '연구계획서의 규칙대로 종합 점수 = 기업 평가 환산점수 × 0.7 + 학생 선호 × 0.3으로 계산한다.',
    '3위 경계에서 학생 선호의 95% 신뢰구간이 겹치면 기업 평가 순위로 정한다.',
    '기업 평가 비중을 60%·80%로 바꿔도 TOP 3가 유지되는지 함께 보인다.',
    '공학 계열과 그 밖의 계열로 나눈 결과, 설문 전부터 이름을 알던 회사만 따로 본 결과(라-4), A·B 자리(순서 1·2)에 따른 차이를 민감도 분석으로 싣는다.',
    '시험 응답과 연습용 자료는 결과에 넣지 않는다. 실제 응답 수와 조사 기간을 그대로 적는다.',
  ].forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

// ───────── Ⅳ. 운영 ─────────
function operation() {
  const out = [h1('Ⅳ. 운영과 개인정보', { before: 300 })];
  out.push(tbl(cw([17, 83]), [
    [lab('도구'), '구글 폼. 학교 계정 로그인으로 1인 1회 응답(이메일은 저장하지 않음), 응답 수정 불가. 시작 문항의 생일(일)에 따라 묶음 1~4의 구역으로 넘어가게 만든다.'],
    [lab('사전 시험'), '배포 전에 팀 밖 학생 3~5명이 네 묶음을 휴대폰으로 끝까지 해 보고, 걸린 시간과 헷갈린 문항을 적는다. 시험 응답은 지운 뒤 배포한다.'],
    [lab('모집'), `에브리타임, 학과 단체방, SNS에 '${S.title}'라는 중립적인 제목으로 알린다. 팀 이름과 가설은 조사가 끝난 뒤 공개한다.`],
    [lab('기간'), '배포일부터 7일. 시작일과 마감일은 배포할 때 안내문과 이 문서에 적는다.'],
    [lab('사례'), `${S.prize}.`],
    [lab('개인정보'), `이름·학번·연락처를 묻지 않는다. IP·기기 정보를 받지 않는다. 생일(일)은 묶음을 나누는 데만 쓴다. 원자료는 팀 계정의 응답 시트에만 두고 ${S.purgeDate}에 파기한다. 저장소와 보고서에는 집계와 그림만 싣는다.`],
    [lab('회사 표기'), '설문 화면과 결과에서 회사의 좋고 나쁨을 평가하는 말을 쓰지 않는다. 결과는 \'같은 조건 카드에서의 선택\'으로만 적는다.'],
  ], { size: 17, padV: 40 }));
  return out;
}

// ───────── 부록 ─────────
function appendix() {
  const out = [h1('부록 A  쌍별 근거 공고', { pageBreak: true })];
  out.push(p(`카드에 쓴 조건의 근거 공고와 시점이다(확인일 ${S.asOf}). 공고는 마감되면 내려갈 수 있다.`, { size: 18 }));
  const short = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  const rows = [[headc('쌍'), headc('부울경 카드의 기준 공고'), headc('수도권 카드의 기준 공고'), headc('수도권 기업의 기업집단'), headc('수도권 공고 출처')]];
  PAIRS.forEach((x) => rows.push([
    { t: String(x.no), align: CENTER, bold: true, fill: C.gray },
    { t: [`**${x.regional}**`, x.regPosting], size: 14 },
    { t: [`**${x.metro.company}**`, x.metro.posting], size: 14 },
    { t: x.metro.group, size: 14 },
    { t: x.metro.urls.map(short).join(', '), size: 13 },
  ]));
  out.push(tbl(cw([5, 30, 27, 20, 18]), rows, { size: 15, padV: 24, padH: 50 }));
  out.push(note('부울경 카드의 출처는 결과보고서 기업별 분석의 출처 목록과 같다. 수도권 카드의 사실별 출처와 확인 수준(두 곳 이상 확인·한 곳 확인)은 연구 노트 「교차검증 2026-11」의 수도권 확인표에 있다.'));

  out.push(h1('부록 B  이 설문의 한계', { before: 300 }));
  [
    '쌍마다 직무와 회사 규모가 완전히 같지는 않다. 특히 쌍 1·6·8은 직무가 다르고, 쌍 8·9의 수도권 기업은 대기업집단 소속이다. 그래서 가림 집단의 선택에는 이름·지역 말고도 조건 차이가 들어 있다. 간판 효과는 같은 카드를 본 두 집단의 차이로 재므로 이 문제의 영향을 덜 받는다.',
    '카드를 칸마다 한 줄로 줄이면서 세부 조건이 빠졌다. 줄이기 전 문안은 부울경 카드는 결과보고서 기업별 분석에, 수도권 카드는 연구 노트의 수도권 확인표에 있다. 부울경 기업은 조사 기간이 길어 아는 정보가 더 많지만, 카드에는 두 쪽 모두 같은 종류의 정보만 실었다.',
    '응답 부담을 줄이려고 걸린 시간을 재는 문항과 쌍마다 이유를 묻는 문항을 뺐다. 그래서 너무 빨리 답한 응답은 주의 확인 문항과 한 번호만 고른 응답으로만 걸러낸다.',
    '고용형태가 다른 쌍이 있다(쌍 2는 계약직 3개월, 쌍 5는 채용연계형 인턴). 이런 쌍에서는 이름·지역이 아니라 고용형태 때문에 선택이 갈릴 수 있다.',
    '기업명과 근무지역을 함께 가리므로 둘의 효과를 나눌 수 없다. 공개 집단이 라-1에서 \'기업명\'과 \'근무지역\' 가운데 무엇을 더 골랐는지로 짐작만 할 수 있다.',
    '생일로 나눈 배정은 무작위에 가깝지만 무작위 배정은 아니다. 자발적으로 응답한 부산대 학생의 결과여서 재학생 전체를 대표하지 않는다.',
    '고른 것은 지원 의향이지 실제 지원이 아니다.',
  ].forEach((t) => out.push(bullet(t, { size: 18 })));
  return out;
}

const children = [...cover(), ...design(), ...questionnaire(), ...analysis(), ...operation(), ...appendix()];
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
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, '| 쌍', PAIRS.length);
});
