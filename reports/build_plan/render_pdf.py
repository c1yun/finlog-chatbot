"""docx → PDF 변환. LibreOffice가 DOCX의 autoSpace 설정을 무시하므로
ODT로 한 번 변환해 style:text-autospace="none"을 넣은 뒤 PDF로 내보낸다."""
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

SOFFICE = '/root/.claude/skills/synced/7b640a9f-9cbd-48a9-acca-1642989da127_c040d038-8908-4f82-9132-90701161c8c9/docx/scripts/office/soffice.py'

src = Path(sys.argv[1]).resolve()
out_pdf = Path(sys.argv[2]).resolve()
work = Path(tempfile.mkdtemp())


def conv(path, fmt, outdir):
    subprocess.run(['python3', SOFFICE, '--headless', '--convert-to', fmt, '--outdir', str(outdir), str(path)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


conv(src, 'odt', work)
odt = work / (src.stem + '.odt')
ex = work / 'ex'
with zipfile.ZipFile(odt) as z:
    z.extractall(ex)


def patch(xml):
    def add(m):
        tag = m.group(0)
        if 'style:text-autospace' in tag:
            return re.sub(r'style:text-autospace="[^"]*"', 'style:text-autospace="none"', tag)
        return tag.replace('<style:paragraph-properties', '<style:paragraph-properties style:text-autospace="none"', 1)
    return re.sub(r'<style:paragraph-properties\b[^>]*>', add, xml)


for name in ('styles.xml', 'content.xml'):
    f = ex / name
    f.write_text(patch(f.read_text(encoding='utf-8')), encoding='utf-8')

fixed = work / (src.stem + '_fixed.odt')
with zipfile.ZipFile(fixed, 'w') as z:
    z.write(ex / 'mimetype', 'mimetype', compress_type=zipfile.ZIP_STORED)
    for p in sorted(ex.rglob('*')):
        if p.is_file() and p.name != 'mimetype':
            z.write(p, p.relative_to(ex).as_posix(), compress_type=zipfile.ZIP_DEFLATED)

conv(fixed, 'pdf', work)
shutil.move(str(work / (src.stem + '_fixed.pdf')), str(out_pdf))
shutil.rmtree(work)
print('pdf', out_pdf)
