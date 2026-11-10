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

## 제출본(설문·인터뷰 미반영, 2026. 11. 10.)

`간판떼고_결과보고서_제출본.docx/.pdf`는 공개자료만으로 쓴 판이다. TOP 3는 기업 평가 환산점수 순으로 정하고, 설문·인사 질의·인터뷰 결과는 넣지 않는다.

| 파일 | 내용 |
|---|---|
| `build_report.js --desk` | 제출본 빌드. 요약 2쪽(결론 먼저) → Ⅰ 기업별 분석 → Ⅱ 비교표 → Ⅲ TOP 3 → Ⅳ 가치 재발견·개선 아이디어 → Ⅴ 지역정주형 취업전략 → 서명 → 부록 1~7 |
| `report_meta.js`의 `desk` | 제출본 문안(요약, 읽는 법, 전공별 진입 직무 표, 통근·주거 표, 계획 대비 변경 등) |
| `make_desk_figs.py` → `figs/desk_*.png` | 그림 2장(점수와 범위, 통근 시간). 빌드할 때 자동으로 다시 그린다 |
| `make_xv_summary.py` → `xv_summary.json` | `research_notes/교차검증 2026-11/`의 통계 줄을 모아 부록 5와 요약 문장에 쓴다 |
| `route_two_engines.json` | 부산대→근무지 자동차 경로를 두 계산기(OSRM·Valhalla)로 구한 값. 기업 원고의 '거리' 행이 이 범위를 쓴다 |
| `check_final.py … --desk` | 제출본 점검(금지 표시, 요약의 TOP 3가 `scores.json`과 같은지, 글꼴 포함) |

빌드 순서: `python3 score.py && python3 make_xv_summary.py && python3 check_report.py && node build_report.js out.docx --desk && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf && python3 check_final.py out.docx out.pdf --desk`

## 설문조사지·인터뷰지

설문과 인터뷰 문서는 두 개로 나눴다(예전 합본 「설문·인터뷰 도구」는 2026. 11. 3.에 대체).

| 문서 | 빌더 | 입력 |
|---|---|---|
| `간판떼고_설문조사지.docx/.pdf` | `build_survey_doc.js` | `../survey/form_text.js`(문항), `../survey/survey_doc_meta.js`(설명), `../survey/spec.lock.json`(배정·순서), `cards_*.json` |
| `간판떼고_인터뷰지.docx/.pdf` | `build_interview_doc.js` | `tool_meta.js`(인터뷰 문안), `interview_q.json`(기업별 질문), `report_meta.js`(평판 판정) |

설문조사지는 구글 폼 생성기(`../survey/build_form_gs.js`)와 같은 문안·카드를 읽으므로 배포본과 문항이 같다. 문안을 고치면 `node ../survey/build_form_gs.js pilot|launch`를 먼저 다시 돌려 `spec.lock.json`을 갱신한다.

빌드 순서: `node build_survey_doc.js out.docx && python3 postprocess.py out.docx && python3 render_pdf.py out.docx out.pdf` (인터뷰지는 `build_interview_doc.js`)

2026. 11. 10.부터 설문조사지는 새 설계(부울경 10곳과 수도권 10곳의 1:1 비교)로 바꿨다. 빌더는 `build_survey_pairs.js`, 입력은 `../survey/pairs_spec.js`(쌍 구성·수도권 카드)와 `cards_regional.json`(부울경 카드)이다. 빌더는 카드 본문에 기업명·지역명이 남아 있으면 멈춘다. 예전 설계의 빌더(`build_survey_doc.js`)와 구글 폼 생성기는 참고용으로 남겼다.
