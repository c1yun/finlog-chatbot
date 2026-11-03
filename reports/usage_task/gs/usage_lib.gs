// ───────────────────── 간판떼고 학생 사용 과제 폼 라이브러리 ─────────────────────
// CONFIG(위)는 build_usage_gs.js가 usage_spec.json과 자료 파일로 만든다.
// 실행하는 함수: build · verify · status · exportTidy · resetProject

var MAX_MS = 270000; // 한 번 실행에서 4.5분이 넘으면 멈추고 다시 실행하게 한다(구글 제한 6분)
var TZ = 'Asia/Seoul';

function props_() { return PropertiesService.getScriptProperties(); }
function getProp_(k) { return props_().getProperty(k); }
function setProp_(k, v) { props_().setProperty(k, String(v)); }
function log_(s) { Logger.log(s); }
function squash_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

var ITEM_TYPE_ = {
  page: 'PAGE_BREAK', mc: 'MULTIPLE_CHOICE', quiz: 'MULTIPLE_CHOICE', section: 'SECTION_HEADER',
  scale: 'SCALE', text: 'TEXT', list: 'LIST',
};

// ───────── 만들기 ─────────
function build() {
  var t0 = Date.now();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var form;
    var formId = getProp_('FORM_ID');
    if (formId && getProp_('SPEC_HASH') !== CONFIG.specHash) {
      throw new Error('이 프로젝트에는 다른 설계 해시(' + getProp_('SPEC_HASH') + ')로 만든 폼이 있습니다. 새 프로젝트에 붙여넣거나 resetProject 후 실행하세요.');
    }
    if (!formId) {
      form = FormApp.create(CONFIG.title);
      form.setIsQuiz(true); // 정답·배점을 넣으려면 먼저 퀴즈로 바꿔야 한다
      var ss = SpreadsheetApp.create(CONFIG.sheetTitle);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
      form.setDescription(CONFIG.description);
      setProp_('FORM_ID', form.getId());
      setProp_('SS_ID', ss.getId());
      setProp_('SPEC_HASH', CONFIG.specHash);
      setProp_('UNIT_DONE', -1);
      log_('폼과 응답 시트를 만들었습니다.');
    } else {
      form = FormApp.openById(formId);
    }
    if (getProp_('FINALIZED') === '1') { log_('이미 다 만들었습니다. 점검 결과와 링크를 다시 보여 드립니다.'); report_(form); return; }

    // 지난 실행이 쪽 중간에서 끊겼으면 그 쪽의 문항을 지우고 다시 만든다
    var done = Number(getProp_('UNIT_DONE'));
    var expected = done >= 0 ? CONFIG.units[done][1] : 0;
    var items = form.getItems();
    for (var k = items.length - 1; k >= expected; k--) form.deleteItem(k);

    for (var u = done + 1; u < CONFIG.units.length; u++) {
      if (Date.now() - t0 > MAX_MS) {
        log_('시간 제한에 가까워 멈췄습니다. build 를 한 번 더 실행하세요. (진행 ' + u + '/' + CONFIG.units.length + '쪽)');
        return;
      }
      var unit = CONFIG.units[u];
      for (var i = unit[0]; i < unit[1]; i++) addEntry_(form, CONFIG.plan[i]);
      setProp_('UNIT_DONE', u);
    }
    if (Date.now() - t0 > MAX_MS) { log_('문항은 다 만들었습니다. build 를 한 번 더 실행하면 이동·설정을 마칩니다.'); return; }
    finalize_(form);
    report_(form);
  } finally {
    lock.releaseLock();
  }
}

