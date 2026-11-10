#!/usr/bin/env python3
"""새 설문(부울경 10곳 대 수도권 10곳, 1:1 비교)의 응답을 분석한다.

입력: 응답 시트의 '설문지 응답' 탭을 CSV로 내려받은 파일(파일 > 다운로드 > CSV).
출력: 집계 JSON(원자료는 담지 않는다)과 화면 요약.
규칙은 설문조사지 Ⅲ장(응답을 보기 전에 정한 규칙)과 같다.
  - 부울경 선택 점수 y: 1~5, 부울경 회사에 지원한다 = 5
  - 학생 선호(기업별): 가림 집단의 y 평균을 (평균 − 1) × 25로 바꾼 값
  - 간판 효과(전체): 응답자별 10쌍 평균의 공개 집단 평균 − 가림 집단 평균, 부트스트랩 95% 신뢰구간
  - 제외: 주의 확인 문항 오답, 10쌍 모두 같은 번호, 동의하지 않음, 3쌍 이상 미응답

사용: python3 analyze_pairs.py 응답.csv [--out results_pairs.json]
      python3 analyze_pairs.py --selftest      (가짜 응답으로 계산 과정만 점검. 결과는 어디에도 쓰지 않는다)
"""
import csv
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
CHOICES = ['A사에 지원한다', 'A사 쪽에 가깝다', '반반이다', 'B사 쪽에 가깝다', 'B사에 지원한다']
GROUPS = {1: ('가림', 1), 2: ('공개', 1), 3: ('가림', 2), 4: ('공개', 2)}
REGIONAL = {1: 'TKG태광', 2: '태광후지킨', 3: '송원산업', 4: '동화엔텍', 5: '해성디에스', 6: '지엠비코리아', 7: '조광요턴', 8: '넥센타이어', 9: 'BHI', 10: '파나시아'}
METRO = {1: '한세실업', 2: '미코세라믹스', 3: '동진쎄미켐', 4: '신성이엔지', 5: '대덕전자', 6: '인지컨트롤스', 7: '노루페인트', 8: '한국타이어앤테크놀로지', 9: 'SGC E&C', 10: '안랩'}
B = 2000
RNG = np.random.default_rng(20261110)


def reg_is_a(no, order):
    return (no % 2 == 1) == (order == 1)


