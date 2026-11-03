// ───────────────────────── 간판떼고 설문 폼 라이브러리 ─────────────────────────
// CONFIG(위)는 build_form_gs.js가 저장소의 문안·카드·설계로 만든다.
// 실행하는 함수: build · verify · status · launch · closeSurvey · exportTidy · purgeTestResponses · rebalance · resetProject

var MAX_MS = 270000; // 한 번 실행에서 4.5분이 넘으면 멈추고 다시 실행하게 한다(구글 제한 6분)
var TZ = 'Asia/Seoul';

function props_() { return PropertiesService.getScriptProperties(); }
function getProp_(k) { return props_().getProperty(k); }
function setProp_(k, v) { props_().setProperty(k, String(v)); }
function log_(s) { Logger.log(s); }

var ITEM_TYPE_ = {
  page: 'PAGE_BREAK', mc: 'MULTIPLE_CHOICE', list: 'LIST', checkbox: 'CHECKBOX', grid: 'GRID',
  paragraph: 'PARAGRAPH_TEXT', time: 'TIME', text: 'TEXT', section: 'SECTION_HEADER',
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
      throw new Error('이 프로젝트에는 다른 설계 해시(' + getProp_('SPEC_HASH') + ')로 만든 폼이 있습니다. 새 프로젝트에 붙여넣어 실행하세요.');
    }
    if (!formId) {
      form = FormApp.create(CONFIG.title);
      var ss = SpreadsheetApp.create(CONFIG.sheetTitle);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
      form.setDescription(CONFIG.description);
      setProp_('FORM_ID', form.getId());
      setProp_('SS_ID', ss.getId());
      setProp_('SPEC_HASH', CONFIG.specHash);
      setProp_('MODE', CONFIG.mode);
      setProp_('UNIT_DONE', -1);
      log_('폼과 응답 시트를 만들었습니다.');
    } else {
      form = FormApp.openById(formId);
    }
    if (getProp_('FINALIZED') === '1') { log_('이미 다 만들었습니다. verify 결과와 링크를 다시 보여 드립니다.'); report_(form); return; }

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
  } else if (e.type === 'mc') {
    it = form.addMultipleChoiceItem().setTitle(e.title).setChoiceValues(e.choices).setRequired(!!e.required);
  } else if (e.type === 'list') {
    it = form.addListItem().setTitle(e.title).setChoiceValues(e.choices).setRequired(!!e.required);
  } else if (e.type === 'checkbox') {
    it = form.addCheckboxItem().setTitle(e.title).setChoiceValues(e.choices).setRequired(!!e.required);
    if (e.other) it.showOtherOption(true);
    if (e.max) it.setValidation(FormApp.createCheckboxValidation().requireSelectAtMost(e.max).build());
  } else if (e.type === 'grid') {
    it = form.addGridItem().setTitle(e.title).setRows(e.rows).setColumns(e.cols).setRequired(!!e.required);
  } else if (e.type === 'paragraph') {
    it = form.addParagraphTextItem().setTitle(e.title).setRequired(!!e.required);
  } else if (e.type === 'time') {
    it = form.addTimeItem().setTitle(e.title).setRequired(!!e.required);
  } else if (e.type === 'text') {
    it = form.addTextItem().setTitle(e.title).setRequired(!!e.required);
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
  if (items.length !== CONFIG.plan.length) throw new Error('문항 수가 계획과 다릅니다: ' + items.length + ' / ' + CONFIG.plan.length + ' — resetProject 후 새 프로젝트에서 다시 만드세요.');
  var byKey = {};
  for (var i = 0; i < items.length; i++) {
    var e = CONFIG.plan[i];
    if (String(items[i].getType()) !== ITEM_TYPE_[e.type]) throw new Error((i + 1) + '번째 문항 종류가 다릅니다: ' + items[i].getType() + ' / ' + e.type);
    byKey[e.key] = items[i];
  }
  // 선택지에 따른 이동
  for (var j = 0; j < CONFIG.plan.length; j++) {
    var p = CONFIG.plan[j];
    if (!p.nav) continue;
    if (p.type === 'mc') {
      var mc = items[j].asMultipleChoiceItem();
      mc.setChoices(p.choices.map(function (c, n) { return mc.createChoice(c, navTarget_(p.nav[n], byKey)); }));
    } else if (p.type === 'list') {
      var li = items[j].asListItem();
      li.setChoices(p.choices.map(function (c, n) { return li.createChoice(c, navTarget_(p.nav[n], byKey)); }));
    }
  }
  // 쪽이 끝나면 어디로: 쪽 구분(page break)의 goTo는 '바로 앞 쪽'이 끝난 뒤 갈 곳이다
  for (var q = 0; q < CONFIG.plan.length; q++) {
    var g = CONFIG.plan[q];
    if (g.type !== 'page' || !g.goTo) continue;
    var pb = items[q].asPageBreakItem();
    if (g.goTo === 'SUBMIT') pb.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    else pb.setGoToPage(byKey[g.goTo].asPageBreakItem());
  }
  var lottery = buildLottery_();
  settings_(form, lottery);
  writeSheets_(form, items);
  setProp_('FINALIZED', '1');
}

