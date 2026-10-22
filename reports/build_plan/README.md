# 연구계획서 빌드 자료

| 파일 | 내용 |
|---|---|
| `content.js` | 계획서 본문 전체(연구 요약, Ⅰ~Ⅴ, 부록 1~3). 두 판본이 모두 이 파일에서 글을 가져온다 |
| `build_plan.js` | 육하원칙 재구성본 → `간판떼고_연구계획서.docx/.pdf` |
| `build_plan_form.js` | 주최 측 「[붙임2] 연구계획서」 공식 양식 모양 → `간판떼고_연구계획서_공식양식.docx/.pdf` |
| `check_form_complete.py` | 양식본이 기존 문서의 문단·표 칸을 하나도 빠뜨리지 않았는지 검사 |
| `lib.js`, `postprocess.py`, `render_pdf.py` | 표·문단 도우미, 한글 자동 간격 끄기, LibreOffice로 PDF 변환 |

빌드: `node build_plan_form.js out.docx && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf`
누락 검사: `python3 check_form_complete.py 간판떼고_연구계획서.docx out.docx`

양식본은 원본 양식의 텍스트 상자(고정 크기)를 쓰지 않고, 같은 모양을 표로 만들어 긴 내용이 쪽을 넘어 이어지게 했다.
