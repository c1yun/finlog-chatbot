"""결과보고서 원고 점검: 출처 번호 범위, 출처 없는 사실 문장, 공개 원칙 금지어, 분량."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
BAN = ['의혹', '내부용', '미게재', '카더라', '익명 후기', '평균 연봉']
QUOTE = re.compile(r'[“”"]([^“”"]{12,})[“”"]')  # 긴 직접 인용(후기 문장 의심)
REF = re.compile(r'\[(\d+)\]')

problems = 0


def warn(k, msg):
    global problems
    problems += 1
    print(f'  [{k}] {msg}')


def texts(c):
    """(위치, 문장) 목록"""
    out = [(f'intro:{l}', v) for l, v in c['intro']]
    for b in c['analysis']:
        for i, pt in enumerate(b['points']):
            out.append((f'{b["title"]}#{i + 1}', pt['t']))
            out += [(f'{b["title"]}#{i + 1}.sub', s) for s in pt.get('sub', [])]
    for j in c['jobs']:
        out += [(f'job:{j["name"][:10]}:{k}', v) for k, v in j.items() if k != 'name']
    for k, arr in c['swot'].items():
        out += [(f'swot:{k}', s) for s in arr]
    for x in c['ideas']:
        out += [(f'idea:{x["title"][:10]}:{k}', v) for k, v in x.items()]
    for r in c['plan8']['rows']:
        out += [(f'plan8:{r[0]}', s) for s in r[1:]]
    out += [('pending', s) for s in c['pending']]
    out.append(('reputation', c['reputation']))
    out.append(('finance.note', c['finance'].get('note', '')))
    return out


for f in sorted((HERE / 'companies').glob('*.json')):
    c = json.loads(f.read_text(encoding='utf-8'))
    k = c['key']
    n = len(c['sources'])
    print(f'{k}: 출처 {n}개')
    for where, s in texts(c):
        for m in REF.finditer(s):
            if not 1 <= int(m.group(1)) <= n:
                warn(k, f'{where}: 출처 번호 [{m.group(1)}] 범위 밖')
        for b in BAN:
            if b in s:
                warn(k, f'{where}: 금지어 \'{b}\' — {s[:60]}')
        if QUOTE.search(s):
            warn(k, f'{where}: 긴 직접 인용 — {QUOTE.search(s).group(0)[:60]}')
    # 분석 문장은 사실이면 출처가 있어야 한다('확인 필요'·'찾지 못했다'는 예외)
    for b in c['analysis']:
        for i, pt in enumerate(b['points']):
            if not REF.search(pt['t']) and not re.search(r'확인(이)? 필요|찾지 못했|공개 정보 없음', pt['t']) and b['title'] != '부산대 학생에게 적합한 이유':
                warn(k, f'{b["title"]}#{i + 1}: 출처 번호 없음 — {pt["t"][:50]}')
    for label, v in c['intro']:
        if label not in ('홈페이지',) and not REF.search(v):
            warn(k, f'intro:{label}: 출처 번호 없음')
    used = {int(x) for _, s in texts(c) for x in REF.findall(s)}
    unused = [i for i in range(1, n + 1) if i not in used]
    if unused:
        warn(k, f'본문에서 쓰지 않은 출처 {unused}')
    npts = sum(len(b['points']) for b in c['analysis'])
    if npts > 22:
        warn(k, f'분석 문장 {npts}개(22개 초과)')

print('문제', problems, '건')
sys.exit(1 if problems else 0)