function buildLottery_() {
  var id = getProp_('LOTTERY_ID');
  if (id) return FormApp.openById(id);
  var L = CONFIG.lottery;
  var lf = FormApp.create(L.title);
  var lss = SpreadsheetApp.create(L.sheetTitle);
  lf.setDestination(FormApp.DestinationType.SPREADSHEET, lss.getId());
  lf.setDescription(L.description);
  var code = lf.addTextItem().setTitle(L.code).setRequired(true);
  code.setValidation(FormApp.createTextValidation().setHelpText('설문 완료 화면의 코드를 그대로 적어 주세요.')
    .requireTextMatchesPattern('^' + CONFIG.completionCode + '$').build());
  var phone = lf.addTextItem().setTitle(L.phone).setRequired(true);
  phone.setValidation(FormApp.createTextValidation().setHelpText('010-1234-5678 형식으로 적어 주세요.')
    .requireTextMatchesPattern('^01[016789]-?[0-9]{3,4}-?[0-9]{4}$').build());
  lf.addMultipleChoiceItem().setTitle(L.consent.title).setChoiceValues(L.consent.choices).setRequired(true);
  try { lf.setRequireLogin(true); } catch (err) { log_('추첨 폼 도메인 제한 실패: ' + err); }
  try { lf.setCollectEmail(false); } catch (err) { }
  lf.setAllowResponseEdits(false);
  lf.setShowLinkToRespondAgain(false);
  lf.setPublishingSummary(false);
  lf.setLimitOneResponsePerUser(false);
  lf.setConfirmationMessage('응모되었습니다. 당첨되면 문자로 쿠폰을 보내 드립니다.');
  try { if (typeof lf.setPublished === 'function') lf.setPublished(true); } catch (err) { }
  setProp_('LOTTERY_ID', lf.getId());
  setProp_('LOTTERY_SS_ID', lss.getId());
  setProp_('LOTTERY_CODE_ITEM', code.getId());
  return lf;
}

function lotteryUrl_(lf) {
  var codeItem = lf.getItemById(Number(getProp_('LOTTERY_CODE_ITEM'))).asTextItem();
  return lf.createResponse().withItemResponse(codeItem.createResponse(CONFIG.completionCode)).toPrefilledUrl();
}

