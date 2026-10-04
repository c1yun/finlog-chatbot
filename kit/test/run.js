#!/usr/bin/env node
/* FAQ 챗봇 키트 — 테스트 (설치할 것 없음): node kit/test/run.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const A = require('../src/assemble.js');
const E = require('../src/engine.js');
const { loadProject, parts } = require('../build.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; } catch (err) { fail++; console.log('✖ ' + name + '\n   ' + err.message.split('\n').join('\n   ')); }
}

// ---------- CSV ----------
test('CSV: 따옴표 안의 쉼표·줄바꿈·"" 와 BOM, CRLF', () => {
  const rows = A.parseCSV('﻿카테고리,질문,답변\r\n영업,"쉼표, 있음","첫 줄\r\n둘째 줄 ""인용"""\r\n');
  assert.deepStrictEqual(rows, [['카테고리', '질문', '답변'], ['영업', '쉼표, 있음', '첫 줄\r\n둘째 줄 "인용"']]);
});
test('CSV: 마지막 줄바꿈 없음, 빈 줄 무시', () => {
  assert.deepStrictEqual(A.parseCSV('a,b\n\n1,2'), [['a', 'b'], ['1', '2']]);
});
test('CSV: 엑셀에서 복사한 탭 구분 표', () => {
  assert.deepStrictEqual(A.parseCSV('질문\t답변\n주차?\t돼요'), [['질문', '답변'], ['주차?', '돼요']]);
});
test('CSV: toCSV → parseCSV 왕복', () => {
  const rows = [['a', 'b,c', 'd"e', '줄\n바꿈']];
  assert.deepStrictEqual(A.parseCSV(A.toCSV(rows)), rows);
});

// ---------- 표 → 항목 ----------
test('항목: 한글·영어 머리글, 키워드·링크 나누기', () => {
  const r = A.rowsToItems(A.parseCSV('Category,Question,Answer,Keywords,Link\n영업,몇 시?,9시,"오픈, 마감|영업시간",지도=https://map.naver.com/;전화=tel:010-1234-5678'));
  assert.strictEqual(r.items.length, 1);
  assert.deepStrictEqual(r.items[0].kw, ['오픈', '마감', '영업시간']);
  assert.deepStrictEqual(r.items[0].links, [{ label: '지도', url: 'https://map.naver.com/' }, { label: '전화', url: 'tel:010-1234-5678' }]);
});
test('항목: 빈 답변·중복 질문·머리글 누락을 알려 준다', () => {
  const r = A.rowsToItems(A.parseCSV('질문,답변,키워드\n주차?,,주차\n와이파이?,있어요,와이파이\n와이파이?,있어요,와이파이'));
  assert.ok(r.errors.some((e) => e.row === 2 && /답변이 비어/.test(e.msg)));
  assert.ok(r.errors.some((e) => e.row === 4 && /겹쳐요/.test(e.msg)));
  assert.ok(/머리글/.test(A.rowsToItems(A.parseCSV('a,b\n1,2')).errors[0].msg));
});

// ---------- 안전 ----------
test('안전: 답변 속 HTML은 글자로만 보인다', () => {
  const h = E.fmt('<img src=x onerror=alert(1)> **굵게** https://a.com/?q=1&b=2');
  assert.ok(!/<img/.test(h));
  assert.ok(/<b>굵게<\/b>/.test(h));
  assert.ok(/<a href="https:\/\/a\.com\/\?q=1&amp;b=2"/.test(h));
});
test('안전: javascript: 링크는 막는다', () => {
  assert.strictEqual(E.safeUrl('javascript:alert(1)'), null);
  assert.strictEqual(E.safeUrl('data:text/html,hi'), null);
  assert.strictEqual(E.safeUrl('naver.com'), 'https://naver.com');
  assert.strictEqual(E.safeUrl('tel:010-0000-0000'), 'tel:010-0000-0000');
});
test('안전: 데이터에 </script> 가 있어도 HTML이 깨지지 않는다', () => {
  const html = A.assemble(parts(), { name: '</script><script>alert(1)</script>' }, [{ q: '</script>', a: '<b>', kw: [] }]);
  const scripts = html.match(/<script>/g).length;
  assert.strictEqual(scripts, 3, '스크립트 블록이 3개여야 함');
  assert.ok(!/<\/script><script>alert/.test(html));
  const json = html.match(/window\.BOT=(.*?);<\/script>/)[1];
  assert.strictEqual(JSON.parse(json).items[0].q, '</script>');
});
test('안전: 손님 데이터 속 {{…}} 자리표시는 그대로 남는다', () => {
  const html = A.assemble(parts(), { name: '{{DESC}}' }, [{ q: '/*{{ENGINE}}*/', a: '{{DATA}} /*{{UI}}*/', kw: [] }]);
  const data = JSON.parse(html.match(/window\.BOT=(.*?);<\/script>/)[1]);
  assert.strictEqual(data.items[0].q, '/*{{ENGINE}}*/');
  assert.strictEqual(data.items[0].a, '{{DATA}} /*{{UI}}*/');
  assert.strictEqual(data.config.name, '{{DESC}}');
  assert.ok(/<title>\{\{DESC\}\}<\/title>/.test(html));
});
test('안전: 개인정보처럼 보이는 부분 가리기', () => {
  assert.strictEqual(E.scrub('제 번호 010-1234-5678 이메일 a.b@c.com'), '제 번호 *** 이메일 ***');
});
test('색: 글자색 대비 4.5 이상', () => {
  ['#ffcc00', '#5b3a29', '#1f5f4a', '#6b2fb3', '#f2c14e', '#e0a84f'].forEach((c) => {
    const v = Object.fromEntries(A.themeVars({ primary: c, accent: c }).split(';').map((x) => x.split(':')));
    assert.ok(A.contrast(v['--pri'], v['--pri-ink']) >= 4.5, c + ' 위 글자 대비 부족');
    assert.ok(A.contrast(v['--pri-text'], '#ffffff') >= 4.5, c + ' 글자색 대비 부족');
  });
});