function addEntry_(form, e) {
  var it;
  if (e.type === 'page') {
    it = form.addPageBreakItem().setTitle(e.title);
  } else if (e.type === 'section') {
    it = form.addSectionHeaderItem().setTitle(e.title);
  } else if (e.type === 'mc') {
    it = form.addMultipleChoiceItem().setTitle(e.title).setChoiceValues(e.choices).setRequired(!!e.required);
  } else if (e.type === 'quiz') {
    var q = form.addMultipleChoiceItem().setTitle(e.title).setRequired(!!e.required);
    q.setChoices(e.choices.map(function (c, n) { return q.createChoice(c, n === e.correct - 1); }));
    q.setPoints(e.points);
    it = q;
  } else if (e.type === 'scale') {
    it = form.addScaleItem().setTitle(e.title).setBounds(e.low, e.high).setLabels(e.lowLabel, e.highLabel).setRequired(!!e.required);
  } else if (e.type === 'text') {
    it = form.addTextItem().setTitle(e.title).setRequired(!!e.required);
    if (e.pattern) {
      it.setValidation(FormApp.createTextValidation().setHelpText(e.patternHelp || '').requireTextMatchesPattern(e.pattern).build());
    }
  } else if (e.type === 'list') {
    it = form.addListItem().setTitle(e.title).setChoiceValues(e.choices).setRequired(!!e.required);
  } else {
    throw new Error('알 수 없는 문항 종류 ' + e.type);
  }
  if (e.help) it.setHelpText(e.help);
  return it;
}

function navTarget_(t, byKey) {
  if (t === 'CONTINUE') return FormApp.PageNavigationType.CONTINUE;
  if (t === 'SUBMIT') return FormApp.PageNavigationType.SUBMIT;
  return byKey[t].asPageBreakItem();
}

function finalize_(form) {
  var items = form.getItems();
  if (items.length !== CONFIG.plan.length) throw new Error('문항 수가 계획과 다릅니다: ' + items.length + ' / ' + CONFIG.plan.length + ' — resetProject 후 새로 만드세요.');
  var byKey = {};
  for (var i = 0; i < items.length; i++) {
    var e = CONFIG.plan[i];
    if (String(items[i].getType()) !== ITEM_TYPE_[e.type]) throw new Error((i + 1) + '번째 문항 종류가 다릅니다: ' + items[i].getType() + ' / ' + e.type);
    byKey[e.key] = items[i];
  }
  // 동의 → 계속/제출, 그룹 → 그룹의 첫 자료 쪽
  for (var j = 0; j < CONFIG.plan.length; j++) {
    var p = CONFIG.plan[j];
    if (!p.nav) continue;
    var mc = items[j].asMultipleChoiceItem();
    mc.setChoices(p.choices.map(function (c, n) { return mc.createChoice(c, navTarget_(p.nav[n], byKey)); }));
  }
  // 쪽 구분의 goTo는 '바로 앞 쪽'이 끝난 뒤 갈 곳이다(G1의 마지막 자료 쪽 → 마무리)
  for (var q = 0; q < CONFIG.plan.length; q++) {
    var g = CONFIG.plan[q];
    if (g.type !== 'page' || !g.goTo) continue;
    items[q].asPageBreakItem().setGoToPage(byKey[g.goTo].asPageBreakItem());
  }
  settings_(form);
  writeSheets_(form, items);
  setProp_('FINALIZED', '1');
}

function settings_(form) {
  form.setIsQuiz(true);
  try { form.setCollectEmail(false); } catch (err) { log_('이메일 수집 끄기 실패: ' + err); }
  try { if (FormApp.EmailCollectionType && form.setEmailCollectionType) form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT); } catch (err) { }
  try { form.setRequireLogin(false); } catch (err) { log_('로그인 요구 끄기를 건너뜀(개인 계정이면 원래 꺼져 있음): ' + err); }
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setPublishingSummary(false);
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setConfirmationMessage(CONFIG.confirmation);
  form.setAcceptingResponses(true);
  try { if (typeof form.setPublished === 'function') form.setPublished(true); } catch (err) { }
}

function sheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}
function writeTable_(ss, name, header, rows) {
  var sh = sheet_(ss, name);
  sh.clear();
  var all = [header].concat(rows);
  var rng = sh.getRange(1, 1, all.length, header.length);
  rng.setNumberFormat('@'); // 글자 그대로 둔다(시각·해시가 날짜·숫자로, '='로 시작하는 답이 수식으로 바뀌지 않게)
  rng.setValues(all);
}

