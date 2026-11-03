"""간판떼고 설문 정리 시트(tidy_resp · tidy_cards · tidy_text) 읽기.

입력 두 가지를 같은 DataFrame으로 바꾼다.
- CSV 디렉터리: 시트를 내려받은 tidy_resp*.csv · tidy_cards*.csv · tidy_text*.csv (UTF-8, 첫 행 머리글)
- 구글 시트 get_values 결과(JSON): 행 목록 [[머리글...], [값...]] 또는 {"values": [...]},
  여러 시트는 {"tidy_resp": ..., "tidy_cards": ..., "tidy_text": ...} 또는 {"valueRanges": [...]}

열 이름과 코드는 gs/form_lib.gs 의 exportTidy() 와 같다(spec.lock.json 의 choices 로 확인).
공개 저장소이므로 이 모듈은 응답을 읽기만 하고 어디에도 쓰지 않는다.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
SPEC_LOCK = HERE / 'spec.lock.json'
SURVEY_SPEC = HERE / 'survey_spec.json'
SCORES = HERE.parent / 'build_result' / 'scores.json'
OUT_NONLIVE = HERE / 'out_nonlive'      # gitignored: 시험·합성 결과
RESULTS_LIVE = HERE / 'results'         # 본조사 집계 결과(원자료 아님)

STATUSES = ('complete', 'screened_out', 'partial')
CARD_COLUMNS = ['resp_key', 'route', 'arm', 'set', 'pos', 'card_id', 'card_type', 'A1', 'A2', 'A2_label']
TEXT_COLUMNS = ['resp_key', 'B2', 'D3', 'C6_other']


class SurveyDataError(ValueError):
    """입력 시트가 정해진 형식과 다를 때."""


def load_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def load_lock(path: Path = SPEC_LOCK) -> dict:
    return load_json(path)


def load_spec(path: Path = SURVEY_SPEC) -> dict:
    return load_json(path)


def sha16(path: Path) -> str:
    """파일 SHA-256 앞 16자리(scores.json 고정 확인용)."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]


# ───────── 열 정의(exportTidy 머리글과 같은 순서) ─────────
def resp_columns(lock: dict) -> list[str]:
    ch = lock['choices']
    return (['resp_key', 'status', 'route', 'arm', 'set', 'stratum', 'C1', 'C2', 'birth_day', 'duration_min', 'AC', 'C3', 'C4']
            + [f'C5_{i + 1}' for i in range(len(ch['C5_rows']))]
            + ['C6', 'C7', 'D1']
            + [f'D2_{c}' for c in ch['D2_rows']]
            + [f'B1_{c}' for c in ch['D1_cards']]
            + ['B3', 'route_conflict', 'submit_date'])


def _int_ranges(lock: dict) -> dict[str, tuple[int, int]]:
    """정수 코드 열과 허용 범위."""
    ch = lock['choices']
    r = {'route': (1, len(lock['routes'])), 'C1': (1, len(ch['C1'])), 'C2': (1, len(ch['C2'])), 'birth_day': (1, 31),
         'AC': (1, 5), 'C3': (1, len(ch['C3'])), 'C4': (1, len(ch['C4'])), 'C7': (1, len(ch['C7'])),
         'B3': (1, len(ch['B3'])), 'route_conflict': (0, 1)}
    r.update({f'C5_{i + 1}': (1, 5) for i in range(len(ch['C5_rows']))})
    r.update({f'D2_{c}': (1, 5) for c in ch['D2_rows']})
    r.update({f'B1_{c}': (1, len(ch['B1'])) for c in ch['D1_cards']})
    return r


@dataclass
class SurveyData:
    resp: pd.DataFrame
    cards: pd.DataFrame
    text: pd.DataFrame
    sources: dict = field(default_factory=dict)   # 시트 이름 → 파일 경로 또는 'sheets'
    warnings: list = field(default_factory=list)

    @property
    def synthetic(self) -> bool:
        """합성 자료 표시(synthetic=1 열 또는 .SYNTHETIC. 파일 이름)가 있으면 True."""
        if 'synthetic' in self.resp.columns and (self.resp['synthetic'].fillna(0) == 1).any():
            return True
        return any('SYNTHETIC' in str(s) for s in self.sources.values())


