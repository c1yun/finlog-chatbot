"""서명 겹치기: 사용자가 PDF에 직접 쓴 서명·날짜(벡터 획만 담은 한 쪽짜리 PDF)를
양식본 PDF의 서명란 '(서명)' 낱말 위치에 맞춰 얹는다. 서명 자료는 저장소에 두지 않는다.

사용: python3 sign_overlay.py 양식본.pdf 서명획.pdf 출력.pdf
- 서명획.pdf는 사용자가 서명한 쪽(표시본)의 내용에서 마지막 'q … re W n /Cs1 cs 0 0 0 sc' 덩어리만 남긴 쪽이다.
- 기준 위치: 표시본의 '(서명)' 낱말이 x=519.964, 위에서 y=547.654, 쪽 높이 840.978이었다.
"""
import re
import subprocess
import sys

from pypdf import PdfReader, PdfWriter, Transformation

OLD_X, OLD_TOP, OLD_H = 519.964, 547.654, 840.978

base_path, ink_path, out_path = sys.argv[1:4]
base = PdfReader(base_path)
ink = PdfReader(ink_path).pages[0]


def find_sign(pdf):
    for n in range(1, len(base.pages) + 1):
        html = subprocess.run(['pdftotext', '-f', str(n), '-l', str(n), '-bbox', pdf, '-'], capture_output=True, text=True).stdout
        m = re.search(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">\(서명\)</word>', html)
        if m:
            return n - 1, float(m.group(1)), float(m.group(2))
    raise SystemExit('(서명) 위치를 찾지 못함')


idx, x, top = find_sign(base_path)
page_h = float(base.pages[idx].mediabox.height)
dx = x - OLD_X
dy = (page_h - top) - (OLD_H - OLD_TOP)  # PDF 좌표(아래 기준)에서의 이동량
print(f'서명란: {idx + 1}쪽, 이동 dx={dx:.3f} dy={dy:.3f}')

w = PdfWriter()
for i, pg in enumerate(base.pages):
    if i == idx:
        pg.merge_transformed_page(ink, Transformation().translate(dx, dy))
    w.add_page(pg)
w.add_metadata({'/Title': '간판떼고 연구계획서', '/Author': '간판떼고'})
with open(out_path, 'wb') as f:
    w.write(f)
print('저장', out_path)
