#!/usr/bin/env python3
"""원문 대조 시트 생성 — TOP3 후보 4곳의 핵심 판정을 팀원 4명이 출처 원문과 대조한다.

대상: 배점 5점 이상 세부 항목 중 최종 판정이 있는 것(미확인 제외).
입력: research_notes/결과보고서 기업 분석/{기업}.md(사실 목록), {기업}_채점A.md·_채점B.md(판정·근거·이유),
      reports/build_result/scores.json(최종 판정: 채점조정·재채점 반영).
출력: xlsx 한 개(탭: 안내, 원문 대조). 구글 드라이브에 올리면 구글 시트로 바뀐다.
사용: python3 build_source_check.py OUT.xlsx [--check]
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
NOTES = ROOT / 'research_notes' / '결과보고서 기업 분석'
SCORES = json.loads((HERE / 'scores.json').read_text(encoding='utf-8'))

ASSIGN = [('동화엔텍', '강현민'), ('BHI', '김채현'), ('태광후지킨', '고종범'), ('지엠비코리아', '권민재')]
MIN_W = 5
MAX_LINKS = 3
FACT_CHARS = 1000

DH_SR = 'https://www.dh.co.kr/sustainable_management/2026%EC%A7%80%EC%86%8D%EA%B0%80%EB%8A%A5%EA%B2%BD%EC%98%81%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf'

# 사실의 출처 칸에 링크가 없을 때 쓰는 문서별 원문 주소(각 기업 노트의 출처 목록에서 옮김).
# (찾을 말, 링크 이름, 주소) — 앞에서부터 처음 맞는 것을 쓴다.
DOCS = {
    '동화엔텍': [
        ('지속가능경영보고서', '동화엔텍 2026 지속가능경영보고서(PDF)', DH_SR),
        ('공고 이미지', '사람인 공고 55274385(본문 이미지)', 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=55274385'),
        ('saramin_동화엔텍', '사람인 공고 55274385', 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=55274385'),
        ('연결', 'DART 연결감사보고서 FY2025', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260422000370'),
        ('감사보고서', 'DART 감사보고서(별도) FY2025', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260320000292'),
    ],
    'BHI': [
        ('반기보고서', 'DART 2026 반기보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000764'),
        ('사업보고서', 'DART 2025 사업보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260320000821'),
        ('단일판매', 'DART 단일판매·공급계약 공시(2026-07-27)', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260727900206'),
        ('잡코리아', '잡코리아 공고 49823774', 'https://www.jobkorea.co.kr/Recruit/GI_Read/49823774'),
        ('공고 이미지', '잡코리아 공고 49823774(본문 이미지)', 'https://file1.jobkorea.co.kr/Mng/2026/10/bumw00_1001_0.jpg'),
        ('menu', 'BHI 홈페이지', 'https://www.bhi.co.kr/menu1_3'),
        ('홈페이지', 'BHI 홈페이지', 'https://www.bhi.co.kr/menu1_3'),
        ('벤처스퀘어', '벤처스퀘어 2026-09-12', 'https://www.venturesquare.net/1112895/'),
        ('아시아경제', '아시아경제 2026-09-17', 'https://core.asiae.co.kr/article/2026091708423848993'),
        ('자소설', '자소설닷컴 BHI 공고 이력', 'https://jasoseol.com/companies/2022/careers'),
        ('경북매일', '경북매일 2009-05', 'https://kbmaeil.com/article/200905251285525'),
    ],
    '태광후지킨': [
        ('2024 감사보고서', 'DART 2024 감사보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250408000333'),
        ('감사보고서', 'DART 2025 감사보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260407001130'),
        ('부산시 보도자료', '부산시 보도자료 2021-05-17', 'https://www.busan.go.kr/biz/community04/1488552?curPage=88'),
        ('노컷', '노컷뉴스 2024-10-15', 'https://www.nocutnews.co.kr/news/6227213'),
        ('부산일보', '부산일보 2026-01-21', 'https://www.busan.com/view/busan/view.php?code=2026011418544372629'),
        ('홈페이지', '태광후지킨 홈페이지', 'https://www.tk-fujikin.com'),
        ('주석', 'DART 2025 감사보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260407001130'),
    ],
    '지엠비코리아': [
        ('반기보고서', 'DART 2026 반기보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814001700'),
        ('사업보고서', 'DART 2025 사업보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260320001109'),
        ('신용', 'DART 2025 사업보고서', 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260320001109'),
    ],
}

GUIDE = [
    '간판떼고 원문 대조 — TOP3 후보 4곳의 핵심 판정(배점 5점 이상)을 팀원이 출처 원문과 대조합니다.',
    '',
    '1. 내 이름이 적힌 11줄만 보면 됩니다(1인 30~40분). 마감: 11월 12일(목) 밤.',
    "2. '근거 사실' 칸의 ①②③ 표시는 오른쪽 '원문 ①②③' 링크와 짝입니다. 링크를 열어 숫자·날짜·조건이 원문과 같은지 봅니다.",
    "3. '확인 결과'에서 맞음 / 다름 / 원문 못 찾음 중 하나를 고르고, 다르거나 못 찾았으면 메모에 원문 내용(쪽·문장)을 적습니다.",
    '4. 판정(0~5)이 기준에 비해 너무 높거나 낮다고 생각되면 메모에 이유를 적습니다. 점수는 직접 바꾸지 않습니다(팀장이 모아 다시 판단).',
    "5. 공고 링크가 여러 개인 줄은 3건만 골라 확인해도 됩니다(메모에 확인한 번호, 예: ①③⑤). 공고가 마감돼 링크가 열리지 않으면 '원문 못 찾음'으로 두고 메모에 '마감'이라고 적습니다. DART 링크는 왼쪽 목차에서 해당 장(예: II-6)을 누르면 됩니다.",
    "6. '?' 표시는 조사 때 찾지 못한 내용입니다. 원문을 찾으면 메모에 링크를 적어 주세요(점수에 반영될 수 있습니다). '·' 표시는 이전 조사 노트의 정리로, 링크가 없어 확인 대상이 아닙니다.",
    '',
    '이 시트의 결과는 결과보고서 Ⅰ장 「조사 방법」의 "팀원이 원문과 대조한 범위"에 실제 확인한 줄 수로만 적습니다.',
]


URL_RE = re.compile(r'\[([^\]]+)\]\((https?://[^)\s]+)\)|(https?://[^\s)\]>,|`]+)')


def split_row(line):
    cells = re.split(r'(?<!\\)\|', line.strip())
    if cells and cells[0] == '':
        cells = cells[1:]
    if cells and cells[-1] == '':
        cells = cells[:-1]
    return [c.strip().replace('\\|', '|') for c in cells]


def plain(s):
    s = re.sub(r'\[([^\]]+)\]\((https?://[^)\s]+)\)', r'\1', s)
    s = s.replace('**', '').replace('`', '')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def parse_facts(md):
    """F 번호 → {'text': 본문, 'src': 출처 부분(링크 포함 원문), 'level': 확인 수준, 'head': 절 제목}"""
    facts = {}
    cur = None
    head = ''
    for ln in md.split('\n'):
        if re.match(r'^\s*#', ln):
            head = ln.strip('# ').strip()
            cur = None
            continue
        m = re.match(r'^\|\s*F(\d+)\s*\|', ln)
        if m:
            cur = None
            cells = split_row(ln)[1:]
            n = int(m.group(1))
            if len(cells) >= 3 and re.search(r'확인|검색|미확인', cells[-1]):
                text, src, level = ' / '.join(cells[:-2]), cells[-2], cells[-1]
            else:  # 공고 표처럼 칸마다 값이 있는 행
                text, src, level = ' | '.join(cells), ' '.join(cells), '확인(원문)'
            facts.setdefault(n, {'text': text, 'src': src, 'level': level, 'head': head, 'full': src})
            continue
        m = re.match(r'^\s*[-*]\s+\*\*F(\d+)\*\*\s*(.*)$', ln)
        if m:
            cur = int(m.group(1))
            if cur in facts:  # 같은 번호가 다시 나오면 처음 것을 쓴다
                cur = None
                continue
            facts[cur] = {'raw': m.group(2), 'more': [], 'head': head}
            continue
        if cur is not None:
            if re.match(r'^\s*---\s*$', ln):
                cur = None
            elif re.match(r'^\s*\|?\s*:?-{3,}', ln):
                continue
            elif ln.strip():
                facts[cur]['more'].append(ln.strip())
    for n, f in facts.items():
        if 'raw' not in f:
            continue
        first = f.pop('raw').strip()
        more = f.pop('more')
        full = '\n'.join([first] + more)
        lv = re.findall(r'\*\*((?:확인|검색 요약|미확인|찾지 못함)[^*]*)\*\*', full)
        level = lv[0] if lv else ''
        if level.startswith('찾지 못함'):
            level = '미확인(찾지 못함)'
        parts = re.split(r'\s—\s', first, maxsplit=1)  # 본문 — 출처
        text = parts[0]
        if more:
            text += ' ' + ' '.join(re.sub(r'^[-*]\s+', '· ', x) for x in more)
        src = (parts[1] if len(parts) > 1 else '') + ' ' + ' '.join(more)
        f.update({'text': text, 'src': src.strip() or first, 'level': level, 'full': full})
    return facts


URL_LABEL = {}


def load_labels():
    for company, _ in ASSIGN:
        d = json.loads((HERE / 'companies' / f'{company}.json').read_text(encoding='utf-8'))
        for src in d.get('sources', []):
            if len(src) >= 3 and src[2]:
                URL_LABEL.setdefault(src[2], src[0])
    for company, docs in DOCS.items():
        for _, label, url in docs:
            URL_LABEL.setdefault(url, label)


def nice_label(label, url):
    m = re.search(r'(saramin|jobkorea)\.co\.kr/.*?(?:rec_idx=|GI_Read/)(\d+)', url)
    if m:  # 공고는 한 건씩 번호로 부른다(보고서 출처의 '공고 n건' 묶음 이름을 쓰지 않음)
        return ('사람인 공고 ' if m.group(1) == 'saramin' else '잡코리아 공고 ') + m.group(2)
    if url in URL_LABEL:
        return URL_LABEL[url]
    site = {'saramin.co.kr': '사람인 공고', 'jobkorea.co.kr': '잡코리아 공고', 'dart.fss.or.kr': 'DART 공시'}
    host = re.sub(r'^https?://(www\.)?', '', url).split('/')[0]
    if label and re.fullmatch(r'[\d\s]+', label):
        return f"{site.get(host, host)} {label.strip()}"
    if host == 'dart.fss.or.kr' and label:
        return f'DART {label}'
    return label or site.get(host, host)


def direct_links(f):
    out = []
    for m in URL_RE.finditer(f['full']):
        label, url = (m.group(1), m.group(2)) if m.group(2) else (None, m.group(3))
        url = url.rstrip('.,;:')
        if '<' in url or url.endswith('rec_idx='):
            continue
        if url not in [u for _, u in out]:
            out.append((nice_label(label or '', url), url))
    return out


def fact_links(company, facts, n, depth=0):
    """사실 하나의 원문 링크 목록 [(이름, 주소)]. 링크가 없으면 참조한 사실·같은 공고·문서 이름 순으로 찾는다."""
    f = facts[n]
    out = direct_links(f)
    if out or depth > 1:
        return out
    refs = [int(x) for x in re.findall(r'F(\d+)', f['src']) if int(x) != n and int(x) in facts]
    for r in dict.fromkeys(refs):
        for l in fact_links(company, facts, r, depth + 1)[:1]:
            if l not in out:
                out.append(l)
    if out:
        return out
    if re.search(r'같은 (공고|표|보고서|자료)', f['src']):
        for back in range(n - 1, max(0, n - 6), -1):
            if back in facts:
                got = fact_links(company, facts, back, depth + 1)
                if got:
                    return got[:1]
    for hay in (f['src'] + ' ' + f['text'], f.get('head', '')):
        for key, label, url in DOCS.get(company, []):
            if key in hay:
                return [(nice_label(label, url), url)]
    return []


def locator(src):
    """출처 칸에서 쪽·장 표시만 뽑는다(예: 40~43쪽, II-6, 주석 16)."""
    bits = re.findall(r'\d+(?:~\d+)?쪽(?:,\s*\d+(?:~\d+)?쪽)*|[IVX]+-\d+(?:\(\d+\))?(?:[·~][IVX]*-?\d+)*|주석\s*\d+', src)
    return ', '.join(dict.fromkeys(bits))


def expand_refs(s):
    ids = []
    for a, b in re.findall(r'F(\d+)\s*(?:~\s*F?(\d+))?', s or ''):
        a = int(a)
        b = int(b) if b else a
        ids.extend(range(a, b + 1) if b >= a and b - a < 15 else [a])
    return ids


def norm_item(name):
    return re.sub(r'\s+', '', re.split(r'\(', name, maxsplit=1)[0])


def parse_judgments(md):
    """세부 항목 → {'j': 판정, 'refs': [F], 'why': 이유}"""
    out = {}
    hdr = None
    for ln in md.split('\n'):
        if ln.startswith('|') and '세부 항목' in ln and '판정' in ln and '근거' in ln:
            hdr = split_row(ln)
            continue
        if hdr is None:
            continue
        if not ln.startswith('|'):
            hdr = None
            continue
        cells = split_row(ln)
        if all(set(c) <= set('-: ') for c in cells):
            continue
        d = dict(zip(hdr, cells))
        col = lambda pre: next((v for k, v in d.items() if k.startswith(pre)), '')
        item = col('세부 항목')
        if not item:
            continue
        out[norm_item(item)] = {'j': col('판정').split()[0] if col('판정') else '', 'refs': expand_refs(col('근거')), 'why': plain(col('판정 이유') or col('판정 사유'))}
    return out


def recheck_rows():
    rows = {}
    for p in sorted(NOTES.glob('_재채점_*.md')):
        for ln in p.read_text(encoding='utf-8').split('\n'):
            c = split_row(ln) if ln.startswith('|') else []
            if len(c) >= 6 and c[0] not in ('기업', '---') and not set(c[0]) <= set('-: '):
                rows[(c[0], norm_item(c[1]))] = (c[2], plain(c[5]), p.stem.replace('_재채점_', ''))
    return rows


def fmt_j(j):
    if j is None:
        return '미확인'
    return str(int(j)) if float(j).is_integer() else f'{j:.1f}'


def short(s, n=FACT_CHARS):
    s = plain(s)
    return s if len(s) <= n else s[:n - 1].rstrip() + '…'


def build_rows():
    RE = recheck_rows()
    load_labels()
    rows = []
    for company, member in ASSIGN:
        facts = parse_facts((NOTES / f'{company}.md').read_text(encoding='utf-8'))
        A = parse_judgments((NOTES / f'{company}_채점A.md').read_text(encoding='utf-8'))
        B = parse_judgments((NOTES / f'{company}_채점B.md').read_text(encoding='utf-8'))
        for area in SCORES[company]['final']['areas']:
            for it in area['items']:
                if it['w'] < MIN_W or it['j'] is None:
                    continue
                key = norm_item(it['name'])
                a, b = A.get(key), B.get(key)
                if not a or not b:
                    raise SystemExit(f'채점 파일에서 항목을 못 찾음: {company} {it["name"]}')
                why = [f'1차({a["j"]}): {a["why"]}', f'2차({b["j"]}): {b["why"]}']
                rc = RE.get((company, key))
                if rc:
                    why.append(f'재채점({rc[2]}, {rc[0]}): {rc[1]}')
                refs = sorted(set(a['refs']) | set(b['refs']))
                docs = []  # [(이름, 주소, [F 번호], 위치)]
                lines = []
                missing = []
                for n in refs:
                    f = facts.get(n)
                    if not f:
                        missing.append(n)
                        continue
                    links = fact_links(company, facts, n)
                    if not links:
                        tag = '?' if (f.get('level') or '').startswith('미확인') else '·'
                    else:
                        label, url = links[0]
                        idx = next((i for i, d in enumerate(docs) if d[1] == url), None)
                        if idx is None:
                            docs.append([label, url, [], set()])
                            idx = len(docs) - 1
                        docs[idx][2].append(n)
                        loc = locator(f['src'])
                        if loc:
                            docs[idx][3].add(loc)
                        tag = '①②③④⑤⑥⑦⑧⑨⑩'[idx] if idx < 10 else f'[{idx + 1}]'
                    lv = '' if (f.get('level') or '').startswith('확인') else f" [{f.get('level') or '확인 수준 표시 없음'}]"
                    lines.append(f'{tag} F{n}: {short(f["text"])}{lv}')
                if missing:
                    lines.append('(노트에 없는 번호: ' + ', '.join(f'F{n}' for n in missing) + ')')
                rows.append({
                    'member': member, 'company': company, 'item': f'{it["name"]}({it["w"]})', 'j': fmt_j(it['j']),
                    'why': '\n'.join(why), 'facts': '\n'.join(lines), 'docs': docs,
                })
    return rows


def link_label(d, i):
    label = d[0] or re.sub(r'^https?://(www\.)?', '', d[1]).split('/')[0]
    loc = ', '.join(sorted(d[3]))
    tag = '①②③④⑤⑥⑦⑧⑨⑩'[i] if i < 10 else f'[{i + 1}]'
    return f'{tag} {label}' + (f' ({loc})' if loc else '')


def write_xlsx(rows, out):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
    from openpyxl.worksheet.datavalidation import DataValidation

    wb = Workbook()
    ws0 = wb.active
    ws0.title = '안내'
    guide = GUIDE
    for i, t in enumerate(guide, 1):
        ws0.cell(row=i, column=1, value=t).alignment = Alignment(wrap_text=True, vertical='top')
    ws0.column_dimensions['A'].width = 120
    ws0['A1'].font = Font(bold=True, size=12)

    ws = wb.create_sheet('원문 대조')
    cols = ['번호', '담당', '기업', '세부 항목(배점)', '최종 판정(0~5)', '판정 이유(1차·2차 채점)', '근거 사실',
            '원문 ①', '원문 ②', '원문 ③', '확인 결과', '메모', '확인일']
    widths = [6, 8, 11, 22, 9, 60, 70, 26, 26, 26, 12, 36, 11]
    head = PatternFill('solid', fgColor='DCE6F1')
    thin = Side(style='thin', color='BFBFBF')
    for c, (name, w) in enumerate(zip(cols, widths), 1):
        cell = ws.cell(row=1, column=c, value=name)
        cell.font = Font(bold=True)
        cell.fill = head
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws.column_dimensions[cell.column_letter].width = w
    band = {m: PatternFill('solid', fgColor=col) for (_, m), col in zip(ASSIGN, ['FFFFFF', 'F7F9FC', 'FFFFFF', 'F7F9FC'])}
    for r, row in enumerate(rows, 2):
        vals = [r - 1, row['member'], row['company'], row['item'], row['j'], row['why'], row['facts']]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = Alignment(wrap_text=True, vertical='top', horizontal='center' if c in (1, 2, 5) else 'left')
        docs = row['docs']
        for i in range(MAX_LINKS):
            cell = ws.cell(row=r, column=8 + i)
            if i < len(docs):
                d = docs[i]
                label = link_label(d, i)
                if i == MAX_LINKS - 1 and len(docs) > MAX_LINKS:
                    label += f' 외 {len(docs) - MAX_LINKS}건(근거 사실 칸 번호 참고)'
                cell.value = f'=HYPERLINK("{d[1]}","{label.replace(chr(34), chr(39))}")'
                cell.font = Font(color='1155CC', underline='single')
            cell.alignment = Alignment(wrap_text=True, vertical='top')
        for c in range(1, len(cols) + 1):
            ws.cell(row=r, column=c).border = Border(top=thin, bottom=thin, left=thin, right=thin)
            if c not in range(8, 11):
                ws.cell(row=r, column=c).fill = band[row['member']]
    # 4개를 넘는 원문은 근거 사실 칸 끝에 주소를 붙인다
    for r, row in enumerate(rows, 2):
        extra = row['docs'][MAX_LINKS:]
        if extra:
            add = '\n'.join(f'{link_label(d, MAX_LINKS + i)}: {d[1]}' for i, d in enumerate(extra))
            ws.cell(row=r, column=7).value = row['facts'] + '\n' + add
    dv = DataValidation(type='list', formula1='"맞음,다름,원문 못 찾음"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f'K2:K{len(rows) + 1}')
    ws.freeze_panes = 'E2'
    ws.auto_filter.ref = f'A1:{ws.cell(row=1, column=len(cols)).column_letter}{len(rows) + 1}'
    wb.save(out)


SHEET_COLS = ['번호', '담당', '기업', '세부 항목(배점)', '최종 판정(0~5)', '판정 이유(1차·2차 채점) — 여기 적힌 사실을 원문과 대조',
              '근거 번호(원문별)', '원문 ①', '원문 ②', '원문 ③', '확인 결과', '메모', '확인일']


def sheet_url(url):
    return url.replace(DH_SR, 'https://www.dh.co.kr/sustainable_management/2026지속가능경영보고서.pdf')


def sheet_rows(rows):
    """구글 시트용 간결본: 사실 본문 대신 F 번호를 원문별로 묶는다(사실 본문은 xlsx 보관본에 있음)."""
    out = []
    for i, r in enumerate(rows, 1):
        groups = {}
        for ln in r['facts'].split('\n'):
            m = re.match(r'^(\S+) F(\d+):', ln)
            if m:
                groups.setdefault(m.group(1), []).append(f'F{m.group(2)}')
        ref = '  '.join(f"{t} {'·'.join(v)}" + (' (조사 때 못 찾음)' if t == '?' else ' (이전 노트)' if t == '·' else '') for t, v in groups.items())
        extra = r['docs'][MAX_LINKS:]
        if extra:
            ref += '\n' + '\n'.join(f'{link_label(d, MAX_LINKS + j)}: {sheet_url(d[1])}' for j, d in enumerate(extra))
        links = []
        for j in range(MAX_LINKS):
            if j < len(r['docs']):
                d = r['docs'][j]
                label = link_label(d, j)
                if j == MAX_LINKS - 1 and len(r['docs']) > MAX_LINKS:
                    label += f' 외 {len(r["docs"]) - MAX_LINKS}건'
                links.append(f'=HYPERLINK("{sheet_url(d[1])}","{label.replace(chr(34), chr(39))}")')
            else:
                links.append('')
        out.append([i, r['member'], r['company'], r['item'], r['j'], r['why'], ref, *links, '', '', ''])
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'source_check.xlsx'
    rows = build_rows()
    if '--sheet-json' in sys.argv:
        dst = Path(sys.argv[sys.argv.index('--sheet-json') + 1])
        data = sheet_rows(rows)
        dst.mkdir(parents=True, exist_ok=True)
        (dst / 'header.json').write_text(json.dumps([SHEET_COLS], ensure_ascii=False), encoding='utf-8')
        for k in range(0, len(data), 15):
            (dst / f'rows_{k // 15 + 1}.json').write_text(json.dumps(data[k:k + 15], ensure_ascii=False), encoding='utf-8')
        print('sheet chunks', [len(json.dumps(data[k:k + 15], ensure_ascii=False)) for k in range(0, len(data), 15)])
    problems = []
    for i, r in enumerate(rows, 1):
        if not r['docs']:
            problems.append(f'{i} {r["company"]} {r["item"]}: 원문 링크 없음')
        if not r['facts']:
            problems.append(f'{i} {r["company"]} {r["item"]}: 근거 사실 없음')
        if '노트에 없는 번호' in r['facts']:
            problems.append(f'{i} {r["company"]} {r["item"]}: ' + r['facts'].split('(노트에 없는 번호: ')[1])
        nolink = [ln for ln in r['facts'].split('\n') if ln[:1] in '·?']
        if nolink:
            problems.append(f'{i} {r["company"]} {r["item"]}: 링크 없는 사실 ' + ', '.join(ln.split(':')[0][2:] for ln in nolink))
    from collections import Counter
    print('rows', len(rows), dict(Counter(r['member'] for r in rows)))
    print('links per row', dict(Counter(len(r['docs']) for r in rows)))
    for p in problems:
        print('  !', p)
    if '--check' in sys.argv:
        for r in rows:
            print('---', r['company'], r['item'], r['j'])
            print(r['facts'])
            for i, d in enumerate(r['docs']):
                print('   ', link_label(d, i), d[1])
        return
    write_xlsx(rows, out)
    print('wrote', out)


if __name__ == '__main__':
    main()
