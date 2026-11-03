"""합성 설문 자료 만들기(분석 파이프라인 시험용, 실제 응답 아님).

알려진 모형에서 tidy_resp · tidy_cards · tidy_text 를 exportTidy() 와 같은 열로 만든다.
  A1* = 카드 기준 평균 + 간판 효과(공개 묶음: 지역 카드 +0.35, 수도권 카드 +0.10) + 응답자 효과 + 오차
  A1  = A1* 를 반올림해 1~5로 자름
배정은 실제 폼처럼 계열(층) → 생일 '일' → spec.lock.json dayRoute 로 정한다.
제외 대상(주의 확인 실패·한 줄 응답·너무 빠른 응답·묶음 충돌·중복)과 선별 종료·미완료 응답을 정해진 수만큼 섞는다.
파일 이름은 *.SYNTHETIC.csv 이고 tidy_resp 에 synthetic=1 열이 붙는다. 정답(truth.SYNTHETIC.json)도 함께 쓴다.

사용: python3 synth_survey.py [--out DIR] [--n 200] [--seed 7]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

sys.dont_write_bytecode = True   # 저장소에 __pycache__ 를 남기지 않는다

import numpy as np               # noqa: E402
from scipy.stats import norm     # noqa: E402

import survey_io as sio          # noqa: E402

DEFAULT_OUT = sio.OUT_NONLIVE / 'synth'

# 비공개 조건의 잠재 평균(카드 효과). 공개 조건은 여기에 간판 효과를 더한다.
CARD_MEAN = {
    'R01': 2.9, 'R02': 3.1, 'R03': 3.0, 'R04': 3.3, 'R05': 2.8, 'R06': 2.7, 'R07': 3.2, 'R08': 3.4, 'R09': 2.6, 'R10': 3.0,
    'M01': 3.7, 'M02': 3.5, 'M03': 3.6, 'M04': 3.2, 'M05': 3.0, 'M06': 3.6, 'M07': 3.3, 'M08': 3.5, 'M09': 3.1, 'M10': 3.2,
}
KANBAN = {'R': 0.35, 'M': 0.10}        # 알려진 간판 효과(잠재 척도, 공개 − 비공개)
SD_RESP, SD_NOISE = 0.55, 0.75         # 응답자 효과, 카드별 오차
INJECT = {'screened_out': 6, 'partial': 1, 'attention': 4, 'straight_line': 1, 'too_fast': 1, 'route_conflict': 1, 'duplicate': 1}
# 사전 인지도(D1) 확률
AWARE = {'R01': .15, 'R02': .05, 'R03': .08, 'R04': .2, 'R05': .1, 'R06': .06, 'R07': .12, 'R08': .7, 'R09': .1, 'R10': .25}
B2_GENERIC = ['모르겠지만 대기업 같았음', '카드 2 반도체 회사?', '짐작 못 함']
D3_TEXT = ['근무지가 가까워서 더 찾아보고 싶다', '연봉 정보가 더 필요하다', '처음 듣는 회사라 잘 모르겠다', '직무가 전공과 맞는다']


def expected_a1(mu: float, sd: float) -> float:
    """잠재 N(mu, sd²)를 반올림·1~5 절단했을 때 A1 기댓값 = 1 + Σ_k P(A1* ≥ k + 0.5)."""
    return 1 + sum(1 - norm.cdf((k + 0.5 - mu) / sd) for k in range(1, 5))


def truth_effects(lock: dict) -> dict:
    """관측 척도(1~5)에서의 기대 효과와 기업별 참 선호 점수."""
    sd = float(np.hypot(SD_RESP, SD_NOISE))
    eff = {}
    for t in ('R', 'M'):
        cards = [c for c, ty in lock['card_type'].items() if ty == t]
        eff[t] = float(np.mean([expected_a1(CARD_MEAN[c] + KANBAN[t], sd) - expected_a1(CARD_MEAN[c], sd) for c in cards]))
    pref = {lock['company'][c]: (expected_a1(CARD_MEAN[c], sd) - 1) * 25 for c in lock['choices']['D2_rows']}
    return {'regional': eff['R'], 'metro': eff['M'], 'did': eff['R'] - eff['M']}, pref


class Generator:
    def __init__(self, lock: dict, spec: dict, seed: int):
        self.lock, self.spec, self.seed = lock, spec, seed
        self.rng = np.random.default_rng(seed)
        self.routes = {r['id']: r for r in lock['routes']}
        ch = lock['choices']
        self.c1_of = {s: [ch['C1'].index(n) + 1 for n in v['c1']] for s, v in lock['strata'].items()}
        self.start = date.fromisoformat(spec['field']['start'])
        self.i = 0

    def key(self) -> str:
        self.i += 1
        return hashlib.sha256(f'synthetic-{self.seed}-{self.i}'.encode()).hexdigest()[:12]

    def choice(self, n: int, p=None) -> int:
        return int(self.rng.choice(np.arange(1, n + 1), p=p))

    def respondent(self, kind: str = 'normal') -> tuple[dict, list, dict | None]:
        """한 응답자의 (tidy_resp 행, tidy_cards 행들, tidy_text 행). kind 로 제외 대상을 만든다."""
        rng, lock, ch = self.rng, self.lock, self.lock['choices']
        key = self.key()
        submit = (self.start + timedelta(days=int(rng.integers(0, 7)))).isoformat()
        row = {c: '' for c in sio.resp_columns(lock)}
        row.update(resp_key=key, status='complete', route_conflict=0, submit_date=submit, synthetic=1)
        if kind == 'screened_out':
            row['status'] = 'screened_out'
            return row, [], None
        stratum = str(rng.choice(['H', 'E', 'O'], p=[.4, .4, .2]))
        day = int(rng.integers(1, 32))
        route = lock['dayRoute'][stratum][day - 1]
        r = self.routes[route]
        row.update(stratum=stratum, C1=int(rng.choice(self.c1_of[stratum])), C2=self.choice(5, [.1, .15, .35, .3, .1]), birth_day=day,
                   route=route, arm=r['arm'], set=r['set'], AC=lock['choices']['AC_pass'],
                   duration_min=int(np.clip(round(rng.lognormal(np.log(11), 0.3)), 6, 40)) if rng.random() > .05 else '')
        # 카드 15장
        u = rng.normal(0, SD_RESP)
        for _ in range(100):
            a1 = [int(np.clip(round(CARD_MEAN[c] + (KANBAN[lock['card_type'][c]] if r['arm'] == 'open' else 0) + u
                                    + rng.normal(0, SD_NOISE)), 1, 5)) for c in r['seq']]
            if len(set(a1)) > 1:      # 우연한 한 줄 응답은 다시 뽑는다(주입한 것만 제외되게)
                break
        if kind == 'straight_line':
            a1 = [4] * 15
        a2_opts = ch['A2_open'] if r['arm'] == 'open' else ch['A2_closed']
        a2_p = [.3, .12, .2, .13, .1, .1, .05] if r['arm'] == 'open' else [.35, .15, .25, .15, .1]
        cards = []
        for pos, (c, v) in enumerate(zip(r['seq'], a1, strict=True), start=1):
            a2 = self.choice(len(a2_opts), a2_p)
            cards.append([key, route, r['arm'], r['set'], pos, c, lock['card_type'][c], v, a2, a2_opts[a2 - 1]])
        # 공통 문항
        row.update(C3=self.choice(len(ch['C3'])), C4=self.choice(4, [.45, .25, .25, .05]), C7=1 if rng.random() < .08 else 2)
        for i in range(len(ch['C5_rows'])):
            row[f'C5_{i + 1}'] = self.choice(5, [.1, .2, .35, .25, .1] if i == 7 else [.03, .07, .25, .35, .3])
        k = int(rng.choice([1, 2, 3], p=[.15, .25, .6]))
        c6p = np.array([.25, .2, .12, .12, .1, .08, .07, .06])
        row['C6'] = '|'.join(str(int(x)) for x in rng.choice(np.arange(1, 9), size=k, replace=False, p=c6p))
        known = [i + 1 for i, c in enumerate(ch['D1_cards']) if rng.random() < AWARE.get(c, .9)]
        row['D1'] = '|'.join(map(str, known)) if known else str(len(ch['D1']))
        for c in ch['D2_rows']:
            row[f'D2_{c}'] = self.choice(5, [.1, .2, .35, .25, .1])
        # 비공개 묶음 가림 점검
        text = {'resp_key': key, 'B2': '', 'D3': '', 'C6_other': ''}
        if r['arm'] == 'closed':
            for c in r['seq']:
                right = 1 if lock['card_type'][c] == 'R' else 2
                x = rng.random()
                row[f'B1_{c}'] = right if x < .45 else 4 if x < .8 else int(rng.choice([v for v in (1, 2, 3) if v != right]))
            row['B3'] = 1 if rng.random() < .06 else 2
            if rng.random() < .1:
                if rng.random() < .5:
                    pos = int(rng.integers(0, 15))
                    text['B2'] = f'카드 {pos + 1} {lock["company"][r["seq"][pos]]}'
                else:
                    text['B2'] = str(rng.choice(B2_GENERIC))
        if rng.random() < .3:
            text['D3'] = str(rng.choice(D3_TEXT))
        if rng.random() < .04:
            text['C6_other'] = '채용 일정'
        # 제외 대상 주입(각각 규칙 하나만 어기게)
        if kind == 'attention':
            row['AC'] = int(rng.choice([1, 2, 4, 5]))
        elif kind == 'too_fast':
            row['duration_min'] = 2
        elif kind == 'route_conflict':     # exportTidy: 묶음 두 개를 지나면 route·arm·set·AC·B1·B3 가 비고 카드 행이 없다
            row.update(route='', arm='', set='', AC='', B3='', route_conflict=1)
            for c in ch['D1_cards']:
                row[f'B1_{c}'] = ''
            cards = []
        elif kind == 'partial':            # D2 없이 끝난 응답
            row['status'] = 'partial'
            row['D1'] = ''
            for c in ch['D2_rows']:
                row[f'D2_{c}'] = ''
        return row, cards, (text if any(text[k] for k in ('B2', 'D3', 'C6_other')) else None)


def generate(n_valid: int = 200, seed: int = 7, lock: dict | None = None, spec: dict | None = None) -> dict:
    """합성 자료(행 목록)와 정답을 만든다. n_valid = 제외되지 않을 정상 응답 수."""
    lock, spec = lock or sio.load_lock(), spec or sio.load_spec()
    g = Generator(lock, spec, seed)
    people = [('normal', *g.respondent('normal')) for _ in range(n_valid)]
    for kind in ('screened_out', 'partial', 'attention', 'straight_line', 'too_fast', 'route_conflict'):
        people += [(kind, *g.respondent(kind)) for _ in range(INJECT[kind])]
    people = [people[i] for i in g.rng.permutation(len(people))]
    # 중복: 앞쪽 정상 응답 하나를 그대로 복사해 그 뒤에 끼운다(resp_key 만 다름)
    for j in range(INJECT['duplicate']):
        normal_pos = [i for i, p in enumerate(people) if p[0] == 'normal']
        src = normal_pos[(j + 1) * len(normal_pos) // (INJECT['duplicate'] + 2)]
        _, row, cards, text = people[src]
        k2 = g.key()
        dup = ('duplicate', {**row, 'resp_key': k2}, [[k2] + c[1:] for c in cards], ({**text, 'resp_key': k2} if text else None))
        people.insert(int(g.rng.integers(src + 1, len(people) + 1)), dup)
    eff, pref = truth_effects(lock)
    return {
        'resp': [p[1] for p in people],
        'cards': [c for p in people for c in p[2]],
        'text': [p[3] for p in people if p[3]],
        'truth': {
            'seed': seed, 'n_rows': len(people), 'n_valid_expected': n_valid,
            'injected': INJECT, 'kanban_latent': {'regional': KANBAN['R'], 'metro': KANBAN['M'], 'did': KANBAN['R'] - KANBAN['M']},
            'kanban_expected': eff, 'pref_true': pref,
            'model': {'card_mean': CARD_MEAN, 'sd_resp': SD_RESP, 'sd_noise': SD_NOISE, 'rounding': 'round, clip 1..5'},
        },
    }


def _check_target(out: Path) -> None:
    """저장소 안이면 git 이 무시하는(.gitignore) 경로에만 쓴다."""
    repo = sio.HERE.parents[1]
    out = out.resolve()
    if repo not in out.parents and out != repo:
        return
    try:
        ignored = subprocess.run(['git', '-C', str(repo), 'check-ignore', '-q', str(out / 'x.csv')]).returncode == 0
    except OSError:
        return
    if not ignored:
        sys.exit(f'{out} 는 git 이 추적하는 경로입니다. reports/survey/out_nonlive/ 아래나 저장소 밖에 쓰세요.')


def write(out: Path, data: dict, lock: dict | None = None) -> dict[str, Path]:
    lock = lock or sio.load_lock()
    out = Path(out)
    _check_target(out)
    header = sio.resp_columns(lock) + ['synthetic']
    paths = {'tidy_resp': out / 'tidy_resp.SYNTHETIC.csv', 'tidy_cards': out / 'tidy_cards.SYNTHETIC.csv',
             'tidy_text': out / 'tidy_text.SYNTHETIC.csv', 'truth': out / 'truth.SYNTHETIC.json'}
    sio.write_rows_csv(paths['tidy_resp'], header, [[r[c] for c in header] for r in data['resp']])
    sio.write_rows_csv(paths['tidy_cards'], sio.CARD_COLUMNS, data['cards'])
    sio.write_rows_csv(paths['tidy_text'], sio.TEXT_COLUMNS, [[t[c] for c in sio.TEXT_COLUMNS] for t in data['text']])
    paths['truth'].write_text(json.dumps(data['truth'], ensure_ascii=False, indent=1), encoding='utf-8')
    return paths


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='합성 설문 자료(tidy_*.SYNTHETIC.csv) 만들기')
    ap.add_argument('--out', type=Path, default=DEFAULT_OUT, help=f'출력 디렉터리(기본 {DEFAULT_OUT})')
    ap.add_argument('--n', type=int, default=200, help='정상(유효) 응답 수')
    ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args(argv)
    data = generate(a.n, a.seed)
    write(a.out, data)
    t = data['truth']
    print(f'합성 자료 {t["n_rows"]}행(유효 예정 {t["n_valid_expected"]}) → {a.out}')
    print(f'  주입: {t["injected"]}')
    print(f'  간판 효과(잠재) 지역 +{KANBAN["R"]} · 수도권 +{KANBAN["M"]} / 관측 척도 기대 지역 {t["kanban_expected"]["regional"]:+.3f}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
