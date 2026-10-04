/*!
 * FAQ 챗봇 키트 — 홈페이지에 떠 있는 챗봇 버튼(위젯)
 * 사용법: <script src="https://내-챗봇-주소/widget.js" data-color="#1f4e9b" data-label="무엇이든 물어보세요" defer></script>
 * 선택 속성: data-bot(챗봇 주소, 기본값은 widget.js와 같은 폴더의 index.html), data-position="left", data-open="true"
 */
(function () {
  'use strict';
  if (window.__faqBotWidget) return;
  window.__faqBotWidget = true;

  var s = document.currentScript || (function () { var a = document.getElementsByTagName('script'); return a[a.length - 1]; })();
  var attr = function (k) { return s.getAttribute(k); };
  var bot = attr('data-bot') || String(attr('src') || '').replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'index.html';
  var color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(attr('data-color') || '') ? attr('data-color') : '#1f4e9b';
  var label = attr('data-label') || '무엇이든 물어보세요';
  var side = attr('data-position') === 'left' ? 'left' : 'right';
  var url = bot + (bot.indexOf('?') >= 0 ? '&' : '?') + 'embed=1';

  var css = '' +
    '.fbw-btn{position:fixed;bottom:20px;' + side + ':20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;' +
    'background:' + color + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;display:flex;align-items:center;' +
    'justify-content:center;transition:transform .15s}' +
    '.fbw-btn:hover{transform:scale(1.06)}.fbw-btn:focus-visible{outline:3px solid #ffbf47;outline-offset:3px}' +
    '.fbw-btn svg{width:28px;height:28px}' +
    '.fbw-pill{position:fixed;bottom:34px;' + side + ':92px;background:#fff;color:#1b1f27;font:600 14px/1.3 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;' +
    'padding:9px 14px;border-radius:18px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483000;cursor:pointer;white-space:nowrap}' +
    '.fbw-panel{position:fixed;bottom:92px;' + side + ':20px;width:380px;height:min(640px,calc(100vh - 120px));border-radius:18px;' +
    'overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.28);z-index:2147483001;background:#fff;display:none}' +
    '.fbw-panel.open{display:block}.fbw-panel iframe{width:100%;height:100%;border:0;display:block}' +
    '.fbw-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;' +
    'background:rgba(0,0,0,.35);color:#fff;font-size:18px;line-height:34px;z-index:2}' +
    '.fbw-x:focus-visible{outline:3px solid #ffbf47}' +
    '@media (max-width:520px){.fbw-panel{inset:0;width:auto;height:auto;border-radius:0;bottom:0;' + side + ':0}' +
    '.fbw-pill{display:none}}';

  function init() {
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    var btn = document.createElement('button');
    btn.className = 'fbw-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'fbw-panel');
    var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1L4.5 21l4.3-2.3c1 .2 2.1.3 3.2.3 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/></svg>';
    var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    btn.innerHTML = ICON_CHAT;

    var pill = document.createElement('div');
    pill.className = 'fbw-pill';
    pill.textContent = label;

    var panel = document.createElement('div');
    panel.className = 'fbw-panel';
    panel.id = 'fbw-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', label);
    var x = document.createElement('button');
    x.className = 'fbw-x';
    x.type = 'button';
    x.setAttribute('aria-label', '챗봇 닫기');
    x.textContent = '✕';
    panel.appendChild(x);

    var frame = null;
    function setOpen(on) {
      if (on && !frame) {
        frame = document.createElement('iframe');
        frame.src = url;
        frame.title = label;
        frame.setAttribute('loading', 'lazy');
        panel.appendChild(frame);
      }
      panel.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      btn.innerHTML = on ? ICON_X : ICON_CHAT;
      if (pill.parentNode) pill.parentNode.removeChild(pill);
      if (on) { setTimeout(function () { try { frame.focus(); } catch (e) { /* 무시 */ } }, 60); }
      else btn.focus();
    }
    btn.onclick = function () { setOpen(!panel.classList.contains('open')); };
    pill.onclick = function () { setOpen(true); };
    x.onclick = function () { setOpen(false); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false);
    });
    // 챗봇 안에서 Esc 를 누르면 챗봇이 알려 준다
    window.addEventListener('message', function (e) {
      if (frame && e.source === frame.contentWindow && e.data && e.data.type === 'faqbot:close') setOpen(false);
    });

    document.body.appendChild(panel);
    document.body.appendChild(pill);
    document.body.appendChild(btn);
    if (attr('data-open') === 'true') setOpen(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
