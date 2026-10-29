# 2027삿포로여행 — 엄마와 삿포로 3박 4일

2027년 3월 9일(화) ~ 12일(금), 엄마와 둘이 가는 삿포로 여행 앱입니다. 한 장짜리 HTML 앱이고, 홈 화면에 추가하면 앱처럼 열립니다.

- 사이트: https://mom-sapporo.netlify.app (검색 노출 차단: `noindex`)
- 화면: 첫 화면 표지 → 일정(화·수·목·금, 목요일은 온천 / 오타루 / 둘 다 중 선택) · 먹기 · 쇼핑 · 할 것 · 준비·정보(살 것 · 준비물 · 지도 · 정보)

## 폴더

| 경로 | 내용 |
|---|---|
| `author_data.py` | 일정·카테고리 내용 원본 → `data.json`, `manual.json` 생성 |
| `notes/` | 사실 확인 노트(`facts.md`, 2026-10-29 기준), 장소 좌표(`places.json`), 살 것·준비물·정보(`lists.json`) |
| `map/build_map.py` | `places_final.json`(앱 지도 탭), `sapporo-places.kml`·`.csv`(구글 내 지도 가져오기) 생성 |
| `app.tmpl.html` + `build_app.py` | 템플릿에 데이터와 사진을 넣어 `sapporo-app.html` 생성 |
| `site/make_site.py` | 넷리파이용 PWA(`index.html`, manifest, 서비스워커, 아이콘) 생성 |
| `img/` | CC 라이선스 사진(출처는 `img/credits/*.json`, 앱 정보 탭 › 사진 출처) |

## 빌드

```sh
python3 -I author_data.py
python3 -I map/build_map.py
python3 -I build_app.py
python3 -I site/make_site.py
```

표지에 쓰는 드라마 〈겨울연가〉 포스터(`img/poster.jpg`)는 개인 감상용이라 이 공개 저장소에는 올리지 않았습니다(`.gitignore`). 포스터 없이 빌드하면 표지는 설경 그라데이션 배경으로 나옵니다. 앱 안의 **표지 사진 바꾸기**로 폰에 저장된 사진을 표지로 쓸 수도 있습니다.
