"""합성 사용 과제 응답 만들기(분석 시험용, 실제 응답 아님).

알려진 모형으로 exportTidy 의 'tidy' 시트와 같은 열을 가진 CSV를 만든다.
  정답 확률(문항마다 독립): 직무 카드 0.92, 기존 채용정보 0.72
  시간(초): 로그정규, 중앙값 카드 100 · 기존 170 / 판단 쉬움(1~5): 정규 반올림, 평균 카드 4.3 · 기존 3.0
참가 번호 1..n, 홀수 G1·짝수 G2. 빼야 할 응답으로 '동의 안 함' 1건, '시험(연습 응답)' 1건, 참가 번호 3의 재응답 1건을 섞는다.
파일 이름은 *.SYNTHETIC.csv 이고 synthetic=1 열이 붙는다(analyze_usage.py 는 --draft 없이 followup.json 에 쓰지 않는다).
--raw 를 주면 원 응답 시트 모양(타임스탬프·점수·문항 제목 열, 같은 제목 두 열)의 raw.SYNTHETIC.csv 도 쓴다.

사용: python3 synth_usage.py [--out DIR] [--n 10] [--seed 7] [--raw]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import numpy as np                 # noqa: E402

HERE = Path(__file__).resolve().parent
P_CORRECT = {'card': 0.92, 'posting': 0.72}
TIME_MEDIAN = {'card': 100, 'posting': 170}
EASE_MEAN = {'card': 4.3, 'posting': 3.0}
DAYS = ['2026-11-12', '2026-11-13', '2026-11-14']


def people(lock: dict, n: int, seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    groups = list(lock['groups'])
    out = []
    for pid in range(1, n + 1):
        g = groups[0] if pid % 2 else groups[1]
        rec = {'pid': pid, 'group': g, 'co': {}}
        for name, code in lock['codes'].items():
            fmt = lock['groups'][g][name]
            ans = []
            for q in [q for q in lock['questions'] if q['code'] == code]:
                ok = rng.random() < P_CORRECT[fmt]
                ans.append(q['correct'] if ok else int(rng.choice([k for k in range(1, 5) if k != q['correct']])))
            rec['co'][code] = {'format': fmt, 'answers': ans,
                               'time': int(round(rng.lognormal(np.log(TIME_MEDIAN[fmt]), 0.25))),
                               'ease': int(np.clip(round(rng.normal(EASE_MEAN[fmt], 0.7)), 1, 5))}
        out.append(rec)
    return out


def score(lock: dict, code: str, ans: list[int]) -> int:
    return sum(a == q['correct'] for a, q in zip(ans, [q for q in lock['questions'] if q['code'] == code]))


def tidy_rows(lock: dict, ppl: list[dict]) -> list[dict]:
    rows = []
    stamp = lambda k: f'{DAYS[k % 3]} {10 + k % 7:02d}:{(k * 7) % 60:02d}'  # noqa: E731
    qs = lambda code: [q for q in lock['questions'] if q['code'] == code]  # noqa: E731
    # 참가 번호 3의 재응답은 모두 오답으로 만든다(분석이 먼저 제출한 응답을 쓰는지 확인)
    dup = {'pid': 3, 'group': ppl[2]['group'], 'dup': True,
           'co': {c: dict(d, answers=[q['correct'] % 3 + 1 for q in qs(c)]) for c, d in ppl[2]['co'].items()}}
    extra = [dup, {'pid': None, 'consent': 2}, dict(ppl[0], pid='test')]
    for k, p in enumerate(ppl + extra):
        r = {'resp_key': f'syn{k:03d}', 'submitted_at': stamp(k) if not p.get('dup') else '2026-11-14 18:00',
             'consent': p.get('consent', 1), 'group': p.get('group', ''), 'pid': p['pid'] if p['pid'] is not None else '',
             'spec_hash': lock['spec_hash'], 'synthetic': 1}
        r['status'] = 'no_consent' if r['consent'] != 1 else ('test' if r['pid'] == 'test' else 'complete')
        for name, code in lock['codes'].items():
            lc = code.lower()
            d = p.get('co', {}).get(code)
            r[f'{lc}_format'] = d['format'] if d else ''
            for i in range(6):
                r[f'{lc}_q{i + 1}'] = d['answers'][i] if d else ''
            r[f'{lc}_score'] = score(lock, code, d['answers']) if d else ''
            r[f'{lc}_time_s'] = d['time'] if d else ''
            r[f'{lc}_ease'] = d['ease'] if d else ''
        rows.append(r)
    return rows


def raw_rows(lock: dict, tidy: list[dict]) -> tuple[list[str], list[list[str]]]:
    """구글 원 응답 시트 모양: 폼 문항 순서대로 열(같은 문항 제목이 경로마다 한 번씩)."""
    groups = list(lock['groups'])
    header = ['타임스탬프', '점수', lock['consent']['title'], lock['group_title']]
    keys = []
    for g in groups:
        for name, code in lock['codes'].items():
            for q in [q for q in lock['questions'] if q['code'] == code]:
                header.append(q['title'])
                keys.append((g, code, q))
    tail = []
    for code in lock['codes'].values():
        tail += [('ease', code), ('more', code)]
    tail.append(('pid', None))
    tail += [('time', code) for code in lock['codes'].values()]
    header += [lock['closing'][c]['ease'] if k == 'ease' else lock['closing'][c]['more'] if k == 'more'
               else lock['pid']['title'] if k == 'pid' else lock['closing'][c]['time'] for k, c in tail]
    out = []
    for r in tidy:
        d, hm = r['submitted_at'].split(' ')
        y, mo, dd = d.split('-')
        h, mi = map(int, hm.split(':'))
        ts = f"{y}. {int(mo)}. {int(dd)} {'오후' if h >= 12 else '오전'} {h % 12 or 12}:{mi:02d}:00"
        row = [ts, '', lock['consent']['yes'] if r['consent'] == 1 else lock['consent']['no'], r['group']]
        for g, code, q in keys:
            v = r[f"{code.lower()}_q{int(q['key'][len(code):])}"]
            row.append(q['choices'][v - 1] if v != '' and r['group'] == g else '')
        for k, c in tail:
            if k == 'pid':
                row.append(lock['pid']['test'] if r['pid'] == 'test' else str(r['pid']))
            elif k == 'more':
                row.append('')
            else:
                v = r[f"{c.lower()}_{'ease' if k == 'ease' else 'time_s'}"]
                row.append('' if v == '' else str(v))
        out.append(row)
    return header, out


def write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='합성 사용 과제 응답(시험용)')
    ap.add_argument('--out', default=str(HERE / 'private' / 'synthetic'))
    ap.add_argument('--n', type=int, default=10)
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--raw', action='store_true')
    a = ap.parse_args(argv)
    lock = json.loads((HERE / 'usage.lock.json').read_text(encoding='utf-8'))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    ppl = people(lock, a.n, a.seed)
    tidy = tidy_rows(lock, ppl)
    header = lock['tidy_header'] + ['synthetic']
    write_csv(out / 'tidy.SYNTHETIC.csv', header, [[r[h] for h in header] for r in tidy])
    if a.raw:
        h, rows = raw_rows(lock, tidy)
        write_csv(out / 'raw.SYNTHETIC.csv', h, rows)
    # 정답(실현값): 먼저 제출한 n명의 형식별 정답 수·시간·판단 쉬움
    truth = {'params': {'p_correct': P_CORRECT, 'time_median': TIME_MEDIAN, 'ease_mean': EASE_MEAN, 'n': a.n, 'seed': a.seed},
             'participants': []}
    for p in ppl:
        fmt = {d['format']: (code, d) for code, d in p['co'].items()}
        truth['participants'].append({'pid': p['pid'], 'group': p['group'],
                                      'card_score': score(lock, fmt['card'][0], fmt['card'][1]['answers']),
                                      'posting_score': score(lock, fmt['posting'][0], fmt['posting'][1]['answers']),
                                      'card_time_s': fmt['card'][1]['time'], 'posting_time_s': fmt['posting'][1]['time'],
                                      'card_ease': fmt['card'][1]['ease'], 'posting_ease': fmt['posting'][1]['ease']})
    (out / 'truth.SYNTHETIC.json').write_text(json.dumps(truth, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'wrote {out}/tidy.SYNTHETIC.csv ({len(tidy)}행, 유효 {a.n}명 + 뺄 응답 3건){" + raw.SYNTHETIC.csv" if a.raw else ""}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
