/*!
 * FAQ 챗봇 키트 — 조립기
 * CSV(엑셀) + 설정(config) → HTML 파일 하나. build.js(명령줄)와 builder.html(브라우저)이 함께 씁니다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BotAssemble = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** RFC 4180 CSV 파서: 따옴표, 따옴표 안의 쉼표·줄바꿈, "" 이스케이프, BOM, CRLF 지원 */
  function parseCSV(text) {
    text = String(text == null ? '' : text).replace(/^﻿/, '');
    var delim = ',';
    var firstLine = text.split(/\r?\n/, 1)[0] || '';
    if (firstLine.indexOf('\t') >= 0 && firstLine.indexOf(',') < 0) delim = '\t'; // 엑셀에서 복사·붙여넣기한 표
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  function toCSV(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        v = String(v == null ? '' : v);
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n') + '\r\n';
  }

  var ALIASES = {
    cat: ['카테고리', '분류', '구분', 'category', 'cat'],
    q: ['질문', '대표질문', 'question', 'q', '제목'],
    a: ['답변', '답', 'answer', 'a', '내용'],
    kw: ['키워드', '검색어', '동의어', 'keywords', 'keyword', 'kw'],
    links: ['링크', '버튼', 'links', 'link', 'url']
  };
  var HEADERS = ['카테고리', '질문', '답변', '키워드', '링크'];

  function headerMap(head) {
    var map = {};
    head.forEach(function (h, i) {
      var k = String(h).replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, '');
      Object.keys(ALIASES).forEach(function (f) {
        if (map[f] == null && ALIASES[f].indexOf(k) >= 0) map[f] = i;
      });
    });
    return map;
  }

  function splitKw(cell) {
    var seen = {};
    return String(cell || '').split(/[,|/;\n、，]+/).map(function (s) { return s.trim(); })
      .filter(function (s) { if (!s || seen[s]) return false; seen[s] = 1; return true; });
  }

  /** "라벨=주소" 를 ; 또는 줄바꿈으로 여러 개 */
  function parseLinks(cell) {
    return String(cell || '').split(/\s*(?:;|\r?\n)\s*/).map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (s) {
        var m = s.match(/^(.*?)\s*=\s*((?:https?:|tel:|mailto:|sms:)\S+|[\w-]+(?:\.[\w-]+)+\S*)$/i);
        return m ? { label: m[1] || '바로가기', url: m[2] } : { label: '바로가기', url: s };
      });
  }

  /** CSV 표 → 챗봇 항목. 문제가 있는 줄은 errors 로 알려 준다 */
  function rowsToItems(rows) {
    var errors = [], items = [];
    if (!rows.length) return { items: items, errors: [{ row: 0, msg: '내용이 비어 있어요.' }] };
    var map = headerMap(rows[0]);
    if (map.q == null || map.a == null) {
      return { items: items, errors: [{ row: 1, msg: '첫 줄(머리글)에 "질문"과 "답변" 칸이 있어야 해요. 예: ' + HEADERS.join(',') }] };
    }
    var seen = {};
    rows.slice(1).forEach(function (r, i) {
      var line = i + 2;
      var get = function (f) { return map[f] == null ? '' : String(r[map[f]] == null ? '' : r[map[f]]).trim(); };
      var q = get('q'), a = get('a');
      if (!q && !a) return;
      if (!q) { errors.push({ row: line, msg: '질문이 비어 있어요.' }); return; }
      if (!a) { errors.push({ row: line, msg: '"' + q + '"의 답변이 비어 있어요.' }); return; }
      if (seen[q]) errors.push({ row: line, msg: '"' + q + '" 질문이 ' + seen[q] + '번째 줄과 겹쳐요.' });
      seen[q] = line;
      var links = parseLinks(get('links'));
      links.forEach(function (l) {
        if (!/^(https?:|tel:|mailto:|sms:)/i.test(l.url) && !/^[\w-]+(\.[\w-]+)+/.test(l.url)) {
          errors.push({ row: line, msg: '링크 주소를 이해하지 못했어요: ' + l.url });
        }
      });
      var kw = splitKw(get('kw'));
      if (!kw.length) errors.push({ row: line, msg: '"' + q + '"에 키워드가 없어요. 손님이 쓸 법한 말을 3개 이상 넣으면 더 잘 찾아요.', warn: true });
      items.push({ cat: get('cat'), q: q, a: a, kw: kw, links: links });
    });
    return { items: items, errors: errors };
  }

  // ---- 색상 ----
  function hex(c, dflt) {
    c = String(c || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : dflt;
  }
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function toHex(a) { return '#' + a.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function lum(h) {
    return rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function ink(bg) { return contrast(bg, '#ffffff') >= contrast(bg, '#16181d') ? '#ffffff' : '#16181d'; }
  function darkEnough(c, bg) {
    var out = c;
    for (var i = 0; i < 12 && contrast(out, bg) < 4.5; i++) out = mix(out, '#000000', 0.12);
    return out;
  }

  function themeVars(theme) {
    theme = theme || {};
    var pri = hex(theme.primary, '#1f4e9b');
    var acc = hex(theme.accent, '#f2b33d');
    var bg = hex(theme.bg, mix(pri, '#ffffff', 0.93));
    var v = {
      '--pri': pri, '--pri-ink': ink(pri), '--pri-text': darkEnough(pri, '#ffffff'),
      '--acc': acc, '--acc-ink': ink(acc),
      '--bg': bg, '--card': '#ffffff', '--ink': '#1b1f27', '--mut': '#5d6676',
      '--soft': mix(pri, '#ffffff', 0.9), '--line': mix(pri, '#ffffff', 0.84)
    };
    return Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(';');
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // <script> 안에 넣어도 안전한 JSON
  function safeJson(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  function isImg(s) { return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(String(s || '')); }

  function favicon(cfg) {
    if (isImg(cfg.avatarImg)) return cfg.avatarImg;
    var emo = escHtml(String(cfg.avatar || '💬')).replace(/#/g, '%23');
    return 'data:image/svg+xml,' + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + emo + '</text></svg>';
  }

  /**
   * parts: {template, css, engine, ui} 원본 문자열
   * config: 챗봇 설정, items: rowsToItems 결과
   */
  function assemble(parts, config, items) {
    var cfg = Object.assign({}, config || {});
    if (cfg.avatarImg && !isImg(cfg.avatarImg)) delete cfg.avatarImg;
    ['engine', 'ui'].forEach(function (k) {
      if (/<\/script/i.test(parts[k])) throw new Error(k + ' 코드에 </script 가 있으면 안 돼요.');
    });
    var title = cfg.title || cfg.name || 'FAQ 챗봇';
    var desc = cfg.description || cfg.tagline || '자주 묻는 질문에 바로 답해 드려요.';
    var data = { config: cfg, items: (items || []).map(function (e) { return { cat: e.cat || '', q: e.q, a: e.a, kw: e.kw || [], links: e.links || [] }; }) };
    var map = {
      TITLE: escHtml(title),
      DESC: escHtml(desc),
      PRIMARY: hex((cfg.theme || {}).primary, '#1f4e9b'),
      FAVICON: escHtml(favicon(cfg)),
      THEME_VARS: themeVars(cfg.theme),
      CSS: parts.css.replace(/<\/style/gi, '<\\/style'),
      DATA: safeJson(data),
      ENGINE: parts.engine,
      UI: parts.ui
    };
    // 한 번에 바꿔야 끼워 넣은 내용(손님 데이터 등) 속 {{…}} 가 다시 바뀌지 않는다
    return parts.template.replace(/\/\*\{\{(CSS|ENGINE|UI)\}\}\*\/|\{\{(TITLE|DESC|PRIMARY|FAVICON|THEME_VARS|DATA)\}\}/g,
      function (m, a, b) { return map[a || b]; });
  }

  function slugify(s) {
    var out = String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '');
    return out || 'bot';
  }

  /** 홈페이지에 붙일 코드 */
  function embedSnippet(botUrl, cfg) {
    cfg = cfg || {};
    var base = String(botUrl || 'https://내-챗봇-주소.netlify.app/').replace(/index\.html?$/, '');
    if (!/\/$/.test(base)) base += '/';
    var color = hex((cfg.theme || {}).primary, '#1f4e9b');
    return '<script src="' + base + 'widget.js" data-color="' + color + '" data-label="' +
      escHtml(cfg.widgetLabel || '무엇이든 물어보세요') + '" defer></script>';
  }

  return {
    parseCSV: parseCSV, toCSV: toCSV, rowsToItems: rowsToItems, splitKw: splitKw, parseLinks: parseLinks,
    assemble: assemble, themeVars: themeVars, contrast: contrast, slugify: slugify, embedSnippet: embedSnippet,
    safeJson: safeJson, escHtml: escHtml, HEADERS: HEADERS
  };
});
