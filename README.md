# 물어봇

월 이용료 0원 FAQ 챗봇 — 서비스 소개, 데모, 제작 도구, 고객 챗봇 배포용 저장소입니다.
GitHub Pages: https://c1yun.github.io/mureobot/

| 경로 | 내용 |
|---|---|
| `index.html` | 서비스 소개 페이지 |
| `bot/` | 소개 페이지에 붙은 물어봇 FAQ 챗봇 |
| `demo/` | 가상 업체 데모 4종(카페·펜션·학원·동아리) |
| `builder/` | 코딩 없이 만드는 제작 도구 |
| `clients/<이름>/` | 고객 챗봇 원본(config.json + faq.csv) |
| `c/<이름>/` | 고객 챗봇 배포 결과(`node build-site.js`가 만듦) |
| `kit/` | 챗봇 엔진·빌드 스크립트·테스트(핀로그 금융 챗봇 엔진에서 출발) |

## 고객 챗봇 추가

1. `clients/<영문-이름>/config.json`과 `faq.csv`를 만든다(형식은 `kit/README.md`).
2. `node build-site.js` → `c/<영문-이름>/`에 챗봇, 위젯, 설치 안내가 생긴다.
3. `node kit/test/run.js`로 확인한 뒤 커밋·푸시하면 몇 분 안에 `https://c1yun.github.io/mureobot/c/<영문-이름>/`에 공개된다.
