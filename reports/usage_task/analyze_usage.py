"""간판떼고 학생 사용 과제 분석: 응답 → 참가자별 정답 수(0~6)·시간 → 형식별 요약과 같은 사람 안의 차이
→ reports/build_result/followup.json 의 "usage" 블록 {"text": 한 단락, "rows": [[구분, 직무 카드, 기존 채용정보, 차이], ...]}.

사용
  python3 analyze_usage.py --in PATH [--draft] [--dry-run] [--followup PATH] [--private-dir DIR] [--results PATH]

  PATH  (권장) 폼 스크립트에서 exportTidy 를 실행한 뒤 응답 시트의 'tidy' 시트를 CSV로 내려받은 파일
        · 원 응답 시트('설문지 응답 시트1')를 CSV로 내려받은 파일도 읽는다(같은 제목의 두 열 = 두 경로)
        · 구글 시트 get_values 결과 JSON({"values": [[머리글...], [값...]]} 또는 행 목록)
        · 위 CSV가 하나 든 디렉터리
  --draft        합성·시험 자료나 진행 중 자료로 미리보기 블록을 쓴다(status "draft", 문장 앞 ［미리보기…］).
                 followup.json 에 본 결과(status "final")가 있으면 덮어쓰지 않는다.
  --dry-run      결과를 화면에만 보이고 followup.json·private/ 에 쓰지 않는다(--results 로 지정한 파일만 쓴다).
  --followup     쓸 파일(기본 reports/build_result/followup.json). "usage" 키만 바꾸고 다른 키는 그대로 둔다.
  --private-dir  참가자별 표·전체 통계를 쓸 곳(기본 reports/usage_task/private/, gitignored. 합성 자료는 그 아래 synthetic/).
  --results      전체 통계 JSON 경로(기본 <private-dir>/usage_results.json). 지정하면 --dry-run·거절 때도 쓴다.

안전장치
  - 합성 자료(synthetic=1 열, 파일 이름의 SYNTHETIC, JSON 의 "synthetic": true)는 --draft 없이 followup.json 에 쓰지 않는다(종료 코드 2).
  - 유효 참가자가 0명이면 쓰지 않는다(종료 코드 2).
  - tidy 시트의 점수(dh_score·tk_score)가 usage.lock.json 정답으로 다시 센 점수와 다르면 멈춘다(폼과 정답 키가 다름, 종료 코드 1).

규칙(usage_spec.json "analysis", 응답을 받기 전에 고정)
  제외: 동의하지 않음 → 참가 번호 '시험(연습 응답)' → 두 경로 모두 답함(경로 충돌) → 그룹·참가 번호·12문항 중 빈 것
        → 같은 참가 번호의 두 번째 이후 응답(먼저 제출한 완료 응답만 씀)
  형식: 고른 그룹으로 정한다(G1 동화엔텍=카드·태광후지킨=공고, G2 반대). 참가 번호 홀짝(홀수 G1)과 다르면 경고만 한다.
  비교: 참가자마다 카드 − 기존(정답 수, 시간, 판단 쉬움). 정확 부호 검정(이항, 양측)과 윌콕슨 부호순위 검정
        (차이 0 제외, 같은 값은 중간 순위, 2^n 부호 뒤집기 정확 분포, 양측). 시간 0·빈칸은 시간 비교에서만 뺀다.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True   # 저장소에 __pycache__ 를 남기지 않는다

import numpy as np                # noqa: E402
from scipy import stats           # noqa: E402

HERE = Path(__file__).resolve().parent
LOCK_PATH = HERE / 'usage.lock.json'
FOLLOWUP = HERE.parent / 'build_result' / 'followup.json'
PRIVATE = HERE / 'private'
KST = ZoneInfo('Asia/Seoul')
ALPHA = 0.05
DRAFT_MARK = {'synthetic': '［미리보기: 합성 자료로 만든 문장이며 실제 결과가 아니다］ ',
              'live': '［미리보기: 진행 중 자료］ '}
STATUSES = ('complete', 'no_consent', 'test', 'path_conflict', 'incomplete')


class UsageError(ValueError):
    """입력이 정해진 형식과 다를 때(종료 코드 1)."""


class Refused(RuntimeError):
    """안전장치 때문에 쓰지 않을 때(종료 코드 2)."""


def load_lock(path: Path = LOCK_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding='utf-8'))


# ───────── 입력 읽기 ─────────
def _rows_from_json(obj) -> tuple[list[list[str]], bool]:
    synthetic = bool(isinstance(obj, dict) and obj.get('synthetic'))
    if isinstance(obj, dict) and 'valueRanges' in obj:
        ranges = obj['valueRanges']
        pick = next((r for r in ranges if str(r.get('range', '')).split('!')[0].strip("'") == 'tidy'), ranges[0] if ranges else {})
        rows = pick.get('values', [])
    elif isinstance(obj, dict):
        rows = obj.get('values', [])
    else:
        rows = obj
    return [list(r) for r in (rows or [])], synthetic


def read_table(path: Path) -> tuple[list[str], list[list[str]], dict]:
    """CSV·JSON·디렉터리 → (머리글, 행들, 정보). 값은 모두 문자열, 짧은 행은 빈칸으로 채운다."""
    path = Path(path)
    if path.is_dir():
        hits = sorted(p for p in path.glob('*.csv') if 'tidy' in p.name and 'text' not in p.name) or sorted(path.glob('*.csv'))
        if len(hits) != 1:
            raise UsageError(f'{path}: 읽을 CSV를 하나로 정하지 못함 {[p.name for p in hits]}')
        path = hits[0]
    if not path.exists():
        raise UsageError(f'입력 파일이 없음: {path}')
    synthetic = 'SYNTHETIC' in path.name
    if path.suffix.lower() == '.json':
        rows, flag = _rows_from_json(json.loads(path.read_text(encoding='utf-8')))
        synthetic = synthetic or flag
    elif path.suffix.lower() == '.csv':
        with path.open(encoding='utf-8-sig', newline='') as f:
            rows = [r for r in csv.reader(f)]
    else:
        raise UsageError(f'CSV·JSON·디렉터리가 아님: {path}')
    if not rows:
        raise UsageError(f'{path.name}: 행이 없음(머리글도 없음)')
    header = [str(h).strip().lstrip('﻿') for h in rows[0]]
    body = []
    for r in rows[1:]:
        r = ['' if v is None else str(v).strip() for v in r][:len(header)]
        r += [''] * (len(header) - len(r))
        if any(r):
            body.append(r)
    return header, body, {'file': path.name, 'synthetic': synthetic}


def _choice_index(q: dict, v: str) -> int:
    if v == '':
        return 0
    if v not in q['choices']:
        raise UsageError(f"{q['key']}: 선택지에 없는 답 {v!r}")
    return q['choices'].index(v) + 1


def _num(v: str, name: str, lo=None, hi=None, integer=False):
    if v is None or str(v).strip() == '':
        return None
    try:
        x = float(str(v).replace(',', ''))
    except ValueError:
        raise UsageError(f'{name}: 숫자가 아님 {v!r}') from None
    if integer and x != round(x):
        raise UsageError(f'{name}: 정수가 아님 {v!r}')
    if lo is not None and not (lo <= x <= hi):
        raise UsageError(f'{name}: 범위 {lo}~{hi} 밖 {v!r}')
    return int(round(x)) if integer else x


def _pid(v: str, lock: dict):
    v = (v or '').strip()
    if v in ('', ):
        return None
    if v in ('test', lock['pid']['test']):
        return 'test'
    return _num(v, 'pid', 1, lock['pid']['max'], integer=True)


_KO_TS = re.compile(r'^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(오전|오후)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?')
_ISO_TS = re.compile(r'^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?')
_US_TS = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?')


def parse_ts(v: str) -> str:
    """시트 타임스탬프 → 'YYYY-MM-DD HH:MM'(못 읽으면 '')."""
    s = (v or '').strip()
    m = _KO_TS.match(s)
    if m:
        y, mo, d, ampm, hh, mm = m.group(1, 2, 3, 4, 5, 6)
        h = int(hh or 0) % 12 + (12 if ampm == '오후' else 0) if ampm else int(hh or 0)
        return f'{int(y):04d}-{int(mo):02d}-{int(d):02d} {h:02d}:{int(mm or 0):02d}'
    m = _ISO_TS.match(s)
    if m:
        y, mo, d, hh, mm = m.group(1, 2, 3, 4, 5)
        return f'{int(y):04d}-{int(mo):02d}-{int(d):02d} {int(hh or 0):02d}:{int(mm or 0):02d}'
    m = _US_TS.match(s)
    if m:
        mo, d, y, hh, mm = m.group(1, 2, 3, 4, 5)
        return f'{int(y):04d}-{int(mo):02d}-{int(d):02d} {int(hh or 0):02d}:{int(mm or 0):02d}'
    return ''


def _status(rec: dict, lock: dict) -> str:
    if rec['consent'] != 1:
        return 'no_consent'
    if rec['pid'] == 'test':
        return 'test'
    if rec.get('conflict'):
        return 'path_conflict'
    if rec['group'] not in lock['groups'] or rec['pid'] is None:
        return 'incomplete'
    if any(0 in rec['co'][c]['answers'] for c in lock['codes'].values()):
        return 'incomplete'
    return 'complete'


def parse_tidy(header: list[str], rows: list[list[str]], lock: dict) -> tuple[list[dict], list[str]]:
    missing = [h for h in lock['tidy_header'] if h not in header]
    if missing:
        raise UsageError(f'tidy 열이 없음 {missing[:6]} — exportTidy 로 만든 tidy 시트인지, usage.lock.json 과 같은 설계인지 확인')
    ix = {h: i for i, h in enumerate(header)}
    qs = lock['questions']
    warnings = []
    recs = []
    for r in rows:
        g = lambda h: r[ix[h]] if h in ix else ''  # noqa: E731
        rec = {'resp_key': g('resp_key'), 'submitted_at': parse_ts(g('submitted_at')) or g('submitted_at'),
               'consent': _num(g('consent'), 'consent', 1, 2, integer=True), 'group': g('group'),
               'pid': _pid(g('pid'), lock), 'conflict': g('status') == 'path_conflict', 'co': {},
               'synthetic': g('synthetic') in ('1', '1.0', 'true', 'TRUE')}
        for name, code in lock['codes'].items():
            lc = code.lower()
            ans = []
            for q in [q for q in qs if q['code'] == code]:
                n = int(q['key'][len(code):])
                v = _num(g(f'{lc}_q{n}'), f'{lc}_q{n}', 1, len(q['choices']), integer=True)
                ans.append(v or 0)
            rec['co'][code] = {'answers': ans, 'time': _num(g(f'{lc}_time_s'), f'{lc}_time_s', 0, 99999),
                               'ease': _num(g(f'{lc}_ease'), f'{lc}_ease', 1, 5, integer=True),
                               'sheet_score': _num(g(f'{lc}_score'), f'{lc}_score', 0, 6, integer=True)}
        rec['status'] = _status(rec, lock)
        if g('status') and g('status') != rec['status'] and g('status') in STATUSES:
            warnings.append(f"{rec['resp_key']}: 시트 status {g('status')} ≠ 다시 계산한 {rec['status']}")
        recs.append(rec)
    hashes = sorted({r[ix['spec_hash']] for r in rows if r[ix['spec_hash']]})
    if hashes and hashes != [lock['spec_hash']]:
        warnings.append(f"tidy 의 설계 해시 {hashes} ≠ usage.lock.json {lock['spec_hash']} — 폼을 만든 뒤 설계가 바뀌었는지 확인(점수 대조로 정답 키는 확인함)")
    return recs, warnings


def parse_raw(header: list[str], rows: list[list[str]], lock: dict) -> tuple[list[dict], list[str]]:
    """원 응답 시트: 열 이름 = 문항 제목. 문항 12개는 경로(그룹)마다 한 열씩 같은 제목으로 두 번 나온다(폼 순서 = 그룹 순서)."""
    warnings = []
    cols = {}
    for i, h in enumerate(header):
        cols.setdefault(h, []).append(i)
    if any(re.search(r'이메일|e-?mail', h, re.I) for h in header):
        warnings.append('응답 시트에 이메일 열이 있음 — 읽지 않았다. 폼 설정에서 이메일 수집을 끄고, 이 열은 지운다.')
    groups = list(lock['groups'])

    def one(title):
        if len(cols.get(title, [])) != 1:
            raise UsageError(f'응답 시트에서 "{title}" 열을 하나로 찾지 못함({len(cols.get(title, []))}개)')
        return cols[title][0]
    ts_col = next((cols[h][0] for h in ('타임스탬프', 'Timestamp') if h in cols), None)
    c_consent, c_group, c_pid = one(lock['consent']['title']), one(lock['group_title']), one(lock['pid']['title'])
    qcols = {}
    for q in lock['questions']:
        found = cols.get(q['title'], [])
        if len(found) != len(groups):
            raise UsageError(f"응답 시트에서 '{q['title']}' 열이 {len(found)}개(경로 수 {len(groups)}개여야 함)")
        qcols[q['key']] = found
    recs = []
    for k, r in enumerate(rows):
        ts = parse_ts(r[ts_col]) if ts_col is not None else ''
        consent_v = r[c_consent]
        rec = {'resp_key': hashlib.sha256(f'{k}|{r[ts_col] if ts_col is not None else ""}'.encode()).hexdigest()[:12],
               'submitted_at': ts, 'consent': None if consent_v == '' else (1 if consent_v == lock['consent']['yes'] else 2),
               'group': r[c_group], 'pid': _pid(r[c_pid], lock), 'conflict': False, 'co': {}, 'synthetic': False}
        for name, code in lock['codes'].items():
            qs = [q for q in lock['questions'] if q['code'] == code]
            by_path = [[_choice_index(q, r[qcols[q['key']][p]]) for q in qs] for p in range(len(groups))]
            used = [p for p in range(len(groups)) if any(by_path[p])]
            if len(used) > 1:
                rec['conflict'] = True
            ans = by_path[used[0]] if len(used) == 1 else [0] * len(qs)
            if len(used) == 1 and rec['group'] in groups and groups[used[0]] != rec['group']:
                rec['conflict'] = True       # 고른 그룹과 다른 경로에 답이 있음
            C = lock['closing'][code]
            rec['co'][code] = {'answers': ans, 'time': _num(r[one(C['time'])], C['time'], 0, 99999),
                               'ease': _num(r[one(C['ease'])], C['ease'], 1, 5, integer=True), 'sheet_score': None}
        rec['status'] = _status(rec, lock)
        recs.append(rec)
    return recs, warnings


def load_records(path: Path, lock: dict) -> tuple[list[dict], dict]:
    header, rows, info = read_table(path)
    if 'resp_key' in header:
        kind = 'tidy'
        recs, warnings = parse_tidy(header, rows, lock)
    elif any(h in ('타임스탬프', 'Timestamp') for h in header) or lock['consent']['title'] in header:
        kind = 'raw'
        recs, warnings = parse_raw(header, rows, lock)
    else:
        raise UsageError(f"{info['file']}: tidy 시트(resp_key 열)도 원 응답 시트(타임스탬프 열)도 아님")
    info.update({'kind': kind, 'warnings': warnings})
    info['synthetic'] = info['synthetic'] or any(r['synthetic'] for r in recs)
    return recs, info


# ───────── 정리·점수 ─────────
def score(answers: list[int], qs: list[dict]) -> int:
    return sum(1 for a, q in zip(answers, qs) if a == q['correct'])


def clean(recs: list[dict], lock: dict) -> tuple[list[dict], dict, list[str]]:
    warnings = []
    flow = {s: 0 for s in STATUSES}
    for r in recs:
        flow[r['status']] += 1
    qs_of = {code: [q for q in lock['questions'] if q['code'] == code] for code in lock['codes'].values()}
    complete = [r for r in recs if r['status'] == 'complete']
    for r in complete:
        for code, d in r['co'].items():
            d['score'] = score(d['answers'], qs_of[code])
            if d.get('sheet_score') is not None and d['sheet_score'] != d['score']:
                raise UsageError(f"{r['resp_key']} {code}: 시트 점수 {d['sheet_score']} ≠ 정답 키로 센 점수 {d['score']} — 폼과 usage.lock.json 의 정답이 다름")
    order = sorted(range(len(complete)), key=lambda i: (complete[i]['submitted_at'] or '9999', i))
    seen, valid, dup = set(), [], 0
    for i in order:
        r = complete[i]
        if r['pid'] in seen:
            dup += 1
            continue
        seen.add(r['pid'])
        valid.append(r)
    flow['duplicate_pid'] = dup
    flow['valid'] = len(valid)
    mism = [r['pid'] for r in valid if (r['pid'] % 2 == 1) != (r['group'] == list(lock['groups'])[0])]
    if mism:
        warnings.append(f'참가 번호 홀짝과 고른 그룹이 다름: {sorted(mism)} — 고른 그룹(실제로 본 형식)으로 분석했다')
    if dup:
        warnings.append(f'같은 참가 번호의 뒤 응답 {dup}건을 뺐다(먼저 제출한 응답만 씀)')
    return sorted(valid, key=lambda r: r['pid']), flow, warnings


def participants(valid: list[dict], lock: dict) -> list[dict]:
    out = []
    for r in valid:
        fmt = lock['groups'][r['group']]
        card_co = next(c for c in lock['order'] if fmt[c] == 'card')
        post_co = next(c for c in lock['order'] if fmt[c] == 'posting')
        cc, pc = lock['codes'][card_co], lock['codes'][post_co]
        out.append({
            'pid': r['pid'], 'group': r['group'], 'submitted_at': r['submitted_at'], 'resp_key': r['resp_key'],
            'card_company': card_co, 'posting_company': post_co,
            'card_score': r['co'][cc]['score'], 'posting_score': r['co'][pc]['score'],
            'card_time_s': r['co'][cc]['time'], 'posting_time_s': r['co'][pc]['time'],
            'card_ease': r['co'][cc]['ease'], 'posting_ease': r['co'][pc]['ease'],
            'answers': {code: r['co'][code]['answers'] for code in lock['codes'].values()},
        })
    return out


# ───────── 통계 ─────────
def paired(card, post) -> dict:
    """같은 사람의 (카드, 기존) 짝. 차이 = 카드 − 기존."""
    card = np.asarray(card, dtype=float)
    post = np.asarray(post, dtype=float)
    n = int(len(card))
    out = {'n': n}
    if n == 0:
        return out
    d = card - post
    nz = d[d != 0]
    pos, neg = int((nz > 0).sum()), int((nz < 0).sum())
    p_sign = float(stats.binomtest(pos, pos + neg, 0.5).pvalue) if pos + neg else 1.0
    if len(nz) == 0:
        p_w = 1.0
    else:
        p_w = float(stats.wilcoxon(d, zero_method='wilcox', alternative='two-sided',
                                   method=stats.PermutationMethod(n_resamples=np.inf)).pvalue)
    out.update({
        'card_mean': float(card.mean()), 'posting_mean': float(post.mean()),
        'card_sd': float(card.std(ddof=1)) if n > 1 else None, 'posting_sd': float(post.std(ddof=1)) if n > 1 else None,
        'card_median': float(np.median(card)), 'posting_median': float(np.median(post)),
        'diff_mean': float(d.mean()), 'diff_median': float(np.median(d)),
        'n_pos': pos, 'n_neg': neg, 'n_tie': n - pos - neg,
        'p_sign': min(p_sign, 1.0), 'p_wilcoxon': min(p_w, 1.0),
    })
    return out


def analyze(pp: list[dict], lock: dict, flow: dict) -> dict:
    sc = paired([p['card_score'] for p in pp], [p['posting_score'] for p in pp])
    tp = [p for p in pp if p['card_time_s'] and p['posting_time_s']]
    tm = paired([p['card_time_s'] for p in tp], [p['posting_time_s'] for p in tp])
    ep = [p for p in pp if p['card_ease'] is not None and p['posting_ease'] is not None]
    ez = paired([p['card_ease'] for p in ep], [p['posting_ease'] for p in ep])
    full = {'card': sum(p['card_score'] == 6 for p in pp), 'posting': sum(p['posting_score'] == 6 for p in pp)}
    # 기업 × 형식 칸(기업 난이도·순서와 형식이 어떻게 섞였는지 보기)
    cells = {}
    for co in lock['order']:
        for fmt in ('card', 'posting'):
            v = [p[f'{fmt}_score'] for p in pp if p[f'{fmt}_company'] == co]
            t = [p[f'{fmt}_time_s'] for p in pp if p[f'{fmt}_company'] == co and p[f'{fmt}_time_s']]
            cells[f'{co}|{fmt}'] = {'n': len(v), 'score_mean': float(np.mean(v)) if v else None,
                                    'time_mean': float(np.mean(t)) if t else None}
    # 문항별 정답률(형식별)
    items = []
    for q in lock['questions']:
        k = int(q['key'][len(q['code']):]) - 1
        row = {'key': q['key'], 'topic': q['topic']}
        for fmt in ('card', 'posting'):
            v = [p['answers'][q['code']][k] == q['correct'] for p in pp if p[f'{fmt}_company'] == q['company']]
            row[fmt] = {'n': len(v), 'correct_rate': float(np.mean(v)) if v else None}
        items.append(row)
    groups = {g: sum(p['group'] == g for p in pp) for g in lock['groups']}
    dates = sorted({p['submitted_at'][:10] for p in pp if p['submitted_at']})
    return {'n': len(pp), 'n_group': groups, 'dates': dates, 'flow': flow, 'score': sc, 'time': tm, 'ease': ez,
            'full_marks': full, 'company_format': cells, 'items': items}


# ───────── 보고서 문장·표 ─────────
def fp(p, compact: bool = False) -> str:
    if compact:
        return 'p<0.001' if p < 0.001 else f'p={p:.3f}'
    return 'p < 0.001' if p < 0.001 else f'p = {p:.3f}'


def signed(x: float, nd: int) -> str:
    s = f'{abs(x):.{nd}f}'
    if float(s) == 0:
        return s
    return ('+' if x > 0 else '−') + s


def kdates(ds: list[str]) -> str:
    if not ds:
        return '과제 기간'
    a, b = [tuple(int(x) for x in d.split('-')) for d in (ds[0], ds[-1])]
    if a == b:
        return f'{a[0]}. {a[1]}. {a[2]}.'
    if a[:2] == b[:2]:
        return f'{a[0]}. {a[1]}. {a[2]}.~{b[2]}.'
    if a[0] == b[0]:
        return f'{a[0]}. {a[1]}. {a[2]}.~{b[1]}. {b[2]}.'
    return f'{a[0]}. {a[1]}. {a[2]}.~{b[0]}. {b[1]}. {b[2]}.'


def _batchim(word: str) -> int | None:
    """마지막 한글 음절의 받침 번호(0 = 없음). 한글이 없으면 None."""
    for ch in reversed(word):
        if '가' <= ch <= '힣':
            return (ord(ch) - 0xAC00) % 28
    return None


def josa(word: str, pair: str) -> str:
    """josa('설계', '와/과') → '설계와', josa('태광후지킨', '으로/로') → '태광후지킨으로'."""
    b = _batchim(word)
    if pair == '으로/로':
        return word + ('으로' if b not in (None, 0, 8) else '로')   # 8 = ㄹ 받침
    if pair == '와/과':
        return word + ('과' if b else '와')
    raise ValueError(pair)


def make_block(R: dict, lock: dict, info: dict, draft: bool) -> dict:
    s, t, e = R['score'], R['time'], R['ease']
    n = R['n']
    g = R['n_group']
    gtxt = ', '.join(f'{k} {v}명' for k, v in g.items())
    co = lock['order']
    jobs = lock.get('jobs', {})
    what = f"{co[0]} {josa(jobs.get(co[0], '직무'), '와/과')} {co[1]} {jobs.get(co[1], '직무')}"
    sig = lambda x: x.get('n', 0) > 0 and x.get('p_wilcoxon', 1) < ALPHA  # noqa: E731
    if sig(s):
        sc = f"{'직무 카드' if s['diff_mean'] > 0 else '기존 채용정보'}로 읽을 때 정답 수가 통계적으로 구분되게 많았고"
    else:
        sc = '정답 수 차이는 이번 표본에서 통계적으로 구분되지 않았고'
    if t.get('n', 0) == 0:
        tc = '걸린 시간은 기록이 없어 비교하지 못했다.'
    elif sig(t):
        tc = f"걸린 시간은 직무 카드가 통계적으로 구분되게 {'짧았다' if t['diff_mean'] < 0 else '길었다'}."
    else:
        tc = '걸린 시간 차이도 통계적으로 구분되지 않았다.' if not sig(s) else '걸린 시간 차이는 통계적으로 구분되지 않았다.'
    caveat = ' 통계적으로 구분되지 않은 차이를 차이가 없다는 뜻으로 읽지 않는다.' if not (sig(s) and sig(t)) else ''
    parts = [
        f'부산대 재학생 {n}명({gtxt})이 {kdates(R["dates"])}에 {what}의 채용 정보를 한 기업은 직무 카드로, '
        f'다른 기업은 기존 채용정보(사람인 공고 원문)로 읽고 자료마다 같은 6문항(실제 업무·필수 요건·근무지·고용형태·초봉·전형 또는 영어 요건)에 답했다.',
        f"평균 정답 수는 직무 카드 {s['card_mean']:.1f}개, 기존 채용정보 {s['posting_mean']:.1f}개(6개 중)였고, "
        f"한 사람 안의 차이(카드 − 기존)는 평균 {signed(s['diff_mean'], 1)}개였다(카드 쪽이 많은 사람 {s['n_pos']}명, 적은 사람 {s['n_neg']}명, "
        f"같은 사람 {s['n_tie']}명, 부호 검정 {fp(s['p_sign'])}, 윌콕슨 부호순위 검정 {fp(s['p_wilcoxon'])}).",
    ]
    tt = (f"자료 하나를 읽고 답하는 데 걸린 시간은 평균 {t['card_mean']:.0f}초 대 {t['posting_mean']:.0f}초"
          f"(차이 {signed(t['diff_mean'], 0)}초, {t['n']}명, 윌콕슨 {fp(t['p_wilcoxon'])})") if t.get('n', 0) else ''
    et = (f"'이 자료로 지원 여부를 판단하기 쉬웠다'는 5점 척도 평균 {e['card_mean']:.1f}점 대 {e['posting_mean']:.1f}점"
          f"(윌콕슨 {fp(e['p_wilcoxon'])})") if e.get('n', 0) else ''
    if tt and et:
        parts.append(f'{tt}였고, {et}이었다.')
    elif tt or et:
        parts.append(f'{tt}였다.' if tt else f'{et}이었다.')
    parts.append(f'정리하면 {sc}, {tc}{caveat}')
    parts.append(f'참가자가 {n}명이고 기업 순서를 {josa(" → ".join(co), "으로/로")} 고정한 채 그룹마다 형식만 바꿨으므로 결과는 탐색적으로 읽는다.')
    text = ' '.join(parts)
    source = 'synthetic' if info['synthetic'] else 'live'
    if draft:
        text = DRAFT_MARK[source] + text

    def ptxt(x):
        return f"n={x['n']}, 부호 {fp(x['p_sign'], True)}, 윌콕슨 {fp(x['p_wilcoxon'], True)}"
    rows = [['정답 수(6문항 중, 평균)', f"{s['card_mean']:.1f}개 ({round(s['card_mean'] / 6 * 100)}%)",
             f"{s['posting_mean']:.1f}개 ({round(s['posting_mean'] / 6 * 100)}%)", f"{signed(s['diff_mean'], 1)}개 ({ptxt(s)})"],
            ['6문항을 모두 맞힌 사람', f"{R['full_marks']['card']}/{n}명", f"{R['full_marks']['posting']}/{n}명",
             f"{R['full_marks']['card'] - R['full_marks']['posting']:+d}명".replace('-', '−')]]
    if t.get('n', 0):
        rows.append(['자료당 걸린 시간(초, 평균·중앙값)', f"{t['card_mean']:.0f}초 · {t['card_median']:.0f}초",
                     f"{t['posting_mean']:.0f}초 · {t['posting_median']:.0f}초", f"{signed(t['diff_mean'], 0)}초 ({ptxt(t)})"])
    if e.get('n', 0):
        rows.append(['지원 여부 판단이 쉬웠다(1~5점, 평균)', f"{e['card_mean']:.1f}점", f"{e['posting_mean']:.1f}점",
                     f"{signed(e['diff_mean'], 1)}점 ({ptxt(e)})"])
    return {
        'text': text, 'rows': rows,
        'status': 'draft' if draft else 'final', 'data_source': source,
        'n': n, 'n_group': g, 'dates': R['dates'],
        'tests': '같은 사람 안의 차이(카드 − 기존): 정확 부호 검정(이항, 양측), 윌콕슨 부호순위 검정(차이 0 제외, 중간 순위, 정확 순열 분포, 양측)',
        'input': info['file'], 'input_kind': info['kind'], 'spec_hash': lock['spec_hash'],
        'generated_at': datetime.now(KST).strftime('%Y-%m-%d %H:%M'),
    }


# ───────── 쓰기 ─────────
def write_followup(path: Path, block: dict) -> None:
    path = Path(path)
    obj = {}
    if path.exists():
        try:
            obj = json.loads(path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as err:
            raise Refused(f'{path} 를 JSON으로 읽지 못해 덮어쓰지 않는다: {err}') from None
        if not isinstance(obj, dict):
            raise Refused(f'{path} 최상위가 객체가 아니라 쓰지 않는다')
    cur = obj.get('usage')
    if block['status'] == 'draft' and isinstance(cur, dict) and cur.get('status', 'final') == 'final':
        raise Refused(f'{path.name} 에 본 결과(usage, final)가 있어 미리보기로 덮어쓰지 않는다')
    obj['usage'] = block
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(path)


def write_private(folder: Path, pp: list[dict], results: dict, results_path: Path | None) -> list[Path]:
    folder.mkdir(parents=True, exist_ok=True)
    out = folder / 'usage_participants.csv'
    cols = ['pid', 'group', 'card_company', 'posting_company', 'card_score', 'posting_score',
            'card_time_s', 'posting_time_s', 'card_ease', 'posting_ease', 'submitted_at']
    with out.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(cols)
        for p in pp:
            w.writerow(['' if p[c] is None else p[c] for c in cols])
    rp = Path(results_path) if results_path else folder / 'usage_results.json'
    rp.parent.mkdir(parents=True, exist_ok=True)
    rp.write_text(json.dumps(results, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return [out, rp]


def run(args) -> int:
    lock = load_lock(Path(args.lock))
    recs, info = load_records(Path(args.input), lock)
    valid, flow, warnings = clean(recs, lock)
    warnings = info['warnings'] + warnings
    pp = participants(valid, lock)
    print(f"입력 {info['file']} ({'tidy 시트' if info['kind'] == 'tidy' else '원 응답 시트'}{', 합성 자료' if info['synthetic'] else ''})")
    print('응답 흐름: ' + ', '.join(f'{k} {v}' for k, v in flow.items()))
    for w in warnings:
        print('주의: ' + w)
    if not pp:
        raise Refused('유효 참가자가 0명이라 결과를 쓰지 않는다')
    R = analyze(pp, lock, flow)
    if R['n'] < lock['sessions']['n_target']:
        print(f"주의: 유효 참가자 {R['n']}명 — 목표 {lock['sessions']['n_target']}명보다 적다")
    block = make_block(R, lock, info, args.draft)
    results = {'block': block, 'analysis': R, 'warnings': warnings, 'participants': pp}
    print('\n' + block['text'] + '\n')
    for row in block['rows']:
        print(' | '.join(row))
    if args.results:   # 따로 지정한 통계 파일은 늘 쓴다(점검·시험용)
        Path(args.results).parent.mkdir(parents=True, exist_ok=True)
        Path(args.results).write_text(json.dumps(results, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if args.dry_run:
        print('\n(--dry-run: followup.json·private/ 에 쓰지 않음)')
        return 0
    if info['synthetic'] and not args.draft:
        raise Refused('합성 자료라 followup.json·private/ 에 쓰지 않는다(미리보기는 --draft)')
    folder = Path(args.private_dir) / ('synthetic' if info['synthetic'] else '')
    for p in write_private(folder, pp, results, args.results):
        print(f'썼음: {p}')
    write_followup(Path(args.followup), block)
    print(f"썼음: {args.followup} 의 usage ({block['status']}, n={block['n']})")
    return 0


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description='간판떼고 학생 사용 과제 분석 → followup.json usage')
    ap.add_argument('--in', dest='input', required=True, help='tidy CSV · 원 응답 시트 CSV · get_values JSON · 디렉터리')
    ap.add_argument('--draft', action='store_true', help='미리보기 블록(합성·진행 중 자료 허용)')
    ap.add_argument('--dry-run', action='store_true', help='화면에만 보이고 파일을 쓰지 않음')
    ap.add_argument('--followup', default=str(FOLLOWUP))
    ap.add_argument('--private-dir', default=str(PRIVATE))
    ap.add_argument('--results', default=None)
    ap.add_argument('--lock', default=str(LOCK_PATH), help=argparse.SUPPRESS)
    return ap.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    try:
        return run(args)
    except Refused as err:
        print(f'쓰지 않음: {err}', file=sys.stderr)
        return 2
    except UsageError as err:
        print(f'입력 오류: {err}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
