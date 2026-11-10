// 새 설문(부울경 10곳 대 수도권 10곳, 1:1 비교)의 구글 폼을 만드는 Apps Script를 생성한다.
// 설문조사지(reports/간판떼고_설문조사지.pdf)와 같은 문안·카드(pairs_spec.js, cards_regional.json)를 읽으므로 배포본과 문서가 같다.
// 사용: node build_form_pairs_gs.js   →  dist/form_pairs.gs (script.new 에 통째로 붙여넣고 build 를 실행)
const fs = require('fs');
const path = require('path');
const S = require('./pairs_spec');
const REG = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, '../build_result/cards_regional.json'), 'utf-8')).map((c) => [c.key, c]));

const SHORT = { '직무와 업무': '직무', '고용형태와 요건': '고용·요건', '보상': '보상', '근무·복지': '근무·복지', '회사 사업과 규모': '회사' };
const CODE = 'GP-2611'; // 완료 코드(추첨 폼에서 확인)
const CHOICES = ['A사에 지원한다', 'A사 쪽에 가깝다', '반반이다', 'B사 쪽에 가깝다', 'B사에 지원한다'];
const GROUPS = [ // 묶음: 생일(일)을 4로 나눈 나머지 1·2·3·0
  { g: 1, cond: '가림', order: 1 }, { g: 2, cond: '공개', order: 1 }, { g: 3, cond: '가림', order: 2 }, { g: 4, cond: '공개', order: 2 },
];
const cleanName = (s) => s.replace(/\(주\)|주식회사|\(.*?\)/g, '').trim();
const pairs = S.pairs.map((x) => {
  const r = REG[x.regional];
  return {
    no: x.no,
    reg: { company: cleanName(r.open.company), region: r.open.region, fields: S.shortReg[x.regional] },
    metro: { company: x.metro.company, region: x.metro.region, fields: S.shortMetro[x.metro.company] },
  };
});
// 순서 1: 홀수 쌍은 부울경이 A, 짝수 쌍은 수도권이 A. 순서 2는 반대(설문조사지 Ⅰ장 4와 같다)
const regIsA = (no, order) => (no % 2 === 1) === (order === 1);
function cardText(p, grp) {
  const a = regIsA(p.no, grp.order) ? p.reg : p.metro;
  const b = regIsA(p.no, grp.order) ? p.metro : p.reg;
  const block = (label, c) => {
    const head = grp.cond === '공개' ? `▣ ${label}: ${c.company} (근무지역: ${c.region})` : `▣ ${label}`;
    return [head, ...S.fields.map((f) => `· ${SHORT[f]}: ${c.fields[f]}`)].join('\n');
  };
  return `${block('A사', a)}\n\n${block('B사', b)}`;
}
function revealText(grp) {
  return ['앞에서 본 회사는 아래와 같습니다.', ...pairs.map((p) => {
    const a = regIsA(p.no, grp.order) ? p.reg : p.metro;
    const b = regIsA(p.no, grp.order) ? p.metro : p.reg;
    return `쌍 ${p.no}: A사 = ${a.company}(${a.region}) / B사 = ${b.company}(${b.region})`;
  })].join('\n');
}
const CONFIG = {
  title: S.title,
  sheetTitle: `${S.title} (응답)`,
  code: CODE,
  intro: [
    '부산대학교 학생 연구팀이 2026학년도 PNU Student Choice Awards 공모전 연구로 하는 조사입니다. 실제 채용 공고의 조건으로 만든 회사 카드를 두 장씩 보고, 어느 쪽에 지원하고 싶은지 골라 주시면 됩니다.',
    '',
    `· 걸리는 시간은 ${S.minutes}입니다. 부산대학교 학부 재학생·휴학생만 응답해 주세요.`,
    '· 카드의 조건은 최근 1년 안팎에 실제로 나온 신입 채용 공고와 회사 공식 자료에서 가져왔습니다. 지금은 마감된 공고도 있습니다.',
    '· 내 전공과 맞지 않는 직무도 있습니다. 그럴 때는 지원 자격이 된다고 가정하고, 두 회사의 조건만 견주어 골라 주세요.',
    '· 응답하는 동안 카드 내용을 검색하지 말아 주세요. 정답은 없습니다.',
    `· 이름·학번·연락처를 묻지 않습니다. 로그인은 한 사람이 한 번만 응답하게 하는 데만 쓰고 이메일은 저장하지 않습니다. 응답은 통계로만 쓰고 원자료는 ${S.purgeDate}에 파기합니다.`,
    '· 응답을 마친 분 가운데 10명을 추첨해 커피 쿠폰을 보내 드립니다(추첨용 연락처는 별도 폼으로 받아 응답과 연결하지 않습니다).',
    '· 응답은 언제든 그만둘 수 있고, 그만두어도 불이익이 없습니다.',
  ].join('\n'),
  done: [
    '응답해 주셔서 감사합니다.',
    '이 조사는 기업명과 근무지역을 보여 줄 때와 가릴 때 선택이 달라지는지를 보려는 연구입니다. 조사가 끝날 때까지 주변에 이 내용을 알리지 말아 주세요.',
    `추첨에 참여하려면 완료 코드 ${CODE} 를 아래 추첨 폼에 입력해 주세요. 추첨 폼의 연락처는 이 설문의 응답과 연결되지 않습니다.`,
  ].join('\n'),
  choices: CHOICES,
  majors: ['공학', '자연', '인문·사회', '상경', '사범·예체능·기타'],
  grades: ['1학년', '2학년', '3학년', '4학년 이상(졸업 유예 포함)', '휴학 중'],
  reasons: ['직무와 업무', '고용형태와 요건', '보상', '근무·복지', '회사 사업과 규모'],
  reasonsOpen: ['기업명', '근무지역'],
  regions: ['부산·울산·경남', '수도권(서울·경기·인천)', '그 밖의 지역', '지역은 상관없다'],
  willing: ['전혀 없다', '없는 편이다', '반반이다', '있는 편이다', '매우 있다'],
  companies: [...pairs.map((p) => p.reg.company), ...pairs.map((p) => p.metro.company), '아는 회사가 없다'],
  groups: GROUPS.map((grp) => ({
    ...grp,
    pages: pairs.map((p) => ({ no: p.no, text: cardText(p, grp), regIsA: regIsA(p.no, grp.order) })),
    reveal: grp.cond === '가림' ? revealText(grp) : null,
  })),
};

