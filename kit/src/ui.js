/*!
 * FAQ 챗봇 키트 — 화면(대화창) 스크립트
 * window.BOT = { config: {...}, items: [...] } 와 BotEngine 을 사용합니다.
 */
(function () {
  'use strict';
  var BOT = window.BOT || { config: {}, items: [] };
  var C = BOT.config || {};
  var E = window.BotEngine;
  var INDEX = E.prepare(BOT.items || []);
  var VOCAB = E.vocab(INDEX);
  var CATS = [];
  INDEX.forEach(function (e) { if (e.cat && CATS.indexOf(e.cat) < 0) CATS.push(e.cat); });

  var chat = document.getElementById('chat');
  var inp = document.getElementById('inp');
  var quick = document.getElementById('quick');
  var form = document.getElementById('form');

  var embedded = false;
  try { embedded = new URLSearchParams(location.search).get('embed') === '1'; } catch (err) { /* 오래된 브라우저 */ }
  if (embedded) {
    document.documentElement.classList.add('embed');
    // 홈페이지 위젯 안에서 Esc 를 누르면 위젯을 닫도록 알린다
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && window.parent !== window) window.parent.postMessage({ type: 'faqbot:close' }, '*');
    });
  }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function scroll() { chat.scrollTop = chat.scrollHeight; }

  function avatar() {
    if (C.avatarImg) return '<img src="' + E.esc(C.avatarImg) + '" alt="">';
    return '<span aria-hidden="true">' + E.esc(C.avatar || '💬') + '</span>';
  }

  function addUser(t) {
    var m = el('div', 'msg user');
    m.appendChild(el('div', 'b', E.esc(t)));
    chat.appendChild(m);
    scroll();
  }

  function botMsg() {
    var m = el('div', 'msg bot');
    m.appendChild(el('div', 'ic', avatar()));
    var b = el('div', 'b');
    m.appendChild(b);
    chat.appendChild(m);
    scroll();
    return b;
  }

  function typing(on) {
    var t = document.getElementById('typing');
    if (!on) { if (t) t.remove(); return; }
    if (t) return;
    var m = el('div', 'msg bot');
    m.id = 'typing';
    m.setAttribute('aria-hidden', 'true');
    m.appendChild(el('div', 'ic', avatar()));
    var b = el('div', 'b');
    b.appendChild(el('div', 'typing', '<span></span><span></span><span></span>'));
    m.appendChild(b);
    chat.appendChild(m);
    scroll();
  }

  /** 누르면 질문을 보내는 버튼 묶음 */
  function chips(parent, list, label, cls) {
    if (!list.length) return;
    if (label) parent.appendChild(el('div', 'hint', E.esc(label)));
    var wrap = el('div', 'chips' + (cls ? ' ' + cls : ''));
    list.forEach(function (x) {
      var btn = el('button', 'chip' + (x.cls ? ' ' + x.cls : ''), E.esc(x.text));
      btn.type = 'button';
      btn.onclick = x.onClick || function () { ask(x.ask || x.text); };
      wrap.appendChild(btn);
    });
    parent.appendChild(wrap);
  }

  function linkButtons(parent, links) {
    var ok = (links || []).map(function (l) { return { label: l.label, url: E.safeUrl(l.url) }; })
      .filter(function (l) { return l.url; });
    if (!ok.length) return;
    var wrap = el('div', 'links');
    ok.forEach(function (l) {
      var a = el('a', 'lnk', E.esc(l.label || '바로가기'));
      a.href = l.url;
      if (/^https?:/i.test(l.url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      wrap.appendChild(a);
    });
    parent.appendChild(wrap);
  }

  function contacts(parent, label) {
    if (!C.contacts || !C.contacts.length) return;
    if (label) parent.appendChild(el('div', 'hint', E.esc(label)));
    linkButtons(parent, C.contacts);
  }

  function answer(e, note) {
    var b = botMsg();
    var h = '';
    if (note) h += '<div class="note">' + note + '</div>';
    h += '<div class="q">' + E.esc(e.q) + '</div><div class="a">' + E.fmt(e.a) + '</div>';
    b.innerHTML = h;
    linkButtons(b, e.links);
    var rel = E.related(INDEX, e, 3).map(function (o) { return { text: o.q }; });
    chips(b, rel, '함께 많이 묻는 질문');
    scroll();
  }

  function showCategory(cat) {
    var b = botMsg();
    b.innerHTML = '<b>' + E.esc(cat) + '</b> 관련 질문이에요. 궁금한 것을 눌러 보세요.';
    chips(b, INDEX.filter(function (e) { return e.cat === cat; }).map(function (e) { return { text: e.q }; }));
    scroll();
  }

  function showAll() {
    var b = botMsg();
    b.innerHTML = '자주 묻는 질문 <b>' + INDEX.length + '개</b>를 분류별로 모았어요.';
    var wrap = el('div', 'all');
    var groups = CATS.length ? CATS : [''];
    groups.forEach(function (cat, i) {
      var list = INDEX.filter(function (e) { return (e.cat || '') === cat; });
      if (!list.length) return;
      var det = el('details');
      if (i === 0) det.open = true;
      det.appendChild(el('summary', null, E.esc(cat || '전체') + '<span class="cnt">' + list.length + '</span>'));
      chips(det, list.map(function (e) { return { text: e.q }; }));
      wrap.appendChild(det);
    });
    b.appendChild(wrap);
    scroll();
  }

  function catChips(parent, label) {
    chips(parent, CATS.map(function (c) {
      return { text: c, cls: 'cat', onClick: function () { addUser(c); showCategory(c); } };
    }), label);
  }

  function report(q, kind) {
    if (!C.reportUrl || !navigator.sendBeacon) return;
    try {
      navigator.sendBeacon(C.reportUrl, JSON.stringify({ bot: C.name || '', q: E.scrub(q), kind: kind, t: new Date().toISOString() }));
    } catch (err) { /* 보고 실패는 무시 */ }
  }

  function respond(q) {
    typing(false);
    var d = E.decide(INDEX, VOCAB, q, CATS);

    if (d.type === 'category') { showCategory(d.cat); return; }
    if (d.type === 'answer') { answer(d.item); return; }

    var b = botMsg();
    if (d.type === 'intent') {
      if (d.intent === 'greet') {
        b.innerHTML = E.esc(C.greetReply || '안녕하세요! 무엇이 궁금하세요?');
        chips(b, (C.examples || []).map(function (t) { return { text: t }; }), '이렇게 물어보세요');
      } else if (d.intent === 'thanks') {
        b.innerHTML = E.esc(C.thanksReply || '도움이 되었다니 기뻐요. 더 궁금한 게 있으면 언제든 물어보세요!');
      } else if (d.intent === 'human') {
        b.innerHTML = E.esc(C.humanReply || '직접 문의하시려면 아래 버튼을 눌러 주세요.');
        contacts(b);
      } else {
        b.innerHTML = '무엇을 도와드릴까요? 분류를 누르거나 질문을 입력해 보세요.';
        catChips(b);
      }
    } else if (d.type === 'suggest') {
      var words = d.fix.changes.map(function (c) { return '‘' + E.esc(c.to) + '’'; }).join(', ');
      b.innerHTML = '혹시 ' + words + '에 대해 물어보신 건가요?';
      chips(b, [{ text: '▶ ' + d.item.q, ask: d.item.q }]);
      report(q, 'suggest');
    } else if (d.type === 'candidates') {
      b.innerHTML = '정확히 맞는 답을 찾지 못했어요. 혹시 이 중에 있나요?';
      chips(b, d.items.map(function (e) { return { text: e.q }; }));
      contacts(b, '원하는 답이 없으면 직접 문의해 주세요');
      report(q, 'candidates');
    } else {
      b.innerHTML = E.esc(C.noMatch || '죄송해요, 그 질문은 아직 답을 준비하지 못했어요.');
      catChips(b, '분류에서 찾아보기');
      contacts(b, '직접 문의하기');
      report(q, 'nomatch');
    }
    scroll();
  }

  var lastQ = '', lastT = 0;
  function ask(q) {
    q = String(q || '').trim();
    if (!q) return;
    var now = Date.now();
    if (q === lastQ && now - lastT < 600) return; // 한글 입력기 중복 전송 방지
    lastQ = q; lastT = now;
    addUser(q);
    typing(true);
    setTimeout(function () { respond(q); }, 280);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = inp.value;
    inp.value = '';
    ask(v);
  });

  // 머리말·빠른 메뉴·꼬리말
  document.getElementById('hdav').innerHTML = avatar();
  document.getElementById('bname').textContent = C.name || 'FAQ 챗봇';
  document.getElementById('btag').textContent = C.tagline || '';
  if (C.placeholder) inp.placeholder = C.placeholder;

  function quickBtn(text, cls, fn) {
    var b = el('button', 'chip ' + (cls || ''), E.esc(text));
    b.type = 'button';
    b.onclick = fn;
    quick.appendChild(b);
  }
  quickBtn('☰ 전체 질문', 'cat', function () { addUser('전체 질문'); showAll(); });
  CATS.forEach(function (c) { quickBtn(c, 'cat', function () { addUser(c); showCategory(c); }); });
  if (C.contacts && C.contacts.length) {
    quickBtn(C.contactLabel || '📞 문의하기', 'contact', function () {
      addUser(C.contactLabel || '문의하기');
      var b = botMsg();
      b.innerHTML = E.esc(C.humanReply || '직접 문의하시려면 아래 버튼을 눌러 주세요.');
      contacts(b);
    });
  }

  var ft = document.getElementById('ft');
  var fh = '';
  if (C.footer) fh += '<span>' + E.esc(C.footer) + '</span>';
  if (C.reportUrl) fh += '<span>더 나은 답변을 위해 답하지 못한 질문만 익명으로 모읍니다.</span>';
  if (C.credit && C.credit.label) {
    var cu = E.safeUrl(C.credit.url);
    fh += cu ? '<a href="' + E.esc(cu) + '" target="_blank" rel="noopener noreferrer">' + E.esc(C.credit.label) + '</a>'
      : '<span>' + E.esc(C.credit.label) + '</span>';
  }
  if (fh) ft.innerHTML = fh; else ft.remove();

  // 첫 인사
  (function () {
    var b = botMsg();
    b.innerHTML = '<div class="greet">' + E.fmt(C.greeting || '안녕하세요! 궁금한 것을 물어보세요.') + '</div>';
    chips(b, (C.examples || []).map(function (t) { return { text: t }; }), '이렇게 물어보세요', 'col');
  })();

  // 테스트·관리용으로 엔진을 노출
  window.FAQBot = { ask: ask, search: function (q) { return E.search(INDEX, q); } };
})();