function settings_(form, lottery) {
  try { form.setRequireLogin(true); } catch (err) { log_('도메인(부산대 계정) 제한을 걸지 못했습니다: ' + err); }
  try { form.setCollectEmail(false); } catch (err) { }
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setPublishingSummary(false);
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setLimitOneResponsePerUser(false); // launch()에서 켠다
  form.setConfirmationMessage(CONFIG.closing + '\n\n완료코드: ' + CONFIG.completionCode + '\n\n' + CONFIG.prize + ' 응모: ' + lotteryUrl_(lottery));
  if (CONFIG.mode === 'launch') {
    form.setAcceptingResponses(false);
    form.setCustomClosedFormMessage('조사 시작 전입니다. 잠시 후 다시 열어 주세요.');
    lottery.setAcceptingResponses(false);
  } else {
    form.setAcceptingResponses(true);
  }
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
  sh.getRange(1, 1, all.length, header.length).setValues(all);
}

function writeSheets_(form, items) {
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  var cb = [];
  for (var i = 0; i < CONFIG.plan.length; i++) {
    var e = CONFIG.plan[i];
    if (e.type === 'page') continue;
    cb.push([i + 1, String(items[i].getId()), e.key, e.var || '', e.type, e.route || '', e.arm || '', e.set || '', e.pos || '',
      e.card_id || '', e.card_type || '', JSON.stringify(e.choices || []), JSON.stringify(e.rows || []), JSON.stringify(e.rowCards || e.cards || [])]);
  }
  writeTable_(ss, 'codebook', ['idx', 'item_id', 'key', 'var', 'type', 'route', 'arm', 'set', 'pos', 'card_id', 'card_type', 'choices_json', 'rows_json', 'row_cards_json'], cb);
  var rt = [];
  CONFIG.routes.forEach(function (r) { r.seq.forEach(function (c, n) { rt.push([r.id, r.arm, r.set, n + 1, c]); }); });
  writeTable_(ss, 'routes', ['route', 'arm', 'set', 'pos', 'card_id'], rt);
  var dm = [];
  CONFIG.strata.forEach(function (s) { CONFIG.dayRoute[s].forEach(function (r, d) { dm.push([s, d + 1, r]); }); });
  writeTable_(ss, 'mapping_log', ['stratum', 'day', 'route', 'changed_at'], dm.map(function (x) { return x.concat(['처음']); }));
  writeTable_(ss, 'meta', ['key', 'value'], [
    ['mode', CONFIG.mode], ['spec_hash', CONFIG.specHash], ['form_id', form.getId()],
    ['built_at', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')],
    ['note', '원자료는 연구팀만 보고 2026-12-31에 파기한다. 이 시트를 공유하지 않는다.'],
  ]);
}

function report_(form) {
  var errs = verify();
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  var lf = FormApp.openById(getProp_('LOTTERY_ID'));
  log_('────────────────────────────');
  log_((errs.length ? 'verify 실패 ' + errs.length + '건 — 위 오류를 연구팀에 알려 주세요.' : 'verify 통과') + ' · 모드 ' + CONFIG.mode + ' · 해시 ' + CONFIG.specHash);
  log_('응답 링크(배포용): ' + form.getPublishedUrl());
  log_('수정 링크: ' + form.getEditUrl());
  log_('응답 시트: ' + ss.getUrl());
  log_('추첨 폼: ' + lf.getPublishedUrl());
  log_('완료코드: ' + CONFIG.completionCode);
  if (CONFIG.mode === 'launch') log_('아직 응답을 받지 않습니다. 준비가 끝나면 launch 를 실행하세요.');
}

// ───────── 점검 ─────────
function verify() {
  var form = FormApp.openById(getProp_('FORM_ID'));
  var items = form.getItems();
  var errs = [];
  if (items.length !== CONFIG.plan.length) { errs.push('문항 수 ' + items.length + ' ≠ ' + CONFIG.plan.length); log_(errs[0]); return errs; }
  var byKey = {};
  for (var i = 0; i < items.length; i++) byKey[CONFIG.plan[i].key] = items[i];
  var idOf = function (k) { return byKey[k].getId(); };
  // 1) 선별 → 종료
  ['S1', 'S2', 'S3'].forEach(function (k) {
    var e = CONFIG.plan.filter(function (x) { return x.key === k; })[0];
    var ch = byKey[k].asMultipleChoiceItem().getChoices();
    e.nav.forEach(function (t, n) {
      var pb = ch[n].getPageBreakItem();
      if (t === 'END' && (!pb || pb.getId() !== idOf('END'))) errs.push(k + ' ' + e.choices[n] + ' → 종료 화면 이동 오류');
      if (t === 'CONTINUE' && ch[n].getPageNavigationType() !== FormApp.PageNavigationType.CONTINUE) errs.push(k + ' 계속 이동 오류');
    });
  });
  // 2) 계열 → 생일 쪽
  var c1 = CONFIG.plan.filter(function (x) { return x.key === 'C1'; })[0];
  var c1ch = byKey.C1.asMultipleChoiceItem().getChoices();
  c1.nav.forEach(function (t, n) { var pb = c1ch[n].getPageBreakItem(); if (!pb || pb.getId() !== idOf(t)) errs.push('계열 ' + c1.choices[n] + ' 이동 오류'); });
  // 3) 생일 → 묶음 첫 카드
  CONFIG.strata.forEach(function (s) {
    var ch = byKey['BD_' + s].asListItem().getChoices();
    for (var d = 0; d < 31; d++) {
      var pb = ch[d].getPageBreakItem();
      var want = idOf('R' + dayRoute_(s)[d] + '_C1');
      if (!pb || pb.getId() !== want) errs.push('생일 ' + (d + 1) + '일(' + s + ') 이동 오류');
    }
  });
  // 4) 묶음 끝 → 공통 쪽, 마지막 쪽 → 제출
  CONFIG.routes.forEach(function (r) {
    if (r.id === 1) return;
    var g = byKey['R' + r.id + '_C1'].asPageBreakItem().getGoToPage();
    if (!g || g.getId() !== idOf('PC')) errs.push((r.id - 1) + '번 묶음 끝 이동 오류');
  });
  if (byKey.END.asPageBreakItem().getPageNavigationType() !== FormApp.PageNavigationType.SUBMIT) errs.push('공개 쪽 다음 제출 이동 오류');
  // 5) 카드 순서와 가림
  CONFIG.routes.forEach(function (r) {
    r.seq.forEach(function (code, n) {
      var pb = byKey['R' + r.id + '_C' + (n + 1)];
      if (pb.getTitle() !== '카드 ' + (n + 1) + ' / 15') errs.push(r.id + '번 묶음 카드 ' + (n + 1) + ' 제목 오류');
      var help = pb.getHelpText();
      if (r.arm === 'closed') {
        CONFIG.leakWords.forEach(function (w) { if (help.indexOf(w) >= 0) errs.push(r.id + '번 묶음 카드 ' + (n + 1) + '에 \'' + w + '\' 노출'); });
        if (help.indexOf('기업: 비공개 · 근무지역: 비공개') !== 0) errs.push(r.id + '번 묶음 카드 ' + (n + 1) + ' 가림 줄 없음');
      } else if (help.indexOf('기업: 비공개') === 0) errs.push(r.id + '번 묶음(공개) 카드 ' + (n + 1) + '가 가려짐');
    });
  });
  // 6) 설정
  try { if (!form.requiresLogin()) errs.push('부산대 계정 로그인 제한이 꺼져 있음'); } catch (err) { errs.push('로그인 제한 확인 불가: ' + err); }
  try { if (form.collectsEmail()) errs.push('이메일 수집이 켜져 있음'); } catch (err) { }
  if (form.hasProgressBar()) errs.push('진행 막대가 켜져 있음');
  errs.forEach(function (x) { log_('오류: ' + x); });
  return errs;
}

// ───────── 운영 ─────────
function status() {
  var tidy = exportTidy();
  var c = {}; var total = 0; var screened = 0;
  tidy.resp.forEach(function (r) {
    if (r.status !== 'complete') { screened++; return; }
    total++;
    var k = r.stratum + '-' + r.route; c[k] = (c[k] || 0) + 1;
  });
  log_('완료 ' + total + '명, 선별 종료 ' + screened + '명');
  CONFIG.strata.forEach(function (s) {
    log_(s + ': ' + CONFIG.routes.map(function (r) { return r.id + '번 ' + (c[s + '-' + r.id] || 0); }).join(' · '));
  });
}

function launch() {
  if (CONFIG.mode !== 'launch') throw new Error('시험용 스크립트입니다. 배포용(form_builder.launch.gs)을 새 프로젝트에서 쓰세요.');
  if (getProp_('FINALIZED') !== '1') throw new Error('build 를 먼저 끝까지 실행하세요.');
  var errs = verify();
  if (errs.length) throw new Error('verify 오류 ' + errs.length + '건이 있어 배포하지 않습니다.');
  var form = FormApp.openById(getProp_('FORM_ID'));
  var lf = FormApp.openById(getProp_('LOTTERY_ID'));
  form.deleteAllResponses();
  lf.deleteAllResponses();
  setProp_('LAUNCH_AT', new Date().toISOString());
  form.setLimitOneResponsePerUser(true);
  lf.setLimitOneResponsePerUser(true);
  lf.setAcceptingResponses(true);
  form.setAcceptingResponses(true);
  installTriggers();
  log_('배포 시작: ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
  log_('응답 링크: ' + form.getPublishedUrl());
}

function closeSurvey() {
  var form = FormApp.openById(getProp_('FORM_ID'));
  form.setAcceptingResponses(false);
  form.setCustomClosedFormMessage('조사가 마감되었습니다. 참여해 주셔서 감사합니다.');
  exportTidy();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'exportTidy') ScriptApp.deleteTrigger(t); });
  setProp_('CLOSED_AT', new Date().toISOString());
  log_('마감했습니다. 추첨 폼은 추첨이 끝날 때까지 열어 둡니다.');
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'exportTidy') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('exportTidy').timeBased().everyHours(1).create();
}