const LIB = String.raw`
// ───────── 간판떼고 새 설문 폼(10쌍 비교) ─────────
// 실행 순서: build(폼·응답 시트·추첨 폼 만들기) → 시험 응답 3~5명 → launch(시험 응답 삭제, 1인 1회 켜기) → 조사 → closeSurvey
// 다시 만들려면 resetProject 를 실행한 뒤 build 를 실행한다(앞서 만든 폼은 드라이브에 그대로 남으니 직접 지운다).
function props_() { return PropertiesService.getScriptProperties(); }

function build() {
  if (props_().getProperty('FORM_ID')) { report_(); throw new Error('이미 만든 폼이 있습니다(위 링크). 새로 만들려면 resetProject 를 먼저 실행하세요.'); }
  // 추첨 폼(완료 코드 확인, 연락처는 설문 응답과 연결되지 않는다)
  var lot = FormApp.create(CONFIG.title + ' 추첨 응모');
  lot.setDescription('설문을 마친 분만 응모할 수 있습니다. 연락처는 추첨과 쿠폰 발송에만 쓰고 추첨 뒤 지웁니다.');
  var codeItem = lot.addTextItem().setTitle('완료 화면에 나온 완료 코드를 적어 주세요.').setRequired(true);
  codeItem.setValidation(FormApp.createTextValidation().setHelpText('완료 코드가 맞지 않습니다.').requireTextMatchesPattern('^\\s*' + CONFIG.code + '\\s*$').build());
  lot.addTextItem().setTitle('쿠폰을 받을 휴대폰 번호 또는 이메일을 적어 주세요.').setRequired(true);
  lot.setCollectEmail(false);
  var lotUrl = lot.getPublishedUrl();
  try { lotUrl = lot.shortenFormUrl(lotUrl); } catch (e) {}

  var form = FormApp.create(CONFIG.title);
  form.setDescription(CONFIG.intro);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setProgressBar(false); // 갈림이 있어 진행 막대가 틀리게 나온다
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(CONFIG.done + '\n추첨 폼: ' + lotUrl);

  var consent = form.addMultipleChoiceItem().setTitle('가-1. 위 안내를 읽었고 조사 참여에 동의합니까?').setRequired(true);
  var pStart = form.addPageBreakItem().setTitle('시작 문항');
  form.addMultipleChoiceItem().setTitle('가-2. 소속 계열을 고르세요.').setChoiceValues(CONFIG.majors).setRequired(true);
  form.addMultipleChoiceItem().setTitle('가-3. 학년을 고르세요.').setChoiceValues(CONFIG.grades).setRequired(true);
  var bday = form.addListItem().setTitle("가-4. 생일의 '일'을 고르세요.").setHelpText('카드 묶음을 나누는 데만 씁니다.').setRequired(true);

  var first = {};
  CONFIG.groups.forEach(function (grp) {
    grp.pages.forEach(function (pg, i) {
      var pb = form.addPageBreakItem().setTitle('쌍 ' + pg.no + ' / 10').setHelpText(pg.text);
      if (i === 0) first[grp.g] = pb;
      form.addMultipleChoiceItem().setTitle('[' + grp.g + '-' + pg.no + '] 두 회사 가운데 한 곳에만 지원할 수 있다면 어느 쪽에 지원하겠습니까?')
        .setChoiceValues(CONFIG.choices).setRequired(true);
      if (pg.no === 5) {
        form.addMultipleChoiceItem().setTitle('[' + grp.g + '-확인] 설문을 주의 깊게 읽고 있는지 확인하는 문항입니다. 아래에서 \'반반이다\'를 골라 주세요.')
          .setChoiceValues(CONFIG.choices).setRequired(true);
      }
    });
    var fin = form.addPageBreakItem().setTitle('고른 이유');
    if (grp.reveal) {
      fin.setHelpText(grp.reveal);
      form.addCheckboxItem().setTitle('[' + grp.g + '-다1] 회사 이름과 근무지역을 보고 나니 선택을 바꾸고 싶은 쌍이 있습니까? 있으면 모두 고르세요.')
        .setChoiceValues(grp.pages.map(function (pg) { return '쌍 ' + pg.no; }).concat(['바꾸고 싶은 쌍이 없다'])).setRequired(true);
    }
    var reasons = grp.cond === '공개' ? CONFIG.reasons.concat(CONFIG.reasonsOpen) : CONFIG.reasons;
    var r = form.addCheckboxItem().setTitle('[' + grp.g + '-라1] 앞의 10쌍에서 회사를 고를 때 가장 크게 본 조건을 2개까지 고르세요.').setChoiceValues(reasons).setRequired(true);
    r.setValidation(FormApp.createCheckboxValidation().setHelpText('2개까지 고를 수 있습니다.').requireSelectAtMost(2).build());
  });

  var common = form.addPageBreakItem().setTitle('마지막 문항');
  form.addMultipleChoiceItem().setTitle('라-2. 졸업 뒤 일하고 싶은 지역은 어디입니까?').setChoiceValues(CONFIG.regions).setRequired(true);
  form.addMultipleChoiceItem().setTitle('라-3. 임금과 근무 조건이 기대에 맞는다면 부울경의 중견·중소기업에 취업할 뜻이 있습니까?').setChoiceValues(CONFIG.willing).setRequired(true);
  form.addCheckboxItem().setTitle('라-4. 아래 20개 회사 가운데 이 설문 전부터 이름을 알고 있던 회사를 모두 고르세요.').setChoiceValues(CONFIG.companies).setRequired(true);

  // 이동: 동의 → 시작 문항, 생일 → 묶음 첫 쪽, 각 묶음 끝 → 마지막 문항
  consent.setChoices([consent.createChoice('동의한다', pStart), consent.createChoice('동의하지 않는다', FormApp.PageNavigationType.SUBMIT)]);
  var ch = [];
  for (var d = 1; d <= 31; d++) { var g = d % 4 === 0 ? 4 : d % 4; ch.push(bday.createChoice(String(d), first[g])); }
  bday.setChoices(ch);
  [2, 3, 4].forEach(function (g) { first[g].setGoToPage(common); }); // 앞 묶음의 마지막 쪽을 마치면 '마지막 문항'으로

  var ss = SpreadsheetApp.create(CONFIG.sheetTitle);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var key = ss.insertSheet('묶음_열쇠');
  var rows = [['묶음', '집단', '순서', '쌍', '부울경 회사가 놓인 자리']];
  CONFIG.groups.forEach(function (grp) { grp.pages.forEach(function (pg) { rows.push([grp.g, grp.cond, grp.order, pg.no, pg.regIsA ? 'A' : 'B']); }); });
  key.getRange(1, 1, rows.length, 5).setValues(rows);

  props_().setProperty('FORM_ID', form.getId());
  props_().setProperty('SS_ID', ss.getId());
  props_().setProperty('LOT_ID', lot.getId());
  report_();
  verify();
  Logger.log('다 만들었습니다. 위 응답 링크로 시험 응답을 해 본 뒤 launch 를 실행하세요.');
}

function report_() {
  var form = FormApp.openById(props_().getProperty('FORM_ID'));
  Logger.log('설문 폼(응답 링크): ' + form.getPublishedUrl());
  Logger.log('설문 폼(편집): ' + form.getEditUrl());
  Logger.log('응답 시트: ' + SpreadsheetApp.openById(props_().getProperty('SS_ID')).getUrl());
  Logger.log('추첨 폼(편집): ' + FormApp.openById(props_().getProperty('LOT_ID')).getEditUrl());
}

// 만든 폼이 설계와 맞는지 본다: 묶음마다 10쌍·확인 문항 1개, 생일 31개가 묶음 첫 쪽으로 가는지
function verify() {
  var form = FormApp.openById(props_().getProperty('FORM_ID'));
  var items = form.getItems();
  var n = { pair: {}, check: {}, pages: 0 };
  items.forEach(function (it) {
    var t = it.getTitle();
    var m = /^\[(\d)-(\d+)\]/.exec(t);
    if (m) n.pair[m[1]] = (n.pair[m[1]] || 0) + 1;
    var c = /^\[(\d)-확인\]/.exec(t);
    if (c) n.check[c[1]] = (n.check[c[1]] || 0) + 1;
    if (it.getType() === FormApp.ItemType.PAGE_BREAK) n.pages++;
  });
  var bad = [];
  ['1', '2', '3', '4'].forEach(function (g) { if (n.pair[g] !== 10) bad.push('묶음 ' + g + ' 쌍 문항 ' + n.pair[g]); if (n.check[g] !== 1) bad.push('묶음 ' + g + ' 확인 문항 ' + n.check[g]); });
  if (n.pages !== 46) bad.push('쪽 수 ' + n.pages + '(46이어야 함)');
  var bday = items.filter(function (it) { return it.getType() === FormApp.ItemType.LIST; })[0].asListItem();
  var dest = {};
  bday.getChoices().forEach(function (c) { var p = c.getGotoPage(); var k = p ? p.getTitle() + '#' + p.getIndex() : '없음'; dest[k] = (dest[k] || 0) + 1; });
  if (Object.keys(dest).length !== 4 || dest['없음']) bad.push('생일 이동 ' + JSON.stringify(dest));
  Logger.log(bad.length ? '점검 실패: ' + bad.join(' / ') : '점검 통과: 묶음 4개 × 10쌍, 확인 문항 4개, 생일 31개 → 묶음 4개');
  if (bad.length) throw new Error(bad.join(' / '));
}

// 본조사 시작: 시험 응답을 지우고 1인 1회 응답을 켠다
function launch() {
  var form = FormApp.openById(props_().getProperty('FORM_ID'));
  form.deleteAllResponses();
  form.setLimitOneResponsePerUser(true); // 구글 로그인이 필요해진다(이메일은 저장하지 않음)
  try { form.setRequireLogin(true); } catch (e) { Logger.log('학교 계정 전용 설정은 건너뜁니다(개인 계정으로 만든 폼): ' + e); }
  try { form.setAcceptingResponses(true); } catch (e) { Logger.log('응답 받기 설정은 폼 편집 화면에서 확인하세요: ' + e); }
  props_().setProperty('LAUNCHED_AT', new Date().toISOString());
  Logger.log('본조사를 시작했습니다. 시험 응답은 지웠습니다.');
  report_();
}

function closeSurvey() {
  var form = FormApp.openById(props_().getProperty('FORM_ID'));
  try { form.setAcceptingResponses(false); } catch (e) { Logger.log('폼 편집 화면에서 응답 받기를 직접 꺼 주세요: ' + e); }
  try { form.setCustomClosedFormMessage('조사가 끝났습니다. 참여해 주셔서 감사합니다.'); } catch (e) {}
  Logger.log('응답 받기를 닫았습니다. 응답 수: ' + form.getResponses().length);
}

// 묶음별 응답 수(조사 중에 수시로)
function status() {
  var form = FormApp.openById(props_().getProperty('FORM_ID'));
  var cnt = { 1: 0, 2: 0, 3: 0, 4: 0 };
  form.getResponses().forEach(function (r) {
    var g = null;
    r.getItemResponses().forEach(function (ir) { var m = /^\[(\d)-1\]/.exec(ir.getItem().getTitle()); if (m) g = m[1]; });
    if (g) cnt[g]++;
  });
  Logger.log('응답 ' + form.getResponses().length + '건 | 묶음 1(가림) ' + cnt[1] + ', 2(공개) ' + cnt[2] + ', 3(가림) ' + cnt[3] + ', 4(공개) ' + cnt[4]);
}

// 학교 계정 로그인이 막혀 응답이 안 들어올 때만: 계정 제한을 풀고 1인 1회는 유지한다(바꾼 시각을 기록)
function openToAnyGoogleAccount() {
  var form = FormApp.openById(props_().getProperty('FORM_ID'));
  try { form.setRequireLogin(false); } catch (e) { Logger.log('계정 제한 해제 실패: ' + e); }
  props_().setProperty('OPENED_AT', new Date().toISOString());
  Logger.log('학교 계정 제한을 풀었습니다. 1인 1회 응답은 그대로입니다.');
}

function resetProject() { props_().deleteAllProperties(); Logger.log('이 프로젝트의 기록을 지웠습니다. 앞서 만든 폼·시트는 드라이브에서 직접 지우세요.'); }
`;

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const out = `// 자동 생성 파일(build_form_pairs_gs.js). 고치려면 pairs_spec.js 를 고친 뒤 다시 생성한다.\n// 설문: ${S.title} · ${S.version} · 쌍 ${pairs.length}개 · 묶음 4개\nvar CONFIG = ${JSON.stringify(CONFIG, null, 1)};\n${LIB}`;
const file = path.join(__dirname, 'dist', 'form_pairs.gs');
fs.writeFileSync(file, out);
// 가린 묶음의 카드에 기업명·지역명이 없는지 한 번 더 본다
const leaks = [];
CONFIG.groups.filter((g) => g.cond === '가림').forEach((g) => g.pages.forEach((pg) => S.banned.forEach((w) => { if (pg.text.includes(w)) leaks.push(`묶음 ${g.g} 쌍 ${pg.no}: ${w}`); })));
if (leaks.length) { console.error('가린 카드에 가려야 할 말이 있다:\n' + leaks.join('\n')); process.exit(2); }
console.log('wrote', file, out.length, 'bytes | 묶음', CONFIG.groups.length, '| 쌍', pairs.length);