def read_rows(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def col(row, pattern):
    for k, v in row.items():
        if k and re.match(pattern, k.strip()):
            return (v or '').strip()
    return ''


def parse(rows):
    """행마다 묶음을 찾고 y(부울경 선택 점수) 10개를 만든다. 제외 사유도 붙인다."""
    out = []
    for r in rows:
        rec = {'reason': None}
        if col(r, r'^가-1') and '동의한다' != col(r, r'^가-1'):
            rec['reason'] = '동의하지 않음'
            out.append(rec)
            continue
        g = next((g for g in GROUPS if any(col(r, rf'^\[{g}-{n}\]') for n in range(1, 11))), None)
        if g is None:
            rec['reason'] = '쌍 문항 응답 없음'
            out.append(rec)
            continue
        cond, order = GROUPS[g]
        xs, ys = [], []
        for n in range(1, 11):
            v = col(r, rf'^\[{g}-{n}\]')
            x = CHOICES.index(v) + 1 if v in CHOICES else None
            xs.append(x)
            ys.append(None if x is None else (6 - x if reg_is_a(n, order) else x))
        rec.update(group=g, cond=cond, order=order, x=xs, y=ys, major=col(r, r'^가-2'), grade=col(r, r'^가-3'),
                   reasons=[s.strip() for s in col(r, rf'^\[{g}-라1\]').split(',') if s.strip()],
                   reveal=[s.strip() for s in col(r, rf'^\[{g}-다1\]').split(',') if s.strip()],
                   want_region=col(r, r'^라-2'), willing=col(r, r'^라-3'),
                   known=[s.strip() for s in col(r, r'^라-4').split(',') if s.strip()])
        missing = sum(1 for x in xs if x is None)
        answered = [x for x in xs if x is not None]
        if col(r, rf'^\[{g}-확인\]') != '반반이다':
            rec['reason'] = '주의 확인 문항 오답'
        elif missing >= 3:
            rec['reason'] = '3쌍 이상 미응답'
        elif len(answered) == 10 and len(set(answered)) == 1:
            rec['reason'] = '10쌍 모두 같은 번호'
        out.append(rec)
    return out


def boot_mean(v):
    v = np.asarray(v, float)
    if len(v) < 2:
        return [None, None]
    m = RNG.choice(v, (B, len(v))).mean(axis=1)
    return [round(float(np.percentile(m, 2.5)), 3), round(float(np.percentile(m, 97.5)), 3)]


def boot_diff(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    if len(a) < 2 or len(b) < 2:
        return [None, None]
    d = RNG.choice(a, (B, len(a))).mean(axis=1) - RNG.choice(b, (B, len(b))).mean(axis=1)
    return [round(float(np.percentile(d, 2.5)), 3), round(float(np.percentile(d, 97.5)), 3)]


def analyze(recs, source):
    valid = [r for r in recs if r['reason'] is None]
    excl = {}
    for r in recs:
        if r['reason']:
            excl[r['reason']] = excl.get(r['reason'], 0) + 1
    by_cond = {c: [r for r in valid if r['cond'] == c] for c in ('가림', '공개')}
    n = {c: len(v) for c, v in by_cond.items()}
    person = {c: [float(np.mean([y for y in r['y'] if y is not None])) for r in v] for c, v in by_cond.items()}
    res = {
        'meta': {'data_source': source, 'n_total': len(recs), 'n_valid': len(valid), 'n_by_cond': n,
                 'n_by_group': {str(g): sum(1 for r in valid if r['group'] == g) for g in GROUPS}, 'excluded': excl,
                 'enough_for_effect': min(n.values()) >= 30, 'enough_for_preference': len(valid) >= 60, 'bootstrap': B},
        'kanban': None, 'pairs': [], 'reasons': {}, 'reveal': None,
    }
    if n['가림'] and n['공개']:
        diff = float(np.mean(person['공개']) - np.mean(person['가림']))
        res['kanban'] = {'mean_blind': round(float(np.mean(person['가림'])), 3), 'mean_open': round(float(np.mean(person['공개'])), 3),
                         'diff_open_minus_blind': round(diff, 3), 'ci95': boot_diff(person['공개'], person['가림'])}
    for no in range(1, 11):
        ya = [r['y'][no - 1] for r in by_cond['가림'] if r['y'][no - 1] is not None]
        yo = [r['y'][no - 1] for r in by_cond['공개'] if r['y'][no - 1] is not None]
        p = {'pair': no, 'regional': REGIONAL[no], 'metro': METRO[no], 'n_blind': len(ya), 'n_open': len(yo)}
        if ya:
            m = float(np.mean(ya))
            ci = boot_mean(ya)
            p.update(mean_blind=round(m, 3), pref=round((m - 1) * 25, 1), pref_ci95=[None if c is None else round((c - 1) * 25, 1) for c in ci],
                     share_regional_blind=round(float(np.mean([y >= 4 for y in ya])), 3))
        if yo:
            p.update(mean_open=round(float(np.mean(yo)), 3), share_regional_open=round(float(np.mean([y >= 4 for y in yo])), 3))
        if ya and yo:
            p.update(diff_open_minus_blind=round(float(np.mean(yo) - np.mean(ya)), 3), diff_ci95=boot_diff(yo, ya))
        res['pairs'].append(p)
    for c, v in by_cond.items():
        cnt = {}
        for r in v:
            for s in r['reasons']:
                cnt[s] = cnt.get(s, 0) + 1
        res['reasons'][c] = {k: round(x / len(v), 3) for k, x in sorted(cnt.items(), key=lambda kv: -kv[1])} if v else {}
    blind = by_cond['가림']
    if blind:
        none = sum(1 for r in blind if '바꾸고 싶은 쌍이 없다' in r['reveal'])
        res['reveal'] = {'n': len(blind), 'share_no_change': round(none / len(blind), 3),
                         'share_by_pair': {str(no): round(sum(1 for r in blind if f'쌍 {no}' in r['reveal']) / len(blind), 3) for no in range(1, 11)}}
    return res


def show(res):
    m = res['meta']
    print(f"응답 {m['n_total']}건, 유효 {m['n_valid']}건 (가림 {m['n_by_cond']['가림']}, 공개 {m['n_by_cond']['공개']}) | 제외 {m['excluded']}")
    if not m['enough_for_effect']:
        print('  ! 한 집단이 30명에 못 미친다. 간판 효과는 값만 적고 결론을 내리지 않는다.')
    if not m['enough_for_preference']:
        print('  ! 유효 응답이 60명에 못 미친다. 학생 선호는 참고 값으로만 쓴다.')
    k = res['kanban']
    if k:
        print(f"간판 효과(공개 − 가림): {k['diff_open_minus_blind']:+.3f}점, 95% CI {k['ci95']} (가림 {k['mean_blind']}, 공개 {k['mean_open']}, 5점 척도)")
    print('쌍  부울경 회사      학생 선호(가림)  95% CI          공개−가림  95% CI')
    for p in res['pairs']:
        print(f"{p['pair']:>2}  {p['regional']:<10}  {str(p.get('pref', '–')):>6}  {str(p.get('pref_ci95', '–')):<18}  {str(p.get('diff_open_minus_blind', '–')):>7}  {p.get('diff_ci95', '–')}")


def selftest():
    """가짜 응답: 가림 집단은 반반, 공개 집단은 부울경 쪽으로 0.5점 덜 고르게 만들고 그 차이를 다시 찾는지 본다."""
    rows = []
    for i in range(240):
        g = i % 4 + 1
        cond, order = GROUPS[g]
        row = {'가-1. 동의': '동의한다', '가-2. 계열': '공학', f'[{g}-확인] 확인': '반반이다'}
        for n in range(1, 11):
            y = int(np.clip(round(RNG.normal(3.0 if cond == '가림' else 2.5, 1.0)), 1, 5))
            x = 6 - y if reg_is_a(n, order) else y
            row[f'[{g}-{n}] 두 회사'] = CHOICES[x - 1]
        row[f'[{g}-라1] 이유'] = '보상, 직무와 업무'
        rows.append(row)
    rows.append({'가-1. 동의': '동의한다', '[1-확인] 확인': 'A사에 지원한다', **{f'[1-{n}] 두 회사': '반반이다' for n in range(1, 11)}})
    res = analyze(parse(rows), 'selftest')
    d = res['kanban']['diff_open_minus_blind']
    assert res['meta']['excluded'] == {'주의 확인 문항 오답': 1}, res['meta']['excluded']
    assert -0.75 < d < -0.25, d
    assert all(40 <= p['pref'] <= 60 for p in res['pairs']), [p['pref'] for p in res['pairs']]
    print(f'자체 점검 통과: 넣은 차이 -0.5점 → 계산 {d:+.3f}점, 가림 집단 학생 선호 {min(p["pref"] for p in res["pairs"])}~{max(p["pref"] for p in res["pairs"])}점(50 근처)')


def main():
    if '--selftest' in sys.argv:
        selftest()
        return
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else Path(__file__).resolve().parent / 'results' / 'results_pairs.json'
    res = analyze(parse(read_rows(args[0])), 'live')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    show(res)
    print('저장:', out)


if __name__ == '__main__':
    main()
