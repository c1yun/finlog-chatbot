#!/usr/bin/env python3
"""제출 직전 최종 점검 — 결과보고서 제출본(docx·pdf)이 그대로 낼 수 있는 상태인지 본다.

검사
1. check_report.py(기업 원고 문장·출처 번호) 통과
2. check_survey.py(설문 결과가 본조사 live 결과이고 폼 ID·설계 해시·점수 해시·종합점수가 맞는지) 통과
3. 제출본 본문에 미리보기·잠정·빈 자리 표시가 남아 있지 않은지(아래 BANNED)
4. 표지 TOP3가 survey_results.json의 TOP3와 같은지, 보고서에 적힌 유효 응답 수가 n_valid와 같은지
5. PDF 쪽수와 글꼴 포함 여부(pdffonts: 모든 글꼴 emb=yes)

사용: python3 check_final.py 제출본.docx 제출본.pdf   (문제가 있으면 종료 코드 1)
      python3 check_final.py 제출본.docx 제출본.pdf --desk
        공개자료만으로 쓴 제출본(설문·인터뷰 미반영). 2·4번 대신 표지 TOP3가 scores.json 환산점수 상위 3곳과 같은지,
        설문 결과처럼 읽히는 표현(DESK_BANNED)이 없는지 본다.
"""
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SURVEY = HERE.parent / 'survey'
RESULTS = SURVEY / 'results' / 'survey_results.json'

BANNED = ['(잠정)', '잠정 TOP3', '잠정 점수', '잠정', '설문 후', '작성 예정', '입력 예정', '［', '］', '미리보기', '제출 금지',
          'SYNTHETIC', 'synthetic', '합성 자료', '합성 데이터', '( 기재 )', '(기재)', 'TODO', 'XXX', 'NaN', 'undefined', '[object']


# 설문·인터뷰를 반영하지 않은 제출본에 있으면 안 되는 표현(하지 않은 조사를 한 것처럼 읽히는 말)
DESK_BANNED = ['유효 응답', '응답자', '학생 선호(95%', '종합 점수 =', '설문 결과를 보기 전', '회사 답변:', '95% 신뢰구간', '간판 효과는',
               '채점자 2명', '채점자 두 명', '별도 채점자', '두 사람 모두 확인', '시작일 확인']


def docx_text(p):
    with zipfile.ZipFile(p) as z:
        xml = ''.join(z.read(n).decode('utf-8', 'ignore') for n in z.namelist()
                      if re.match(r'word/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$', n))
    return re.sub(r'<[^>]+>', '', re.sub(r'</w:p>', '\n', xml))


def pdf_text(p):
    return subprocess.run(['pdftotext', '-layout', str(p), '-'], capture_output=True, text=True, check=True).stdout


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip().splitlines()[-6:]


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    docx, pdf = Path(sys.argv[1]), Path(sys.argv[2])
    desk = '--desk' in sys.argv
    problems = []

    code, tail = run([sys.executable, 'check_report.py'], HERE)
    if code != 0:
        problems.append('check_report.py 실패: ' + ' / '.join(tail))

    if desk:
        sv = None
    elif not RESULTS.exists():
        problems.append(f'본조사 설문 결과가 없음: {RESULTS}')
        sv = None
    else:
        code, tail = run([sys.executable, 'check_survey.py', str(RESULTS)], SURVEY)
        if code != 0:
            problems.append('check_survey.py 실패: ' + ' / '.join(tail))
        sv = json.loads(RESULTS.read_text(encoding='utf-8'))

    texts = {'docx': docx_text(docx), 'pdf': pdf_text(pdf)}
    for kind, t in texts.items():
        for w in BANNED:
            n = t.count(w)
            if n:
                i = t.find(w)
                ctx = re.sub(r'\s+', ' ', t[max(0, i - 30):i + 30])
                problems.append(f'{kind}에 금지 표시 "{w}" {n}곳 (예: …{ctx}…)')

    if desk:
        for kind, t in texts.items():
            for w in DESK_BANNED:
                if w in t:
                    i = t.find(w)
                    problems.append(f'{kind}에 설문·인터뷰 결과처럼 읽히는 표현 "{w}" (예: …{re.sub(chr(92) + "s+", " ", t[max(0, i - 30):i + 30])}…)')
        sc = json.loads((HERE / 'scores.json').read_text(encoding='utf-8'))
        ok = [k for k in sc if sc[k]['final']['fill'] >= 0.7]
        exp = sorted(ok, key=lambda k: (-sc[k]['final']['scaled'], -sc[k]['final']['low']))[:3]
        head = texts['pdf'][:3000]
        pos = [head.find(f'{i + 1}위 {k}') for i, k in enumerate(exp)]
        if min(pos) < 0:
            problems.append(f'표지 요약에 TOP3({", ".join(exp)})가 순위와 함께 적혀 있지 않음')
    if sv:
        top3 = sv.get('ranking', {}).get('top3') or []
        names = [x.get('company') if isinstance(x, dict) else x for x in top3]
        head = texts['pdf'][:6000]
        for k in names:
            if k not in head:
                problems.append(f'표지·요약(앞 6,000자)에 TOP3 기업 "{k}"가 없음')
        nv = sv.get('meta', {}).get('n_valid')
        if nv is not None and f'{nv}명' not in texts['pdf']:
            problems.append(f'보고서에 유효 응답 수 "{nv}명"이 없음')
        if sv.get('meta', {}).get('data_source') != 'live':
            problems.append('설문 결과가 본조사(live)가 아님')

    lines = subprocess.run(['pdffonts', str(pdf)], capture_output=True, text=True).stdout.splitlines()
    noemb = []
    if lines:
        col = lines[0].find('emb')  # 고정 폭 표: 'emb' 열 위치에서 yes/no를 읽는다
        noemb = [ln[:col].split()[0] for ln in lines[2:] if ln.strip() and ln[col:col + 3].strip() == 'no']
    if noemb:
        problems.append('PDF에 포함되지 않은 글꼴: ' + ', '.join(noemb))
    pages = re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', str(pdf)], capture_output=True, text=True).stdout)

    print(f'쪽수 {pages.group(1) if pages else "?"}, 검사한 금지 표시 {len(BANNED)}종')
    for p in problems:
        print('  !', p)
    print('문제', len(problems), '건')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