# ───────── 값 변환 ─────────
def _strip(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lstrip('﻿') for c in df.columns]
    for c in df.columns:
        df[c] = df[c].fillna('').astype(str).str.strip()
    return df


def _to_int(s: pd.Series, name: str, lo: int | None = None, hi: int | None = None) -> pd.Series:
    num = pd.to_numeric(s.mask(s == ''), errors='coerce')
    bad = s[(s != '') & num.isna()]
    if len(bad):
        raise SurveyDataError(f'{name}: 숫자가 아닌 값 {list(bad.unique()[:5])}')
    frac = num[num.notna() & (num != num.round())]
    if len(frac):
        raise SurveyDataError(f'{name}: 정수가 아닌 값 {list(frac.unique()[:5])}')
    out = num.round().astype('Int64')
    if lo is not None:
        oor = out[out.notna() & ((out < lo) | (out > hi))]
        if len(oor):
            raise SurveyDataError(f'{name}: 범위 {lo}~{hi} 밖의 값 {sorted(set(oor.tolist()))[:5]}')
    return out


_SHEETS_EPOCH = date(1899, 12, 30)


def parse_date(v) -> str | None:
    """제출일 → 'YYYY-MM-DD'. 시트 표시 형식(2026. 11. 4 · 2026/11/04 · 11/4/2026)과 일련번호(46330)를 받는다."""
    s = str(v).strip() if v is not None else ''
    if not s:
        return None
    m = re.match(r'^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})', s)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', s)          # 미국식 M/D/YYYY
        if m:
            mo, d, y = map(int, m.groups())
        elif re.fullmatch(r'\d{5}(\.\d+)?', s):                    # 시트 날짜 일련번호
            return (_SHEETS_EPOCH + timedelta(days=int(float(s)))).isoformat()
        else:
            return None
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def split_codes(v) -> list[int]:
    """'1|3|5' → [1, 3, 5] (C6·D1 복수 선택)."""
    s = '' if v is None or (isinstance(v, float) and pd.isna(v)) else str(v).strip()
    out = []
    for x in s.split('|'):
        x = x.strip()
        if x:
            try:
                out.append(int(float(x)))
            except ValueError:
                raise SurveyDataError(f'복수 선택 코드가 숫자가 아님: {s!r}') from None
    return out


def _require(df: pd.DataFrame, cols: list[str], name: str) -> None:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise SurveyDataError(f'{name}: 열이 없음 {missing[:8]}{" …" if len(missing) > 8 else ""} '
                              f'(exportTidy 머리글과 다름 — spec.lock.json 과 같은 설계의 시트인지 확인)')


def coerce_resp(raw: pd.DataFrame, lock: dict) -> pd.DataFrame:
    df = _strip(raw)
    _require(df, resp_columns(lock), 'tidy_resp')
    df = df[df['resp_key'] != ''].reset_index(drop=True)          # 빈 행 제거
    dup = df['resp_key'][df['resp_key'].duplicated()]
    if len(dup):
        raise SurveyDataError(f'tidy_resp: resp_key 중복 {list(dup.unique()[:5])}')
    bad = sorted(set(df['status']) - set(STATUSES))
    if bad:
        raise SurveyDataError(f'tidy_resp: 알 수 없는 status {bad}')
    for c, (lo, hi) in _int_ranges(lock).items():
        df[c] = _to_int(df[c], f'tidy_resp.{c}', lo, hi)
    dur = df['duration_min']
    df['duration_min'] = pd.to_numeric(dur.mask(dur == ''), errors='coerce').astype('Float64')
    for c, allowed in (('arm', {'open', 'closed', ''}), ('set', {'A', 'B', ''}), ('stratum', set(lock['strata']) | {''})):
        bad = sorted(set(df[c]) - allowed)
        if bad:
            raise SurveyDataError(f'tidy_resp.{c}: 알 수 없는 값 {bad}')
    for c in ('C6', 'D1'):
        df[c].map(split_codes)                                     # 형식만 확인
    df['submit_date'] = df['submit_date'].map(parse_date)
    if 'synthetic' in df.columns:
        df['synthetic'] = _to_int(df['synthetic'], 'tidy_resp.synthetic', 0, 1)
    return df


