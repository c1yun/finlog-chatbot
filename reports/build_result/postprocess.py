"""docx 후처리: 한글-숫자/영문 사이 자동 간격(autoSpaceDE/DN)을 끈다."""
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

src = Path(sys.argv[1])
tmp = Path(tempfile.mkdtemp())
with zipfile.ZipFile(src) as z:
    z.extractall(tmp)

styles = tmp / 'word' / 'styles.xml'
xml = styles.read_text(encoding='utf-8')
insert = '<w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>'
if 'w:autoSpaceDE' not in xml:
    if re.search(r'<w:pPrDefault>\s*<w:pPr>', xml):
        xml = re.sub(r'(<w:pPrDefault>\s*<w:pPr>)', r'\1' + insert, xml, count=1)
    elif '<w:pPrDefault/>' in xml:
        xml = xml.replace('<w:pPrDefault/>', f'<w:pPrDefault><w:pPr>{insert}</w:pPr></w:pPrDefault>')
    else:
        xml = xml.replace('</w:rPrDefault>', f'</w:rPrDefault><w:pPrDefault><w:pPr>{insert}</w:pPr></w:pPrDefault>', 1)
    styles.write_text(xml, encoding='utf-8')

# LibreOffice는 docDefaults의 autoSpace를 무시하므로 문단마다 명시한다
AFTER = ['bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing',
         'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment',
         'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange']
after_re = re.compile(r'<w:(?:' + '|'.join(AFTER) + r')[ />]')


def fix_ppr(m):
    inner = m.group(1)
    if 'w:autoSpaceDE' in inner:
        return m.group(0)
    a = after_re.search(inner)
    pos = a.start() if a else len(inner)
    return '<w:pPr>' + inner[:pos] + insert + inner[pos:] + '</w:pPr>'


for part in list((tmp / 'word').glob('document.xml')) + list((tmp / 'word').glob('header*.xml')) + list((tmp / 'word').glob('footer*.xml')):
    x = part.read_text(encoding='utf-8')
    x = re.sub(r'<w:pPr>(.*?)</w:pPr>', fix_ppr, x, flags=re.S)
    x = re.sub(r'<w:pPr/>', '<w:pPr>' + insert + '</w:pPr>', x)
    # pPr이 없는 문단
    x = re.sub(r'(<w:p(?: [^>]*)?>)(?!<w:pPr>)', r'\1<w:pPr>' + insert + '</w:pPr>', x)
    part.write_text(x, encoding='utf-8')

out = src.with_suffix('.tmp.docx')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    # [Content_Types].xml 을 먼저 넣는다
    names = sorted(p for p in tmp.rglob('*') if p.is_file())
    names.sort(key=lambda p: (p.name != '[Content_Types].xml', str(p)))
    for p in names:
        z.write(p, p.relative_to(tmp).as_posix())
shutil.move(out, src)
shutil.rmtree(tmp)
print('postprocessed', src)
