// Google Apps Script(FormApp·SpreadsheetApp 등) 최소 모의 객체. usage_lib.gs를 Node에서 시험하려고 만든다.
// reports/survey/test/mock_gas.js를 복사해 퀴즈(정답·배점), 제목·설명 칸(SECTION_HEADER), 척도(SCALE), 글자 검증을 더했다.
// 실제 API 동작 중 이 스크립트가 쓰는 부분만 흉내 낸다(이동 규칙: 선택지 이동 > 다음 쪽 구분의 goTo > 다음 쪽).
const crypto = require('crypto');

let NEXT_ID = 1000;
const newId = () => ++NEXT_ID;

const PageNavigationType = { CONTINUE: 'CONTINUE', GO_TO_PAGE: 'GO_TO_PAGE', RESTART: 'RESTART', SUBMIT: 'SUBMIT' };
const ItemType = { PAGE_BREAK: 'PAGE_BREAK', MULTIPLE_CHOICE: 'MULTIPLE_CHOICE', LIST: 'LIST', CHECKBOX: 'CHECKBOX', GRID: 'GRID', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', TIME: 'TIME', TEXT: 'TEXT', SECTION_HEADER: 'SECTION_HEADER', SCALE: 'SCALE' };
const NO_ANSWER = [ItemType.PAGE_BREAK, ItemType.SECTION_HEADER];

class Choice {
  constructor(value, nav, correct) { this.value = value; this.nav = nav === undefined ? null : nav; this.correct = !!correct; }
  getValue() { return this.value; }
  isCorrectAnswer() { return this.correct; }
  getPageBreakItem() { return this.nav && typeof this.nav === 'object' ? this.nav : null; }
  getPageNavigationType() { if (this.nav && typeof this.nav === 'object') return PageNavigationType.GO_TO_PAGE; return this.nav || PageNavigationType.CONTINUE; }
}

class Item {
  constructor(form, type) { this.form = form; this.type = type; this.id = newId(); this.title = ''; this.help = ''; this.required = false; this.choices = []; this.rows = []; this.cols = []; this.other = false; this.validation = null; this.goTo = null; this.points = 0; this.bounds = null; this.labels = null; }
  getId() { return this.id; }
  getType() { return this.type; }
  getTitle() { return this.title; }
  getHelpText() { return this.help; }
  setTitle(t) { this.title = t; return this; }
  setHelpText(t) { this.help = t; return this; }
  setRequired(r) { if (NO_ANSWER.includes(this.type)) throw new Error(this.type + '에는 setRequired 없음'); this.required = r; return this; }
  isRequired() { return this.required; }
  setPoints(p) { if (this.type !== ItemType.MULTIPLE_CHOICE) throw new Error('setPoints 불가 ' + this.type); if (!this.form.quiz) throw new Error('퀴즈가 아닌 폼에 배점'); this.points = p; return this; }
  getPoints() { return this.points; }
  setBounds(lo, hi) { if (this.type !== ItemType.SCALE) throw new Error('setBounds 불가'); if (!(lo === 0 || lo === 1) || hi < 3 || hi > 10) throw new Error('척도 범위 오류'); this.bounds = [lo, hi]; return this; }
  getLowerBound() { return this.bounds[0]; }
  getUpperBound() { return this.bounds[1]; }
  setLabels(lo, hi) { if (this.type !== ItemType.SCALE) throw new Error('setLabels 불가'); this.labels = [lo, hi]; return this; }
  getLeftLabel() { return this.labels[0]; }
  getRightLabel() { return this.labels[1]; }
  setChoiceValues(v) { this._needChoices(); this.choices = v.map((x) => new Choice(x)); return this; }
  createChoice(value, nav) {
    this._needChoices();
    if (typeof nav === 'boolean') { // 퀴즈: createChoice(value, isCorrect)
      if (!this.form.quiz) throw new Error('createChoice(value, isCorrect): 퀴즈가 아닌 폼');
      return new Choice(value, null, nav);
    }
    if (nav && typeof nav === 'object' && nav.type !== ItemType.PAGE_BREAK) throw new Error('createChoice: 이동 대상이 쪽 구분이 아님');
    if (nav && typeof nav === 'object' && nav.form !== this.form) throw new Error('createChoice: 다른 폼의 쪽');
    return new Choice(value, nav);
  }
  setChoices(cs) { this._needChoices(); cs.forEach((c) => { if (!(c instanceof Choice)) throw new Error('setChoices: Choice 아님'); }); this.choices = cs; return this; }
  getChoices() { return this.choices; }
  showOtherOption(b) { if (![ItemType.MULTIPLE_CHOICE, ItemType.CHECKBOX].includes(this.type)) throw new Error('showOtherOption 불가'); this.other = b; return this; }
  setValidation(v) { this.validation = v; return this; }
  setRows(r) { if (this.type !== ItemType.GRID) throw new Error('setRows 불가'); this.rows = r; return this; }
  setColumns(c) { if (this.type !== ItemType.GRID) throw new Error('setColumns 불가'); this.cols = c; return this; }
  getRows() { return this.rows; }
  getColumns() { return this.cols; }
  setGoToPage(x) { if (this.type !== ItemType.PAGE_BREAK) throw new Error('setGoToPage 불가'); this.goTo = x; return this; }
  getGoToPage() { return this.goTo && typeof this.goTo === 'object' ? this.goTo : null; }
  getPageNavigationType() { if (this.goTo && typeof this.goTo === 'object') return PageNavigationType.GO_TO_PAGE; return this.goTo || PageNavigationType.CONTINUE; }
  createResponse(v) { return { item: this, value: v, getItem: () => this, getResponse: () => v }; }
  _needChoices() { if (![ItemType.MULTIPLE_CHOICE, ItemType.LIST, ItemType.CHECKBOX].includes(this.type)) throw new Error(this.type + '에는 선택지가 없음'); }
  _as(t) { if (this.type !== t) throw new Error(`as ${t} 불가 (${this.type})`); return this; }
  asPageBreakItem() { return this._as(ItemType.PAGE_BREAK); }
  asMultipleChoiceItem() { return this._as(ItemType.MULTIPLE_CHOICE); }
  asListItem() { return this._as(ItemType.LIST); }
  asCheckboxItem() { return this._as(ItemType.CHECKBOX); }
  asGridItem() { return this._as(ItemType.GRID); }
  asTextItem() { return this._as(ItemType.TEXT); }
  asScaleItem() { return this._as(ItemType.SCALE); }
  asSectionHeaderItem() { return this._as(ItemType.SECTION_HEADER); }
}

class FormResponseBuilder {
  constructor(form) { this.form = form; this.irs = []; }
  withItemResponse(ir) { this.irs.push(ir); return this; }
  toPrefilledUrl() { return `https://docs.google.com/forms/d/e/${this.form.id}/viewform?usp=pp_url&` + this.irs.map((x) => `entry.${x.item.id}=${encodeURIComponent(x.value)}`).join('&'); }
}

class Form {
  constructor(title) { this.id = 'FORM' + newId(); this.title = title; this.items = []; this.responses = []; this.quiz = false; this.settings = { accepting: true, progress: true, login: true, email: true, one: false, shuffle: false }; }
  setIsQuiz(b) { this.quiz = b; return this; }
  isQuiz() { return this.quiz; }
  setEmailCollectionType(t) { this.settings.email = t !== 'DO_NOT_COLLECT'; return this; }
  getId() { return this.id; }
  setTitle(t) { this.title = t; return this; }
  setDescription(d) { this.description = d; return this; }
  setDestination(type, id) { this.dest = id; return this; }
  _add(type) { const it = new Item(this, type); this.items.push(it); this.form_calls = (this.form_calls || 0) + 1; return it; }
  addPageBreakItem() { return this._add(ItemType.PAGE_BREAK); }
  addMultipleChoiceItem() { return this._add(ItemType.MULTIPLE_CHOICE); }
  addListItem() { return this._add(ItemType.LIST); }
  addCheckboxItem() { return this._add(ItemType.CHECKBOX); }
  addGridItem() { return this._add(ItemType.GRID); }
  addParagraphTextItem() { return this._add(ItemType.PARAGRAPH_TEXT); }
  addTimeItem() { return this._add(ItemType.TIME); }
  addTextItem() { return this._add(ItemType.TEXT); }
  addSectionHeaderItem() { return this._add(ItemType.SECTION_HEADER); }
  addScaleItem() { return this._add(ItemType.SCALE); }
  getItems() { return this.items.slice(); }
  getItemById(id) { return this.items.find((x) => x.id === Number(id)) || null; }
  deleteItem(i) { if (typeof i === 'number') this.items.splice(i, 1); else this.items = this.items.filter((x) => x !== i); }
  setRequireLogin(b) { this.settings.login = b; return this; }
  requiresLogin() { return this.settings.login; }
  setCollectEmail(b) { this.settings.email = b; return this; }
  collectsEmail() { return this.settings.email; }
  setAllowResponseEdits(b) { this.settings.edits = b; return this; }
  setShowLinkToRespondAgain(b) { this.settings.again = b; return this; }
  setPublishingSummary(b) { this.settings.summary = b; return this; }
  setProgressBar(b) { this.settings.progress = b; return this; }
  hasProgressBar() { return this.settings.progress; }
  setShuffleQuestions(b) { this.settings.shuffle = b; return this; }
  setLimitOneResponsePerUser(b) { this.settings.one = b; return this; }
  hasLimitOneResponsePerUser() { return this.settings.one; }
  getShuffleQuestions() { return this.settings.shuffle; }
  setConfirmationMessage(m) { this.confirmation = m; return this; }
  setAcceptingResponses(b) { this.settings.accepting = b; return this; }
  setCustomClosedFormMessage(m) { this.closed = m; return this; }
  setPublished(b) { this.settings.published = b; return this; }
  getPublishedUrl() { return `https://docs.google.com/forms/d/e/${this.id}/viewform`; }
  getEditUrl() { return `https://docs.google.com/forms/d/${this.id}/edit`; }
  deleteAllResponses() { this.responses = []; return this; }
  getResponses() { return this.responses.slice(); }
  createResponse() { return new FormResponseBuilder(this); }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  clear() { this.data = []; return this; }
  getRange(r, c, nr, nc) {
    const sh = this;
    return {
      setValues(v) {
        if (v.length !== nr) throw new Error(`setValues 행 수 ${v.length} ≠ ${nr}`);
        v.forEach((row, i) => { if (row.length !== nc) throw new Error(`setValues ${sh.name} ${i + 1}행 열 수 ${row.length} ≠ ${nc}`); sh.data[r - 1 + i] = row.slice(); });
        return this;
      },
    };
  }
  appendRow(row) { this.data.push(row.slice()); return this; }
  getDataRange() { const d = this.data; return { getValues: () => d.map((x) => x.slice()) }; }
}
class Spreadsheet {
  constructor(title) { this.id = 'SS' + newId(); this.title = title; this.sheets = {}; }
  getId() { return this.id; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}`; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { this.sheets[n] = new Sheet(n); return this.sheets[n]; }
}

function makeEnv() {
  const forms = {}; const sheets = {}; const props = {}; const triggers = []; const logs = [];
  const validation = () => {
    const v = { rules: [], requireSelectAtMost(n) { v.rules.push(['max', n]); return v; }, requireTextMatchesPattern(p) { new RegExp(p); v.rules.push(['pattern', p]); return v; }, setHelpText(t) { v.help = t; return v; }, build() { return { rules: v.rules }; } };
    return v;
  };
  const env = {
    FormApp: {
      create(t) { const f = new Form(t); forms[f.id] = f; return f; },
      openById(id) { if (!forms[id]) throw new Error('폼 없음 ' + id); return forms[id]; },
      DestinationType: { SPREADSHEET: 'SPREADSHEET' },
      EmailCollectionType: { DO_NOT_COLLECT: 'DO_NOT_COLLECT', VERIFIED: 'VERIFIED', RESPONDER_INPUT: 'RESPONDER_INPUT' },
      PageNavigationType, ItemType,
      createCheckboxValidation: validation,
      createTextValidation: validation,
    },
    SpreadsheetApp: {
      create(t) { const s = new Spreadsheet(t); sheets[s.id] = s; return s; },
      openById(id) { if (!sheets[id]) throw new Error('시트 없음 ' + id); return sheets[id]; },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty: (k) => (k in props ? props[k] : null),
          setProperty: (k, v) => { if (typeof v !== 'string') throw new Error('속성 값은 문자열'); if (v.length > 9000) throw new Error('속성 값이 9KB 초과: ' + k); props[k] = v; },
          deleteAllProperties: () => { for (const k of Object.keys(props)) delete props[k]; },
        };
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log: (s) => logs.push(String(s)) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(String(s)).digest()).map((b) => (b > 127 ? b - 256 : b)),
      formatDate: (d, tz, fmt) => {
        const k = new Date(d.getTime() + 9 * 3600 * 1000);
        const p2 = (n) => String(n).padStart(2, '0');
        return fmt.replace('yyyy', k.getUTCFullYear()).replace('MM', p2(k.getUTCMonth() + 1)).replace('dd', p2(k.getUTCDate()))
          .replace('HH', p2(k.getUTCHours())).replace('mm', p2(k.getUTCMinutes()));
      },
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: (fn) => ({ timeBased: () => ({ everyHours: () => ({ create: () => { const t = { getHandlerFunction: () => fn }; triggers.push(t); return t; } }) }) }),
    },
    console,
    JSON, Math, Date, String, Number, Array, Object, Error, RegExp, encodeURIComponent,
  };
  return { env, forms, sheets, props, triggers, logs };
}

// 응답자 한 명이 폼을 따라가며 답한다. answerFn(item, form) → 값(없으면 건너뜀)
function walk(form, answerFn) {
  const items = form.items;
  const pages = [[]]; // 쪽별 문항, pages[k][0]은 k≥1이면 쪽 구분
  items.forEach((it) => { if (it.type === ItemType.PAGE_BREAK) pages.push([it]); else pages[pages.length - 1].push(it); });
  const pageIndexOf = (pb) => pages.findIndex((p) => p[0] === pb);
  const answers = []; const visited = [];
  let k = 0; let guard = 0;
  while (k < pages.length) {
    if (++guard > 500) throw new Error('이동이 끝나지 않음');
    visited.push(k);
    let jump = null;
    for (const it of pages[k]) {
      if (NO_ANSWER.includes(it.type)) continue;
      const v = answerFn(it, form);
      if (v === undefined || v === null || v === '') { if (it.required) throw new Error(`필수 문항 미응답: ${it.title}`); continue; }
      if (it.validation) for (const [kind, arg] of it.validation.rules) if (kind === 'pattern' && !new RegExp(arg).test(String(v))) throw new Error(`검증 실패 ${it.title}: ${v}`);
      if (it.type === ItemType.SCALE && !(Number(v) >= it.bounds[0] && Number(v) <= it.bounds[1])) throw new Error(`척도 범위 밖 ${v}`);
      if (it.type === ItemType.LIST && !it.choices.some((c) => c.value === v)) throw new Error(`없는 목록 값 ${v}`);
      answers.push({ item: it, value: v });
      if ((it.type === ItemType.MULTIPLE_CHOICE || it.type === ItemType.LIST) && it.choices.some((c) => c.nav)) {
        const ch = it.choices.find((c) => c.value === v);
        if (!ch) throw new Error(`없는 선택지 ${v} (${it.title})`);
        if (ch.nav && typeof ch.nav === 'object') jump = pageIndexOf(ch.nav);
        else if (ch.nav === PageNavigationType.SUBMIT) jump = 'SUBMIT';
      }
    }
    if (jump === 'SUBMIT') break;
    if (jump !== null) { k = jump; continue; }
    const next = pages[k + 1];
    if (!next) break;
    const pb = next[0];
    if (pb.goTo === PageNavigationType.SUBMIT) break;
    if (pb.goTo && typeof pb.goTo === 'object') { k = pageIndexOf(pb.goTo); continue; }
    k += 1;
  }
  return { answers, visited };
}

function submit(form, answers, when) {
  const id = 'RESP' + newId();
  form.responses.push({
    getId: () => id,
    getTimestamp: () => when,
    getItemResponses: () => answers.map((a) => ({ getItem: () => a.item, getResponse: () => a.value })),
  });
}

module.exports = { makeEnv, walk, submit, ItemType, PageNavigationType, NO_ANSWER };
