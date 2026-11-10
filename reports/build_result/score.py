"""채점 파일(_채점A·_채점B·_채점조정)을 읽어 기업별 점수를 계산하고 scores.json으로 쓴다.

규칙(연구계획서 Ⅴ-2, 부록 1)
- 세부 항목 점수 = 배점 × 판정(0~5) ÷ 5. 미확인 항목은 0점이 아니라 '채점 안 함'
- 확인 득점·확인 배점 → 환산점수 = 확인 득점 ÷ 확인 배점 × 100, 하한 = 확인 득점, 상한 = 하한 + 미확인 배점
- 정보 충족률 = 확인 배점 ÷ 100 (70% 미만은 TOP3 후보 제외)
- 2인 평가: 항목 판정은 두 평가자의 평균. _채점조정.md의 제3 평가자 판정이 있으면 그 항목은 조정값을 쓴다.
- 규칙 통일 재채점(_재채점_*.md, 2026-11-03 '찾지 못함은 미확인'): 기업·항목별 최종 판정이 있으면 위 값보다 앞선다.
- 2026-11-10 마무리 규칙(교차검증 2026-11/보상_2차자료_판정규칙.md)
  · 재채점 파일의 최종 판정 칸에 '2차 자료'라고 적힌 판정은 원문(공고·공시)이 아닌 2차 자료로 한 판정이다(src = sec).
  · 그래도 판정이 없는 항목은 그 항목을 판정받은 기업들의 평균 판정(소수 첫째 자리)으로 채운다(src = imp).
  · final은 이렇게 18개 항목을 모두 채운 점수다. 원문으로 확인한 항목만의 값도 함께 남긴다:
    docconf(원문 확인 배점), fill(= docconf ÷ 100), scaled_doc(연구계획서의 환산점수), low·high(원문 미확인을 0점·만점으로 둘 때).
"""
import json
import re
import sys
from pathlib import Path

NOTES = Path(__file__).resolve().parents[2] / 'research_notes' / '결과보고서 기업 분석'
OUT = Path(__file__).with_name('scores.json')

ORDER = ['조광요턴', '동화엔텍', '태광후지킨', '파나시아', '송원산업',
         '지엠비코리아', '해성디에스', '넥센타이어', 'BHI', 'TKG태광']

AREAS = [
    ('직무 연계', 25, [('학사 신입 진입 경로·반복성', 10), ('전공·교과 연결과 요건 명확성', 8), ('교육·경력개발', 7)]),
    ('보상·근무', 25, [('보상', 10), ('고용 안정', 5), ('근로시간·교대·출장·휴가', 5), ('복지(통근·주거·교육 지원)', 5)]),
    ('성장·지속성', 20, [('3년 실적 추이', 8), ('현금흐름·재무 안정성', 6), ('수주·고객·산업 전망', 6)]),
    ('기술·경쟁력', 15, [('핵심 제품·기술 차별성', 6), ('연구개발·인증·특허', 5), ('납품 실적·시장 지위', 4)]),
    ('해외·경력', 5, [('해외 매출·거점', 3), ('신입의 해외 업무·어학 활용', 2)]),
    ('ESG·지역', 10, [('노동·안전', 4), ('환경·윤리·지배구조', 3), ('지역 고용·대학 연계', 3)]),
]
ITEMS = {f'{n}({w})': (a, n, w) for a, _, subs in AREAS for n, w in subs}
ITEMS['복지(통근·주거·교육)(5)'] = ITEMS['복지(통근·주거·교육 지원)(5)']  # 표기 변형


def clean(c):
    return re.sub(r'\*\*|`', '', c).strip()


def parse(path):
    """{항목명: 판정(float) 또는 None(미확인)}"""
    res = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.startswith('|'):
            continue
        cells = [clean(c) for c in line.strip().strip('|').split('|')]
        for i, c in enumerate(cells):
            if c in ITEMS and i + 1 < len(cells):
                name = ITEMS[c][1]
                if name in res:
                    break
                j = cells[i + 1]
                status = next((x for x in cells[i + 2:] if x in ('확인', '미확인')), None)
                m = re.match(r'^(\d+(?:\.\d+)?)', j)
                if status == '미확인' or not m:
                    res[name] = None
                else:
                    res[name] = float(m.group(1))
                break
    missing = [n for _, _, subs in AREAS for n, _ in subs if n not in res]
    if missing:
        sys.exit(f'{path.name}: 항목을 찾지 못함 {missing}')
    return res


def parse_adjust(path):
    """_채점조정.md: '| 항목명(배점) | 제3 판정 | ...' 행. 판정 칸이 '미확인'이면 None"""
    if not path.exists():
        return {}
    res = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.startswith('|'):
            continue
        cells = [clean(c) for c in line.strip().strip('|').split('|')]
        for i, c in enumerate(cells):
            if c in ITEMS and i + 1 < len(cells):
                v = cells[i + 1]
                m = re.match(r'^(\d+(?:\.\d+)?)', v)
                res[ITEMS[c][1]] = float(m.group(1)) if m else None
                break
    return res


