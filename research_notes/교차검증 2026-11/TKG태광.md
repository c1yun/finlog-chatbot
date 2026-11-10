# TKG태광 교차검증 (결과보고서 ⑩)

- 확인일: 2026-11-10
- 대상: `reports/build_result/companies/TKG태광.json` 전체와 `reports/build_result/cards_regional.json`의 R10 카드. 원고는 고치지 않았다.
- 방법: 원고 문장에서 객관적 사실을 뽑아, 사실마다 출처 원문을 이 세션에서 직접 열어 문구·숫자를 대조했다. DART 문서 4건(별도·연결 감사보고서, 2024 사업보고서, TKG애강 공개매수신고서)은 뷰어 전 구간을 내려받아 숫자를 대조했고, 채용 사이트는 목록 API와 공고 본문 4건, 부산대 게시물은 원고의 5건과 게시판 제목 검색으로 찾은 7건을 열었다. 검색 결과 요약만 본 것은 출처로 세지 않았다.
- 출처 세는 법: 같은 회사가 낸 공시 2종(예: 감사보고서와 사업보고서, 감사보고서와 공개매수신고서)은 2개로 셌다. 부산대 원 게시물과 학과 게시판 재게시는 '다른 게재처 사본'으로 2개로 세되 표에 '사본'이라고 적었다. 같은 사이트의 목록과 본문은 1개로 셌다.
- 통계: 사실 83개 중 확인(2+) 38, 확인(1) 35, 불일치 7, 확인 불가 2, 기준일 지남 1. 검증하지 못하고 남긴 사실은 없다.
- 수정 제안: 21건(`TKG태광.corrections.json`). 한 사실이 여러 문장에 걸쳐 있어 사실 수보다 많다.

## 검증표