// ---------- 검색 품질 ----------
// [손님 질문, 기대하는 질문(일부), 선택: 'suggest'=오타 교정 후 "혹시 ○○?"로 되묻기]  기대값 null 은 "바로 답하면 안 됨"
const CASES = {
  cafe: [
    ['몇시까지 해요?', '영업시간'], ['오늘 몇 시에 문 닫아요', '영업시간'], ['월요일에도 하나요', '쉬는 날'], ['주차 돼요?', '주차'],
    ['차 가지고 가도 되나요', '주차'], ['주소 알려주세요', '어디에'], ['디카페인 있어요?', '디카페인'],
    ['임산부가 마셔도 되는 커피', '디카페인'], ['오트밀크로 바꿀 수 있어요?', '두유'], ['뭐가 제일 맛있어요?', '대표 메뉴'],
    ['케이크 팔아요?', '디저트'], ['배달 되나요', '배달'], ['텀블러 할인', '텀블러'], ['카드 결제 돼요?', '결제 수단'],
    ['와이파이 비번', '와이파이'], ['노트북 할 자리 있나요', '콘센트'], ['강아지 데려가도 돼요?', '반려동물'],
    ['10명 모임 예약 가능?', '단체'], ['원두 살 수 있어요?', '원두도'], ['원두 택배 되나요', '택배'], ['기프티콘 보내고 싶어요', '기프티콘'],
    ['주처 돼요?', '주차', 'suggest'], ['디카페잉', '디카페인', 'suggest'], ['텀블로 할인', '텀블러'],
    ['비트코인 시세 알려줘', null], ['오늘 날씨 어때', null],
    // 엔진을 고칠 때 보지 않았던 질문(일반화 확인용)
    ['몇 시에 열어요?', '영업시간'], ['일요일도 영업해요?', '영업시간'], ['지하철역에서 가까워요?', '어디에'], ['라떼 추천해 주세요', '대표'],
    ['비건 메뉴 있나요', '두유'], ['빵 있어요?', '디저트'], ['현금영수증 돼요?', '결제'], ['인터넷 되나요', '와이파이'],
    ['공부하기 좋아요?', '콘센트'], ['고양이 데려가도 돼요', '반려동물'], ['생일파티 할 수 있나요', '단체'], ['원두 갈아주나요', '원두도'],
    ['화장실 어디예요', null], ['아메리카노 가격', null]
  ],
  pension: [
    ['체크인 몇시예요?', '체크인'], ['퇴실 시간', '체크인'], ['밤 11시에 도착해요', '늦게'], ['6명이 가도 되나요', '인원'],
    ['예약 어떻게 해요', '예약은'], ['취소하면 환불돼요?', '환불'], ['바베큐 얼마예요', '바베큐'], ['숯 추가 되나요', '바베큐'],
    ['불멍 가능?', '불멍'], ['수영장 운영해요?', '수영장'], ['와이파이 돼요?', '와이파이'], ['요리해 먹을 수 있나요', '요리'],
    ['수건 있어요?', '수건'], ['강아지 동반 가능해요?', '반려동물'], ['애기랑 가도 돼요?', '아기'], ['바베쿠 얼마예요', '바베큐', 'suggest'], ['근처 편의점', '마트'],
    ['주변 맛집', '가 볼 만한'], ['터미널에서 데리러 와주나요', '픽업'], ['아침 주나요', '조식'], ['주식 추천해줘', null],
    ['입실 몇시부터', '체크인'], ['늦게 퇴실 가능해요?', '체크인'], ['최대 몇 명까지 돼요', '인원'], ['환불 규정 알려주세요', '환불'],
    ['고기 구워 먹을 수 있어요?', '바베큐'], ['스파 있어요?', '수영장'], ['밥솥 있나요', '요리'], ['드라이기 있어요?', '수건'],
    ['반려견 몇마리까지', '반려동물'], ['버스 타고 가는데요', '픽업'], ['아침밥 먹을 데 있나요', '조식']
  ],
  academy: [
    ['초등학생 반 있어요?', '어떤 반'], ['수업 몇시에 해요', '시간표'], ['레테 언제 봐요', '레벨테스트'], ['학원비 얼마예요', '수강료는 얼마'],
    ['형제 할인 있나요', '형제'], ['카드 결제 되나요', '어떻게 내나요'], ['중간에 그만두면 환불돼요?', '환불'],
    ['아파서 결석하면요?', '결석'], ['숙제 많아요?', '숙제'], ['중간고사 대비', '내신'], ['성적 알려주나요', '학습 상황'],
    ['차량 운행해요?', '차량'], ['교재비 따로예요?', '교재비'], ['자습실 있어요?', '자습실'], ['학기 중간에 들어가도 돼요?', '중간에 들어가도'],
    ['영어 학원도 해요?', null],
    ['중학생 반 있나요', '어떤 반'], ['토요일 수업 있어요?', '시간표'], ['테스트 비용 있어요?', '레벨테스트'], ['한달 수강료', '수강료는 얼마'],
    ['둘째 할인', '형제'], ['보충 수업', '결석'], ['시험 기간 특강', '내신'], ['셔틀 노선', '차량'], ['선생님 몇 분이에요?', null]
  ],
  club: [
    ['언제까지 지원해요?', '지원 기간'], ['가입 어떻게 해요', '어떻게 지원'], ['기타 처음인데 괜찮나요', '못 쳐도'],
    ['오디션 봐요?', '오디션'], ['졸업생도 되나요', '졸업생'], ['드럼 파트 있어요?', '파트'], ['정기모임 무슨 요일', '정기 모임'],
    ['공연 몇 번 해요', '공연'], ['매주 꼭 나가야 돼요?', '매주'], ['동방 어디예요', '동아리방'], ['술 못 마셔도 되나요', '뒤풀이'],
    ['엠티 가요?', 'MT'], ['회비 얼마', '회비'], ['악기 없는데요', '악기가 없어도'], ['토익 점수 필요해요?', null],
    ['신입 모집 언제', '지원 기간'], ['면접 봐요?', '오디션'], ['연습 언제 해요', '정기 모임'], ['축제 공연', '공연'], ['회비 있어요?', '회비'],
    ['드럼 없는데', '악기가 없어도'], ['휴학생도 가입 돼요?', '졸업생'], ['동아리 인원 몇 명이에요?', null]
  ]
};

