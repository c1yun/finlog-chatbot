"""설문 분석 파이프라인 시험(pytest 없이 실행): python3 reports/survey/tests/test_pipeline.py

1) 합성 자료(알려진 간판 효과 + 주입한 제외 대상) → analyze_survey
   - 흐름 표의 단계별 수 = 주입한 수, 유효 = 정상 응답 수
   - 알려진 지역 간판 효과(+0.35)가 Welch·BCa 95% CI 안에 있음(이중차분·혼합모형·기업별 선호도 확인)
   - --out 을 줘도 out_nonlive/ 로 감, --source live 라도 합성 표시가 있으면 synthetic
   - check_survey 가 비본조사·폼 ID 문제를 보고하고, 종합점수 조작·cells 불일치를 잡음
2) 3위 경계 규칙(만든 숫자), 3) 시트 행 ↔ CSV, 일일 현황
"""
import copy
import csv
import json
import sys
import tempfile
import time
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True                       # 저장소에 __pycache__ 를 남기지 않는다
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd                                  # noqa: E402

import analyze_survey as an                          # noqa: E402
import check_survey                                  # noqa: E402
import monitor_survey                                # noqa: E402
import survey_io as sio                              # noqa: E402
import synth_survey                                  # noqa: E402

PASSED = []


def ok(cond, msg):
    if not cond:
        raise AssertionError(msg)
    PASSED.append(msg)


def covers(ci, x):
    return ci is not None and ci[0] <= x <= ci[1]


def test_tie_rule():
    """3·4위 선호 CI가 겹치면 기업 평가가 높은 쪽이 3위. 충족률 미달은 점수가 높아도 제외."""
    def base(co, ev, pref, ci, fill=0.9):
        return {'company': co, 'eval': ev, 'fill': fill, 'pref': pref, 'pref_ci': ci}
    rows = an.score_rows([base('A', 80, 60, [50, 70]), base('B', 78, 62, [52, 72]), base('C', 70, 70, [60, 80]),
                          base('D', 75, 58, [48, 68]), base('E', 99, 99, [90, 100], fill=0.6)], 0.7)
    # 종합: E 98.97(자격 없음) · A 74.0 · B 73.2 · C 70.0 · D 69.9
    ok([r['company'] for r in rows] == ['E', 'A', 'B', 'C', 'D'] and rows[0]['rank'] == 1 and not rows[0]['eligible'],
       'tie: ranks by final, ineligible kept in table')
    top, tie = an.select_top3(rows)
    ok(top == ['A', 'B', 'D'] and tie['applied'] and '바뀜' in tie['detail'], 'tie: overlapping CIs → higher evaluation (D) takes 3rd')
    for r in rows:
        if r['company'] == 'D':
            r['pref_ci'] = [40, 55]
    top, tie = an.select_top3(rows)
    ok(top == ['A', 'B', 'C'] and not tie['applied'], 'tie: no overlap → final-score order kept')
    rows = an.score_rows([base('A', 80, 60, [50, 70]), base('B', 78, 62, [52, 72]), base('C', 74, 60, [50, 70]),
                          base('D', 72, 63, [53, 73])], 0.7)
    top, tie = an.select_top3(rows)
    ok(top == ['A', 'B', 'C'] and tie['applied'] and '유지' in tie['detail'], 'tie: overlap but #3 has higher evaluation → kept')
    ok(an.ci_overlap(None, [1, 2]), 'tie: unknown CI counts as overlap')


