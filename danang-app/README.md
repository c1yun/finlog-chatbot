# 엄마와 다낭 5일 — 모바일 가이드 앱

2026-10-29(목) ~ 11-03(화) 다낭·호이안 여행용 단일 파일 PWA. 하단 5탭(일정·먹기·마사지·할 것·리스트), 큰 글씨, 지도 열기 버튼, 체크리스트(폰에 저장), 오프라인 캐시.

- 라이브: https://mom-danang.netlify.app (홈 화면에 추가하면 "2026다낭여행" 앱으로 설치)
- `site/` — 그대로 배포하는 정적 사이트 (index.html에 사진 31장 내장, manifest, 서비스워커, 아이콘)
- `src/` — 소스: `app.tmpl.html`(화면), `data.json`(금~월 일정, 팜플렛에서 추출), `manual.json`(목·화 일정, 추가 항목, 분류), `lists.json`(쇼핑·준비물·정보), `img/`(CC 라이선스 사진 + 출처 JSON)
- `docs/` — 숙소 실후기 재조사 보고서, 리스트 출처

## 다시 빌드하기
```
cd src
python3 build_app.py          # app.tmpl.html + data/manual/lists + img → danang-app.html
python3 make_site.py          # → ../site/index.html, manifest, sw.js, 아이콘  (경로는 스크립트 상단 APP 변수 조정)
```
넷리파이에 `site/` 폴더를 올리면 끝. 사진 출처는 `src/img/credits/*.json`과 앱의 정보 탭 맨 아래에 있음.