const report = [];
Object.keys(CASES).forEach((slug) => {
  const { items } = loadProject(path.join(__dirname, '..', 'examples', slug));
  const idx = E.prepare(items);
  const voc = E.vocab(idx);
  CASES[slug].forEach(([q, want, mode]) => {
    test(`검색(${slug}): "${q}"`, () => {
      const d = E.decide(idx, voc, q, []);
      const res = d.results || [];
      const got = d.item ? d.item.q : null;
      report.push({ slug, q, type: d.type, got, s: d.score || (res[0] ? res[0].s : 0), second: res[1] ? res[1].s : 0, fix: d.fix ? d.fix.query : '' });
      if (want === null) {
        assert.notStrictEqual(d.type, 'answer', `바로 답하면 안 되는데 "${got}"(${d.score}점)로 답함`);
      } else {
        const type = mode || 'answer';
        assert.strictEqual(d.type, type, `기대 ${type} "${want}" / 실제 ${d.type} ${got ? '"' + got + '"' : ''} (1등 ${res[0] ? res[0].s + '점 "' + res[0].e.q + '"' : '없음'})`);
        assert.ok(got.indexOf(want) >= 0, `기대 "${want}" / 실제 "${got}"`);
      }
    });
  });
});

test('인사·상담원 연결 의도', () => {
  assert.strictEqual(E.intent('안녕하세요!'), 'greet');
  assert.strictEqual(E.intent('감사합니다'), 'thanks');
  assert.strictEqual(E.intent('상담원 연결해 주세요'), 'human');
  assert.strictEqual(E.intent('주차 돼요?'), null);
});

test('예시 빌드: 모든 예시가 오류 없이 만들어진다', () => {
  fs.readdirSync(path.join(__dirname, '..', 'examples')).forEach((slug) => {
    const { config, items, errors } = loadProject(path.join(__dirname, '..', 'examples', slug));
    assert.strictEqual(errors.filter((e) => !e.warn).length, 0, slug + ' 오류');
    const html = A.assemble(parts(), config, items);
    assert.ok(html.length < 200 * 1024, slug + ' 파일이 너무 큼');
  });
});

if (process.argv.includes('--verbose')) {
  report.forEach((r) => console.log(`${r.slug.padEnd(8)} ${r.type.padEnd(10)} ${String(r.s).padStart(4)} ${String(r.second).padStart(4)}  ${r.q} → ${r.got || '-'}${r.fix ? ' (교정: ' + r.fix + ')' : ''}`));
}
console.log(`\n${fail ? '✖' : '✔'} 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
