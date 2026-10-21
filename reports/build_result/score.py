"""채점 파일(_채점A·_채점B·_채점조정)을 읽어 기업별 점수를 계산하고 scores.json으로 쓴다.

규칙(연구계획서 Ⅴ-2, 부록 1)
- 세부 항목 점수 = 배점 × 판정(0~5) ÷ 5. 미확인 항목은 0점이 아니라 '채점 안 함'
- 확인 득점·확인 배점 → 환산점수 = 확인 득점 ÷ 확인 배점 × 100, 하한 = 확인 득점, 상한 = 하한 + 미확인 배점
- 정보 충족률 = 확인 배점 ÷ 100 (70% 미만은 TOP3 후보 제외)
- 2인 평가: 항목 판정은 두 평가자의 평균. _채점조정.md의 제3 평가자 판정이 있으면 그 항목은 조정값을 쓴다.
"""
import json
import re
import sys
from pathlib import Path

NOTES = Path('/home/user/finlog-chatbot/research_notes/결과보고서 기업 분석')
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


def compute(judg):
    """judg: {항목: 판정 또는 None} → 영역별·전체 점수"""
    areas = []
    got = conf = 0.0
    for a, aw, subs in AREAS:
        ag = ac = 0.0
        items = []
        for n, w in subs:
            j = judg[n]
            s = None if j is None else w * j / 5
            items.append({'name': n, 'w': w, 'j': j, 's': s})
            if s is not None:
                ag += s
                ac += w
        areas.append({'name': a, 'w': aw, 'got': round(ag, 2), 'conf': ac, 'items': items})
        got += ag
        conf += ac
    return {
        'areas': areas, 'got': round(got, 2), 'conf': conf,
        'scaled': round(got / conf * 100, 1) if conf else None,
        'low': round(got, 1), 'high': round(got + (100 - conf), 1), 'fill': round(conf / 100, 2),
    }


def main():
    out = {}
    for key in ORDER:
        fa = NOTES / f'{key}_채점A.md'
        if not fa.exists():
            continue
        A = parse(fa)
        fb = NOTES / f'{key}_채점B.md'
        B = parse(fb) if fb.exists() else None
        adj = parse_adjust(NOTES / f'{key}_채점조정.md')
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
                        final[n] = None if (ja is None or jb is None) else (ja + jb) / 2
                    else:
                        final[n] = (ja + jb) / 2
                    if ja is not None and jb is not None:
                        n_both += 1
                        same += ja == jb
                        near += abs(ja - jb) <= 1
                agree[a] = {'items': n_both, 'same': same, 'near': near}
            rec['final'] = compute(final)
            rec['agree'] = agree
            # 영역 점수 차 2점 이상(제3 평가자 검토 대상)
            rec['gap_areas'] = [x['name'] for x, y in zip(rec['A']['areas'], rec['B']['areas'])
                                if abs(x['got'] - y['got']) >= 2 or x['conf'] != y['conf']]
            rec['adjusted'] = sorted(adj)
        else:
            rec['final'] = rec['A']
        out[key] = rec
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for k, r in out.items():
        f = r['final']
        tag = 'A+B' if 'B' in r else 'A만'
        print(f"{k:8s} {tag:4s} 환산 {f['scaled']:5.1f}  충족 {f['fill']:.2f}  범위 {f['low']:.1f}~{f['high']:.1f}  "
              + ' '.join(f"{a['name'][:2]}{a['got']:.1f}/{a['conf']:.0f}" for a in f['areas'])
              + (f"  차이영역 {r['gap_areas']}" if r.get('gap_areas') else ''))


if __name__ == '__main__':
    main()
