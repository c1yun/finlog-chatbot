"""간판떼고 설문 분석: 정리 시트 → survey_results.json + 그림(PNG, 200 dpi).

사용
  python3 analyze_survey.py --in DIR --source live|pilot|synthetic [--form-id ID] [--pilot-median MIN] [--out PATH] [--figs DIR]

  DIR: tidy_resp*.csv · tidy_cards*.csv · tidy_text*.csv 가 있는 디렉터리(또는 시트 get_values JSON 파일).
  본조사(live)이고 --form-id 가 있을 때만 --out·--figs 를 따른다(기본 reports/survey/results/).
  그 밖에는 --out 을 무시하고 reports/survey/out_nonlive/<data_source>/ 에 쓴다(gitignored).
  합성 표시(synthetic=1, *.SYNTHETIC.csv)가 있는 입력은 --source 와 상관없이 synthetic 으로 본다.

규칙(연구계획서 Ⅳ·Ⅴ와 survey_spec.json, 응답 수집 전에 고정)
  제외(차례대로): 주의 확인 AC≠3 → 카드 15장 A1이 모두 같음 → 응답 시간 < max(4, 시험 중앙값/3)분(시간 있는 응답만)
                 → 묶음 충돌(route_conflict=1·카드 구조 이상) → 모든 답이 같은 중복(처음 것만 남김)
  학생 선호 = (비공개 묶음의 카드 평균 A1 − 1) × 25,  종합 = w × 기업 평가(환산) + (1 − w) × 학생 선호, w = 0.7 (0.6·0.8 민감도)
  TOP3 = 정보 충족률 ≥ 0.7 인 기업 중 종합 상위 3곳. 3·4위의 선호 95% CI가 겹치면 기업 평가가 높은 쪽이 3위
  간판 효과 = 응답자별 지역 카드 10장 평균 A1 의 공개 − 비공개(Welch·BCa·Hedges g), 수도권 5장, 이중차분, 혼합모형
  학생 선호는 유효 < 80명 또는 비공개 < 40명이면 '잠정(provisional)'
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import warnings
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True   # 저장소에 __pycache__ 를 남기지 않는다(.gitignore 에 없음)

import numpy as np                # noqa: E402
import pandas as pd               # noqa: E402
from scipy import stats           # noqa: E402

import survey_io as sio           # noqa: E402

KST = ZoneInfo('Asia/Seoul')
W_MAIN, W_GRID = 0.7, (0.6, 0.7, 0.8)
FILL_MIN = 0.7
N_BOOT, N_BOOT_RANK, SEED = 9999, 2000, 20261104
RULES = ('attention', 'straight_line', 'too_fast', 'route_conflict')   # 중복(duplicate)은 마지막에 따로
VARIANTS = {
    'no_c7': '연구팀원과 아는 사이(C7=1) 제외',
    'no_searchers': '비공개 묶음에서 카드 내용을 검색했다고 답한 응답(B3=1) 제외',
    'keep_straight': '한 줄 응답(카드 15장 A1이 모두 같음) 포함',
    'no_b2_named': '비공개 묶음에서 B2에 본 카드의 회사 이름(별칭 포함)을 적은 응답 제외 — 자동 대조, 사람이 확인할 것',
}
# 회사 이름 별칭: build_form_gs.js 의 ALIAS 와 같게 유지(spec.lock.json company 키는 따로 더한다)
ALIASES = {
    'R01': ['요턴', 'Jotun', '조광페인트'], 'R02': ['동화엔텍'], 'R03': ['후지킨', 'Fujikin'], 'R04': ['파나시아', 'Panasia'],
    'R05': ['송원'], 'R06': ['지엠비', 'GMB'], 'R07': ['해성'], 'R08': ['넥센', 'Nexen'], 'R09': ['BHI', '비에이치아이'],
    'R10': ['TKG', '태광실업', '나이키', 'Nike'], 'M01': ['하이닉스', 'hynix'], 'M02': ['현대차', '현대자동차'], 'M03': ['카카오', 'Kakao'],
    'M04': ['올리브영'], 'M05': ['삼성물산'], 'M06': ['삼성전자'], 'M07': ['바이오로직스'], 'M08': ['네이버', 'NAVER'],
    'M09': ['ENM'], 'M10': ['제일제당'],
}
FORMULA = 'A1 ~ open*regional + C(set) + C(stratum) + n_gap + pos'


# ───────── 작은 통계 도구 ─────────
def _arr(s) -> np.ndarray:
    """숫자 배열(결측 제외)."""
    return pd.to_numeric(pd.Series(s), errors='coerce').dropna().to_numpy(dtype=float)


def _b(s: pd.Series) -> pd.Series:
    """nullable 비교 결과 → bool(결측은 False)."""
    return s.fillna(False).astype(bool)


def _fl(s: pd.Series) -> pd.Series:
    return pd.Series(s.to_numpy(dtype=float, na_value=np.nan), index=s.index)


def _txt(x):
    """문자열로(결측은 ''). pandas 3 의 astype(str) 은 결측을 NaN 으로 남기므로 먼저 채운다."""
    return x.astype(object).fillna('').astype(str)


def mean_ci(x) -> dict:
    """평균과 t 분포 95% CI."""
    x = _arr(x)
    n = len(x)
    if n == 0:
        return {'n': 0, 'mean': None, 'sd': None, 'ci': None}
    m = float(x.mean())
    if n < 2:
        return {'n': 1, 'mean': m, 'sd': None, 'ci': None}
    sd = float(x.std(ddof=1))
    h = stats.t.ppf(0.975, n - 1) * sd / math.sqrt(n)
    return {'n': n, 'mean': m, 'sd': sd, 'ci': [m - h, m + h]}


def welch(x, y) -> dict:
    """평균 차이(x − y)와 Welch 95% CI·t·df·p."""
    x, y = _arr(x), _arr(y)
    out = {'diff': None, 'ci': None, 't': None, 'df': None, 'p': None}
    if len(x) and len(y):
        out['diff'] = float(x.mean() - y.mean())
    if len(x) < 2 or len(y) < 2:
        return out
    vx, vy = x.var(ddof=1) / len(x), y.var(ddof=1) / len(y)
    se = math.sqrt(vx + vy)
    if se == 0:
        out['ci'] = [out['diff'], out['diff']]
        return out
    df = (vx + vy) ** 2 / (vx ** 2 / (len(x) - 1) + vy ** 2 / (len(y) - 1))
    h = stats.t.ppf(0.975, df) * se
    t = out['diff'] / se
    out.update(ci=[out['diff'] - h, out['diff'] + h], t=t, df=df, p=float(2 * stats.t.sf(abs(t), df)))
    return out


def hedges_g(x, y):
    """Hedges g(소표본 보정)와 정규근사 95% CI."""
    x, y = _arr(x), _arr(y)
    n1, n2 = len(x), len(y)
    if n1 < 2 or n2 < 2:
        return None, None
    sp = math.sqrt(((n1 - 1) * x.var(ddof=1) + (n2 - 1) * y.var(ddof=1)) / (n1 + n2 - 2))
    if sp == 0:
        return None, None
    g = (1 - 3 / (4 * (n1 + n2) - 9)) * (x.mean() - y.mean()) / sp
    se = math.sqrt((n1 + n2) / (n1 * n2) + g * g / (2 * (n1 + n2)))
    z = stats.norm.ppf(0.975)
    return float(g), [float(g - z * se), float(g + z * se)]


def boot_ci(x, y, rng) -> list | None:
    """평균 차이의 BCa 부트스트랩 95% CI (scipy.stats.bootstrap, 두 표본 독립 재추출)."""
    x, y = _arr(x), _arr(y)
    if len(x) < 2 or len(y) < 2:
        return None
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        try:
            r = stats.bootstrap((x, y), lambda a, b, axis=-1: a.mean(axis=axis) - b.mean(axis=axis), vectorized=True,
                                paired=False, n_resamples=N_BOOT, method='BCa', confidence_level=0.95, rng=rng)
        except Exception:
            return None
    lo, hi = float(r.confidence_interval.low), float(r.confidence_interval.high)
    return [lo, hi] if math.isfinite(lo) and math.isfinite(hi) else None


def two_group(x_open, x_closed, rng) -> dict:
    xo, xc = _arr(x_open), _arr(x_closed)
    w = welch(xo, xc)
    g, gci = hedges_g(xo, xc)
    return {'diff': w['diff'], 'ci_welch': w['ci'], 'ci_boot': boot_ci(xo, xc, rng), 't': w['t'], 'df': w['df'], 'p': w['p'],
            'g': g, 'g_ci': gci, 'n_open': len(xo), 'n_closed': len(xc),
            'mean_open': float(xo.mean()) if len(xo) else None, 'mean_closed': float(xc.mean()) if len(xc) else None}


def mde(x_open, x_closed) -> dict:
    """실현 표본에서 검출 가능한 최소 효과(양측 α=.05, 검정력 .8). d 와 원 척도(관측 합동 SD 곱)."""
    from statsmodels.stats.power import TTestIndPower
    xo, xc = _arr(x_open), _arr(x_closed)
    if len(xo) < 2 or len(xc) < 2:
        return {'d': None, 'raw': None, 'sd': None, 'alpha': 0.05, 'power': 0.8}
    sd = math.sqrt(((len(xo) - 1) * xo.var(ddof=1) + (len(xc) - 1) * xc.var(ddof=1)) / (len(xo) + len(xc) - 2))
    d = float(np.squeeze(TTestIndPower().solve_power(effect_size=None, nobs1=len(xo), ratio=len(xc) / len(xo),
                                                    alpha=0.05, power=0.8, alternative='two-sided')))
    return {'d': d, 'raw': d * sd, 'sd': sd, 'alpha': 0.05, 'power': 0.8}


# ───────── 설계 확인과 제외 ─────────
def check_design(resp: pd.DataFrame, cards: pd.DataFrame, lock: dict) -> None:
    """묶음별 카드 순서·공개 여부·세트가 spec.lock.json 과 같은지. 다르면 다른 설계의 응답이므로 멈춘다."""
    routes = {r['id']: r for r in lock['routes']}
    bad = []
    for route, pos, cid, arm, st in cards[['route', 'pos', 'card_id', 'arm', 'set']].dropna().drop_duplicates().itertuples(index=False):
        r = routes[int(route)]
        if r['seq'][int(pos) - 1] != cid or r['arm'] != arm or r['set'] != st:
            bad.append(f'{route}번 묶음 {pos}번 카드 {cid}({arm}/{st})')
    for route, arm, st in resp.loc[resp['route'].notna(), ['route', 'arm', 'set']].drop_duplicates().itertuples(index=False):
        r = routes[int(route)]
        if r['arm'] != arm or r['set'] != st:
            bad.append(f'tidy_resp {route}번 묶음이 {arm}/{st}')
    if bad:
        raise sio.SurveyDataError('설계(spec.lock.json)와 다른 묶음·카드: ' + '; '.join(bad[:5])
                                  + ' — 다른 설계 해시의 폼 응답이 섞였는지 확인하세요')


def answer_vectors(resp: pd.DataFrame, cards: pd.DataFrame, text: pd.DataFrame, lock: dict) -> pd.Series:
    """중복 판정용 '모든 답' 문자열: 응답 시트의 답(응답 시간·제출일 제외) + 카드 15장 A1·A2 + 자유 응답."""
    cols = [c for c in sio.resp_columns(lock) if c not in ('resp_key', 'duration_min', 'submit_date')]
    r = resp.set_index('resp_key')
    base = _txt(r[cols]).agg('\x1f'.join, axis=1)
    cs = cards.sort_values(['resp_key', 'pos'])
    one = _txt(cs['pos']) + ':' + _txt(cs['card_id']) + ':' + _txt(cs['A1']) + ':' + _txt(cs['A2'])
    cv = one.groupby(cs['resp_key']).agg('|'.join).reindex(r.index, fill_value='')
    t = text.drop_duplicates('resp_key', keep='last').set_index('resp_key')
    tv = _txt(t[['B2', 'D3', 'C6_other']]).agg('\x1f'.join, axis=1).reindex(r.index, fill_value='') if len(t) else ''
    return base + '\x1e' + cv + '\x1e' + tv


def exclusion_flags(data: sio.SurveyData, lock: dict, too_fast_min: float) -> pd.DataFrame:
    """응답자별 제외 규칙 해당 여부(서로 독립 판정). 적용 순서는 apply_exclusions 가 정한다."""
    r = data.resp.set_index('resp_key')
    g = data.cards.groupby('resp_key')
    size = g.size().reindex(r.index, fill_value=0)
    n_a1 = g['A1'].count().reindex(r.index, fill_value=0)
    n_uniq = g['A1'].nunique().reindex(r.index, fill_value=0)
    pos_ok = g['pos'].agg(lambda s: sorted(s.dropna().astype(int)) == list(range(1, 16))).reindex(r.index, fill_value=False)
    croute = g['route'].agg(lambda s: float(s.iloc[0]) if s.notna().all() and s.nunique() == 1 else -1.0).reindex(r.index)
    route_known = _b(r['route'].notna() & (r['route_conflict'] == 0))
    structure = (size == 15) & (n_a1 == 15) & _b(pos_ok) & _b(croute == _fl(r['route']))
    f = pd.DataFrame(index=r.index)
    f['attention'] = route_known & ~_b(r['AC'] == lock['choices']['AC_pass'])      # 물은 사람 중 '보통이다'가 아님(무응답 포함)
    f['straight_line'] = structure & (n_uniq == 1)
    f['too_fast'] = _b(r['duration_min'] < too_fast_min)                            # 시간 모르면 해당 없음
    f['route_conflict'] = _b(r['route_conflict'] == 1) | ~route_known | ~structure
    f['vector'] = answer_vectors(data.resp, data.cards, data.text, lock)
    return f


def apply_exclusions(resp: pd.DataFrame, flags: pd.DataFrame, skip=()) -> tuple[list, pd.Index]:
    """제출 → 선별 종료 → 미완료 → 완료 → 규칙별 제외(차례대로) → 유효. 처음 걸린 규칙 하나로만 센다."""
    status = resp.set_index('resp_key')['status']
    flow = [{'step': 'submitted', 'n': len(status)},
            {'step': 'screened_out', 'n': int((status == 'screened_out').sum())},
            {'step': 'partial', 'n': int((status == 'partial').sum())}]
    keep = status.index[(status == 'complete').to_numpy()]       # 제출 순서 유지(중복은 처음 것을 남김)
    flow.append({'step': 'complete', 'n': len(keep)})
    for rule in RULES:
        if rule in skip:
            continue
        hit = flags.loc[keep, rule].to_numpy()
        flow.append({'step': f'excl_{rule}', 'n': int(hit.sum())})
        keep = keep[~hit]
    dup = flags.loc[keep, 'vector'].duplicated(keep='first').to_numpy()
    flow.append({'step': 'excl_duplicate', 'n': int(dup.sum())})
    keep = keep[~dup]
    flow.append({'step': 'valid', 'n': len(keep)})
    return flow, keep


def _norm(s) -> str:
    return re.sub(r'\s+', '', str(s)).lower()


def b2_named(r: pd.DataFrame, text: pd.DataFrame, lock: dict) -> pd.Series:
    """B2(회사 이름 짐작)에 그 사람이 본 카드의 회사 이름·별칭이 들어 있으면 True(자동 대조)."""
    seq = {x['id']: x['seq'] for x in lock['routes']}
    b2 = text.drop_duplicates('resp_key', keep='last').set_index('resp_key')['B2'] if len(text) else pd.Series(dtype=str)
    out = pd.Series(False, index=r.index)
    for key, route in r['route'].items():
        t = _norm(b2.get(key, '') or '')
        if t and pd.notna(route):
            names = [a for c in seq[int(route)] for a in ALIASES.get(c, []) + [lock['company'][c]]]
            out[key] = any(_norm(a) in t for a in names)
    return out


def variant_keys(main: pd.Index, data: sio.SurveyData, flags: pd.DataFrame, lock: dict) -> dict:
    """민감도 분석용 유효 응답자 집합."""
    r = data.resp.set_index('resp_key').loc[main]
    closed = _b(r['arm'] == 'closed')
    named = b2_named(r, data.text, lock)
    return {
        'no_c7': main[~_b(r['C7'] == 1).to_numpy()],
        'no_searchers': main[~(closed & _b(r['B3'] == 1)).to_numpy()],
        'keep_straight': apply_exclusions(data.resp, flags, skip=('straight_line',))[1],
        'no_b2_named': main[~(closed & named).to_numpy()],
    }


def respondent_table(data: sio.SurveyData, keys: pd.Index) -> pd.DataFrame:
    """응답자별 지역 카드 평균(reg)·수도권 카드 평균(met)·차이(did)와 배정 정보."""
    r = data.resp.set_index('resp_key').loc[keys]
    c = data.cards[data.cards['resp_key'].isin(keys)]
    a1 = _fl(c['A1'])
    reg = a1[(c['card_type'] == 'R').to_numpy()].groupby(c.loc[c['card_type'] == 'R', 'resp_key']).mean()
    met = a1[(c['card_type'] == 'M').to_numpy()].groupby(c.loc[c['card_type'] == 'M', 'resp_key']).mean()
    P = pd.DataFrame({'arm': r['arm'], 'set': r['set'], 'stratum': r['stratum'], 'route': r['route'], 'C7': r['C7'], 'B3': r['B3']})
    P['reg'] = reg.reindex(P.index)
    P['met'] = met.reindex(P.index)
    P['did'] = P['reg'] - P['met']
    return P


# ───────── 결과 묶음 ─────────
def card_stats(cv: pd.DataFrame, lock: dict) -> list:
    out = []
    for cid in lock['choices']['D1_cards']:
        sub = cv[cv['card_id'] == cid]
        xo, xc = sub.loc[sub['arm'] == 'open', 'A1'], sub.loc[sub['arm'] == 'closed', 'A1']
        w = welch(xo, xc)
        out.append({'card_id': cid, 'type': lock['card_type'][cid], 'company': lock['company'][cid], 'label': lock['labels'][cid],
                    'open': mean_ci(xo), 'closed': mean_ci(xc), 'diff': {'est': w['diff'], 'ci': w['ci']}})
    return out


def pref_of(x) -> dict:
    """학생 선호 = (평균 A1 − 1) × 25, CI 도 같은 변환(0~100으로 자름)."""
    m = mean_ci(x)
    to = lambda v: min(100.0, max(0.0, (v - 1) * 25))   # noqa: E731
    return {'n': m['n'], 'mean': m['mean'], 'pref': None if m['mean'] is None else (m['mean'] - 1) * 25,
            'ci': None if m['ci'] is None else [to(m['ci'][0]), to(m['ci'][1])]}


def preference(cv_all: pd.DataFrame, keysets: dict, lock: dict) -> list:
    closed = cv_all[cv_all['arm'] == 'closed']
    out = []
    for cid in lock['choices']['D2_rows']:
        sub = closed[closed['card_id'] == cid]
        by_set = {name: pref_of(sub.loc[sub['resp_key'].isin(keys), 'A1']) for name, keys in keysets.items()}
        p = by_set['main']
        out.append({'company': lock['company'][cid], 'card_id': cid, 'n': p['n'], 'mean': p['mean'], 'pref': p['pref'], 'ci': p['ci'],
                    'variants': {v: by_set[v] for v in VARIANTS}})
    return out


def long_frame(cv: pd.DataFrame, P: pd.DataFrame, lock: dict) -> pd.DataFrame:
    """혼합모형용 카드 단위 자료."""
    c = cv[cv['resp_key'].isin(P.index)]
    return pd.DataFrame({
        'resp_key': c['resp_key'].astype(str).to_numpy(), 'card_id': c['card_id'].astype(str).to_numpy(),
        'A1': c['A1'].to_numpy(dtype=float), 'open': (c['arm'] == 'open').astype(int).to_numpy(),
        'regional': (c['card_type'] == 'R').astype(int).to_numpy(), 'set': c['set'].astype(str).to_numpy(),
        'stratum': c['resp_key'].map(P['stratum']).astype(str).to_numpy(),
        'n_gap': c['card_id'].map(lock['n_gap']).astype(float).to_numpy(), 'pos': c['pos'].to_numpy(dtype=float),
    })


def mixed_model(long: pd.DataFrame) -> dict:
    """A1 ~ open*regional + C(set) + C(stratum) + n_gap + pos, 응답자·카드 교차 무선절편(MixedLM vc_formula).
    수렴하지 않으면 응답자 군집 표준오차의 OLS 로 대신한다."""
    import statsmodels.formula.api as smf
    if len(long) < 20 or long['open'].nunique() < 2 or long['regional'].nunique() < 2:
        return {'method': 'not estimated (needs both arms, both card types and ≥ 20 card rows)', 'terms': {}}
    terms = lambda res, names: {k: {'est': float(res.params[k]), 'se': float(res.bse[k]), 'p': float(res.pvalues[k])} for k in names}  # noqa: E731
    reason = ''
    for kw in ({'method': 'lbfgs'}, {'method': 'powell', 'maxiter': 3000}, {'method': 'nm', 'maxiter': 6000}):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                md = smf.mixedlm(FORMULA, long, groups=np.ones(len(long)), re_formula='0',
                                 vc_formula={'resp': '0 + C(resp_key)', 'card': '0 + C(card_id)'})
                res = md.fit(reml=True, **kw)
            fe = list(res.fe_params.index)
            if res.converged and np.all(np.isfinite(res.bse[fe])):
                return {'method': f'MixedLM REML, crossed random intercepts (respondent, card), optimizer={kw["method"]}',
                        'terms': terms(res, fe)}
            reason = f'{kw["method"]}: not converged'
        except Exception as e:      # 특이 행렬 등
            reason = f'{kw["method"]}: {type(e).__name__}: {e}'[:160]
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            res = smf.ols(FORMULA, long).fit(cov_type='cluster', cov_kwds={'groups': pd.factorize(long['resp_key'])[0]})
        X = res.model.exog
        if np.linalg.matrix_rank(X) < X.shape[1]:
            return {'method': f'not estimated (design rank-deficient; MixedLM — {reason})', 'terms': {}}
        return {'method': f'OLS with respondent-clustered SE (MixedLM failed — {reason})', 'terms': terms(res, list(res.params.index))}
    except Exception as e:
        return {'method': f'not estimated (MixedLM — {reason}; OLS — {type(e).__name__}: {e})'[:300], 'terms': {}}


def kanban(P_all: pd.DataFrame, keysets: dict, long: pd.DataFrame, rng) -> dict:
    P = P_all.loc[keysets['main']]
    o, c = P[P['arm'] == 'open'], P[P['arm'] == 'closed']
    did = welch(o['did'], c['did'])
    sens = {}
    for v in VARIANTS:
        Pv = P_all.loc[keysets[v]]
        w = welch(Pv.loc[Pv['arm'] == 'open', 'reg'], Pv.loc[Pv['arm'] == 'closed', 'reg'])
        sens[v] = {'diff': w['diff'], 'ci': w['ci']}
    return {'regional': two_group(o['reg'], c['reg'], rng), 'metro': two_group(o['met'], c['met'], rng),
            'did': {'est': did['diff'], 'ci': did['ci']}, 'mixed': mixed_model(long), 'sensitivity': sens,
            'mde': mde(o['reg'], c['reg'])}


def a2_shares(cv: pd.DataFrame, lock: dict) -> dict:
    out = {}
    for arm, key in (('open', 'A2_open'), ('closed', 'A2_closed')):
        opts = lock['choices'][key]
        sub = cv[cv['arm'] == arm]
        lab = [opts[int(k) - 1] if pd.notna(k) and 1 <= int(k) <= len(opts) else (lbl or None)
               for k, lbl in zip(sub['A2'], sub['A2_label'], strict=True)]
        lab = pd.Series([x for x in lab if x])
        out[arm] = {o: (float((lab == o).mean()) if len(lab) else None) for o in opts}
    return out


def c6_shares(rv: pd.DataFrame, text: pd.DataFrame, lock: dict) -> dict:
    n = len(rv)
    if not n:
        return {}
    codes = rv['C6'].map(sio.split_codes)
    out = {o: sum((i + 1) in cs for cs in codes) / n for i, o in enumerate(lock['choices']['C6'])}
    other = text.loc[text['resp_key'].isin(rv['resp_key']) & (text['C6_other'] != ''), 'resp_key'].nunique()
    out['기타(직접 입력)'] = other / n
    return out


def d1_shares(rv: pd.DataFrame, lock: dict) -> dict:
    n = len(rv)
    codes = rv['D1'].map(sio.split_codes)
    return {lock['company'][cid]: (sum((i + 1) in cs for cs in codes) / n if n else None)
            for i, cid in enumerate(lock['choices']['D1_cards'])}


def blinding(rv: pd.DataFrame, text: pd.DataFrame, lock: dict) -> dict:
    """비공개 묶음 가림 점검: B1 근무지역 정답률(지역 카드=부산·울산·경남, 수도권 카드=수도권), B2 짐작 비율, B3 검색 비율."""
    ch, seq = lock['choices'], {x['id']: x['seq'] for x in lock['routes']}
    right_code = {'R': ch['B1'].index('부산·울산·경남') + 1, 'M': ch['B1'].index('수도권') + 1}
    cl = rv[rv['arm'] == 'closed']
    right = total = 0
    for _, row in cl.iterrows():
        for c in seq[int(row['route'])]:
            v = row[f'B1_{c}']
            if pd.notna(v):
                total += 1
                right += int(v == right_code[lock['card_type'][c]])
    guessed = set(text.loc[text['B2'] != '', 'resp_key'])
    b3 = cl['B3'].dropna()
    return {'b1_correct_region_share': right / total if total else None,
            'b2_guess_rate': float(cl['resp_key'].isin(guessed).mean()) if len(cl) else None,
            'searched_share': float((b3 == 1).mean()) if len(b3) else None}


# ───────── 순위 ─────────
def score_rows(base: list, w: float) -> list:
    """기업별 종합점수와 순위(동점이면 기업 평가가 높은 쪽)."""
    rows = []
    for i, b in enumerate(base):
        final = None if b['pref'] is None or b['eval'] is None else w * b['eval'] + (1 - w) * b['pref']
        rows.append({'company': b['company'], 'eval': b['eval'], 'pref': b['pref'], 'pref_ci': b['pref_ci'], 'final': final,
                     'rank': None, 'eligible': b['fill'] is not None and b['fill'] >= FILL_MIN, '_i': i})
    ranked = sorted([r for r in rows if r['final'] is not None], key=lambda r: (-r['final'], -r['eval'], r['_i']))
    for k, r in enumerate(ranked, start=1):
        r['rank'] = k
    out = ranked + [r for r in rows if r['final'] is None]
    for r in out:
        r.pop('_i')
    return out


def ci_overlap(a, b) -> bool:
    """두 95% CI가 겹치는가. 구간을 모르면 겹친 것으로 본다(선호로 가를 근거가 없음)."""
    if not a or not b or None in (*a, *b):
        return True
    return a[0] <= b[1] and b[0] <= a[1]


def select_top3(rows: list) -> tuple[list, dict]:
    """충족률 ≥ 0.7 인 기업을 종합점수 순으로 놓고 3위를 정한다.
    3위·4위의 학생 선호 95% CI가 겹치면 기업 평가(환산점수)가 높은 쪽이 3위."""
    elig = sorted([r for r in rows if r['eligible'] and r['final'] is not None], key=lambda r: (-r['final'], -r['eval']))
    top = [r['company'] for r in elig[:3]]
    if len(elig) < 4:
        return top, {'applied': False, 'detail': f'충족률 70% 이상이면서 종합점수(학생 선호)가 있는 기업이 {len(elig)}곳이라 3위 경계 비교 없음'}
    a, b = elig[2], elig[3]
    head = f"3위 {a['company']}(종합 {a['final']:.1f}) · 4위 {b['company']}(종합 {b['final']:.1f})"
    if not ci_overlap(a['pref_ci'], b['pref_ci']):
        return top, {'applied': False, 'detail': f'{head}: 학생 선호 95% CI가 겹치지 않아 종합점수 순서대로 정함'}
    if b['eval'] > a['eval']:
        top[2] = b['company']
        return top, {'applied': True, 'detail': f"{head}: 학생 선호 95% CI가 겹쳐 기업 평가가 높은 {b['company']}"
                                                f"({b['eval']:.1f} > {a['eval']:.1f})를 3위로 정함(종합점수 순서와 바뀜)"}
    return top, {'applied': True, 'detail': f"{head}: 학생 선호 95% CI가 겹쳐 기업 평가로 비교했고 {a['company']}"
                                            f"({a['eval']:.1f} ≥ {b['eval']:.1f})가 높아 순서 유지"}


def effective_weight(base: list, w: float) -> float | None:
    """학생 선호의 실효 비중 = (1−w)·SD_선호 ÷ (w·SD_평가 + (1−w)·SD_선호), 10곳 기준."""
    pairs = [(b['eval'], b['pref']) for b in base if b['eval'] is not None and b['pref'] is not None]
    if len(pairs) < 2:
        return None
    ev, pr = np.array(pairs, dtype=float).T
    den = w * ev.std(ddof=1) + (1 - w) * pr.std(ddof=1)
    return float((1 - w) * pr.std(ddof=1) / den) if den > 0 else None


def bootstrap_top3(base: list, M: np.ndarray, rng, w: float = W_MAIN, B: int = N_BOOT_RANK) -> dict:
    """비공개 묶음 응답자를 다시 뽑아(B회) 학생 선호와 TOP3 선정(충족률·3위 규칙 포함)을 반복, P(TOP3)."""
    counts = {b['company']: 0 for b in base}
    n = M.shape[0]
    if n < 2:
        return {c: None for c in counts}
    with warnings.catch_warnings(), np.errstate(all='ignore'):
        warnings.simplefilter('ignore')
        for _ in range(B):
            S = M[rng.integers(0, n, n)]
            k = (~np.isnan(S)).sum(axis=0)
            mean, sd = np.nanmean(S, axis=0), np.nanstd(S, axis=0, ddof=1)
            h = stats.t.ppf(0.975, np.maximum(k - 1, 1)) * sd / np.sqrt(np.maximum(k, 1))
            rows = []
            for j, b in enumerate(base):
                p = (mean[j] - 1) * 25 if k[j] else None
                ci = [(mean[j] - h[j] - 1) * 25, (mean[j] + h[j] - 1) * 25] if k[j] >= 2 else None
                final = None if p is None or b['eval'] is None else w * b['eval'] + (1 - w) * p
                rows.append({'company': b['company'], 'eval': b['eval'], 'pref_ci': ci, 'final': final,
                             'eligible': b['fill'] is not None and b['fill'] >= FILL_MIN})
            for c in select_top3(rows)[0]:
                counts[c] += 1
    return {c: v / B for c, v in counts.items()}


def ranking(prefs: list, scores: dict, cv: pd.DataFrame, lock: dict, rng) -> dict:
    by = {p['company']: p for p in prefs}
    base = []
    for cid in lock['choices']['D2_rows']:
        co = lock['company'][cid]
        if co not in scores:
            raise sio.SurveyDataError(f'scores.json 에 {co} 가 없음')
        f = scores[co]['final']
        base.append({'company': co, 'eval': f.get('scaled'), 'fill': f.get('fill'), 'pref': by[co]['pref'], 'pref_ci': by[co]['ci']})
    by_w = {f'{w:.1f}': score_rows(base, w) for w in W_GRID}
    top3, tie = select_top3(by_w[f'{W_MAIN:.1f}'])
    closed = cv[(cv['arm'] == 'closed') & (cv['card_type'] == 'R')]
    M = (closed.pivot_table(index='resp_key', columns='card_id', values='A1', aggfunc='first')
         .reindex(columns=lock['choices']['D2_rows']).to_numpy(dtype=float)) if len(closed) else np.empty((0, len(base)))
    return {'by_w': by_w, 'top3': top3, 'tie_rule': tie,
            'eff_weight': {f'{w:.1f}': effective_weight(base, w) for w in W_GRID},
            'p_top3': bootstrap_top3(base, M, rng)}


# ───────── 분석 전체 ─────────
def analyze(data: sio.SurveyData, *, lock: dict, spec: dict, scores: dict, scores_hash: str, data_source: str,
            form_id: str | None, pilot_median: float | None, seed: int = SEED) -> tuple[dict, dict]:
    """결과 dict(figs 제외)와 그림용 중간 자료를 돌려준다."""
    rng = np.random.default_rng(seed)
    check_design(data.resp, data.cards, lock)
    ex = spec['exclusions']
    thr = max(ex['too_fast_min'], pilot_median / 3) if pilot_median else float(ex['too_fast_min'])
    flags = exclusion_flags(data, lock, thr)
    flow, main = apply_exclusions(data.resp, flags)
    keysets = {'main': main, **variant_keys(main, data, flags, lock)}
    complete = data.resp.loc[data.resp['status'] == 'complete', 'resp_key']
    P_all = respondent_table(data, pd.Index(complete))
    P = P_all.loc[main]
    cv_all = data.cards.assign(A1=_fl(data.cards['A1']))
    cv = cv_all[cv_all['resp_key'].isin(main)]
    rv = data.resp[data.resp['resp_key'].isin(main)]
    n_open, n_closed = int((P['arm'] == 'open').sum()), int((P['arm'] == 'closed').sum())
    cells = {f'{r["id"]}-{s}': 0 for r in lock['routes'] for s in lock['strata']}
    for (route, stratum), n in P.groupby(['route', 'stratum'], dropna=False).size().items():
        k = f'{int(route)}-{stratum or "?"}'
        cells[k] = cells.get(k, 0) + int(n)
    tg = spec['targets']
    prefs = preference(cv_all, keysets, lock)
    result = {
        'meta': {
            'schema': 1, 'data_source': data_source, 'form_id': form_id, 'spec_hash': lock['spec_hash'], 'scores_hash': scores_hash,
            'generated_at': datetime.now(KST).isoformat(timespec='seconds'), 'flow': flow,
            'n_valid': len(main), 'n_open': n_open, 'n_closed': n_closed, 'cells': cells,
            'preference_status': 'provisional' if len(main) < tg['n_min'] or n_closed < tg['closed_min'] else 'final',
            'exclusions_applied': {
                'order': list(RULES) + ['duplicate'],
                'rules': {
                    'attention': f"AC ≠ {lock['choices']['AC_pass']} (주의 확인에서 '보통이다'가 아님, 무응답 포함)",
                    'straight_line': '카드 15장의 A1이 모두 같음',
                    'too_fast': f'응답 시간 < {thr:g}분 = max({ex["too_fast_min"]}, 시험 응답 중앙값/3), 시간을 아는 응답만',
                    'route_conflict': 'route_conflict = 1, 또는 묶음·카드 15장 구조가 설계와 다름',
                    'duplicate': '모든 답(카드 A1·A2, 자유 응답 포함; 응답 시간·제출일 제외)이 같은 응답 중 처음 것만 남김',
                },
                'too_fast_threshold_min': thr, 'pilot_median_min': pilot_median,
                'flagged_independent': {k: int(flags.loc[complete, k].sum()) for k in RULES},
                'targets': {'n_min': tg['n_min'], 'closed_min': tg['closed_min']},
                'sensitivity': VARIANTS,
            },
        },
        'cards': card_stats(cv, lock),
        'preference': prefs,
        'kanban': kanban(P_all, keysets, long_frame(cv, P, lock), rng),
        'a2': a2_shares(cv, lock),
        'c5': {row: _fl(rv[f'C5_{i + 1}']).mean() for i, row in enumerate(lock['choices']['C5_rows'])},
        'c6': c6_shares(rv, data.text, lock),
        'd1': d1_shares(rv, lock),
        'd2': {lock['company'][c]: _fl(rv[f'D2_{c}']).mean() for c in lock['choices']['D2_rows']},
        'blinding': blinding(rv, data.text, lock),
        'ranking': ranking(prefs, scores, cv, lock, rng),
        'figs': [],
    }
    return result, {'P': P, 'cv': cv}


# ───────── 그림 ─────────
PAL = {'open': '#2a78d6', 'closed': '#eb6834', 'eval': '#1baf7a', 'ink': '#0b0b0b', 'ink2': '#52514e', 'muted': '#898781',
     'grid': '#e1e0d9', 'axis': '#c3c2b7'}
ARM_KO = {'open': '공개', 'closed': '비공개'}
SOURCE_TAG = {'synthetic': '합성 데이터 · 실제 결과 아님', 'pilot': '시험 응답 · 본조사 아님', 'live_no_form_id': '폼 ID 확인 안 됨'}


def setup_fonts() -> str:
    """한글 글꼴(Pretendard 우선)을 명시적으로 쓴다. 없으면 멈춘다."""
    import matplotlib
    matplotlib.use('Agg')
    from matplotlib import font_manager as fm
    from matplotlib import rcParams
    from matplotlib.ft2font import FT2Font
    for d in (Path.home() / '.fonts', Path.home() / '.local' / 'share' / 'fonts'):   # 시스템 글꼴은 matplotlib 가 이미 안다
        if d.is_dir():
            for f in [*d.rglob('Pretendard*.ttf'), *d.rglob('Pretendard*.otf')]:
                try:
                    fm.fontManager.addfont(str(f))
                except (OSError, RuntimeError):
                    pass
    for fam in ('Pretendard', 'Noto Sans CJK KR', 'Noto Sans KR', 'NanumGothic', 'Apple SD Gothic Neo', 'Malgun Gothic'):
        try:
            path = fm.findfont(fm.FontProperties(family=fam), fallback_to_default=False)
        except ValueError:
            continue
        if ord('가') in FT2Font(path).get_charmap():
            rcParams.update({'font.family': fam, 'axes.unicode_minus': False, 'figure.facecolor': 'white',
                             'axes.facecolor': 'white', 'savefig.facecolor': 'white', 'text.color': PAL['ink']})
            return fam
    raise RuntimeError('한글 글꼴(Pretendard 등)을 찾지 못했습니다. ~/.fonts 에 Pretendard 를 설치한 뒤 다시 실행하세요.')


def _axes(size):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=size)
    for s in ('top', 'right'):
        ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'):
        ax.spines[s].set_color(PAL['axis'])
    ax.tick_params(colors=PAL['ink2'], labelsize=9, length=0)
    return fig, ax


def _grid(ax, axis: str) -> None:
    ax.grid(axis=axis, color=PAL['grid'], linewidth=0.8, linestyle='-')
    ax.set_axisbelow(True)


def _head(ax, title: str, sub: str, tag: str | None) -> None:
    kw = dict(xycoords='axes fraction', textcoords='offset points', va='bottom')
    ax.annotate(title, (0, 1), xytext=(0, 30), ha='left', fontsize=13, fontweight='bold', color=PAL['ink'], **kw)
    ax.annotate(sub, (0, 1), xytext=(0, 12), ha='left', fontsize=9, color=PAL['ink2'], **kw)
    if tag:
        ax.annotate(tag, (1, 1), xytext=(0, 30), ha='right', fontsize=9, fontweight='bold', color=PAL['ink2'], **kw)


def _save(fig, path: Path) -> None:
    import matplotlib.pyplot as plt
    fig.savefig(path, dpi=200, facecolor='white', bbox_inches='tight', pad_inches=0.25)
    plt.close(fig)


def _legend(ax, **kw) -> None:
    if ax.get_legend_handles_labels()[0]:          # 그릴 것이 없으면 범례도 없다
        ax.legend(frameon=False, **kw)


def _label(ax, x, y, text, dx=6, **kw):
    ax.annotate(text, (x, y), xytext=(dx, 0), textcoords='offset points', va='center', ha='left' if dx >= 0 else 'right',
                fontsize=kw.pop('fontsize', 9), color=kw.pop('color', PAL['ink2']), **kw)


def fig_kanban(res: dict, P: pd.DataFrame, path: Path, tag: str | None) -> None:
    k = res['kanban']
    fig, ax = _axes((7.4, 4.8))
    groups = [('reg', '지역기업 카드 10장', k['regional']), ('met', '수도권 대기업 카드 5장', k['metro'])]
    lows, highs = [], []
    for i, (col, _, g) in enumerate(groups):
        top = 0
        for arm, dx in (('open', -0.13), ('closed', 0.13)):
            m = mean_ci(P.loc[P['arm'] == arm, col])
            if m['mean'] is None:
                continue
            lo, hi = m['ci'] or (m['mean'], m['mean'])
            ax.plot([i + dx, i + dx], [lo, hi], color=PAL[arm], lw=2, solid_capstyle='round', zorder=2)
            ax.plot(i + dx, m['mean'], 'o', ms=9, color=PAL[arm], mec='white', mew=2, zorder=3,
                    label=f'{ARM_KO[arm]} (n={m["n"]})' if i == 0 else None)
            _label(ax, i + dx, m['mean'], f'{m["mean"]:.2f}', dx=10 if arm == 'closed' else -10)
            lows.append(lo)
            highs.append(hi)
            top = max(top, hi)
        if g['diff'] is not None:
            ci = g['ci_welch']
            txt = f'공개 − 비공개 {g["diff"]:+.2f}' + (f'\n95% CI {ci[0]:+.2f} ~ {ci[1]:+.2f}' if ci else '')
            ax.annotate(txt, (i, top), xytext=(0, 10), textcoords='offset points', ha='center', va='bottom', fontsize=9, color=PAL['ink'])
    if lows:
        ax.set_ylim(max(1, min(lows) - 0.35), min(5, max(highs) + 0.5))
    ax.set_xlim(-0.6, 1.6)
    ax.set_xticks([0, 1], [g[1] for g in groups], fontsize=10, color=PAL['ink'])
    ax.set_ylabel('평균 지원 의향 (1~5점)', fontsize=9, color=PAL['ink2'])
    _grid(ax, 'y')
    _legend(ax, loc='upper center', bbox_to_anchor=(0.5, -0.13), ncol=2, fontsize=9)
    _head(ax, '간판 효과: 기업명·근무지역 공개 여부별 지원 의향',
          '응답자별 카드 평균의 집단 평균, 세로선은 95% 신뢰구간 · 공개 − 비공개 차이는 Welch 구간', tag)
    _save(fig, path)


def fig_cards(res: dict, path: Path, tag: str | None) -> None:
    from matplotlib.transforms import blended_transform_factory
    cards = res['cards']
    ypos, heads, y = {}, [], 0.0
    for c in cards:                                    # 지역·수도권 묶음마다 머리 줄 하나
        if not heads or heads[-1][1] != c['type']:
            y += 0.5 if heads else 0
            heads.append((y, c['type']))
            y += 1
        ypos[c['card_id']] = y
        y += 1
    fig, ax = _axes((8.2, 9.8))
    for arm, dy in (('open', -0.17), ('closed', 0.17)):
        first = True
        for c in cards:
            s = c[arm]
            if s['mean'] is None:
                continue
            yy = ypos[c['card_id']] + dy
            if s['ci']:
                ax.plot(s['ci'], [yy, yy], color=PAL[arm], lw=1.6, solid_capstyle='round', zorder=2)
            ax.plot(s['mean'], yy, 'o', ms=6.5, color=PAL[arm], mec='white', mew=1.5, zorder=3, label=ARM_KO[arm] if first else None)
            first = False
    ax.set_yticks([ypos[c['card_id']] for c in cards], [f'{c["card_id"]} {c["label"]} · {c["company"]}' for c in cards], fontsize=8.5)
    tr = blended_transform_factory(ax.transAxes, ax.transData)
    names = {'R': '지역기업 10곳 · 모든 응답자', 'M': '수도권 대기업 10곳 · 세트 A·B 중 5장'}
    for yy, t in heads:
        ax.text(-0.015, yy, names[t], transform=tr, ha='right', va='center', fontsize=9, fontweight='bold', color=PAL['ink'])
        if yy > 0:
            ax.axhline(yy - 0.75, color=PAL['axis'], lw=0.8)
    ax.set_ylim(y - 0.4, -0.6)
    ax.set_xlim(1, 5)
    ax.set_xticks([1, 2, 3, 4, 5], ['1 전혀 없다', '2', '3 보통', '4', '5 매우 있다'])
    _grid(ax, 'x')
    _legend(ax, loc='upper center', bbox_to_anchor=(0.5, -0.07), fontsize=9, ncol=2)
    ax.set_xlabel('평균 지원 의향 (A1)', fontsize=9, color=PAL['ink2'])
    _head(ax, '카드별 지원 의향: 공개 vs 비공개', '점은 평균, 가로선은 95% 신뢰구간 · 수도권 카드는 응답자의 절반만 봄', tag)
    _save(fig, path)


def fig_pref(res: dict, path: Path, tag: str | None) -> None:
    rows = sorted([p for p in res['preference'] if p['pref'] is not None], key=lambda p: -p['pref'])
    labels = {c['company']: c['label'] for c in res['cards']}
    fig, ax = _axes((7.6, 5.4))
    for i, p in enumerate(rows):
        if p['ci']:
            ax.plot(p['ci'], [i, i], color=PAL['closed'], lw=2, solid_capstyle='round', zorder=2)
        ax.plot(p['pref'], i, 'o', ms=9, color=PAL['closed'], mec='white', mew=2, zorder=3)
        _label(ax, p['ci'][1] if p['ci'] else p['pref'], i, f'{p["pref"]:.1f}  (n={p["n"]})')
    ax.set_yticks(range(len(rows)), [f'{p["company"]} · {labels.get(p["company"], "")}' for p in rows], fontsize=9, color=PAL['ink'])
    ax.set_ylim(len(rows) - 0.4, -0.6)
    ax.set_xlim(0, 100)
    _grid(ax, 'x')
    ax.set_xlabel('학생 선호 점수 (0~100)', fontsize=9, color=PAL['ink2'])
    status = res['meta']['preference_status']
    _head(ax, '학생 선호 점수: 기업명·근무지역을 가린 조건',
          '(평균 지원 의향 − 1) × 25 · 가로선은 95% 신뢰구간' + (' · 잠정(목표 표본 미달)' if status == 'provisional' else ''), tag)
    _save(fig, path)


def fig_final(res: dict, path: Path, tag: str | None) -> None:
    rk = res['ranking']
    key = f'{W_MAIN:.1f}'
    rows = [r for r in rk['by_w'][key] if r['final'] is not None]
    alt = {w: {r['company']: r['final'] for r in rk['by_w'][w]} for w in rk['by_w'] if w != key}
    marks = dict(zip(sorted(alt), (('D', PAL['ink2']), ('^', PAL['ink'])), strict=False))   # w 0.6 ◆, 0.8 ▲
    fig, ax = _axes((8.2, 5.8))
    for i, r in enumerate(rows):
        e, p = W_MAIN * r['eval'], (1 - W_MAIN) * r['pref']
        ax.barh(i, e, height=0.56, color=PAL['eval'], edgecolor='white', linewidth=1.5, label=f'기업 평가 × {W_MAIN:g}' if i == 0 else None)
        ax.barh(i, p, left=e, height=0.56, color=PAL['closed'], edgecolor='white', linewidth=1.5,
                label=f'학생 선호 × {1 - W_MAIN:.1f}' if i == 0 else None)
        ends = [r['final']]
        for w, (mk, col) in marks.items():
            v = alt[w].get(r['company'])
            if v is not None:
                ax.plot(v, i, mk, ms=6.5, color=col, mec='white', mew=1, zorder=4, label=f'w = {w}일 때 종합' if i == 0 else None)
                ends.append(v)
        top = r['company'] in rk['top3']
        note = f'{r["final"]:.1f}' + ('  TOP3' if top else '') + ('' if r['eligible'] else '  충족률 70% 미달')
        _label(ax, max(ends), i, note, dx=8, color=PAL['ink'] if top else PAL['ink2'], fontweight='bold' if top else 'normal')
    ax.set_yticks(range(len(rows)), [r['company'] for r in rows], fontsize=9.5, color=PAL['ink'])
    ax.set_ylim(len(rows) - 0.4, -0.6)
    ax.set_xlim(0, 100)
    _grid(ax, 'x')
    ax.set_xlabel('종합점수 (0~100)', fontsize=9, color=PAL['ink2'])
    _legend(ax, loc='upper center', bbox_to_anchor=(0.5, -0.12), ncol=4, fontsize=8.5)
    sub = '막대 = w 0.7 기준(기업 평가는 확인 항목 환산점수) · 표식 = 비중을 바꾼 종합점수 · TOP3는 충족률·3위 경계 규칙 적용'
    _head(ax, f'종합점수 = 기업 평가 × {W_MAIN:g} + 학생 선호 × {1 - W_MAIN:.1f}', sub, tag)
    _save(fig, path)


def fig_a2(res: dict, path: Path, tag: str | None) -> None:
    a2 = res['a2']
    opts = list(a2['open'])
    fig, ax = _axes((7.6, 5.0))
    xmax = max([v for d in a2.values() for v in d.values() if v is not None] + [0.01]) * 100
    for arm, dy in (('open', -0.19), ('closed', 0.19)):
        for i, o in enumerate(opts):
            v = a2[arm].get(o)
            if v is None:
                if arm == 'closed' and o not in a2['closed']:
                    _label(ax, 0, i + dy, '비공개 조건에는 없는 선택지', dx=4, fontsize=8, color=PAL['muted'])
                continue
            ax.barh(i + dy, v * 100, height=0.36, color=PAL[arm], label=ARM_KO[arm] if i == 0 else None)
            _label(ax, v * 100, i + dy, f'{v * 100:.0f}%', dx=4, fontsize=8)
    ax.set_yticks(range(len(opts)), opts, fontsize=9, color=PAL['ink'])
    ax.set_ylim(len(opts) - 0.4, -0.6)
    ax.set_xlim(0, xmax * 1.25)
    _grid(ax, 'x')
    ax.set_xlabel('카드 응답 중 비율 (%)', fontsize=9, color=PAL['ink2'])
    _legend(ax, loc='upper center', bbox_to_anchor=(0.5, -0.12), fontsize=9, ncol=2)
    _head(ax, '판단에 가장 큰 영향을 준 조건 (A2)', '카드마다 하나를 고름 · 기업명·근무지역은 공개 조건에서만 보기로 나옴', tag)
    _save(fig, path)


def fig_c6(res: dict, path: Path, tag: str | None) -> None:
    items = sorted(res['c6'].items(), key=lambda kv: -(kv[1] or 0))
    fig, ax = _axes((7.4, 4.8))
    for i, (_, v) in enumerate(items):
        ax.barh(i, (v or 0) * 100, height=0.56, color=PAL['open'])
        _label(ax, (v or 0) * 100, i, f'{(v or 0) * 100:.0f}%', dx=4, fontsize=8.5)
    ax.set_yticks(range(len(items)), [k for k, _ in items], fontsize=9, color=PAL['ink'])
    ax.set_ylim(len(items) - 0.4, -0.6)
    ax.set_xlim(0, max([(v or 0) * 100 for _, v in items] + [1]) * 1.2)
    _grid(ax, 'x')
    ax.set_xlabel('응답자 중 선택 비율 (%)', fontsize=9, color=PAL['ink2'])
    _head(ax, '지원 전에 더 알고 싶은 정보 (C6)', f'유효 응답자 {res["meta"]["n_valid"]}명, 한 사람이 최대 3개 선택', tag)
    _save(fig, path)


def draw_figures(res: dict, ctx: dict, figs_dir: Path, rel_to: Path, data_source: str) -> list[str]:
    """그림 6장을 그리고 survey_results.json 기준 상대 경로를 돌려준다. 빠진 글자가 있으면 멈춘다."""
    setup_fonts()
    figs_dir.mkdir(parents=True, exist_ok=True)
    tag = SOURCE_TAG.get(data_source)
    jobs = [('kanban_effect.png', lambda p: fig_kanban(res, ctx['P'], p, tag)),
            ('cards_open_closed.png', lambda p: fig_cards(res, p, tag)),
            ('student_preference.png', lambda p: fig_pref(res, p, tag)),
            ('final_score.png', lambda p: fig_final(res, p, tag)),
            ('a2_by_arm.png', lambda p: fig_a2(res, p, tag)),
            ('c6_info_needs.png', lambda p: fig_c6(res, p, tag))]
    out = []
    with warnings.catch_warnings():
        warnings.filterwarnings('error', message='Glyph')      # 한글이 네모로 나오면 실패로 본다
        for name, draw in jobs:
            p = figs_dir / name
            draw(p)
            out.append(Path(os.path.relpath(p, rel_to)).as_posix())
    return out


# ───────── 저장과 CLI ─────────
def _clean(o, key=None):
    """JSON 으로 쓸 수 있게: numpy → 파이썬, NaN → null, 소수 4자리(p 는 유효숫자 3자리)."""
    if isinstance(o, dict):
        return {str(k): _clean(v, k) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v, key) for v in o]
    if isinstance(o, (bool, np.bool_)):
        return bool(o)
    if isinstance(o, (int, np.integer)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        f = float(o)
        if not math.isfinite(f):
            return None
        return float(f'{f:.3g}') if key == 'p' else round(f, 4)
    if o is pd.NA:
        return None
    return o


def resolve_output(source: str, form_id: str | None, out, figs) -> tuple[str, Path, Path, bool]:
    """(data_source, json 경로, 그림 디렉터리, 비본조사 여부). 본조사 + 폼 ID 일 때만 --out·--figs 를 따른다."""
    if source == 'live' and form_id:
        jp = Path(out) if out else sio.RESULTS_LIVE / 'survey_results.json'
        if jp.suffix.lower() != '.json':
            jp = jp / 'survey_results.json'
        return 'live', jp, Path(figs) if figs else jp.parent / 'figs', False
    ds = 'live_no_form_id' if source == 'live' else source
    base = sio.OUT_NONLIVE / ds
    if out or figs:
        print(f'주의: 본조사(live + --form-id)가 아니므로 --out/--figs 를 무시하고 {base} 에 씁니다.', file=sys.stderr)
    return ds, base / 'survey_results.json', base / 'figs', True


def parse_args(argv=None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description='간판떼고 설문 분석 → survey_results.json + 그림')
    ap.add_argument('--in', dest='inp', required=True, type=Path, help='tidy_*.csv 디렉터리 또는 시트 행 JSON')
    ap.add_argument('--source', required=True, choices=['live', 'pilot', 'synthetic'])
    ap.add_argument('--form-id', default=None, help='본조사 폼 ID(survey_spec.json production_form_id 와 같아야 함)')
    ap.add_argument('--pilot-median', type=float, default=None, help='시험 응답 시간 중앙값(분). 없으면 4분 기준')
    ap.add_argument('--out', default=None, help='결과 JSON 경로(본조사만)')
    ap.add_argument('--figs', default=None, help='그림 디렉터리(본조사만)')
    ap.add_argument('--seed', type=int, default=SEED, help=argparse.SUPPRESS)
    a = ap.parse_args(argv)
    if a.pilot_median is not None and a.pilot_median <= 0:
        ap.error('--pilot-median 은 양수(분)')
    return a


def run(args: argparse.Namespace) -> tuple[dict, Path]:
    lock, spec = sio.load_lock(), sio.load_spec()
    data = sio.load(args.inp, lock)
    for w in data.warnings:
        print('주의:', w, file=sys.stderr)
    source = args.source
    if data.synthetic and source != 'synthetic':
        print(f"주의: 입력에 합성 자료 표시가 있어 data_source 를 '{source}' 대신 'synthetic' 으로 둡니다.", file=sys.stderr)
        source = 'synthetic'
    data_source, json_path, figs_dir, _ = resolve_output(source, args.form_id, args.out, args.figs)
    result, ctx = analyze(data, lock=lock, spec=spec, scores=sio.load_json(sio.SCORES), scores_hash=sio.sha16(sio.SCORES),
                          data_source=data_source, form_id=args.form_id, pilot_median=args.pilot_median, seed=args.seed)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    result['figs'] = draw_figures(result, ctx, figs_dir, json_path.parent, data_source)
    json_path.write_text(json.dumps(_clean(result), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return result, json_path


def summary(res: dict, path: Path) -> str:
    m, k, rk = res['meta'], res['kanban'], res['ranking']
    f = lambda v: 'NA' if v is None else f'{v:+.2f}'                         # noqa: E731
    ci = lambda c: 'NA' if not c else f'[{c[0]:+.2f}, {c[1]:+.2f}]'           # noqa: E731
    flow = ' → '.join(f"{s['step']} {s['n']}" for s in m['flow'])
    return '\n'.join([
        f'[{m["data_source"]}] {path}',
        f'  흐름: {flow}',
        f'  유효 {m["n_valid"]}명 (공개 {m["n_open"]} · 비공개 {m["n_closed"]}), 학생 선호 {m["preference_status"]}',
        f'  간판 효과(지역) {f(k["regional"]["diff"])} Welch {ci(k["regional"]["ci_welch"])} BCa {ci(k["regional"]["ci_boot"])}'
        f' · 수도권 {f(k["metro"]["diff"])} · 이중차분 {f(k["did"]["est"])} {ci(k["did"]["ci"])}',
        f'  TOP3(w=0.7): {", ".join(rk["top3"])} — {rk["tie_rule"]["detail"]}',
        f'  그림 {len(res["figs"])}장: {(path.parent / res["figs"][0]).parent if res["figs"] else "-"}',
    ])


def main(argv=None) -> int:
    args = parse_args(argv)
    try:
        res, path = run(args)
    except sio.SurveyDataError as e:
        print(f'입력 오류: {e}', file=sys.stderr)
        return 2
    print(summary(_clean(res), path))
    return 0


if __name__ == '__main__':
    sys.exit(main())
