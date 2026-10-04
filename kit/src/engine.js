/*!
 * FAQ 챗봇 키트 — 검색 엔진 (외부 라이브러리 없음)
 * 핀로그(FinLog) 금융 챗봇의 검색 엔진을 범용 FAQ용으로 넓힌 버전입니다.
 * 답을 지어내지 않고, 사람이 써 둔 답 중에서 가장 알맞은 것을 찾아 돌려줍니다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BotEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 검색에 도움이 안 되는 말(군말·어미)
  var STOP = new Set(['뭐', '뭐야', '뭔가요', '뭐예요', '뭐에요', '무엇', '무엇인가요', '알려줘', '알려주세요', '알려줘요',
    '궁금해요', '궁금합니다', '궁금', '문의', '문의드려요', '질문', '혹시', '좀', '그', '저', '제가', '저희', '이거', '이건',
    '이게', '그거', '그럼', '그리고', '근데', '또', '해', '해요', '하나요', '하는', '되나요', '돼요', '되요', '되는', '있나요',
    '있어요', '있는', '없나요', '없어요', '인가요', '인가', '이야', '이에요', '예요', '에요', '한가요', '어떻게', '어때',
    '어때요', '대해', '대해서', '관련', '관해', '있을까요', '할까요', '될까요', '가능', '가능한가요', '가능해요', '가능할까요',
    '하고', '싶어요', '싶은데', '합니다', '입니다', '나요', '까요', '주세요', '해주세요', '알고', '싶습니다']);

  // 낱말 끝에 붙는 조사·어미(긴 것부터 검사)
  var SUFFIX = ['가능한가요', '가능할까요', '가능해요', '되나요', '될까요', '되는지', '있나요', '있어요', '있을까요', '없나요',
    '없어요', '인가요', '한가요', '하나요', '할까요', '하면요', '해요', '에서는', '에서', '으로는', '으로', '에게', '한테', '까지',
    '부터', '이랑', '이란', '이라는', '라는', '에대해', '에대한', '에관해', '이에요', '예요', '에요', '이요', '은요', '는요', '나요',
    '까요', '가요', '하면', '되면', '해도', '돼도', '되도', '인데', '이나', '하고', '처럼', '보다', '마다', '도', '은', '는', '이',
    '가', '을', '를', '에', '와', '과', '로', '만', '랑', '나', '요'];
  var PARTICLE1 = '은는이가을를도만로랑와과나요에';

  // 질문 끝에 흔한 두 글자(어미)는 유사도 계산에서 뺀다
  var END_BI = new Set(['나요', '해요', '어요', '가요', '까요', '예요', '에요', '되나', '하나', '인가', '한가', '있어', '없어',
    '세요', '니다', '습니', '합니', '는데', '은데', '할까', '될까', '있나', '없나', '주세', '돼요', '되요']);

  var PUNCT = /[\s()[\]{}<>·•,.\-_/\\?!~'"“”‘’:;…|+*=#@^`]/g;
  var SPLIT = /[\s()[\]{}<>·•,.\-_/\\?!~'"“”‘’:;…|+*=#@^`]+/;

  // 숫자 + 명/인(사람 수)은 '몇명'으로 맞춰 "6명이 가도 돼요?"도 인원 질문으로 찾는다
  function canon(s) {
    return String(s == null ? '' : s).normalize('NFC').toLowerCase()
      .replace(/몇\s+(?=[가-힣])/g, '몇') // "몇 시" → "몇시"
      .replace(/\d+\s*(명|인)(?![가-힣])|\d+\s*(명|인)(?=[이가은는도을를에])/g, '몇명');
  }

  // 질문의 '종류'만 말해 주는 낱말. 이것만 맞고 모르는 낱말이 섞이면(예: "화장실 어디예요") 확신하지 않는다
  var GENERIC = new Set(['어디', '언제', '얼마', '몇시', '몇명', '몇번', '몇개', '몇분', '무슨', '어떤', '어느', '누구', '가격',
    '비용', '요금', '시간', '방법', '가능', '여부', '정보', '문의', '안내']);

  function norm(s) {
    return canon(s).replace(PUNCT, '');
  }

  function stripJosa(w) {
    for (var pass = 0; pass < 2; pass++) {
      var hit = false;
      for (var i = 0; i < SUFFIX.length; i++) {
        var s = SUFFIX[i];
        if (w.length - s.length >= 2 && w.slice(-s.length) === s) { w = w.slice(0, -s.length); hit = true; break; }
      }
      if (!hit) break;
    }
    return w;
  }

  function toks(s) {
    var out = [];
    canon(s).split(SPLIT).forEach(function (w) {
      if (!w) return;
      var b = stripJosa(w);
      if (b.length >= 2 && !STOP.has(b) && !STOP.has(w)) out.push(b);
    });
    return out;
  }

  // 한 글자 낱말(숯, 술, 차 …). 데이터에 한 글자 키워드가 있을 때만 쓰인다
  function words1(s) {
    var out = [];
    canon(s).split(SPLIT).forEach(function (w) {
      if (w.length === 1) out.push(w);
      else if (w.length === 2 && PARTICLE1.indexOf(w[1]) >= 0) out.push(w[0]);
    });
    return out.filter(function (w) { return /[가-힣a-z0-9]/.test(w) && !STOP.has(w); });
  }

  // 한글 음절을 자모로 풀어 오타를 잡는다(예: 주처 → 주차)
  function jamo(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xac00 && c <= 0xd7a3) {
        var x = c - 0xac00;
        out.push('i' + Math.floor(x / 588), 'm' + Math.floor((x % 588) / 28));
        if (x % 28) out.push('f' + (x % 28));
      } else out.push(s[i]);
    }
    return out;
  }

  function lev(a, b, max) {
    if (max == null) max = Infinity;
    var m = a.length, n = b.length;
    if (Math.abs(m - n) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[n];
  }

  function bigrams(ns) {
    var set = new Set();
    for (var i = 0; i < ns.length - 1; i++) {
      var b = ns.slice(i, i + 2);
      if (!END_BI.has(b)) set.add(b);
    }
    return set;
  }

  function dice(a, b) {
    if (!a.size || !b.size) return 0;
    var n = 0;
    a.forEach(function (x) { if (b.has(x)) n++; });
    return (2 * n) / (a.size + b.size);
  }

  function uniq(arr) { return Array.from(new Set(arr)); }

  /** 검색용 색인을 만든다. items: [{cat, q, a, kw:[], links:[]}] */
  function prepare(items) {
    return (items || []).map(function (e, i) {
      var kw = uniq((e.kw || []).map(norm).filter(Boolean));
      var nq = norm(e.q);
      // 오타 교정은 사람이 고른 키워드 기준으로만(질문 속 '날이' 같은 조각은 제외)
      var vocab = kw.slice();
      (e.kw || []).forEach(function (k) { vocab = vocab.concat(toks(k)); });
      if (!kw.length) vocab = toks(e.q);
      return Object.assign({}, e, {
        _i: i,
        _nq: nq,
        _qt: uniq(toks(e.q)),
        _nkw: kw,
        _na: norm(e.a),
        _ncat: norm(e.cat),
        _bis: [nq].concat(kw).map(bigrams),
        _vocab: uniq(vocab.map(norm).filter(function (w) { return w.length >= 2; }))
      });
    });
  }

  function score(e, nq, tk, qbi, w1, wt, unk) {
    var s = 0, ev = [];
    if (e._nq === nq) s += 120;
    else if (nq.length >= 4 && (e._nq.indexOf(nq) >= 0 || (e._nq.length >= 4 && nq.indexOf(e._nq) >= 0))) s += 48;

    // 키워드: 겹치는(다른 키워드에 포함되는) 짧은 키워드는 한 번만 센다
    var hits = [];
    e._nkw.forEach(function (k) {
      if (k === nq) hits.push({ k: k, v: 90 });
      else if (k.length >= 2 && nq.indexOf(k) >= 0) hits.push({ k: k, v: 34 + Math.min(16, (k.length - 2) * 4) });
      else if (nq.length >= 2 && k.indexOf(nq) >= 0) hits.push({ k: k, v: 16 });
    });
    hits.forEach(function (h) {
      var covered = hits.some(function (o) { return o !== h && o.k.length > h.k.length && o.k.indexOf(h.k) >= 0; });
      if (!covered) { s += h.v; ev.push(h.k); }
    });
    // 한 글자 키워드는 질문에 따로 떨어진 낱말로 나올 때만 인정
    (w1 || []).forEach(function (c) { if (e._nkw.indexOf(c) >= 0) { s += 72; ev.push(c); } });

    tk.forEach(function (w) {
      var v = 0;
      if (e._nq.indexOf(w) >= 0) v += 16;
      else if (e._qt.some(function (t) { return t.indexOf(w) >= 0 || (t.length >= 2 && w.indexOf(t) >= 0); })) v += 12;
      if (e._nkw.some(function (k) { return k.indexOf(w) >= 0 || (k.length >= 2 && w.indexOf(k) >= 0); })) v += 18;
      if (e._nkw.indexOf(w) >= 0) v += 20; // 키워드와 낱말이 정확히 같음
      if (e._ncat && e._ncat.indexOf(w) >= 0) v += 6;
      if (e._na.indexOf(w) >= 0) v += 4;
      s += v * (wt && wt[w] != null ? wt[w] : 1);
      if (v) ev.push(w);
    });

    var d = 0;
    e._bis.forEach(function (b) { var v = dice(qbi, b); if (v > d) d = v; });
    s += d * 50;

    // 챗봇이 전혀 모르는 낱말이 질문에 있으면 덜 확신한다
    if (unk > 0) {
      s *= Math.pow(0.85, Math.min(unk, 2));
      if (ev.length && ev.every(function (w) { return GENERIC.has(w); })) s *= 0.4;
    }
    return Math.round(s);
  }

  function knownAnywhere(index, w) {
    return index.some(function (e) {
      return e._nq.indexOf(w) >= 0 || e._na.indexOf(w) >= 0 || (e._ncat && e._ncat.indexOf(w) >= 0) ||
        e._nkw.some(function (k) { return k.indexOf(w) >= 0 || (k.length >= 2 && w.indexOf(k) >= 0); });
    });
  }

  // 여러 항목에 두루 나오는 낱말(예: 학원 챗봇의 '학원')은 덜 중요하게 본다
  function weights(index, tk) {
    var wt = {};
    tk.forEach(function (w) {
      var df = 0;
      index.forEach(function (e) {
        if (e._nq.indexOf(w) >= 0 || e._nkw.some(function (k) { return k.indexOf(w) >= 0; })) df++;
      });
      wt[w] = df <= 1 ? 1 : df === 2 ? 0.85 : df <= 4 ? 0.6 : 0.4;
    });
    return wt;
  }

  /** 질문과 가장 잘 맞는 항목들을 점수순으로 돌려준다 */
  function search(index, q) {
    var nq = norm(q);
    if (!nq) return [];
    var tk = uniq(toks(q).map(norm));
    var qbi = bigrams(nq);
    var w1 = uniq(words1(q));
    var wt = weights(index, tk);
    var unk = tk.filter(function (w) { return !knownAnywhere(index, w); }).length;
    var out = [];
    index.forEach(function (e) {
      var s = score(e, nq, tk, qbi, w1, wt, unk);
      if (s > 0) out.push({ e: e, s: s });
    });
    out.sort(function (a, b) { return b.s - a.s || a.e._i - b.e._i; });
    return out;
  }

  /** 오타 교정용 단어장 */
  function vocab(index) {
    var v = new Map();
    index.forEach(function (e) { e._vocab.forEach(function (w) { if (!v.has(w)) v.set(w, jamo(w)); }); });
    return v;
  }

  function known(w, voc) {
    if (voc.has(w)) return true;
    var ok = false;
    voc.forEach(function (_, v) { if (!ok && (v.indexOf(w) >= 0 || (v.length >= 2 && w.indexOf(v) >= 0))) ok = true; });
    return ok;
  }

  /** 모르는 낱말을 자모 거리로 가장 가까운 아는 낱말로 바꾼다. 바뀐 게 없으면 null */
  function correct(q, voc) {
    var changed = [];
    var fixed = toks(q).map(norm).map(function (w) {
      if (w.length < 2 || known(w, voc)) return w;
      var jw = jamo(w);
      if (jw.length < 4) return w;
      var maxD = jw.length >= 8 ? 2 : 1;
      var best = null, bd = maxD + 1;
      voc.forEach(function (jv, v) {
        if (bd === 0 || Math.abs(jv.length - jw.length) > maxD) return;
        var d = lev(jw, jv, bd - 1);
        if (d < bd) { bd = d; best = v; }
      });
      if (best && bd <= maxD) { changed.push({ from: w, to: best }); return best; }
      return w;
    });
    return changed.length ? { query: fixed.join(' '), changes: changed } : null;
  }

  /** 같은 분류이거나 키워드가 겹치는 항목 */
  function related(index, e, n) {
    var kw = new Set(e._nkw);
    return index.filter(function (o) { return o !== e; }).map(function (o) {
      var s = 0;
      if (o.cat && o.cat === e.cat) s += 2;
      if (o._nkw.some(function (k) { return kw.has(k); })) s += 3;
      return { o: o, s: s };
    }).filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.o._i - b.o._i; })
      .slice(0, n || 3).map(function (x) { return x.o; });
  }

  // 인사·감사·상담원 연결 같은 기본 대화
  var INTENTS = {
    greet: ['안녕', '안녕하세요', '안녕하십니까', '하이', 'hi', 'hello', 'ㅎㅇ', '반가워', '반가워요', '반갑습니다'],
    thanks: ['고마워', '고마워요', '고맙습니다', '감사', '감사해요', '감사합니다', '땡큐', 'thanks', 'thankyou', 'ㄳ', 'ㄱㅅ', '좋아요', '알겠어요', '알겠습니다'],
    human: ['상담원', '상담사', '직원', '사장님', '사람이랑', '사람과', '사람연결', '연결해', '연결해주세요', '통화', '전화번호', '연락처', '문의처'],
    help: ['처음', '처음으로', '메뉴', '도움말', 'help', '시작', '목록', '전체']
  };

  function intent(q) {
    var nq = norm(q);
    if (!nq) return null;
    var found = null;
    Object.keys(INTENTS).some(function (k) {
      return INTENTS[k].some(function (w) {
        var nw = norm(w);
        var hit = k === 'human' ? nq.indexOf(nw) >= 0 : (nq === nw || (nq.indexOf(nw) === 0 && nq.length <= nw.length + 3));
        if (hit) found = k;
        return hit;
      });
    });
    return found;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 답변 글을 안전한 HTML로: 줄바꿈, **굵게**, 주소 자동 링크 */
  function fmt(text) {
    var h = esc(text);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    return h.replace(/\r?\n/g, '<br>');
  }

  /** 버튼 링크는 웹·전화·문자·메일 주소만 허용 */
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (/^(https?:|tel:|mailto:|sms:)/i.test(u)) return u;
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(u) && !/^javascript/i.test(u)) return 'https://' + u;
    return null;
  }

  // 답하지 못한 질문을 보고할 때 개인정보로 보이는 부분을 가린다
  function scrub(q) {
    return String(q || '')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***')
      .replace(/\d[\d\s-]{4,}\d/g, '***')
      .slice(0, 200);
  }

  var CONFIDENT = 45, CANDIDATE = 22;

  /**
   * 질문 하나에 대한 챗봇의 판단. 화면(ui.js)과 테스트가 함께 쓴다.
   * answer: 바로 답 / category: 분류 목록 / intent: 인사·감사·상담원 / suggest: 오타 교정 후 "혹시 ○○?" /
   * candidates: 비슷한 질문 후보 / none: 못 찾음
   */
  function decide(index, voc, q, cats) {
    var nq = norm(q);
    var cat = (cats || []).filter(function (c) { return norm(c) === nq; })[0];
    if (cat) return { type: 'category', cat: cat };
    var res = search(index, q);
    if (res.length && res[0].s >= CONFIDENT) return { type: 'answer', item: res[0].e, score: res[0].s, results: res };
    var it = intent(q);
    if (it) return { type: 'intent', intent: it, results: res };
    var fix = correct(q, voc);
    if (fix) {
      var r2 = search(index, fix.query);
      if (r2.length && r2[0].s >= CONFIDENT) {
        // 원래 질문으로도 그럴듯한 후보가 있었다면 둘 다 보여 준다(진짜 낱말을 오타로 오해했을 수 있으므로)
        if (res.length && res[0].s >= CANDIDATE && res[0].e !== r2[0].e) {
          return { type: 'candidates', items: [res[0].e, r2[0].e], fix: fix, results: res };
        }
        return { type: 'suggest', item: r2[0].e, fix: fix, score: r2[0].s, results: res };
      }
    }
    var c = res.filter(function (x) { return x.s >= CANDIDATE; }).slice(0, 3);
    if (c.length) return { type: 'candidates', items: c.map(function (x) { return x.e; }), results: res };
    return { type: 'none', results: res };
  }

  return {
    decide: decide,
    canon: canon, norm: norm, toks: toks, words1: words1, stripJosa: stripJosa, jamo: jamo, lev: lev, bigrams: bigrams, dice: dice,
    prepare: prepare, search: search, vocab: vocab, correct: correct, related: related, intent: intent,
    esc: esc, fmt: fmt, safeUrl: safeUrl, scrub: scrub,
    CONFIDENT: CONFIDENT, CANDIDATE: CANDIDATE
  };
});
