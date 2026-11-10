// 새 설문 폼 스크립트(dist/form_pairs.gs)를 모의 Apps Script 환경에서 끝까지 돌려 본다.
// 사용: node build_form_pairs_gs.js && node test/test_form_pairs.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { makeEnv, walk, ItemType } = require('./mock_gas');
const S = require('../pairs_spec');

const M = makeEnv();
const ctx = vm.createContext({ ...M.env });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'form_pairs.gs'), 'utf-8'), ctx, { filename: 'form_pairs.gs' });
ctx.build();
const form = Object.values(M.forms).find((f) => f.title === S.title);
const lot = Object.values(M.forms).find((f) => f.title.includes('추첨'));
assert(form && lot, '폼 두 개');
assert.strictEqual(form.items.filter((x) => x.type === ItemType.PAGE_BREAK).length, 46, '쪽 수');
assert.strictEqual(form.settings.email, false, '이메일 미수집');
assert.strictEqual(form.settings.one, false, '시험 중에는 1인 1회 꺼짐');
assert(form.confirmation.includes('GP-2611') && form.confirmation.includes('forms.gle'), '완료 문구에 코드와 추첨 링크');

// 생일 1~31마다 폼을 끝까지 따라가 본다
const cond = { 1: '가림', 2: '공개', 3: '가림', 4: '공개' };
const names = [...S.pairs.map((p) => p.metro.company), 'TKG태광', '태광후지킨', '송원산업', '동화엔텍', '해성디에스', '지엠비코리아', '조광요턴', '넥센타이어', 'BHI', '파나시아'];
const count = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (let d = 1; d <= 31; d++) {
  const g = d % 4 === 0 ? 4 : d % 4;
  count[g]++;
  const seen = [];
  const res = walk(form, (it) => {
    const t = it.title;
    if (t.startsWith('가-1')) return '동의한다';
    if (t.startsWith('가-4')) return String(d);
    if (/-확인\]/.test(t)) return '반반이다';
    if (it.type === ItemType.CHECKBOX) return [it.choices[0].value];
    return it.choices[0].value;
  });
  res.answers.forEach((a) => { const m = /^\[(\d)-(\d+)\]/.exec(a.item.title); if (m) seen.push([Number(m[1]), Number(m[2])]); });
  assert.strictEqual(seen.length, 10, `생일 ${d}: 쌍 10개`);
  assert(seen.every(([gg]) => gg === g), `생일 ${d}: 묶음 ${g}만`);
  assert.deepStrictEqual(seen.map((x) => x[1]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `생일 ${d}: 쌍 순서`);
  const titles = res.answers.map((a) => a.item.title);
  assert(titles.some((t) => t.startsWith('라-4')), `생일 ${d}: 마지막 문항까지`);
  assert.strictEqual(titles.filter((t) => /-라1\]/.test(t)).length, 1, `생일 ${d}: 이유 문항 1개`);
  assert.strictEqual(titles.filter((t) => /-다1\]/.test(t)).length, cond[g] === '가림' ? 1 : 0, `생일 ${d}: 이름 공개 문항`);
  // 가린 묶음: 10쌍을 고르는 쪽에는 회사 이름이 없어야 한다
  const pages = form.items.filter((x) => x.type === ItemType.PAGE_BREAK && /^쌍 /.test(x.title));
  const mine = pages.slice((g - 1) * 10, g * 10);
  mine.forEach((pb) => {
    const leak = names.filter((n) => pb.help.includes(n));
    if (cond[g] === '가림') assert.strictEqual(leak.length, 0, `묶음 ${g} ${pb.title}: 이름 노출 ${leak}`);
    else assert.strictEqual(leak.length, 2, `묶음 ${g} ${pb.title}: 두 회사 이름`);
  });
}
// 동의하지 않으면 바로 끝난다
const no = walk(form, (it) => (it.title.startsWith('가-1') ? '동의하지 않는다' : it.choices[0] && it.choices[0].value));
assert.strictEqual(no.answers.length, 1, '비동의는 한 문항으로 끝');
// 부울경 회사의 자리: 순서 1은 홀수 쌍 A, 순서 2는 반대
const key = Object.values(M.sheets)[0].sheets['묶음_열쇠'].data;
assert.strictEqual(key.length, 41);
assert.strictEqual(key.find((r) => r[0] === 1 && r[3] === 1)[4], 'A');
assert.strictEqual(key.find((r) => r[0] === 3 && r[3] === 1)[4], 'B');
ctx.launch();
assert.strictEqual(form.settings.one, true, 'launch 뒤 1인 1회');
ctx.closeSurvey();
assert.strictEqual(form.settings.accepting, false);
console.log('통과: 생일 31개 경로', JSON.stringify(count), '· 쪽 46 · 가린 묶음 이름 노출 없음 · launch/close 동작');
console.log(M.logs.filter((l) => /점검/.test(l)).join('\n'));