def parse_recheck():
    """_재채점_*.md: '| 기업 | 세부 항목(배점) | 최종 판정 | ...' 행 → ({기업: {항목: 판정 또는 None}}, {기업: {2차 자료로 판정한 항목}})"""
    res = {}
    sec = {}
    for path in sorted(NOTES.glob('_재채점_*.md')):
        for line in path.read_text(encoding='utf-8').splitlines():
            if not line.startswith('|'):
                continue
            cells = [clean(c) for c in line.strip().strip('|').split('|')]
            if len(cells) < 3 or cells[0] not in ORDER or cells[1] not in ITEMS:
                continue
            m = re.match(r'^(\d+(?:\.\d+)?)', cells[2])
            name = ITEMS[cells[1]][1]
            res.setdefault(cells[0], {})[name] = float(m.group(1)) if m else None
            if m and '2차 자료' in cells[2]:
                sec.setdefault(cells[0], set()).add(name)
            else:
                sec.setdefault(cells[0], set()).discard(name)
    return res, sec


def compute(judg, src=None):
    """judg: {항목: 판정 또는 None}, src: {항목: 'sec'|'imp'}(없으면 원문 판정 'doc') → 영역별·전체 점수"""
    src = src or {}
    areas = []
    got = conf = dgot = dconf = 0.0
    for a, aw, subs in AREAS:
        ag = ac = adw = 0.0
        items = []
        for n, w in subs:
            j = judg[n]
            s = None if j is None else w * j / 5
            kind = None if j is None else src.get(n, 'doc')
            items.append({'name': n, 'w': w, 'j': j, 's': s, 'src': kind})
            if s is not None:
                ag += s
                ac += w
                if kind == 'doc':
                    adw += w
                    dgot += s
        areas.append({'name': a, 'w': aw, 'got': round(ag, 2), 'conf': ac, 'docw': adw, 'items': items})
        got += ag
        conf += ac
        dconf += adw
    return {
        'areas': areas, 'got': round(got, 2), 'conf': conf,
        'scaled': round(got / conf * 100, 1) if conf else None,
        'docgot': round(dgot, 2), 'docconf': dconf,
        'scaled_doc': round(dgot / dconf * 100, 1) if dconf else None,
        'low': round(dgot, 1), 'high': round(dgot + (100 - dconf), 1), 'fill': round(dconf / 100, 2),
    }


def main():
    out = {}
    recheck, sec = parse_recheck()
    finals = {}
    for key in ORDER:
        fa = NOTES / f'{key}_채점A.md'
        if not fa.exists():
            continue
        A = parse(fa)
        fb = NOTES / f'{key}_채점B.md'
        B = parse(fb) if fb.exists() else None
        adj = parse_adjust(NOTES / f'{key}_채점조정.md')
        adj.update(recheck.get(key, {}))
        rec = {'A': compute(A)}
        if B:
            rec['B'] = compute(B)
            final = {}
            agree = {}
            for a, _, subs in AREAS:
                same = near = n_both = 0
                for n, _w in subs:
                    ja, jb = A[n], B[n]
                    if n in adj:
                        final[n] = adj[n]
                    elif ja is None or jb is None:
                        # 한 사람만 확인한 항목은 조정 파일에서 정한다. 없으면 미확인으로 둔다.
                        final[n] = None
                    else:
                        final[n] = (ja + jb) / 2
                    if ja is not None and jb is not None:
                        n_both += 1
                        same += ja == jb
                        near += abs(ja - jb) <= 1
                agree[a] = {'items': n_both, 'same': same, 'near': near}
            rec['agree'] = agree
            # 영역 점수 차 2점 이상(제3 평가자 검토 대상)
            rec['gap_areas'] = [x['name'] for x, y in zip(rec['A']['areas'], rec['B']['areas'])
                                if abs(x['got'] - y['got']) >= 2 or x['conf'] != y['conf']]
            rec['adjusted'] = sorted(adj)
        else:
            final = dict(A)
        finals[key] = final
        out[key] = rec

    # 판정이 없는 항목은 그 항목을 판정받은 기업들의 평균(소수 첫째 자리)으로 채운다
    names = [n for _, _, subs in AREAS for n, _ in subs]
    mean = {}
    for n in names:
        v = [f[n] for f in finals.values() if f[n] is not None]
        mean[n] = round(sum(v) / len(v) + 1e-9, 1) if v else None
    for key, final in finals.items():
        src = {n: 'sec' for n in sec.get(key, set()) if final[n] is not None}
        filled = dict(final)
        for n in names:
            if filled[n] is None and mean[n] is not None:
                filled[n] = mean[n]
                src[n] = 'imp'
        out[key]['final'] = compute(filled, src)
        out[key]['sec'] = sorted(n for n, v in src.items() if v == 'sec')
        out[key]['imputed'] = sorted(n for n, v in src.items() if v == 'imp')
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for k, r in out.items():
        f = r['final']
        tag = 'A+B' if 'B' in r else 'A만'
        print(f"{k:8s} {tag:4s} 점수 {f['scaled']:5.1f}  원문환산 {f['scaled_doc']:5.1f}  충족 {f['fill']:.2f}  범위 {f['low']:.1f}~{f['high']:.1f}  "
              + ' '.join(f"{a['name'][:2]}{a['got']:.1f}/{a['docw']:.0f}" for a in f['areas'])
              + (f"  2차 {r['sec']}" if r['sec'] else '') + (f"  평균대체 {r['imputed']}" if r['imputed'] else ''))


if __name__ == '__main__':
    main()
