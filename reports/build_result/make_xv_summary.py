#!/usr/bin/env python3
"""교차검증 노트(research_notes/교차검증 2026-11/*.md)의 통계 줄을 읽어 xv_summary.json을 만든다.

1차: '<기업>.md'의 '통계: 사실 N개 중 확인(2+) a, 확인(1) b, 불일치 c, 확인 불가 d, 기준일 지남 e'
2차: '<기업>.2차.md'의 '확인(1) 총 n개 → 2차 확인 a, 원천 1개 b, 2차 못 찾음 c, 불일치 발견 d'(있을 때만)
build_report.js --desk가 부록 5와 요약의 교차검증 문장에 쓴다.
"""
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
XV = HERE.parent.parent / 'research_notes' / '교차검증 2026-11'
ORDER = ['조광요턴', '동화엔텍', '태광후지킨', '파나시아', '송원산업', '지엠비코리아', '해성디에스', '넥센타이어', 'BHI', 'TKG태광']
EXTRA = [('통계·인용·공모전 사실', '통계_인용_공모전')]


def num(pat, text):
    m = re.search(pat, text)
    return int(m.group(1)) if m else None


def first(path):
    line = next((l for l in path.read_text(encoding='utf-8').splitlines() if '통계:' in l and '확인(2+)' in l), None)
    if not line:
        raise SystemExit(f'통계 줄이 없다: {path.name}')
    r = {
        'n': num(r'사실(?: 묶음)? (\d+)개', line), 'two': num(r'확인\(2\+\) (\d+)', line), 'one': num(r'확인\(1\) (\d+)', line),
        'mismatch': num(r'불일치 (\d+)', line), 'na': num(r'확인 불가 (\d+)', line), 'stale': num(r'기준일 지남 (\d+)', line),
    }
    if None in r.values() or r['two'] + r['one'] + r['mismatch'] + r['na'] + r['stale'] != r['n']:
        raise SystemExit(f'통계 합이 맞지 않는다: {path.name} {r}')
    return r


def second(path):
    # 2차 결과는 '<기업>.2차.md'에 있거나, 없으면 '<기업>.md' 끝의 '2차 출처 보강' 절에 있다
    if not path.exists():
        path = path.with_name(path.name.replace('.2차.md', '.md'))
    text = path.read_text(encoding='utf-8')
    line = next((l for l in text.splitlines() if '확인(1) 총' in l and '2차 확인' in l and '원천 1개' in l), None)
    if not line:
        return None
    r = {
        'n': num(r'총 (\d+)개', line), 'confirmed': num(r'2차 확인 (\d+)', line), 'single_origin': num(r'원천 1개 (\d+)', line),
        'not_found': num(r'2차 못 찾음 (\d+)', line), 'mismatch': num(r'불일치 발견 (\d+)', line), 'unreviewed': num(r'미검토 (\d+)', line) or 0,
    }
    if None in (r['n'], r['confirmed'], r['single_origin'], r['not_found'], r['mismatch']):
        return None
    if r['confirmed'] + r['single_origin'] + r['not_found'] + r['mismatch'] + r['unreviewed'] != r['n']:
        raise SystemExit(f'2차 통계 합이 맞지 않는다: {path.name} {r}')
    return r


def main():
    rows = []
    for label, stem in [(k, k) for k in ORDER] + EXTRA:
        r = first(XV / f'{stem}.md')
        r['label'] = label
        r['second'] = second(XV / f'{stem}.2차.md')
        rows.append(r)
    keys = ['n', 'two', 'one', 'mismatch', 'na', 'stale']
    total = {k: sum(r[k] for r in rows) for k in keys}
    sec = [r['second'] for r in rows if r['second']]
    total['second'] = ({k: sum(s[k] for s in sec) for k in ['n', 'confirmed', 'single_origin', 'not_found', 'mismatch', 'unreviewed']} | {'files': len(sec)}) if sec else None
    out = {'date': '2026. 11. 10.', 'rows': rows, 'total': total}
    (HERE / 'xv_summary.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print('xv_summary.json', total)


if __name__ == '__main__':
    main()
