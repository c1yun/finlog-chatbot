"""survey_results.json 을 결과보고서에 쓰기 전에 점검한다.

check(results_json, scores_json) → 문제 목록(빈 목록이면 통과)
- data_source 가 'live' 인가(시험·합성 결과는 보고서에 쓰지 않는다)
- form_id 가 survey_spec.json 의 production_form_id 와 같은가(production_form_id 가 null 이면 그것도 문제)
- spec_hash 가 spec.lock.json 과, scores_hash 가 지금의 scores.json 과 같은가
- 종합점수를 preference 와 scores.json 으로 다시 계산해 ±0.05 안에 드는가(기업 평가·충족률 자격·TOP3 자격 포함)
- cells 합과 n_open + n_closed 가 n_valid 와 같은가

사용: python3 check_survey.py [RESULTS_JSON] [--scores PATH]   (문제가 있으면 종료 코드 1)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True   # 저장소에 __pycache__ 를 남기지 않는다

import survey_io as sio          # noqa: E402

TOL = 0.05
FILL_MIN = 0.7


def _close(a, b) -> bool:
    return a is not None and b is not None and abs(float(a) - float(b)) <= TOL


def _check_scores(r: dict, scores: dict) -> list[str]:
    """종합점수 다시 계산: final = w × scores.json 환산점수 + (1 − w) × preference.pref"""
    out = []
    pref = {p.get('company'): p.get('pref') for p in r.get('preference') or []}
    rk = r.get('ranking') or {}
    by_w = rk.get('by_w') or {}
    if '0.7' not in by_w:
        out.append('ranking.by_w 에 "0.7"(주 분석)이 없음')
    eligible = {}
    for wk, rows in by_w.items():
        w = float(wk)
        missing = set(pref) - {e.get('company') for e in rows}
        if missing:
            out.append(f'w={wk}: 순위표에 없는 기업 {sorted(missing)}')
        for e in rows:
            co = e.get('company')
            if co not in scores:
                out.append(f'w={wk} {co}: scores.json 에 없는 기업')
                continue
            fin = scores[co]['final']
            ok = fin.get('fill') is not None and fin['fill'] >= FILL_MIN
            eligible[co] = ok
            if not _close(e.get('eval'), fin.get('scaled')):
                out.append(f'w={wk} {co}: 기업 평가 {e.get("eval")} ≠ scores.json {fin.get("scaled")}')
            if e.get('eligible') != ok:
                out.append(f'w={wk} {co}: TOP3 자격 {e.get("eligible")} ≠ 충족률 {fin.get("fill")} 기준')
            p = pref.get(co)
            if p is None:
                if e.get('final') is not None:
                    out.append(f'w={wk} {co}: 학생 선호가 없는데 종합점수가 있음')
                continue
            if not _close(e.get('pref'), p):
                out.append(f'w={wk} {co}: 순위표 학생 선호 {e.get("pref")} ≠ preference {p}')
            expect = w * fin['scaled'] + (1 - w) * p
            if not _close(e.get('final'), expect):
                out.append(f'w={wk} {co}: 종합 {e.get("final")} ≠ 다시 계산 {expect:.2f}')
    for co in rk.get('top3') or []:
        if not eligible.get(co, False):
            out.append(f'TOP3 {co}: 정보 충족률 {FILL_MIN:.0%} 미만이거나 점수표에 없음')
    return out


def check(results_path, scores_path=sio.SCORES) -> list[str]:
    try:
        r = sio.load_json(results_path)
    except (OSError, json.JSONDecodeError) as e:
        return [f'결과 파일을 읽지 못함: {e}']
    problems = []
    meta = r.get('meta') or {}
    if meta.get('data_source') != 'live':
        problems.append(f"data_source 가 'live' 가 아님: {meta.get('data_source')!r} — 시험·합성 결과는 보고서에 쓰지 않는다")
    prod = sio.load_spec().get('production_form_id')
    if not prod:
        problems.append('survey_spec.json 의 production_form_id 가 null — 배포 폼 ID를 고정해야 결과의 출처를 확인할 수 있음')
    elif meta.get('form_id') != prod:
        problems.append(f"form_id {meta.get('form_id')!r} ≠ production_form_id {prod!r}")
    lock_hash = sio.load_lock()['spec_hash']
    if meta.get('spec_hash') != lock_hash:
        problems.append(f"spec_hash {meta.get('spec_hash')!r} ≠ spec.lock.json {lock_hash!r} — 다른 설계로 분석함")
    try:
        sh = sio.sha16(scores_path)
        scores = sio.load_json(scores_path)
    except OSError as e:
        return problems + [f'scores.json 을 읽지 못함: {e}']
    if meta.get('scores_hash') != sh:
        problems.append(f"scores_hash {meta.get('scores_hash')!r} ≠ 지금 scores.json {sh!r} — 기업 점수가 바뀌었으니 다시 분석")
    problems += _check_scores(r, scores)
    n = meta.get('n_valid')
    cells = meta.get('cells') or {}
    if sum(cells.values()) != n:
        problems.append(f'cells 합 {sum(cells.values())} ≠ n_valid {n}')
    if (meta.get('n_open') or 0) + (meta.get('n_closed') or 0) != n:
        problems.append(f"n_open {meta.get('n_open')} + n_closed {meta.get('n_closed')} ≠ n_valid {n}")
    return problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='survey_results.json 점검(보고서 반영 전)')
    ap.add_argument('results', nargs='?', type=Path, default=sio.RESULTS_LIVE / 'survey_results.json')
    ap.add_argument('--scores', type=Path, default=sio.SCORES)
    a = ap.parse_args(argv)
    problems = check(a.results, a.scores)
    if problems:
        print(f'문제 {len(problems)}건: {a.results}')
        for p in problems:
            print('  -', p)
        return 1
    print(f'통과: {a.results}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
