"""양식본이 기존 최종 계획서의 내용을 하나도 빠뜨리지 않았는지 검사한다.

두 docx의 문단·표 칸 글자를 하나씩 뽑아 공백을 정리한 뒤, 기존 문서의 모든 글이 양식본에 있는지 센다.
양식 라벨의 맨 앞 '- ', '· '(대시·가운뎃점)은 서식이므로 떼고 비교한다.
사용: python3 check_form_complete.py 기존.docx 양식본.docx
"""
import collections
import html
import re
import sys
import zipfile


def paras(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    out = []
    for m in re.finditer(r'<w:p[ >].*?</w:p>', xml, flags=re.S):
        t = ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', m.group(0)))
        t = re.sub(r'\s+', ' ', html.unescape(t)).strip()
        t = re.sub(r'^(- |· )', '', t)
        if t:
            out.append(t)
    return out


old, new = paras(sys.argv[1]), paras(sys.argv[2])
co, cn = collections.Counter(old), collections.Counter(new)
missing = co - cn
extra = cn - co
print(f'기존 문단·칸 {len(old)}개 중 {len(old) - sum(missing.values())}개가 양식본에 있음 (양식본 전체 {len(new)}개)')
if missing:
    print(f'빠진 것 {sum(missing.values())}개:')
    for t, n in missing.items():
        print(f'  - ×{n} {t[:100]}')
print(f'양식본에만 있는 것 {sum(extra.values())}개:')
for t, n in extra.items():
    print(f'  + ×{n} {t[:100]}')
sys.exit(1 if missing else 0)