| # | 원고 위치(JSON 경로) | 원고 문장 요지 | 출처 1(이름, URL, 확인한 문구) | 출처 2 | 판정 | 조치 |
|---|---|---|---|---|---|---|
| 1 | intro[0] | 법인명 티케이지태광㈜, 2021. 12. 태광실업에서 상호 변경 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 1 "2021년 12월 13일 임시주주총회에서 당사의 상호를 태광실업 주식회사에서 티케이지태광 주식회사로 변경" | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 정관 변경 이력 "2021년 12월 13일 … 태광실업주식회사 → 티케이지태광주식회사로 변경" | 확인(2+) | 유지. 참고: 공개매수신고서 연혁은 사명 사용 시점을 2022.01.01로 적음 |
| 2 | intro[0], analysis[0].points[0].t | 비상장 중견기업 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "중견기업 해당 여부 해당" | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 기업집단 표의 상장 2사는 TKG애강·TKG휴켐스뿐(공개매수자는 비상장) | 확인(2+) | 유지 |
| 3 | intro[1], analysis[0].points[0].sub[0] | 대표이사 박주환 회장 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 표지 "티케이지태광 주식회사 대표이사 박주환" | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 임원 현황 "박주환 … 회장 … 대표이사"(2026-08-28 기준) | 확인(2+) | 유지 |
| 4 | intro[2], analysis[0].points[0].t | 1980. 12. 30. 설립 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 1 "1980년 12월 30일자로 … 설립" | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 연혁 "1980.12.30 태광실업(주) 설립" | 확인(2+) | 유지 |
| 5 | intro[3] | 본사 경남 김해시 김해대로2635번길 26(안동) | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 표지 "경상남도 김해시 김해대로 2635번길 26(안동)" | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497) "근무지: 경남 김해시 김해대로 2635번길 26" | 확인(2+) | 유지 |
| 6 | intro[3], analysis[0].points[0].t | 2002. 3. 이후 국내 제조 중단, 해외 법인 완제품 판매 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 1 "2002년 3월 이후 신발제품에 대한 제조활동을 중단하고, 해외 현지법인으로부터 생산되는 신발완제품의 판매를 주요 영업" | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "해외 현지법인에서 생산되는 신발완제품 판매를 주요 영업"(공시 서류 2종, 같은 회사 작성) | 확인(2+) | 유지 |
| 7 | intro[4], analysis[0].points[1].t | 본사가 나이키 영업·마케팅, 오더 배분, 원가 분석·가격 협상 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "해외 신발 생산법인을 대신하여 나이키에 대한 영업, 마케팅 기능을 수행 … Capacity를 고려하여 각 공장에 배분 … 원가를 분석하고 … 가격 협상" | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 5 "신발 완제품 / 해외법인 생산 신발 제품 중계무역 등 / 나이키(Nike, Inc.)" | 확인(2+) | 유지 |
| 8 | intro[5] | 러닝화 중심, 중계무역 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "나이키의 고부가가치 제품군인 러닝화를 주력으로 공급" | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 5 중계무역 | 확인(2+) | 유지 |
| 9 | intro[6] | 직원 968명(정규 945·기간제 23, 2024-12-31) | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "직원수는 968명 … 합계 945 / 23 / 968" | 없음 | 확인(1) | 유지. 두 번째 없음: 사업보고서가 유일한 공시(이후 정기보고서 없음) |
| 10 | intro[7], analysis[0].points[2].t, finance.rows | 별도 매출 2025년 2조 6,600억 원 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 손익계산서 2,660,004,048,557원 | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 요약별도재무 매출액 2,660,004백만 원 | 확인(2+) | 유지 |
| 11 | intro[7], finance.note, analysis[0].points[2].t | 연결 매출 3조 5,899억→3조 8,655억→4조 223억 원 | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 4,022,282,098,823 / 3,865,513,838,746원; [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 요약연결 3,589,943백만(2023) | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 요약연결 4,022,282 / 3,865,514 / 3,589,943백만 | 확인(2+) | 유지 |
| 12 | intro[8] | 홈페이지 tkg.taekwang.com, 채용 tkg.recruiter.co.kr | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "홈페이지 : http://tkg.taekwang.com" | 채용 사이트는 2026-11-10 직접 열림. 홈페이지는 열지 못함 | 확인(1) | 유지. 두 번째 없음: 홈페이지 접속 불가 |
| 13 | intro[9] | 학사 신입 채용 직무 목록 | [채용 사이트 목록](https://tkg.recruiter.co.kr/career/job) 28건 제목(Costing·PM·생산계획·금형/치공구·화공기술·패턴설계·정보전략·회계) | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) 10개 모집분야(Costing·정보전략·생산계획 등 일부 겹침) | 확인(2+) | 유지 |
| 14 | intro[10], analysis[6].points[0].t, settle[3], plan8.rows[0][1] | 2024. 11.~2026. 1. 부산대 추천채용 5회 | [부산대 게시판 제목 검색 'TKG'](https://im.pusan.ac.kr/bbs/cse/2616/artclList.do): 추천채용 안내 7건(2024-11-20, 2025-01-17, 2025-04-07, 2025-08-11, 2025-11-20, 2025-12-08, 2026-01-30) + 보안팀 추천 지원 공고 1건(2025-05-26) | [부산대 1750621(2025-12-08)](https://im.pusan.ac.kr/bbs/cse/2616/1750621/artclView.do) "[채용] TKG태광(주) 추천채용 안내(~12/14까지)" 개발운영 개선팀(Lean팀) | 불일치 | '5회' → '게시판 제목 기준 7회'. 2025-01-17 건(1705281)은 본문 열지 못해 제목·게시일만 확인 |
| 15 | intro[10] | 공고마다 신입 연봉과 근무시간이 적힘 | [부산대 1748454(2025-11-19)](https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do) 근무조건 표에 근무형태·지역·시간·복리후생만 있고 연봉 없음 | [부산대 1750621(2025-12-08)](https://im.pusan.ac.kr/bbs/cse/2616/1750621/artclView.do) 연봉 없음. 연봉 표기는 2024-11, 2025-04, 2025-08, 2026-01 4건 | 불일치 | '본문을 연 6회 모두 근무시간, 4회에 연봉'으로 수정 |
| 16 | intro[10], analysis[2].points[2].t, swot.W[0], plan8 | 별도 매출의 98.6%(2조 6,227억 원)가 나이키 중계무역 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 5(3) 나이키 중계무역 2,622,656백만 / 매출 2,660,004백만 = 98.6%(계산) | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 5(4) 고객 1 2,624,727백만(연결) | 확인(2+) | 유지 |
| 17 | finance.rows[0] | 별도 매출 2023년 21,696 / 2024년 24,788억 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 요약별도 2,169,629 / 2,478,798백만 | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 요약별도 같은 값; [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 전기 2,478,798,417,836원 | 확인(2+) | 유지 |
| 18 | finance.rows[1], analysis[2].points[0].t | 별도 영업이익 939 / 1,550 / 1,149억 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 93,927 / 155,031백만; [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 114,921,303,750원 | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 114,921 / 155,031 / 93,927백만 | 확인(2+) | 유지 |
| 19 | finance.rows[2] | 별도 당기순이익 2,902 / 3,091 / 1,717억 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 290,192 / 309,116백만; [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 171,664,630,115원 | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 171,665 / 309,116 / 290,192백만 | 확인(2+) | 유지 |
| 20 | finance.rows[3] | 별도 영업현금흐름 4,570 / 3,954 / 2,936억 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 457,003,481,969 / 395,417,693,516원 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 293,567,016,920원(2025), 전기 395,417,693,516원 | 확인(2+) | 유지. 2024년은 두 문서 일치, 2023·2025년은 각 한 문서(다음 연도 비교 수치 없음) |
| 21 | finance.note, analysis[2].points[1].sub[0], swot.T[2], plan8 | 별도 부채비율 73.0% / 52.4% / 70.8%(계산) | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 부채 622,953 / 자본 852,881(2023), 593,118 / 1,132,789(2024); [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 895,850 / 1,265,433(2025) | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 요약별도 같은 부채·자본 총계 | 확인(2+) | 유지(재계산 73.04 / 52.36 / 70.79) |
| 22 | finance.note | 2025년 해외 종속법인 배당금 725억 원 포함 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 현금흐름표 '배당금의 수취 72,478,659,725' | 없음 | 확인(1) | 유지. 두 번째 없음: 감사보고서가 유일 |
| 23 | analysis[0].points[0].sub[1] | 주주 박주환 45.74%, 자기주식 39.82%, 기획재정부 9.37% | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 1 주주 현황 45.74 / 39.82 / 9.37 | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) 최대주주 박주환 4,369,922주 45.74% | 확인(2+) | 유지 |
| 24 | analysis[0].points[1].sub[0], analysis[2].points[2].sub[1], swot.O[0], summary, plan8.rows[2][2], 카드 | 9개 해외 종속법인이 생산을 맡는다 / 생산 거점 4개국 | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 1(2) 신발 업종 종속기업 9개(베트남 5·인도네시아 2·인도 1·미얀마 1) | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 1(3) 요약재무: TKG Taekwang India 매출 '-'(자산 135백만), TAEKWANG MYANMAR 매출 '-' | 불일치 | 법인 수 9개·4개국은 맞음. 인도·미얀마 법인은 2025년 매출이 없어 '생산을 맡는다'·'생산 거점'은 근거 부족 → 문장 수정 |
| 25 | analysis[2].points[2].sub[1] | 인도 법인 2024년 설립 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 연결범위 변동(제45기) 'TKG Taekwang India Private Limited 신규포함 신규설립' | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 전기 변동 내역 같은 기재 | 확인(2+) | 유지 |
| 26 | analysis[0].points[2].sub[0] | 연결 종속회사 46개, TKG휴켐스·TKG애강 포함(2025년) | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 1(2) 종속기업 표 46행(티케이지휴켐스 42.56%, 티케이지애강 47.53%) | [TKG애강 공개매수신고서 2026-08-31](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260831000008) '연결에포함된회사수 46개'(2025년 말) | 확인(2+) | 유지 |
| 27 | analysis[0].points[2].sub[1] | 연결 매출 중 신발 비중 2024년 63.3%, 2025년 65.8% | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 5(2) 신발 순매출 2,645,618 / 4,022,282(65.8%), 전기 2,446,088 / 3,865,514(63.3%) | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 매출실적 신발 합계 2,446,088 / 총합계 3,865,514(2024) | 확인(2+) | 유지 |
| 28 | analysis[1].points[0].sub[0] | 연구조직 김해·베트남 PCC, 신발 연구 실적은 기밀이라 제외 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) '신발부문 PCC 한국, 김해 … TKG태광비나 PCC 베트남', '신발부문 연구개발은 주요한 기밀 사항으로 제외' | 없음 | 확인(1) | 유지. 두 번째 없음: 사업보고서가 유일 |
| 29 | analysis[1].points[0].sub[1] | 공고에 금형·치공구 설계와 공정 개선 업무 | [채용 공고 265514](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265514) "금형/치공구 설계 및 모델링 … 공정 효율 향상 … 원가 절감" | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) '치공구 개발 엔지니어', '베트남 치공구 개발팀 신규 모델 치공구 설계 및 구조 검토' | 확인(2+) | 유지 |
| 30 | analysis[1].points[1].t | 연결 연구개발비 84억→99억→573억(2022~2024), 기업부설연구소 설립 영향 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 연구개발비용 8,377 / 9,913 / 57,330백만, '기업부설연구소 설립으로 연구개발부서의 인건비 부분이 연구개발비용으로 산입' | 없음 | 확인(1) | 유지. 두 번째 없음: 사업보고서가 유일 |
| 31 | analysis[1].points[1].sub[0] | 2024년 연구개발비는 연결 매출의 1.48% | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) '매출액 대비 비율 1.48%' | 계산 57,330 / 3,865,514 = 1.48% | 확인(1) | 유지 |
| 32 | analysis[1].points[1].sub[1] | 연결 특허 142건 대부분은 화학·소재 부문 것 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "신발, 배관재 및 C_PVC, 소재 관련 국내외 특허는 총 142건"(국가별 111·9·2·8·11·1) | 부문별 건수는 공시에 없음 | 확인 불가 | 142건은 확인. '대부분 화학·소재'는 근거 없음 → 문장 수정 |
| 33 | analysis[1].points[2].t | 나이키 OEM·ODM 상위 5개사가 물량 약 65%, 품질·납기·개발역량·근무환경 평가 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "상위 5개 업체가 나이키 연간 신발 생산물량의 약 65%를 점유", "품질 및 납기 준수, 생산 및 개발역량, 근무환경 등에 대한 평가를 강화" | 없음 | 확인(1) | 유지('회사 공시에 따르면' 표현 유지). 두 번째 없음: 회사 공시가 유일 |
| 34 | analysis[1].points[2].sub[0], swot.T[0] | 위험 요인: 생산국 노동환경·법규, FTA·환율 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "생산국의 노동환경, 법률 및 규정의 변화 … FTA(자유무역협정) 및 환율 관련 법률의 영향" | 없음 | 확인(1) | 유지 |
| 35 | analysis[1].points[2].sub[1], plan8.rows[1][2] | 신발 라인 102개, 라인당 일 3,269족, 2024년 8,130만 족, 가동률 70% | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "1개 라인당 … 3,269족 … 총 신발 제조 라인은 102개", 운동화 81,295천 족, 가동율 70% | 없음 | 확인(1) | 유지(81,295천 족 = 8,129.5만 족, 반올림 일치) |
| 36 | analysis[2].points[0].sub[0], swot.W[1] | 별도 영업이익률 4.3%→6.3%→4.3%(계산) | 위 매출·영업이익으로 재계산 4.33 / 6.25 / 4.32 | 같음(공시 3종) | 확인(2+) | 유지 |
| 37 | analysis[2].points[0].sub[1] | 연결 신발 부문 순매출 2조 1,969억→2조 6,456억, 2025년 부문 순이익 감소 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 신발 합계 2,196,909백만(2023), 2,446,088백만(2024) | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 5(2) 순매출 2,645,618(2025), 부문 순이익 457,300→361,608 | 확인(2+) | 유지 |
| 38 | analysis[2].points[1].t | 영업현금흐름 별도·연결 3년 흑자 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) 연결 644,893,869,185 / 414,780,509,113원, 별도 위와 같음 | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 연결 468,509,897,714원(2025) | 확인(2+) | 유지 |
| 39 | analysis[2].points[1].t | 2025년 TKG솔믹스 등 취득으로 별도 현금 1,433억→26억 | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 현금및현금성자산 2,613,265,845 / 143,279,971,406원, 종속기업투자의 취득 468,545백만, 티케이지솔믹스 현금출자 447,079백만 | [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 1 '티케이지솔믹스(주) … 당기 중 지배기업이 지분을 100% 취득' | 확인(2+) | 유지 |
| 40 | analysis[2].points[1].sub[1], swot.S[1] | 회사채 신용등급 A+(2024. 5.) | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) '2024.05.14 제11회 회사채 A+ 나이스신용평가 / 2024.05.13 A+ 한국기업평가' | 없음(신용평가사 페이지는 열지 않음) | 확인(1) | 유지 |
| 41 | analysis[2].points[1].sub[1] | 2025. 5. 이후 정기보고서 없음, 2026 반기 재무 미공시 | DART 공시 검색(회사명 티케이지태광, 2026-01-01~11-10): 감사보고서·연결감사보고서 2건뿐 | 없음 | 확인(1) | 유지. 2026-10-20~11-10 신규 공시 없음 |
| 42 | analysis[2].points[2].t | 지역별 미주 33.5%, 유럽 32.4%, 아시아 31.3%, 기타 2.8%, 국내 0.1% | [별도감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001164) 주석 5(2) 미주 889,789 / 유럽 861,683 / 아시아 831,861 / 기타 75,028 / 국내 1,643백만 | 두 번째 출처로 본 [연결감사 FY2025](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165) 주석 5(3) 신발 부문은 유럽 831,861·아시아 1,579,478(내부거래 포함)로 배열이 다름 | 확인(1) | 유지. 별도 주석 원문과 일치. 연결 주석의 유럽 값이 별도 주석의 아시아 값과 같아 두 문서의 유럽·아시아 구분이 서로 맞지 않음(원인 확인 못 함) |
| 43 | analysis[2].points[2].sub[0] | IFC: 1987년부터 나이키에 공급 | [IFC 사례연구](https://www.ifc.org/content/dam/ifc/doc/mgrt/vietnam-ifc-childcare-casestudies-taekwangvina.pdf) "The company has supplied footwear to Nike since 1987" | 없음 | 확인(1) | 유지. 두 번째 없음: IFC 자료가 유일 |
| 44 | analysis[3].points[0].t, plan8 | 2026. 1.~9. 수시 공고 28건, 1·3·7·9월에 학사 신입 공고 | [채용 사이트 목록](https://tkg.recruiter.co.kr/career/job) list.json recordCount 28, 접수 시작 01-26 / 03-13 / 07-28 / 09-07, 모두 '수시'·'접수마감'(2026-11-10 재조회) | 없음(사람인 검색 페이지는 열렸으나 마감 공고 사본을 확인하지 못함) | 확인(1) | 유지. 11-10에도 28건 그대로, 새 공고 없음 |
| 45 | analysis[3].points[0].sub[0], ideas[0].problem | 모든 공고가 '해외여행(출장) 결격사유 없음'을 자격으로 둠 | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497)·265492·261460·265514 4건 모두 '해외여행에 결격사유가 없는 분' | [부산대 1748454(2025-11-19)](https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do)·1756250에는 이 문구 없음(1699158·1717653·1735841·1750621에는 있음) | 확인 불가 | '모든'은 확인 범위를 넘음 → '본문을 연 공고'로 한정 |
| 46 | analysis[3].points[0].sub[1] | 베트남 치공구개발팀 주재원 신입/경력 공고 | [채용 사이트 목록](https://tkg.recruiter.co.kr/career/job) 242005 '[해외법인] TKG태광 베트남 치공구개발팀 주재원 신입/경력사원 채용' 2026-01-26~03-02 | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) 모집분야 10 '베트남 치공구 개발팀' | 확인(2+) | 유지. 공고 242005 본문은 열지 못함(301) |
| 47 | analysis[3].points[1].t, jobs[0].work, 카드 | Costing 업무 4가지 | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497) "제품별 원가 산정 및 견적 검토 / 개발 단계별 원가 구조 검토 및 개선 방향 제안 / 글로벌 고객사 대상 원가 관련 커뮤니케이션 / 시즌별 원가 이슈 대응 및 수익성 관리" | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) "Costing 제품별 원가 산정 및 견적 검토 등" | 확인(2+) | 유지(원문 마감) |
| 48 | analysis[3].points[1].sub[0], jobs[0].req, 카드 | Costing 필수: 상경계열 학사·영어 회화·이메일, 우대: Excel·PPT, 4년제, 해외여행 결격 없음 | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497) Hard Skills "상경계열 등 관련 전공자 학사 이상(신입) / 영어 회화 및 이메일 커뮤니케이션 가능자 / (우대) 신발 개발, 원가관리 … / (우대) Excel, PPT" | 없음 | 확인(1) | 유지. 두 번째 없음: 회사 채용 사이트 공고가 유일(원문 마감) |
| 49 | analysis[3].points[2].t, jobs[1].work | GSCM 생산계획: LRLP·DPO 수립, 신모델 진도 점검, 법인 간 소통 | [채용 공고 261460](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=261460) "인도네시아 법인 상세 생산계획(LRLP, DPO) 수립 및 운영 / 신규 모델 생산 진도 … 모니터링 / GSCM–인도네시아 법인 간 커뮤니케이션" | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) "생산계획팀 해외법인 생산계획(LRLP/DPO) 확인 및 관리 등" | 확인(2+) | 유지 |
| 50 | analysis[3].points[2].sub[0], jobs[1].req | 2026. 7. 공고: 경영·산업공학·물류·무역·통계 전공, 인도네시아어 네이티브, E-7 | [채용 공고 261460](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=261460) "인도네시아어(Bahasa Indonesia) 네이티브 수준 구사자 * 내/외국인 관계 無 / 경영학·산업공학·물류·무역·통계학과 등 관련 전공 / E-7(특정활동) 비자 발급을 전제" | 없음 | 확인(1) | 유지. 두 번째 없음: 공고 원문이 유일(원문 마감) |
| 51 | analysis[3].points[3].t | PM: 기획~양산·품질 개선 관리, 해외 공장 지원, 영어 회화 능통 필수 / 금형·치공구: 2D/3D CAD 필수 | [채용 공고 265492](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265492) "기획 → 개발 → 양산 → 품질 개선까지 전 단계 프로젝트 관리 / 해외 공장(베트남·인도네시아 등) 개발 지원 / 영어 회화 능통자"; [채용 공고 265514](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265514) "2D / 3D CAD 활용 가능자" | [부산대 1748454(2025-11-19)](https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do) "PM 고객사 대응 신발 개발 업무 전반 담당 제품의 기획→개발→양산→품질→개선까지 전 단계 프로젝트 관리" | 확인(2+) | 유지 |
| 52 | analysis[3].points[3].sub[0] | 2025. 8. 기준정보팀: TOEIC 800 또는 OPIc IM3 이상 | [부산대 1735841(2025-08-08)](https://im.pusan.ac.kr/bbs/cse/2616/1735841/artclView.do) "영어: Toeic 800점 이상 또는 Toeic Speaking IM3, OPIc IM3 이상" | [부산대 1736204(2025-08-11)](https://im.pusan.ac.kr/bbs/cse/2616/1736204/artclView.do) 같은 문구(학과 게시판 재게시, 같은 공문의 사본) | 확인(2+) | 유지 |
| 53 | analysis[4].points[0].t, 카드 | 주 5일, 평일 08:00~17:00 | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497) "정규직, 주 5일 근무, 오전 8시 - 오후 5시" | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) "(평일)08:00~17:00" | 확인(2+) | 유지 |
| 54 | analysis[4].points[0].t, 카드 | 2024년 시차출퇴근 150명·선택근무 112명, 재택 없음 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) '시차출퇴근제 사용자 수 150 / 선택근무제 사용자 수 112 / 원격근무제(재택근무 포함) 사용자수 -' | 없음 | 확인(1) | 유지. 두 번째 없음: 사업보고서가 유일 |
| 55 | analysis[4].points[0].sub[0] | 육아휴직 16명(2022)→31명(2024), 남성 사용률 0%→18.2% | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) '육아휴직 사용자수(전체) 31 / 25 / 16', '사용률(남) 18.2% / 4.0% / 0.0%' | 없음 | 확인(1) | 유지 |
| 56 | analysis[4].points[0].sub[1] | PM·금형 공고에 해외 공장 지원·현장 테스트 | [채용 공고 265492](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265492) 해외 공장 개발 지원; [채용 공고 265514](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265514) "현장 적용 및 테스트 … (국내/해외 시화)" | 없음 | 확인(1) | 유지 |
| 57 | analysis[4].points[1].t, 카드 | 복지: 하계휴가비, 복지포인트 연 50만 원, 나이키 임직원몰, 사내 식당, 헬스장 | [부산대 1717653(2025-04-09)](https://im.pusan.ac.kr/bbs/cse/2616/1717653/artclView.do) "하계휴가비, 복지포인트 연 50만 원, 나이키 임직원몰, 사내 식당, 헬스장" | [부산대 1717150(2025-04-07)](https://im.pusan.ac.kr/bbs/cse/2616/1717150/artclView.do) 같은 문구(재게시 사본); 1748454·1756250은 하계휴가비·복지포인트·임직원몰만 | 확인(2+) | 유지 |
| 58 | analysis[4].points[1].sub[1] | 2024년 말 평균근속 8.4년 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "평균근속년수는 8.4년" | 없음 | 확인(1) | 유지 |
| 59 | analysis[4].points[2].t, sources[8] | 블라인드(2026. 10. 18.) 3.2점, 349건, 추천율 55%, +0.5 | [블라인드](https://www.teamblind.com/kr/company/TKG%ED%83%9C%EA%B4%91/reviews) 2026-11-10 '평점 3.2 업계 평균 대비 +0.5 리뷰 352 추천율 54%' | 없음(블라인드 페이지가 유일) | 기준일 지남 | 11-10 값으로 갱신(352건·54%)하거나 10-18 기준임을 유지 |
| 60 | analysis[5].points[0].t, reputation | 2024 사업보고서 제재 항목 모두 '해당사항 없음' | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) XI-3 수사·사법기관, 금융감독당국, 공정위, 과세당국, 거래소 모두 '해당사항이 없습니다' | 없음 | 확인(1) | 유지. 두 번째 없음: 회사 공시가 유일 |
| 61 | analysis[5].points[0].sub[0] | 연결 피고 소송 4건, 1,125백만 원 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "피고로 계류중인 소송 사건은 4건으로 소송금액은 총 1,125백만원"(주석 33·XI-2) | 없음 | 확인(1) | 유지 |
| 62 | analysis[5].points[0].sub[1], reputation | 2021년 이후 노동자 사망 기록 찾지 못함 | 이번 검색(2026-11-10, 사고·제재·체불·구조조정)에서도 TKG태광 관련 사망 보도 찾지 못함 | 없음 | 확인(1) | 유지('찾지 못했다' 표현 유지). 부재 진술이라 출처 1로 셈 |
| 63 | analysis[5].points[1].t, swot.T[1], reputation | 2021. 3. 인도네시아 공장 보안 담당 직원이 노동자를 발로 차는 영상(노동자 폭행 영상) | [국민일보 2021-03-07](http://news.kmib.co.kr/article/view.asp?arcid=0015604179) "바닥에 있는 무언가를 발로 찼다 … '발로 찼다'는 잘못된 소문이 퍼지기도 했다 … 음식물 봉지를 발로 찬 것" | [조선비즈 2021-03-06](https://biz.chosun.com/site/data/html_dir/2021/03/06/2021030600706.html) 사측 설명 "음식물 봉지가 바닥에 있는데도 … 실랑이"(두 기사 모두 연합뉴스 계열 내용으로 보임) | 불일치 | '노동자를 발로 찼다'·'노동자 폭행'은 보도와 다름 → 문장 3곳 수정 |
| 64 | analysis[5].points[1].t | 회사는 다음 날 해고·사과 | [국민일보 2021-03-07](http://news.kmib.co.kr/article/view.asp?arcid=0015604179) "사건 발생 다음 날인 5일 오전 해고 … 피해 근로자들에게 사과했다" | [조선비즈 2021-03-06](https://biz.chosun.com/site/data/html_dir/2021/03/06/2021030600706.html) "다음 날인 5일 오전 해고된 것으로 전해졌다"(사과는 국민일보에만) | 확인(2+) | 유지 |
| 65 | analysis[5].points[1].sub[0], reputation | 2023. 10. TKG휴켐스 여수공장 배출 뒤 인근 노동자 16명 진료 보도 | [경향신문 2023-10-25](https://www.khan.co.kr/article/202310252124015) "고농도 질소산화물이 포함된 연기가 배출돼 노동자 16명이 병원 진료"(사고일 10-7, 인근 증설공사 노동자) | 없음(다른 매체 보도·노동부 발표 검색에서 찾지 못함) | 확인(1) | 유지('보도가 있다' 표현 유지). 두 번째 없음: 경향신문 단독 취재 기사 |
| 66 | analysis[5].points[1].sub[1], reputation | TKG휴켐스는 인과관계 미확인 입장, 처분 보도 없음 | [경향신문 2023-10-25](https://www.khan.co.kr/article/202310252124015) "인과관계가 확실하지 않다" | 처분·조사 결과는 이번 검색에서도 찾지 못함 | 확인(1) | 유지 |
| 67 | analysis[5].points[2].t | IFC: 동나이 4개 공장 공용 유치원(정원 500명) | [IFC 사례연구](https://www.ifc.org/content/dam/ifc/doc/mgrt/vietnam-ifc-childcare-casestudies-taekwangvina.pdf) "shared kindergarten for its four factories", "space for 500 children" | 없음 | 확인(1) | 유지 |
| 68 | analysis[5].points[2].sub[0] | IFC: 베트남 인력 49,461명 중 약 33,000명 동나이, 84% 여성(2019) | [IFC 사례연구](https://www.ifc.org/content/dam/ifc/doc/mgrt/vietnam-ifc-childcare-casestudies-taekwangvina.pdf) "Around 33,000 of Taekwang Vina's total Vietnamese workforce of 49,461 is based in Dong Nai", "Women account for 84 percent of … Dong Nai workforce" | 없음 | 확인(1) | 유지 |
| 69 | analysis[5].points[2].sub[1] | 화학 계열: 화관법 영업허가, 주 1회 자체 점검 | [사업보고서 FY2024](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351) "화학물질관리법을 적용 … 환경청으로부터 법적 영업허가 … 주 1회 자체적으로 점검" | 없음 | 확인(1) | 유지 |
| 70 | analysis[6].points[0].t, settle[3] | 2025. 11. 공고: 추천 인원 제한 없음, 서류전형 가산점 | [부산대 1748454(2025-11-19)](https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do) "추천인원에 제한이 없으며, 추천자 선발 시 서류전형 가산점 부여" | [부산대 1748580(2025-11-20)](https://im.pusan.ac.kr/bbs/cse/2616/1748580/artclView.do) 같은 문구(접수기한 연장 재게시) | 확인(2+) | 유지 |
| 71 | analysis[6].points[0].sub[0], swot.O[2] | 2026. 1. 추천채용 10개 직무(Costing·IE·생산계획·플랫폼개발 등) | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) 모집분야 연번 1~10 | 저장소 저장본 `원문 검증/originals/P2/PNU_im_TKG태광_1756250.txt`(같은 글) | 확인(1) | 유지. 두 번째 없음: 게시물이 유일 |
| 72 | analysis[6].points[1].t, jobs[*].pay, 카드 | 추천채용 신입 연봉 4,100만(2024. 11.)→4,200만(2025.)→4,300만(2026. 1.) | [부산대 1699158(2024-11-19)](https://im.pusan.ac.kr/bbs/cse/2616/1699158/artclView.do) '연봉: 4,100만 원 / 년'; [부산대 1717653(2025-04-09)](https://im.pusan.ac.kr/bbs/cse/2616/1717653/artclView.do) '4,200만 원 / 년'; [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) '4,300만원' | [부산대 1699354(2024-11-20)](https://im.pusan.ac.kr/bbs/cse/2616/1699354/artclView.do)·1717150·1736204 재게시 사본 같은 금액 | 불일치 | 금액은 모두 확인. 다만 2025년 11월·12월 공고에는 연봉이 없으므로 '(2025.)' → '(2025. 4.·8.)' |
| 73 | analysis[6].points[1].sub[0], jobs[0].pay, 카드 | 2025. 8. 공고: '대졸초임 군필기준' 4,200만 원, PS/PI 별도 | [부산대 1735841(2025-08-08)](https://im.pusan.ac.kr/bbs/cse/2616/1735841/artclView.do) "(대졸초임 군필기준) 4,200만원 ※ PS/PI 별도 지급" | [부산대 1736204(2025-08-11)](https://im.pusan.ac.kr/bbs/cse/2616/1736204/artclView.do) 같은 문구(재게시 사본) | 확인(2+) | 유지 |
| 74 | jobs[*].type, 카드 | 정규직, 추천채용 공고 기준 수습 3개월 | [부산대 1756250(2026-01-30)](https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do) "정규직 (수습기간 3개월)" | [부산대 1735841(2025-08-08)](https://im.pusan.ac.kr/bbs/cse/2616/1735841/artclView.do)·1748454 같은 표기 | 확인(2+) | 유지 |
| 75 | jobs[0].when | Costing 공고 2026. 9. 7.~9. 20., 서류→역량검사→1·2차 면접→10월 입사 | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497) "2026.09.07(월) 00:00 ~ 2026.09.20(일) 23:59", "서류전형(~9/29) → 역량검사(~10/6) → 1-2차 면접(~10/19) → … 입사(`26년 10월 중)" | [채용 사이트 목록](https://tkg.recruiter.co.kr/career/job) 같은 접수기간 | 확인(1) | 유지. 같은 사이트의 목록·본문이라 출처 1로 셈 |
| 76 | jobs[0].when | 같은 직무 2026. 3. 12.~3. 29. | [채용 사이트 목록](https://tkg.recruiter.co.kr/career/job) 공고 247588 접수 2026-03-13 00:00~03-29(KST) | 본문은 열지 못함(301) | 불일치 | '3. 12.' → '3. 13.' |
| 77 | jobs[1].when | GSCM 생산계획 공고 2026. 7. 28.~8. 9. | [채용 공고 261460](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=261460) "2026.07.28(화) 00:00 ~ 2026.08.09(일) 23:59" | [채용 사이트 목록](https://tkg.recruiter.co.kr/career/job) 같은 기간 | 확인(1) | 유지 |
| 78 | jobs[1].place | 김해 본사(공고 근무지 표기: 경남) | [채용 공고 261460](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=261460) "근무지: 경남 김해시 김해대로 2635번길 26" | 없음 | 불일치 | 공고 본문 표기대로 주소로 수정 |
| 79 | values | Soft Skills 4개 항목, '유관 부서와의 협업을 통한 원가 조율' | [채용 공고 265497](https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497) Soft Skills(필수 역량) 4줄, 주요 업무 5번째 줄 | 없음 | 확인(1) | 유지. 회사 차원 핵심가치는 홈페이지를 열지 못해 여전히 미확인 |
| 80 | settle[2] | 부산대→김해 본사 자동차 약 19km·약 21분(OSRM) | OSRM 공개 서버 재계산(부산대 129.079,35.233 → 김해대로2635번길 128.915,35.233): 19.07km, 20.9분 | 없음 | 확인(1) | 유지('추정' 표기 유지) |
| 81 | 카드 fields | 매출 대부분(약 99%)이 한 고객사, 2023~2025년 매출 증가, 직원 500~1,000명 | 위 98.6%·별도 매출 3개년·968명과 일치 | 같음 | 확인(2+) | 유지 |
| 82 | sources[0~2] | DART rcpNo·제출일(2026. 3. 30., 2025. 3. 31.) | DART 뷰어에서 세 문서 모두 열림, 접수일 2026.03.30(검색 목록) | 없음 | 확인(1) | 유지 |
| 83 | sources[6], sources[7] | 국민일보 2021. 3. 7. / 경향신문 2023. 10. | [국민일보 2021-03-07](http://news.kmib.co.kr/article/view.asp?arcid=0015604179) '입력: 2021-03-07 00:30' | [경향신문 2023-10-25](https://www.khan.co.kr/article/202310252124015) '입력 2023.10.25 21:24' | 확인(1) | 유지(각 기사 자체 표기) |

## 수정 필요 목록

불일치·확인 불가·기준일 지남만 모았다. 고친 문장은 JSON 파일의 `new`와 같다.

1. **불일치** — `TKG태광.json` `analysis[5].points[1].t`
   - 원고: 보안 담당 직원이 노동자를 발로 차는 영상이 보도됐고, 회사는 다음 날 그 직원을 해고하고 사과했다
   - 수정: 한국인 보안 담당자가 현지 노동자들 앞에서 바닥의 음식물 봉지를 발로 차고 큰 소리로 훈계하는 영상이 보도됐고(노동자들은 음식물이 튀고 손등이 긁혔다고 주장), 회사는 다음 날 그 직원을 해고하고 노동자들에게 사과했다
   - 근거: 두 보도 모두 '바닥에 있는 무언가(음식물 봉지)를 발로 찼다'고 적었고, 국민일보는 '여성 근로자를 발로 찼다'는 것을 잘못된 소문이라고 명시
   - 출처: http://news.kmib.co.kr/article/view.asp?arcid=0015604179, https://biz.chosun.com/site/data/html_dir/2021/03/06/2021030600706.html
2. **불일치** — `TKG태광.json` `swot.T[1]`
   - 원고: "인도네시아 종속법인 공장 직원의 노동자 폭행 영상 보도
   - 수정: "인도네시아 종속법인 공장 보안 담당자가 노동자들 앞에서 음식물 봉지를 발로 차고 훈계한 영상 보도
   - 근거: 보도는 노동자를 직접 때리거나 찬 것이 아니라고 적음. 같은 문장이 reputation에도 있어 old 앞에 JSON 여는 따옴표를 포함해 구분함
   - 출처: http://news.kmib.co.kr/article/view.asp?arcid=0015604179, https://biz.chosun.com/site/data/html_dir/2021/03/06/2021030600706.html
3. **불일치** — `TKG태광.json` `reputation`
   - 원고: [3]. 인도네시아 종속법인 공장 직원의 노동자 폭행 영상 보도
   - 수정: [3]. 인도네시아 종속법인 공장 보안 담당자가 노동자들 앞에서 음식물 봉지를 발로 차고 훈계한 영상 보도
   - 근거: 보도는 노동자를 직접 때리거나 찬 것이 아니라고 적음
   - 출처: http://news.kmib.co.kr/article/view.asp?arcid=0015604179, https://biz.chosun.com/site/data/html_dir/2021/03/06/2021030600706.html
4. **불일치** — `TKG태광.json` `intro[10][1]`
   - 원고: 5회 열렸고 공고마다 신입 연봉과 근무시간이 적혀 비교할 수 있다
   - 수정: 학과 게시판 제목 검색 기준 7회 올라왔고(2025. 1. 건은 제목·게시일만 확인), 본문을 연 6회 모두 근무시간이, 그중 4회에 신입 연봉이 적혀 비교할 수 있다
   - 근거: 게시판 제목 검색에 2025. 1. 17.·2025. 12. 8. 추천채용 안내가 더 있고, 2025. 11.·12. 공고에는 연봉 표기가 없음
   - 출처: https://im.pusan.ac.kr/bbs/cse/2616/artclList.do, https://im.pusan.ac.kr/bbs/cse/2616/1750621/artclView.do, https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do
5. **불일치** — `TKG태광.json` `analysis[6].points[0].t`
   - 원고: 5회 열렸고, 2025. 11. 공고는 추천 인원 제한이 없고
   - 수정: 학과 게시판 제목 검색 기준 7회 올라왔고(2025. 1.·2025. 12. 포함, 2025. 1. 건은 제목·게시일만 확인), 2025. 11. 공고는 추천 인원 제한이 없고
   - 근거: 게시판 제목 검색에 2025. 1. 17.(1705281)·2025. 12. 8.(1750621) 추천채용 안내가 더 있음
   - 출처: https://im.pusan.ac.kr/bbs/cse/2616/artclList.do, https://im.pusan.ac.kr/bbs/cse/2616/1750621/artclView.do
6. **불일치** — `TKG태광.json` `settle[3][1]`
   - 원고: 5회 열렸고, 2025. 11. 공고는 추천자에게
   - 수정: 학과 게시판 제목 검색 기준 7회 올라왔고(2025. 1. 건은 제목·게시일만 확인), 2025. 11. 공고는 추천자에게
   - 근거: 게시판 제목 검색에 2025. 1.·2025. 12. 추천채용 안내가 더 있음
   - 출처: https://im.pusan.ac.kr/bbs/cse/2616/artclList.do, https://im.pusan.ac.kr/bbs/cse/2616/1750621/artclView.do
7. **불일치** — `TKG태광.json` `plan8.rows[0][1]`
   - 원고: 부산대 추천채용(2024. 11.~2026. 1. 5회)
   - 수정: 부산대 추천채용(2024. 11.~2026. 1. 게시판 제목 기준 7회)
   - 근거: 게시판 제목 검색에 2025. 1.·2025. 12. 추천채용 안내가 더 있음
   - 출처: https://im.pusan.ac.kr/bbs/cse/2616/artclList.do, https://im.pusan.ac.kr/bbs/cse/2616/1750621/artclView.do
8. **불일치** — `TKG태광.json` `analysis[6].points[1].t`
   - 원고: 4,200만 원(2025.)
   - 수정: 4,200만 원(2025. 4.·8.)
   - 근거: 2025년 추천채용 공고 가운데 연봉을 적은 것은 4월·8월 공고뿐이고 11월·12월 공고에는 연봉 표기가 없음
   - 출처: https://im.pusan.ac.kr/bbs/cse/2616/1717653/artclView.do, https://im.pusan.ac.kr/bbs/cse/2616/1735841/artclView.do, https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do
9. **기준일 지남** — `TKG태광.json` `analysis[4].points[2].t`
   - 원고: 블라인드 집계(2026. 10. 18.): 평점 3.2점, 리뷰 349건, 추천율 55%, 업계 대비 +0.5
   - 수정: 블라인드 집계(2026. 11. 10.): 평점 3.2점, 리뷰 352건, 추천율 54%, 업계 대비 +0.5
   - 근거: 2026. 11. 10. 페이지 표기 '평점 3.2 업계 평균 대비 +0.5 리뷰 352 추천율 54%'
   - 출처: https://www.teamblind.com/kr/company/TKG%ED%83%9C%EA%B4%91/reviews
10. **기준일 지남** — `TKG태광.json` `sources[8][1]`
   - 원고: 업계 대비 수치만 사용, 2026. 10. 18. 확인
   - 수정: 업계 대비 수치만 사용, 2026. 11. 10. 확인
   - 근거: 블라인드 수치를 11. 10. 값으로 바꿀 때 확인일도 함께 바꿈
   - 출처: https://www.teamblind.com/kr/company/TKG%ED%83%9C%EA%B4%91/reviews
11. **불일치** — `TKG태광.json` `jobs[0].when`
   - 원고: 같은 직무 2026. 3. 12.~3. 29.
   - 수정: 같은 직무 2026. 3. 13.~3. 29.
   - 근거: 채용 사이트 목록의 공고 247588 접수 시작이 2026-03-13 00:00(KST)
   - 출처: https://tkg.recruiter.co.kr/career/job
12. **불일치** — `TKG태광.json` `jobs[1].place`
   - 원고: 김해 본사(공고 근무지 표기: 경남)
   - 수정: 경남 김해시 김해대로 2635번길 26(본사, 공고 본문 표기)
   - 근거: 공고 261460 본문 '근무지: 경남 김해시 김해대로 2635번길 26'
   - 출처: https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=261460
13. **확인 불가** — `TKG태광.json` `analysis[1].points[1].sub[1]`
   - 원고: 연결 특허 142건 대부분은 배관재·소재 등 화학·소재 부문 것이다
   - 수정: 연결 특허는 142건이고 신발·배관재·C_PVC·소재 관련이다(부문별 건수는 공시되지 않았다)
   - 근거: 사업보고서는 '신발, 배관재 및 C_PVC, 소재 관련 국내외 특허는 총 142건'과 국가별 건수만 적어 '대부분 화학·소재'는 확인되지 않음
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351
14. **불일치** — `TKG태광.json` `analysis[0].points[1].sub[0]`
   - 원고: 생산은 베트남 5곳, 인도네시아 2곳, 인도·미얀마 각 1곳 등 9개 해외 종속법인이 맡는다(2025년)
   - 수정: 신발 업종 해외 종속법인은 베트남 5곳, 인도네시아 2곳, 인도·미얀마 각 1곳 등 9개다(2025년). 이 가운데 인도·미얀마 법인은 2025년 매출이 없다
   - 근거: 연결감사보고서 종속기업 요약재무에서 인도·미얀마 신발 법인의 2025년 매출이 '-'라 두 법인이 생산을 맡는다고 쓸 근거가 없음
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165
15. **불일치** — `TKG태광.json` `analysis[2].points[2].sub[1]`
   - 원고: 생산 거점은 베트남·인도네시아·인도·미얀마 4개국이고, 인도 법인은 2024년에 세웠다
   - 수정: 신발 종속법인은 베트남·인도네시아·인도·미얀마 4개국에 있고(인도·미얀마 법인은 2025년 매출 없음), 인도 법인은 2024년에 세웠다
   - 근거: 인도·미얀마 신발 법인의 2025년 매출이 '-'(연결감사보고서). 인도 법인 2024년 신규 설립은 사업보고서와 일치
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165, https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351
16. **불일치** — `TKG태광.json` `swot.O[0]`
   - 원고: 2024년 인도 생산법인을 세우는 등 생산 거점이 늘었다
   - 수정: 2024년 인도에 신발 종속법인을 세웠다(2025년 매출은 아직 없다)
   - 근거: 인도 법인은 2025년 매출 '-', 자산 1억 3,500만 원으로 생산 거점이 늘었다고 쓸 근거가 없음
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165, https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250331003351
17. **불일치** — `TKG태광.json` `plan8.rows[2][2]`
   - 원고: 4개국 9개 생산법인 지도
   - 수정: 4개국 9개 신발 종속법인 지도
   - 근거: 인도·미얀마 법인은 2025년 매출이 없어 '생산법인'보다 공시 표기(신발 업종 종속기업)에 맞춤
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165
18. **불일치** — `TKG태광.json` `summary`
   - 원고: 해외 9개 생산법인의
   - 수정: 해외 9개 신발 종속법인의
   - 근거: 인도·미얀마 법인은 2025년 매출이 없어 공시 표기(신발 업종 종속기업)에 맞춤
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165
19. **확인 불가** — `TKG태광.json` `analysis[3].points[0].sub[0]`
   - 원고: 모든 공고가 '해외여행(출장)에 결격사유 없음'을 자격으로 둔다
   - 수정: 본문을 연 채용 사이트 공고 4건이 모두 '해외여행에 결격사유 없음'을 자격으로 두고, 추천채용 공고 4건에도 같은 조건이 있다
   - 근거: 28건 중 본문을 연 것은 4건이고, 2025. 11.·2026. 1. 추천채용 게시물에는 이 문구가 없어 '모든 공고'는 확인되지 않음
   - 출처: https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497, https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=261460, https://im.pusan.ac.kr/bbs/cse/2616/1748454/artclView.do, https://im.pusan.ac.kr/bbs/cse/2616/1756250/artclView.do
20. **확인 불가** — `TKG태광.json` `ideas[0].problem`
   - 원고: 모든 공고가 해외여행 결격 없음을 요구하고
   - 수정: 본문을 확인한 공고가 모두 해외여행 결격 없음을 요구하고
   - 근거: '모든 공고'는 확인되지 않음(본문 확인 범위로 한정)
   - 출처: https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265497, https://tkg.recruiter.co.kr/app/jobnotice/view?systemKindCode=MRS2&jobnoticeSn=265492
21. **불일치** — `cards_regional.json` `R10(key=TKG태광).fields["사업과 경력 정보"]`
   - 원고: 생산은 해외 4개국 자회사 법인
   - 수정: 생산은 베트남·인도네시아 등 해외 자회사 법인
   - 근거: 신발 종속법인은 4개국에 있으나 인도·미얀마 법인은 2025년 매출이 없음(연결감사보고서)
   - 출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260330001165

중요도 순서: ① 인도네시아 사건 표현(1~3번) ② 부산대 추천채용 횟수와 연봉 표기 범위(4~8번) ③ 인도·미얀마 법인을 생산 거점으로 쓴 문장(14~18, 21번). 나머지는 날짜·표기 정정이다.

## 새로 확인된 사실

- 부산대 게시판 제목 검색(2026-11-10)에 2025-05-26 '[채용] TKG태광 보안팀 정보보안담당자(IT/보안) 신입 모집'이 있다. 취업전략과에 추천자 명단을 내는 방식이고 '초봉: 신입 군필기준 4100(미필 3900)'이라고 적었다. 같은 해 4월·8월 추천채용 공고의 4,200만 원과 다르므로, 원고의 연봉 흐름 문장은 '추천채용 공고 중 연봉을 적은 4건' 기준임을 밝혀 두는 편이 안전하다. https://im.pusan.ac.kr/bbs/cse/2616/1728004/artclView.do
- 같은 검색에서 2026-01-30 이후 TKG태광 추천채용 게시물은 없다. 채용 사이트 공고도 28건 그대로이고 모두 접수마감이다(새 공고 없음).
- 2026년 공시대상기업집단: 공정위 보도자료(2026-04-29, KDI 경제정보센터 게재본) 본문과 별첨 2(지정현황)·별첨 5(계열회사 현황) 엑셀에 '티케이지'·'TKG'가 없다. '태광'(48위)은 태광산업 계열이다. 미지정 그대로다. https://eiec.kdi.re.kr/policy/materialView.do?num=280329
- 공개매수신고서(2026-08-28 기준)의 계열회사는 상장 2사·비상장 45사로, 2025년 말 연결 종속 46개 뒤에 TKG Holdings USA Inc., TKG Solmics USA Inc.가 더해졌다. 원고는 '2025년' 기준이라 고칠 필요는 없다.
- 2026-11-03 이후 TKG태광 관련 사망사고·제재·임금체불·구조조정 보도는 검색 2회에서 찾지 못했다. 종속회사 TKG애강의 상장폐지 사유 발생·매매거래 정지를 다룬 딜사이트 기사는 검색 요약으로만 보았고 본문을 열지 못해 사실로 세지 않았다.

## 열지 못한 출처

- 회사 홈페이지 tkg.taekwang.com: 연결 실패(응답 없음). 회사 차원의 핵심가치·인재상은 여전히 미확인.
- 공정위 ftc.go.kr, 기업집단포털 egroup.go.kr: 연결이 끊김. KDI 경제정보센터에 실린 같은 보도자료와 별첨으로 대신 확인했다. 별첨 1(hwp)은 열지 않았다.
- 채용 사이트 공고 242005(베트남 치공구 주재원)·247588(2026-03 Costing) 본문: 301 응답으로 열리지 않아 목록의 제목·접수기간만 확인.
- 부산대 게시물 1705281(2025-01-17 추천채용 안내): '원하시는 페이지를 찾을 수가 없습니다'. 제목과 게시일만 확인.
- 딜사이트 TKG애강 기사(https://dealsite.co.kr/articles/171452): 본문 열지 않음(11/3 조사 때 403).
- 마감된 채용 사이트 공고의 사람인·잡코리아 사본: 찾지 못함. 그래서 공고 조건 일부는 확인(1)이다.
- 여수 사건의 고용노동부·환경부 조사 결과와 두 번째 매체 보도: 검색 2회에서 찾지 못함.