def test_pipeline(tmp: Path) -> dict:
    data = synth_survey.generate(n_valid=200, seed=7)
    synth_survey.write(tmp / 'synth', data)
    truth, inj = data['truth'], data['truth']['injected']

    # 가드: 합성 자료는 --out/--figs 를 무시하고 out_nonlive/synthetic 에 쓴다
    res, path = an.run(an.parse_args(['--in', str(tmp / 'synth'), '--source', 'synthetic',
                                      '--out', str(tmp / 'elsewhere.json'), '--figs', str(tmp / 'figs')]))
    ok(path.resolve().is_relative_to(sio.OUT_NONLIVE.resolve()), f'guard: output under out_nonlive ({path})')
    ok(not (tmp / 'elsewhere.json').exists() and not (tmp / 'figs').exists(), 'guard: --out/--figs ignored for non-live')
    saved = json.loads(path.read_text(encoding='utf-8'))
    m = saved['meta']
    ok(m['data_source'] == 'synthetic' and m['form_id'] is None, 'meta: data_source synthetic')

    # JSON 모양
    ok(list(saved) == ['meta', 'cards', 'preference', 'kanban', 'a2', 'c5', 'c6', 'd1', 'd2', 'blinding', 'ranking', 'figs'], 'json: top-level keys')
    ok(list(m) == ['schema', 'data_source', 'form_id', 'spec_hash', 'scores_hash', 'generated_at', 'flow', 'n_valid', 'n_open',
                   'n_closed', 'cells', 'preference_status', 'exclusions_applied'], 'json: meta keys')
    ok(set(saved['kanban']) == {'regional', 'metro', 'did', 'mixed', 'sensitivity', 'mde'}
       and set(saved['kanban']['regional']) == {'diff', 'ci_welch', 'ci_boot', 't', 'df', 'p', 'g', 'g_ci', 'n_open', 'n_closed',
                                                  'mean_open', 'mean_closed'}, 'json: kanban keys')
    ok(set(saved['ranking']) == {'by_w', 'top3', 'tie_rule', 'eff_weight', 'p_top3'} and set(saved['ranking']['by_w']) == {'0.6', '0.7', '0.8'},
       'json: ranking keys')
    ok(len(saved['cards']) == 20 and len(saved['preference']) == 10 and len(saved['figs']) == 6, 'json: 20 cards, 10 companies, 6 figs')
    ok(all((path.parent / f).is_file() and (path.parent / f).stat().st_size > 20000 for f in saved['figs']), 'figs: PNG files written')

    # 흐름 = 주입한 제외 대상
    flow = {s['step']: s['n'] for s in m['flow']}
    expect = {'submitted': truth['n_rows'], 'screened_out': inj['screened_out'], 'partial': inj['partial'],
              'complete': truth['n_rows'] - inj['screened_out'] - inj['partial'], 'excl_attention': inj['attention'],
              'excl_straight_line': inj['straight_line'], 'excl_too_fast': inj['too_fast'], 'excl_route_conflict': inj['route_conflict'],
              'excl_duplicate': inj['duplicate'], 'valid': truth['n_valid_expected']}
    ok(flow == expect, f'flow matches injected exclusions {flow}')
    ok(m['n_valid'] == m['n_open'] + m['n_closed'] == sum(m['cells'].values()), 'meta: n_open + n_closed = cells sum = n_valid')
    ok(m['preference_status'] == 'final', 'meta: preference_status final at n=200')

    # 간판 효과: 알려진 값(잠재 +0.35, 관측 척도 기댓값)이 95% CI 안
    reg, did = saved['kanban']['regional'], saved['kanban']['did']
    for key in ('ci_welch', 'ci_boot'):
        ok(covers(reg[key], truth['kanban_latent']['regional']), f'kanban: known regional effect 0.35 in {key} {reg[key]}')
        ok(covers(reg[key], truth['kanban_expected']['regional']), f'kanban: expected observed-scale effect in {key}')
    ok(covers(did['ci'], truth['kanban_expected']['did']), f'kanban: DiD CI {did["ci"]} covers truth')
    mx = saved['kanban']['mixed']
    ok(mx['method'].startswith('MixedLM'), f'mixed: crossed MixedLM converged ({mx["method"]})')
    t = mx['terms']['open:regional']
    ok(abs(t['est'] - truth['kanban_expected']['did']) < 2.5 * t['se'], f'mixed: open:regional {t["est"]:.3f} near truth')
    ok(reg['g'] is not None and covers(reg['g_ci'], reg['g']) and saved['kanban']['mde']['d'] > 0, 'kanban: Hedges g CI and MDE present')
    pref_hits = sum(covers(p['ci'], truth['pref_true'][p['company']]) for p in saved['preference'])
    ok(pref_hits >= 8, f'preference: true scores inside 95% CI for {pref_hits}/10 companies')

    # 순위: 종합 = 0.7 × 평가 + 0.3 × 선호, 자격
    scores = sio.load_json(sio.SCORES)
    for r in saved['ranking']['by_w']['0.7']:
        ok(abs(r['final'] - (0.7 * scores[r['company']]['final']['scaled'] + 0.3 * r['pref'])) < 0.01, f'ranking: final for {r["company"]}')
    ok(len(saved['ranking']['top3']) == 3 and abs(sum(saved['ranking']['p_top3'].values()) - 3) < 1e-6, 'ranking: TOP3 and P(TOP3) sum to 3')

    # check_survey: 비본조사 문제는 보고, 나머지는 일치
    probs = check_survey.check(path, sio.SCORES)
    ok(any('data_source' in p for p in probs), 'check: reports non-live data_source')
    ok(any('production_form_id' in p for p in probs), 'check: reports null production_form_id')
    ok(not any(k in p for p in probs for k in ('spec_hash', 'scores_hash', '다시 계산', 'cells')), f'check: hashes/finals/cells consistent {probs}')
    bad = copy.deepcopy(saved)
    bad['ranking']['by_w']['0.7'][0]['final'] += 1.0
    bad['meta']['cells']['1-H'] += 1
    (tmp / 'bad.json').write_text(json.dumps(bad, ensure_ascii=False), encoding='utf-8')
    probs = check_survey.check(tmp / 'bad.json', sio.SCORES)
    ok(any('다시 계산' in p for p in probs) and any('cells' in p for p in probs), 'check: catches tampered final score and cells')
    # 본조사 결과라면 통과하는지(폼 ID를 고정했다고 가정)
    live = copy.deepcopy(saved)
    live['meta'].update(data_source='live', form_id='FORM-TEST')
    (tmp / 'live.json').write_text(json.dumps(live, ensure_ascii=False), encoding='utf-8')
    orig = sio.load_spec
    sio.load_spec = lambda *a: {**orig(*a), 'production_form_id': 'FORM-TEST'}
    try:
        ok(check_survey.check(tmp / 'live.json', sio.SCORES) == [], 'check: clean live result passes')
    finally:
        sio.load_spec = orig

    # 합성 표시가 있으면 --source live --form-id 라도 synthetic 으로 out_nonlive 에 쓴다
    res2, path2 = an.run(an.parse_args(['--in', str(tmp / 'synth'), '--source', 'live', '--form-id', 'FORM-TEST', '--out', str(tmp / 'x.json')]))
    ok(res2['meta']['data_source'] == 'synthetic' and path2.resolve().is_relative_to(sio.OUT_NONLIVE.resolve()) and not (tmp / 'x.json').exists(),
       'guard: synthetic marker overrides --source live')
    ok(an.resolve_output('live', None, None, None)[0] == 'live_no_form_id' and an.resolve_output('live', 'F', str(tmp / 'r.json'), None)[1] == tmp / 'r.json',
       'guard: live needs --form-id; live + form id follows --out')

    # 응답 시간 기준: 시험 중앙값 15분 → max(4, 5) = 5분
    lock = sio.load_lock()
    d = sio.read_dir(tmp / 'synth', lock)
    comp = d.resp.loc[d.resp['status'] == 'complete', 'resp_key']
    ok(int(an.exclusion_flags(d, lock, 5.0).loc[comp, 'too_fast'].sum()) == inj['too_fast'], 'exclusions: pilot-median threshold applied')

    # 시트 get_values 행(끝 빈칸 생략) → CSV 와 같은 DataFrame
    def rows(name):
        with open(sio.find_sheet_file(tmp / 'synth', name), encoding='utf-8') as f:
            out = list(csv.reader(f))
        return [r[:max((i + 1 for i, v in enumerate(r) if v != ''), default=0)] for r in out]
    d2 = sio.from_sheet_rows({'tidy_resp': rows('tidy_resp'), 'tidy_cards': {'values': rows('tidy_cards')}, 'tidy_text': rows('tidy_text')}, lock)
    for a, b in ((d.resp, d2.resp), (d.cards, d2.cards), (d.text, d2.text)):
        pd.testing.assert_frame_equal(a, b)
    ok(d2.synthetic, 'io: Sheets rows == CSV frames, synthetic flag kept')

    # 일일 현황
    s = monitor_survey.summarize(d.resp, today=date(2026, 11, 6))
    grid = sum(v for st in s['grid']['complete'].values() for v in st.values())
    ok(s['complete'] == expect['complete'] and s['screened_out'] == inj['screened_out'] and grid == s['complete'], 'monitor: counts by stratum × route')
    line = monitor_survey.status_line(s)
    ok('11. 6.(금) 기준' in line and '\n' not in line, 'monitor: one-paragraph Korean status line')
    return saved | {'_path': str(path)}


def main() -> int:
    t0 = time.time()
    test_tie_rule()
    with tempfile.TemporaryDirectory() as tmp:
        saved = test_pipeline(Path(tmp))
    reg, rk = saved['kanban']['regional'], saved['ranking']
    flow = ' → '.join(f"{s['step']} {s['n']}" for s in saved['meta']['flow'])
    print(f'통과 {len(PASSED)}개 확인 ({time.time() - t0:.1f}초)')
    print(f'  흐름: {flow}')
    print(f"  간판 효과(지역) {reg['diff']:+.3f}, Welch [{reg['ci_welch'][0]:+.3f}, {reg['ci_welch'][1]:+.3f}],"
          f" BCa [{reg['ci_boot'][0]:+.3f}, {reg['ci_boot'][1]:+.3f}] ∋ 0.35")
    print(f"  TOP3(합성): {', '.join(rk['top3'])} · 결과: {saved['_path']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