function writeSheets_(form, items) {
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  var cb = [];
  for (var i = 0; i < CONFIG.plan.length; i++) {
    var e = CONFIG.plan[i];
    if (e.type === 'page' || e.type === 'section') continue;
    cb.push([i + 1, String(items[i].getId()), e.key, e.qkey || '', e.type, e.group || '', e.company || '', e.format || '',
      e.title, JSON.stringify(e.choices || []), e.correct || '']);
  }
  writeTable_(ss, 'codebook', ['idx', 'item_id', 'key', 'qkey', 'type', 'group', 'company', 'format', 'title', 'choices_json', 'correct'], cb);
  writeTable_(ss, 'meta', ['key', 'value'], [
    ['spec_hash', CONFIG.specHash], ['form_id', form.getId()],
    ['built_at', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')],
    ['note', '참가 번호만 받는다. 팀원만 보고 2026-12-31에 폼 응답과 이 시트를 지운다.'],
  ]);
}

function report_(form) {
  var errs = verify();
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  log_('────────────────────────────');
  log_(errs.length ? '점검(verify) 실패 ' + errs.length + '건 — 위 오류를 팀에 알려 주세요.' : '점검(verify) 통과 · 설계 해시 ' + CONFIG.specHash);
  log_('응답 링크(참가자용): ' + form.getPublishedUrl());
  log_('수정 링크(팀용): ' + form.getEditUrl());
  log_('응답 시트: ' + ss.getUrl());
  CONFIG.manualSteps.forEach(function (s, n) { log_('직접 할 일 ' + (n + 1) + ': ' + s); });
}

// ───────── 점검 ─────────
function verify() {
  var form = FormApp.openById(getProp_('FORM_ID'));
  var items = form.getItems();
  var errs = [];
  if (items.length !== CONFIG.plan.length) { errs.push('문항 수 ' + items.length + ' ≠ ' + CONFIG.plan.length); log_('오류: ' + errs[0]); return errs; }
  var byKey = {};
  for (var i = 0; i < items.length; i++) {
    var e = CONFIG.plan[i];
    if (String(items[i].getType()) !== ITEM_TYPE_[e.type]) errs.push((i + 1) + '번째 문항 종류 ' + items[i].getType() + ' ≠ ' + e.type);
    else if (squash_(items[i].getTitle()) !== squash_(e.title)) errs.push((i + 1) + '번째 제목이 다름: ' + items[i].getTitle());
    byKey[e.key] = items[i];
  }
  if (errs.length) { errs.forEach(function (x) { log_('오류: ' + x); }); return errs; }
  var idOf = function (k) { return byKey[k].getId(); };
  // 1) 동의·그룹 이동
  CONFIG.plan.forEach(function (p) {
    if (!p.nav) return;
    var ch = byKey[p.key].asMultipleChoiceItem().getChoices();
    p.nav.forEach(function (t, n) {
      if (!ch[n] || ch[n].getValue() !== p.choices[n]) { errs.push(p.key + ' 선택지 ' + (n + 1) + ' 글이 다름'); return; }
      if (t === 'CONTINUE' || t === 'SUBMIT') {
        if (ch[n].getPageNavigationType() !== FormApp.PageNavigationType[t]) errs.push(p.key + ' ' + p.choices[n] + ' → ' + t + ' 이동 오류');
      } else {
        var pb = ch[n].getPageBreakItem();
        if (!pb || pb.getId() !== idOf(t)) errs.push(p.key + ' ' + p.choices[n] + ' → ' + t + ' 이동 오류');
      }
    });
  });
  // 2) 첫 그룹의 마지막 자료 쪽 → 마무리
  CONFIG.plan.forEach(function (p) {
    if (p.type !== 'page' || !p.goTo) return;
    var g = byKey[p.key].asPageBreakItem().getGoToPage();
    if (!g || g.getId() !== idOf(p.goTo)) errs.push(p.key + ' 앞 쪽이 끝난 뒤 ' + p.goTo + '로 가지 않음');
  });
  // 3) 자료 칸과 정답
  CONFIG.plan.forEach(function (p) {
    var it = byKey[p.key];
    if (p.help && squash_(it.getHelpText()) !== squash_(p.help)) errs.push(p.key + ' 설명(자료) 글이 다름');
    if (p.type !== 'quiz') return;
    var q = it.asMultipleChoiceItem();
    var ch = q.getChoices();
    if (ch.length !== p.choices.length) { errs.push(p.key + ' 선택지 수 오류'); return; }
    var right = 0;
    ch.forEach(function (c, n) {
      if (c.getValue() !== p.choices[n]) errs.push(p.key + ' 선택지 ' + (n + 1) + ' 글이 다름');
      if (c.isCorrectAnswer()) { right++; if (n !== p.correct - 1) errs.push(p.key + ' 정답 위치 오류'); }
    });
    if (right !== 1) errs.push(p.key + ' 정답이 ' + right + '개');
    if (q.getPoints() !== p.points) errs.push(p.key + ' 배점 ' + q.getPoints());
    if (!q.isRequired()) errs.push(p.key + ' 필수 아님');
  });
  // 4) 설정
  if (!form.isQuiz()) errs.push('퀴즈가 꺼져 있음');
  try { if (form.collectsEmail()) errs.push('이메일 수집이 켜져 있음'); } catch (err) { }
  try { if (form.requiresLogin()) errs.push('로그인 요구가 켜져 있음'); } catch (err) { }
  if (form.hasLimitOneResponsePerUser()) errs.push('1인 1회 제한이 켜져 있음(로그인이 필요해짐)');
  if (form.getShuffleQuestions()) errs.push('문항 섞기가 켜져 있음');
  errs.forEach(function (x) { log_('오류: ' + x); });
  return errs;
}

// ───────── 정리 시트(분석용, 1인 1행) ─────────
function hash12_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
  return bytes.slice(0, 6).map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}