def coerce_cards(raw: pd.DataFrame, lock: dict) -> pd.DataFrame:
    df = _strip(raw)
    _require(df, CARD_COLUMNS, 'tidy_cards')
    df = df[df['resp_key'] != ''].reset_index(drop=True)
    df['route'] = _to_int(df['route'], 'tidy_cards.route', 1, len(lock['routes']))
    df['pos'] = _to_int(df['pos'], 'tidy_cards.pos', 1, 15)
    df['A1'] = _to_int(df['A1'], 'tidy_cards.A1', 1, 5)
    df['A2'] = _to_int(df['A2'], 'tidy_cards.A2', 1, len(lock['choices']['A2_open']))
    bad = sorted(set(df['card_id']) - set(lock['labels']))
    if bad:
        raise SurveyDataError(f'tidy_cards.card_id: 설계에 없는 카드 {bad[:5]}')
    wrong = df[df['card_type'] != df['card_id'].map(lock['card_type'])]
    if len(wrong):
        raise SurveyDataError(f'tidy_cards.card_type 이 설계와 다름: {wrong[["card_id", "card_type"]].head(3).values.tolist()}')
    return df


def coerce_text(raw: pd.DataFrame | None) -> pd.DataFrame:
    if raw is None:
        return pd.DataFrame({c: pd.Series(dtype=str) for c in TEXT_COLUMNS})
    df = _strip(raw)
    _require(df, TEXT_COLUMNS, 'tidy_text')
    return df[df['resp_key'] != ''].reset_index(drop=True)


# ───────── CSV 디렉터리 ─────────
def _read_csv(path: Path) -> pd.DataFrame:
    # utf-8-sig: 엑셀이 붙인 BOM이 있어도 읽는다. 모든 값은 문자열로 읽고 나중에 변환한다.
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding='utf-8-sig')


def find_sheet_file(folder: Path, name: str, required: bool = True) -> Path | None:
    """folder 안에서 이름에 name(tidy_resp 등)이 들어간 CSV 하나를 찾는다."""
    hits = sorted(p for p in Path(folder).glob('*.csv') if name in p.name)
    if len(hits) > 1:
        exact = [p for p in hits if p.stem == name]
        if len(exact) == 1:
            return exact[0]
        raise SurveyDataError(f'{folder}: {name} CSV가 여러 개 {[p.name for p in hits]} — 하나만 두세요')
    if not hits:
        if required:
            raise SurveyDataError(f'{folder}: {name}*.csv 가 없음')
        return None
    return hits[0]


def read_dir(folder: Path, lock: dict | None = None) -> SurveyData:
    lock = lock or load_lock()
    folder = Path(folder)
    if not folder.is_dir():
        raise SurveyDataError(f'입력 디렉터리가 없음: {folder}')
    fr, fc = find_sheet_file(folder, 'tidy_resp'), find_sheet_file(folder, 'tidy_cards')
    ft = find_sheet_file(folder, 'tidy_text', required=False)
    warnings = [] if ft else [f'{folder}: tidy_text CSV 없음 — 자유 응답(B2·D3·C6 기타)은 빈 것으로 본다']
    data = SurveyData(coerce_resp(_read_csv(fr), lock), coerce_cards(_read_csv(fc), lock),
                      coerce_text(_read_csv(ft) if ft else None),
                      {'tidy_resp': str(fr), 'tidy_cards': str(fc), 'tidy_text': str(ft) if ft else None}, warnings)
    return _check_links(data)


