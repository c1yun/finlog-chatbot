"""일일 응답 현황: tidy_resp 하나로 완료·선별 종료 수(계열 × 묶음), 오늘 들어온 수, 한 문단 상태 문장을 만든다.

사용: python3 monitor_survey.py --in PATH [--today YYYY-MM-DD] [--json]
  PATH: tidy_resp*.csv 가 있는 디렉터리, tidy_resp.csv 파일, 또는 시트 get_values JSON(tidy_resp 행)
제외 예상 수는 응답 시트만 보고 어림한 값이다(한 줄 응답·중복은 카드 시트가 있어야 알 수 있어 analyze_survey.py 에서 센다).
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True   # 저장소에 __pycache__ 를 남기지 않는다

import pandas as pd              # noqa: E402

import survey_io as sio          # noqa: E402

KST = ZoneInfo('Asia/Seoul')
WEEKDAY = '월화수목금토일'


def _md(d: date) -> str:
    return f'{d.month}. {d.day}.({WEEKDAY[d.weekday()]})'


def summarize(resp: pd.DataFrame, today: date | None = None, lock: dict | None = None, spec: dict | None = None) -> dict:
    lock, spec = lock or sio.load_lock(), spec or sio.load_spec()
    today = today or datetime.now(KST).date()
    strata, routes = list(lock['strata']), [r['id'] for r in lock['routes']]
    arm_of = {r['id']: r['arm'] for r in lock['routes']}
    st = resp['status']
    comp = resp[st == 'complete']
    grid = {}
    for status in sio.STATUSES:
        sub = resp[st == status]
        g = {s: {str(r): int(((sub['stratum'] == s) & (sub['route'] == r)).sum()) for r in routes} for s in strata}
        g['미배정'] = {'-': int((~sub['stratum'].isin(strata) | sub['route'].isna()).sum())}
        grid[status] = g
    route_known = comp['route'].notna() & (comp['route_conflict'] == 0)
    quality = {
        'attention_fail': int((route_known & (comp['AC'] != lock['choices']['AC_pass']).fillna(True)).sum()),
        'route_conflict': int((comp['route_conflict'] == 1).sum()),
        'too_fast': int((comp['duration_min'] < spec['exclusions']['too_fast_min']).fillna(False).sum()),
    }
    start = date.fromisoformat(spec['field']['start'])
    close = date.fromisoformat(spec['field']['close'][:10])
    tg = spec['targets']
    n_closed = int(comp['route'].map(arm_of).eq('closed').sum())
    return {
        'today': today.isoformat(), 'start': start.isoformat(), 'close': close.isoformat(),
        'field_day': (today - start).days + 1, 'days_left': (close - today).days,
        'submitted': len(resp), 'complete': len(comp), 'screened_out': int((st == 'screened_out').sum()), 'partial': int((st == 'partial').sum()),
        'today_submitted': int((resp['submit_date'] == today.isoformat()).sum()),
        'today_complete': int((comp['submit_date'] == today.isoformat()).sum()),
        'grid': grid,
        'arms': {'open': int(comp['route'].map(arm_of).eq('open').sum()), 'closed': n_closed},
        'strata_complete': {s: int((comp['stratum'] == s).sum()) for s in strata},
        'quality': quality, 'too_fast_min': spec['exclusions']['too_fast_min'], 'targets': tg,
    }


def status_line(s: dict, lock: dict | None = None) -> str:
    """일일 보고용 한 문단."""
    lock = lock or sio.load_lock()
    names = {k: v['name'] for k, v in lock['strata'].items()}
    today = date.fromisoformat(s['today'])
    tg, q = s['targets'], s['quality']
    excl = q['attention_fail'] + q['route_conflict'] + q['too_fast']
    est = s['complete'] - excl
    parts = [f"{_md(today)} 기준 응답 {s['submitted']}건이 제출되었다(완료 {s['complete']}, 선별 종료 {s['screened_out']}, 미완료 {s['partial']})."]
    parts.append(f"오늘 들어온 응답은 {s['today_submitted']}건(완료 {s['today_complete']})이다." if s['field_day'] >= 1
                 else f"본조사는 {_md(date.fromisoformat(s['start']))}에 시작한다.")
    parts.append(f"완료 응답은 공개 {s['arms']['open']}명·비공개 {s['arms']['closed']}명이고, 계열별로 "
                 + ', '.join(f'{names[k]} {v}명' for k, v in s['strata_complete'].items()) + '이다.')
    if excl:
        parts.append(f"주의 확인 실패 {q['attention_fail']}·묶음 충돌 {q['route_conflict']}·{s['too_fast_min']}분 미만 {q['too_fast']}건은 분석에서 빠질 예정이라 "
                     f"유효 응답은 약 {est}명이다.")
    need_n, need_c = max(0, tg['n_min'] - est), max(0, tg['closed_min'] - s['arms']['closed'])
    if need_n or need_c:
        parts.append(f"목표 유효 {tg['n_valid']}명 대비 {est / tg['n_valid']:.0%}로, 최소 기준 {tg['n_min']}명까지 {need_n}명, "
                     f"비공개 {tg['closed_min']}명까지 {need_c}명이 더 필요하다.")
    else:
        parts.append(f"최소 기준(유효 {tg['n_min']}명, 비공개 {tg['closed_min']}명)을 넘었고 목표 {tg['n_valid']}명 대비 {est / tg['n_valid']:.0%}다.")
    worst = None
    for k in lock['strata']:
        row = s['grid']['complete'][k]
        lo, hi = min(row, key=row.get), max(row, key=row.get)
        gap = row[hi] - row[lo]
        if worst is None or gap > worst[0]:
            worst = (gap, k, lo, row[lo], hi, row[hi])
    if worst and worst[0] >= 3:
        gap, k, lo, nlo, hi, nhi = worst
        parts.append(f"묶음 차이가 가장 큰 계열은 {names[k]}({lo}번 {nlo}명, {hi}번 {nhi}명)으로 rebalance 를 검토한다.")
    if s['days_left'] >= 0:
        parts.append(f"마감일 {_md(date.fromisoformat(s['close']))}까지 {s['days_left']}일 남았다.")
    else:
        parts.append('조사가 마감되었다.')
    return ' '.join(parts)


def table(s: dict, lock: dict | None = None) -> str:
    lock = lock or sio.load_lock()
    routes = [str(r['id']) for r in lock['routes']]
    arm = {str(r['id']): ('공개' if r['arm'] == 'open' else '비공개') + r['set'] for r in lock['routes']}
    lines = ['계열 \\ 묶음  ' + '  '.join(f'{r}({arm[r]})' for r in routes) + '   합계']
    for k in lock['strata']:
        row = s['grid']['complete'][k]
        lines.append(f'{k:<10}' + ''.join(f'{row[r]:>11}' for r in routes) + f'{sum(row.values()):>8}')
    unassigned = s['grid']['complete']['미배정']['-']
    if unassigned:
        lines.append(f'묶음 미정(충돌 등) 완료 응답 {unassigned}')
    lines.append(f"완료 {s['complete']} · 선별 종료 {s['screened_out']} · 미완료 {s['partial']} · 오늘 {s['today_submitted']}")
    return '\n'.join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='설문 일일 현황(계열 × 묶음, 오늘, 상태 문장)')
    ap.add_argument('--in', dest='inp', required=True, type=Path, help='tidy_resp 디렉터리·CSV·시트 행 JSON')
    ap.add_argument('--today', type=date.fromisoformat, default=None, help='기준일(기본: 오늘, 한국 시간)')
    ap.add_argument('--json', action='store_true', help='JSON 으로 출력')
    a = ap.parse_args(argv)
    try:
        resp = sio.load_resp(a.inp)
    except sio.SurveyDataError as e:
        print(f'입력 오류: {e}', file=sys.stderr)
        return 2
    s = summarize(resp, a.today)
    line = status_line(s)
    if a.json:
        print(json.dumps({**s, 'status_line': line}, ensure_ascii=False, indent=1))
    else:
        print(table(s))
        print()
        print(line)
    return 0


if __name__ == '__main__':
    sys.exit(main())