function purgeTestResponses() {
  if (CONFIG.mode !== 'pilot') throw new Error('배포용 폼의 응답은 지우지 않습니다.');
  FormApp.openById(getProp_('FORM_ID')).deleteAllResponses();
  FormApp.openById(getProp_('LOTTERY_ID')).deleteAllResponses();
  exportTidy();
  log_('시험 응답을 지웠습니다.');
}

function resetProject() {
  // 폼과 시트는 지우지 않는다. 이 프로젝트가 기억하는 연결만 지운다(다시 build 하면 새 폼을 만든다).
  props_().deleteAllProperties();
  log_('프로젝트 연결을 지웠습니다. 이전 폼·시트는 드라이브에 그대로 남아 있습니다.');
}

// ───────── 정리 시트(분석용, 문항 ID 기준) ─────────
function hash12_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
  return bytes.slice(0, 6).map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}
function dayRoute_(s) { var v = getProp_('DAYROUTE_' + s); return v ? JSON.parse(v) : CONFIG.dayRoute[s]; }
function codeOf_(choices, v) { var i = choices.indexOf(v); return i >= 0 ? i + 1 : ''; }

function exportTidy() {
  var form = FormApp.openById(getProp_('FORM_ID'));
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  var items = form.getItems();
  var keyOfId = {};
  for (var i = 0; i < items.length && i < CONFIG.plan.length; i++) keyOfId[String(items[i].getId())] = CONFIG.plan[i];
  var since = getProp_('LAUNCH_AT') ? new Date(getProp_('LAUNCH_AT')) : null;
  var respRows = []; var cardRows = []; var textRows = []; var out = { resp: [] };
  var c5rows = (CONFIG.plan.filter(function (x) { return x.key === 'C5'; })[0] || {}).rows || [];
  var d2 = CONFIG.plan.filter(function (x) { return x.key === 'D2'; })[0];
  var d1 = CONFIG.plan.filter(function (x) { return x.key === 'D1'; })[0];
  var allCards = d1.cards;

  form.getResponses().forEach(function (resp) {
    var ts = resp.getTimestamp();
    if (since && ts < since) return;
    var key = hash12_(String(resp.getId()));
    var a = {};
    resp.getItemResponses().forEach(function (ir) {
      var e = keyOfId[String(ir.getItem().getId())];
      if (e) a[e.key] = { e: e, v: ir.getResponse() };
    });
    var get = function (k) { return a[k] ? a[k].v : ''; };
    var mcCode = function (k) { return a[k] ? codeOf_(a[k].e.choices, a[k].v) : ''; };
    // 상태
    var screenedOut = mcCode('S1') !== 1 || mcCode('S2') !== 1 || mcCode('S3') !== 2;
    var complete = !screenedOut && !!a.D2;
    // 묶음
    var routesSeen = CONFIG.routes.filter(function (r) { return !!a['R' + r.id + '_C1_A1']; }).map(function (r) { return r.id; });
    var route = routesSeen.length === 1 ? routesSeen[0] : '';
    var rinfo = CONFIG.routes.filter(function (r) { return r.id === route; })[0];
    var c1 = mcCode('C1');
    var stratum = c1 ? CONFIG.plan.filter(function (x) { return x.key === 'C1'; })[0].nav[c1 - 1].replace('P4', '') : '';
    var bd = ''; CONFIG.strata.forEach(function (s) { if (a['BD_' + s]) bd = Number(a['BD_' + s].v); });
    // 응답 시간(분): 제출 시각 − 시작 시각
    var dur = '';
    var t0 = get('T0');
    if (t0) {
      var m = String(t0).match(/(\d{1,2}):(\d{2})/);
      if (m) {
        var sub = Utilities.formatDate(ts, TZ, 'HH:mm').split(':');
        var diff = (Number(sub[0]) * 60 + Number(sub[1])) - (Number(m[1]) * 60 + Number(m[2]));
        if (diff < 0) diff += 1440;
        dur = diff <= 180 ? diff : '';
      }
    }
    // 카드
    if (rinfo) {
      rinfo.seq.forEach(function (code, n) {
        var k1 = 'R' + route + '_C' + (n + 1) + '_A1';
        var k2 = 'R' + route + '_C' + (n + 1) + '_A2';
        if (!a[k1]) return;
        cardRows.push([key, route, rinfo.arm, rinfo.set, n + 1, code, CONFIG.cardType[code], mcCode(k1), mcCode(k2), get(k2)]);
      });
    }
    // 가림 점검(비공개 묶음)
    var b1 = {}; var b3 = ''; var b2 = '';
    if (rinfo && rinfo.arm === 'closed') {
      var g = a['R' + route + '_B1'];
      if (g) (g.v || []).forEach(function (val, n) { b1[rinfo.seq[n]] = codeOf_(g.e.cols || [], val); });
      b3 = mcCode('R' + route + '_B3');
      b2 = get('R' + route + '_B2');
    }
    var c5codes = c5rows.map(function (_, n) { return a.C5 ? codeOf_(a.C5.e.cols, (a.C5.v || [])[n]) : ''; });
    var c6 = a.C6 ? a.C6.v : []; var c6codes = []; var c6other = '';
    (c6 || []).forEach(function (v) { var cc = codeOf_(a.C6.e.choices, v); if (cc) c6codes.push(cc); else c6other = v; });
    var d1v = a.D1 ? a.D1.v : []; var d1codes = (d1v || []).map(function (v) { return codeOf_(d1.choices, v); }).filter(function (x) { return x; });
    var d2v = a.D2 ? a.D2.v : []; var d2codes = d2.rows.map(function (_, n) { return a.D2 ? codeOf_(d2.cols, (d2v || [])[n]) : ''; });
    var status = screenedOut ? 'screened_out' : (complete ? 'complete' : 'partial');
    var row = [key, status, route, rinfo ? rinfo.arm : '', rinfo ? rinfo.set : '', stratum, c1, mcCode('C2'), bd, dur,
      a['R' + route + '_AC_Q'] ? mcCode('R' + route + '_AC_Q') : '', mcCode('C3'), mcCode('C4')]
      .concat(c5codes)
      .concat([c6codes.join('|'), mcCode('C7'), d1codes.join('|')])
      .concat(d2codes)
      .concat(allCards.map(function (c) { return b1[c] || ''; }))
      .concat([b3, routesSeen.length > 1 ? 1 : 0, Utilities.formatDate(ts, TZ, 'yyyy-MM-dd')]);
    respRows.push(row);
    out.resp.push({ key: key, status: status, route: route, stratum: stratum });
    if (b2 || get('D3') || c6other) textRows.push([key, b2, get('D3'), c6other]);
  });
  var header = ['resp_key', 'status', 'route', 'arm', 'set', 'stratum', 'C1', 'C2', 'birth_day', 'duration_min', 'AC', 'C3', 'C4']
    .concat(c5rows.map(function (_, n) { return 'C5_' + (n + 1); }))
    .concat(['C6', 'C7', 'D1'])
    .concat(d2.rows.map(function (_, n) { return 'D2_' + d2.rowCards[n]; }))
    .concat(allCards.map(function (c) { return 'B1_' + c; }))
    .concat(['B3', 'route_conflict', 'submit_date']);
  writeTable_(ss, 'tidy_resp', header, respRows);
  writeTable_(ss, 'tidy_cards', ['resp_key', 'route', 'arm', 'set', 'pos', 'card_id', 'card_type', 'A1', 'A2', 'A2_label'], cardRows);
  writeTable_(ss, 'tidy_text', ['resp_key', 'B2', 'D3', 'C6_other'], textRows);
  return out;
}