# ───────── 구글 시트 get_values 행 ─────────
def rows_to_frame(rows) -> pd.DataFrame:
    """[[머리글...], [값...], ...] 또는 {"values": [...]} → 문자열 DataFrame. 짧은 행(끝 빈칸 생략)은 채운다."""
    if isinstance(rows, dict):
        rows = rows.get('values', [])
    rows = [list(r) for r in (rows or [])]
    if not rows:
        raise SurveyDataError('시트 행이 비어 있음(머리글도 없음)')
    header = [str(h).strip() for h in rows[0]]
    body = []
    for r in rows[1:]:
        r = ['' if v is None else str(v) for v in r][:len(header)]
        body.append(r + [''] * (len(header) - len(r)))
    return pd.DataFrame(body, columns=header, dtype=str)


def _sheet_payloads(obj) -> dict:
    """여러 모양의 get_values 결과를 {'tidy_resp': rows, ...}로 모은다."""
    if isinstance(obj, dict) and 'valueRanges' in obj:
        out = {}
        for vr in obj['valueRanges']:
            name = str(vr.get('range', '')).split('!')[0].strip("'")
            out[name] = vr.get('values', [])
        return out
    if isinstance(obj, dict) and any(k in obj for k in ('tidy_resp', 'tidy_cards', 'tidy_text')):
        return obj
    raise SurveyDataError('시트 JSON에서 tidy_resp·tidy_cards·tidy_text 를 찾지 못함')


def from_sheet_rows(payloads: dict, lock: dict | None = None) -> SurveyData:
    lock = lock or load_lock()
    p = _sheet_payloads(payloads)
    for k in ('tidy_resp', 'tidy_cards'):
        if k not in p:
            raise SurveyDataError(f'시트 JSON에 {k} 가 없음')
    data = SurveyData(coerce_resp(rows_to_frame(p['tidy_resp']), lock), coerce_cards(rows_to_frame(p['tidy_cards']), lock),
                      coerce_text(rows_to_frame(p['tidy_text']) if p.get('tidy_text') else None),
                      {k: 'sheets' for k in p})
    return _check_links(data)


def resp_from_rows(rows, lock: dict | None = None) -> pd.DataFrame:
    """tidy_resp 하나만(일일 점검용)."""
    return coerce_resp(rows_to_frame(rows), lock or load_lock())


def load(path, lock: dict | None = None) -> SurveyData:
    """디렉터리(CSV) 또는 .json(시트 행) 경로를 읽는다."""
    path = Path(path)
    if path.is_dir():
        return read_dir(path, lock)
    if path.suffix.lower() == '.json':
        data = from_sheet_rows(load_json(path), lock)
        data.sources = {k: f'{path}#{k}' for k in data.sources}
        return data
    raise SurveyDataError(f'디렉터리나 .json 이 아님: {path}')


def load_resp(path, lock: dict | None = None) -> pd.DataFrame:
    """tidy_resp 만 읽는다: 디렉터리 · tidy_resp.csv · 시트 행 JSON."""
    lock = lock or load_lock()
    path = Path(path)
    if path.is_dir():
        return coerce_resp(_read_csv(find_sheet_file(path, 'tidy_resp')), lock)
    if path.suffix.lower() == '.csv':
        return coerce_resp(_read_csv(path), lock)
    if path.suffix.lower() == '.json':
        obj = load_json(path)
        if isinstance(obj, list) or (isinstance(obj, dict) and 'values' in obj):
            return resp_from_rows(obj, lock)
        return resp_from_rows(_sheet_payloads(obj)['tidy_resp'], lock)
    raise SurveyDataError(f'읽을 수 없는 입력: {path}')


def _check_links(data: SurveyData) -> SurveyData:
    keys = set(data.resp['resp_key'])
    orphan = sorted(set(data.cards['resp_key']) - keys)
    if orphan:
        data.warnings.append(f'tidy_cards 에만 있는 resp_key {len(orphan)}개(무시)')
    if data.resp['submit_date'].isna().any() and (data.resp['status'] == 'complete').any():
        n = int(data.resp['submit_date'].isna().sum())
        data.warnings.append(f'제출일을 읽지 못한 행 {n}개')
    return data


def write_rows_csv(path: Path, header: list[str], rows: list[list]) -> None:
    """CSV 쓰기 도우미(합성 자료 전용). 원자료를 저장소 추적 경로에 쓰지 않는다."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows([['' if v is None else v for v in r] for r in rows])