function tidyRows_() {
  var form = FormApp.openById(getProp_('FORM_ID'));
  var items = form.getItems();
  // 문항 순서가 곧 열 정의다. 만든 뒤 폼을 손으로 고쳤으면 응답을 잘못 옮기지 않게 멈춘다.
  if (items.length !== CONFIG.plan.length) throw new Error('폼 문항 수가 설계와 다릅니다(' + items.length + ' / ' + CONFIG.plan.length + '). 폼을 손으로 고쳤는지 확인하고 verify 를 실행하세요.');
  var planOf = {};
  for (var i = 0; i < items.length; i++) {
    if (squash_(items[i].getTitle()) !== squash_(CONFIG.plan[i].title)) throw new Error((i + 1) + '번째 문항 제목이 설계와 다릅니다: ' + items[i].getTitle());
    planOf[String(items[i].getId())] = CONFIG.plan[i];
  }
  var groups = Object.keys(CONFIG.groups);
  var rows = []; var texts = [];
  form.getResponses().forEach(function (resp) {
    var a = {};
    resp.getItemResponses().forEach(function (ir) {
      var e = planOf[String(ir.getItem().getId())];
      if (e) a[e.key] = ir.getResponse();
    });
    var consent = a.CONSENT === undefined ? '' : (a.CONSENT === CONFIG.consentYes ? 1 : 2);
    var group = a.GROUP || '';
    var pidRaw = a.PID === undefined ? '' : String(a.PID);
    var isTest = pidRaw === CONFIG.pidTest;
    var row = { resp_key: hash12_(String(resp.getId())), submitted_at: Utilities.formatDate(resp.getTimestamp(), TZ, 'yyyy-MM-dd HH:mm'),
      consent: consent, group: group, pid: isTest ? 'test' : pidRaw, spec_hash: CONFIG.specHash };
    var conflict = false; var missing = false;
    CONFIG.order.forEach(function (name) {
      var code = CONFIG.codes[name]; var lc = code.toLowerCase();
      var fromGroups = groups.filter(function (g) { return CONFIG.plan.some(function (p) { return p.type === 'quiz' && p.group === g && p.code === code && a[p.key] !== undefined; }); });
      if (fromGroups.length > 1) conflict = true;
      var seen = fromGroups.length === 1 ? fromGroups[0] : (CONFIG.groups[group] ? group : '');
      row[lc + '_format'] = CONFIG.groups[group] ? CONFIG.groups[group][name] : '';
      var score = 0;
      CONFIG.plan.forEach(function (p) {
        if (p.type !== 'quiz' || p.group !== seen || p.code !== code) return;
        var v = a[p.key];
        var n = v === undefined ? 0 : p.choices.indexOf(v) + 1;
        row[lc + '_q' + p.qkey.slice(code.length)] = n || '';
        if (!n) missing = true;
        if (n === p.correct) score++;
      });
      if (!seen) { missing = true; for (var k = 1; k <= 6; k++) row[lc + '_q' + k] = ''; }
      row[lc + '_score'] = seen ? score : '';
      var t = a[code + '_TIME'];
      row[lc + '_time_s'] = t === undefined || t === '' ? '' : Number(t);
      var ez = a[code + '_EASE'];
      row[lc + '_ease'] = ez === undefined || ez === '' ? '' : Number(ez);
    });
    var status = 'complete';
    if (consent !== 1) status = 'no_consent';
    else if (isTest) status = 'test';
    else if (conflict) status = 'path_conflict';
    else if (!CONFIG.groups[group] || !pidRaw || missing) status = 'incomplete';
    row.status = status;
    rows.push(CONFIG.tidyHeader.map(function (h) { return row[h] === undefined ? '' : row[h]; }));
    var more = CONFIG.order.map(function (name) { var v = a[CONFIG.codes[name] + '_MORE']; return v === undefined ? '' : String(v); });
    if (more.some(function (x) { return x; })) texts.push([row.resp_key].concat(more));
  });
  return { rows: rows, texts: texts };
}

