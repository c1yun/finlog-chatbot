# 결과보고서 빌드 자료

`간판떼고_결과보고서.docx/.pdf`를 만든 원고와 스크립트다. 설문·인터뷰 결과가 나오면 이 폴더에서 숫자와 문장을 고쳐 다시 빌드한다.

| 파일 | 내용 |
|---|---|
| `companies/<기업>.json` | 기업별 원고(기업 소개 11칸, 분석 7묶음, 직무, SWOT, 아이디어, 8주 전략, 출처). 작성 규칙은 `SCHEMA.md` |
| `score.py` → `scores.json` | `research_notes/결과보고서 기업 분석/`의 채점 A·B·조정 파일로 최종 점수를 계산 |
| `report_meta.js` | 요약·방법·TOP3 이유·부록 문안 |
| `check_report.py` | 출처 번호 범위·공개 원칙 금지어 점검 |
| `build_report.js`, `lib.js` | docx 생성(Node `docx` 패키지) |
| `postprocess.py`, `render_pdf.py` | 한글 자동 간격 끄기, LibreOffice로 PDF 변환 |

빌드 순서: `python3 score.py && python3 check_report.py && node build_report.js out.docx && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf`

설문 후에는 `report_meta.js`의 TOP3 이유와 `build_report.js`의 '적합성' 열(현재 '설문 후')을 학생 선호 점수로 채운다.