// ───────── 칸 균형 다시 맞추기(밤에만, 필요할 때만) ─────────
function rebalance() {
  if (getProp_('FINALIZED') !== '1') throw new Error('build 를 먼저 끝내세요.');
  var tidy = exportTidy();
  var form = FormApp.openById(getProp_('FORM_ID'));
  var items = form.getItems();
  var byKey = {};
  for (var i = 0; i < items.length; i++) byKey[CONFIG.plan[i].key] = items[i];
  var ss = SpreadsheetApp.openById(getProp_('SS_ID'));
  var logSheet = sheet_(ss, 'mapping_log');
  var stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  CONFIG.strata.forEach(function (s) {
    var cnt = CONFIG.routes.map(function (r) { return tidy.resp.filter(function (x) { return x.status === 'complete' && x.stratum === s && x.route === r.id; }).length; });
    var max = Math.max.apply(null, cnt);
    var w = cnt.map(function (c) { return 1 + 2 * (max - c); });
    var sumw = w.reduce(function (x, y) { return x + y; }, 0);
    var got = [0, 0, 0, 0]; var map = [];
    for (var d = 0; d < 31; d++) {
      var best = 0; var bestGap = -1e9;
      for (var r = 0; r < 4; r++) { var gap = w[r] / sumw * (d + 1) - got[r]; if (gap > bestGap) { bestGap = gap; best = r; } }
      got[best]++; map.push(best + 1);
    }
    var li = byKey['BD_' + s].asListItem();
    li.setChoices(map.map(function (r, d) { return li.createChoice(String(d + 1), byKey['R' + r + '_C1'].asPageBreakItem()); }));
    setProp_('DAYROUTE_' + s, JSON.stringify(map));
    map.forEach(function (r, d) { logSheet.appendRow([s, d + 1, r, stamp]); });
    log_(s + ' 응답 ' + cnt.join('/') + ' → 생일 배정 ' + got.join('/'));
  });
}