function exportTidy() {
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  var t = tidyRows_();
  writeTable_(ss, 'tidy', CONFIG.tidyHeader, t.rows);
  writeTable_(ss, 'tidy_text', CONFIG.textHeader, t.texts);
  log_('정리 시트를 썼습니다: tidy ' + t.rows.length + '행, tidy_text ' + t.texts.length + '행. tidy 시트를 CSV로 내려받아 분석하세요.');
  return t;
}

// ───────── 진행 중 확인 ─────────
function status() {
  var t = tidyRows_();
  var H = CONFIG.tidyHeader;
  var col = function (name) { return H.indexOf(name); };
  var count = {}; var pids = {}; var byGroup = {};
  t.rows.forEach(function (r) {
    var s = r[col('status')]; count[s] = (count[s] || 0) + 1;
    if (s !== 'complete') return;
    var g = r[col('group')]; byGroup[g] = (byGroup[g] || 0) + 1;
    var p = String(r[col('pid')]); pids[p] = (pids[p] || 0) + 1;
  });
  log_('응답 ' + t.rows.length + '건: ' + Object.keys(count).map(function (k) { return k + ' ' + count[k]; }).join(' · '));
  log_('완료: ' + Object.keys(CONFIG.groups).map(function (g) { return g + ' ' + (byGroup[g] || 0) + '명'; }).join(' · '));
  var used = Object.keys(pids).sort(function (x, y) { return Number(x) - Number(y); });
  log_('쓴 참가 번호: ' + (used.join(', ') || '없음'));
  var dup = used.filter(function (p) { return pids[p] > 1; });
  if (dup.length) log_('주의: 두 번 이상 나온 참가 번호 ' + dup.join(', ') + ' (분석은 먼저 제출한 응답만 씀)');
  var odd = t.rows.filter(function (r) {
    var p = Number(r[col('pid')]);
    return r[col('status')] === 'complete' && p && ((p % 2 === 1) !== (r[col('group')] === 'G1'));
  }).length;
  if (odd) log_('주의: 참가 번호 홀짝과 고른 그룹이 다른 응답 ' + odd + '건(홀수 G1, 짝수 G2)');
  return t;
}

function resetProject() {
  // 폼과 시트는 지우지 않는다. 이 프로젝트가 기억하는 연결만 지운다(다시 build 하면 새 폼을 만든다).
  props_().deleteAllProperties();
  log_('프로젝트 연결을 지웠습니다. 이전 폼·시트는 드라이브에 그대로 남아 있습니다.');
}
