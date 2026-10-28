# lists.json 출처 정리 (조사일 2026-10-28)

범례: [확인] = 출처에서 직접 확인 / [부분] = 2차 출처 또는 날짜 불명 / [확인 못 함] = 검증 실패, JSON에서 제외 또는 "현장 확인"으로 표기

## 환율
- [확인] 1 VND = 0.0514 KRW (갱신 2026-10-28 00:02 UTC) — https://open.er-api.com/v6/latest/VND
  → JSON의 모든 ₩ 환산은 1,000동 ≈ 51원 기준.

## 호텔 (Courtyard by Marriott Danang Han River)
- [확인] 전화 +84-236-3937979, 체크인 After 15:00, 체크아웃 Before 12:00, 주소 58 Bạch Đằng, 공항 4.35km·차로 약 14분, 프런트 24/7 — https://nz.trip.com/hotels/da-nang-hotel-detail-129078951/courtyard-by-marriott-danang-han-river (2026-10-28 열람)
- [부분] 체크인 창구 15:00~24:00, "late check-in subject to availability" — Expedia 검색 결과 요약 https://www.expedia.com/Da-Nang-Hotels-Courtyard-By-Marriott-Danang-Han-River.h116649616.Hotel-Information (직접 열람은 429로 실패)
- [확인 못 함] Marriott 공식 페이지 https://www.marriott.com/en-us/hotels/dadcy-courtyard-danang-han-river/overview (403). "Late arrival" 공식 문구는 확인하지 못해 JSON에는 일반 표현으로 적음.

## 비자·여권
- [확인] 한국 포함 13개국 일방 무비자 최대 45일, 2023-08-15 시행 — https://www.vietnam.travel/kr/plan-your-trip/visa-requirements (베트남 관광총국 공식, 2026-10-28 열람)
- [부분] 일방 무비자 입국 시 여권 잔여 유효기간 6개월 이상 (Law 51/2019/QH14, 2020-07-01 시행) — https://luatvietnam.vn/tin-van-ban-moi/highlights-new-conditions-of-exit-and-entry-for-foreigners-186-23286-article.html , https://lawnet.vn/ngan-hang-phap-luat/en/tu-van-phap-luat/bo-may-hanh-chinh/if-the-passport-period-is-6-months-are-foreigners-allowed-to-enter-vietnam-371721
- [확인 못 함] 외교부 0404.go.kr 베트남 페이지 직접 열람 실패. 재입국 간격(30일) 규정은 출처가 엇갈려 JSON에서 제외.

## 수하물·기내 규정
- [확인] 진에어: 국제선(일본·중국·동남아) 위탁 15kg/203cm, 기내 10kg/115cm, 부산-괌/다낭/세부 기내 12kg — https://kr.trip.com/flights/airline-lj/jin-air/ (진에어 규정 전재, 2026-10-28 열람). 공식 https://www.jinair.com/ready/carryBaggage 는 403.
- [부분] 에어부산: 일반운임 위탁 15kg·기내 10kg, 특가운임 위탁 없음 — https://dategom.com/?p=10979 (수정 2026-01-27), 여행상품 안내 https://www.tripstore.kr/products/TE27C3FAAA58E . 공식 https://www.airbusan.com/content/common/service/baggage/ 는 403.
- [확인] 보조배터리(국토부, 2025-03-01 시행): 100Wh 이하 5개, 100~160Wh 승인 시 2개, 선반 보관 금지, 기내 충전 금지, 단자 절연·지퍼백 1개씩 — https://news.bizwatch.co.kr/article/real_estate/2025/02/13/0015
- [확인] 2026-04-20부터 1인 2개, 각 160Wh 이하, 위탁 금지, 기내 충전·사용 전면 금지 (ICAO 표준, 국토부 발표) — https://www.khan.co.kr/article/202604081441001 (2026-04-08)
- [확인] 액체류: 개별 용기 100ml 이하, 1인 1L 지퍼백 1개(국제선) — https://www.airport.kr/ap_ko/906/subview.do (한국공항공사)
- [부분] 한국 입국 면세한도 US$800 — https://www.etoday.co.kr/news/view/2160787 (2022), 2026 정리 https://asiatop.co.kr/public-services/overseas-travel-duty-free-limit-2026/ . JSON에는 넣지 않음(피시소스 소량은 한도 내).

## 전압·플러그
- [부분] 베트남 220V/50Hz, 플러그 A·C·F, 한국 플러그 대부분 그대로 사용, 일부 숙소 3구 — https://vietnamguide.co.kr/베트남-전기-콘센트-전압-코드/ , https://www.vietnamtourism.com/ko/power-plugs-and-voltage-in-vietnam-what-to-pack

## 통신
- [확인] Viettel 관광객 eSIM 가격(2026-10-13 확인): 5G80T 5GB/일·15일 US$3.09(≈8만동), 5G150T 5GB/일·30일 US$5.79, ST70K 500MB·30일 US$2.70 — https://www.vietnamtourism.com/ko/esim/viettel
- [부분] 2026-03-01부터 현지 유심 개통 시 여권+얼굴 생체인증 필수; 공항 카운터는 시내보다 20~30% 비쌈 — https://vietnamguide.co.kr/베트남-유심-구입-정리/ , https://www.vietnamtourism.com/ko/wifi-and-internet-in-vietnam-sim-cards-esims-and-staying-con
- [확인 못 함] 다낭 공항 실물 유심 현장 가격(2026). JSON에는 eSIM 가격만 적음.

## 돈·ATM·팁
- [확인] VPBank·TPBank ATM 트래블로그/트래블월렛 수수료 무료, 1회 200만~500만동 — https://www.tripstore.kr/blog/베트남-환전-트래블카드-atm (2026-04-01)
- [부분] 한시장 금은방 환율이 공항보다 유리 — https://www.tripstore.kr/blog/다낭-환전-팁-총정리 ; 현금 US$5,000 또는 1,500만동 초과 세관 신고 — https://www.vietnamtourism.com/ko/exchanging-money-in-vietnam-banks-atms-and-gold-shops-compar
- [확인] 팁: 60~90분 마사지 5만~15만동(가장 흔한 범위 5만~10만동) 마사지사에게 직접, 대절 기사 하루 5만~10만동 — https://vietnamtourism.com/en/tipping-in-vietnam-2026-when-it-s-insulting-when-it-s-expected , https://goodmorning-hoian.com/en/tipping-in-vietnam/
- [확인 못 함] 한시장 금은방·공항 환전소의 2026-10 실제 고시 환율 수치.

## 교통
- [확인] 공항↔시내 그랩 평균 7만~12만동, 10~15분, 국제선 도착 1차선·2차선 GrabCar 픽업지점 — https://www.grab.com/global/ko/airport-rides/da-nang-international-airport/ (Grab 공식, 2026-10-28 열람)
- [확인] 다낭→호이안 그랩 4인승 25만~35만동, 45~60분 — https://www.vietnamtourism.com/ko/getting-to-hoi-an-from-da-nang-airport-and-beyond (2026-08-29 갱신)
- [확인] 다낭 공항 지정 택시 5개사 중 Xanh SM 포함; 신뢰 택시 Vinasun·Tiên Sa·Mai Linh·Xanh SM — https://danangairport.vn/airport-guide-transport-from-the-airport (검색 요약; 직접 열람은 503), https://sg.trip.com/guide/transport/da-nang-transport.html (2026-10-16)
- [부분] Xanh SM 전국 핫라인 1900 2088, 다낭 국제선 출구 직진 Slot 1~3 픽업 — https://www.greensm.com/vn-vi/news/trien-khai-dich-vu-xanh-sm-airport-tai-san-bay-quoc-te-da-nang-huong-dan-don-xe-va-bang-gia-dich-vu , https://skyjoy.vietjetair.com/en/?p=28710
- [확인 못 함] Xanh SM 다낭 공항 고정요금표 수치, 그랩 심야 할증 수치. JSON에는 "앱 표시 요금 확인"으로 적음.

## 긴급연락처
- [확인] 베트남 113 경찰 / 114 소방 / 115 구급, 베트남어만 — https://gov.uk/foreign-travel-advice/vietnam/getting-help , https://travel.gc.ca/assistance/embassies-consulates/vietnam
- [확인] 영사안전콜센터 +82-2-3210-0404 (24시간, 유료) — https://www.mofa.go.kr/us-houston-ko/wpge/m_5615/contents.do 등 외교부 공관 페이지
- [부분] 주다낭 총영사관: Tầng 3-4, Lô A1-2 Chương Dương, P. Khuê Mỹ, Q. Ngũ Hành Sơn / 대표 +84-23-6356-6100~4 / 긴급 +84-93-112-0404 (24시간) — https://vietnamguide.co.kr/베트남-대사관-영사관-연락처-주소/ (최종업데이트 2024-10-22). 공식 https://overseas.mofa.go.kr/vn-danang-ko/index.do 는 리다이렉트 오류로 열람 실패 → JSON에 "공식 홈페이지에서 한 번 더 확인" 문구 추가.
- [확인] Family Hospital: 73 Nguyễn Hữu Thọ, 응급 24/24 0236.3632.333, 한국어 라인 0911424040, 콜센터 19002250 — https://familyhospital.vn/en/ (2026-10-28 열람)
- [확인] Vinmec Da Nang: 0236 3711 111, 다국어(한국어 포함) 통역 — https://www.vinmec.com/eng/blog/contact_vinmec-healthcare-system-en , https://www.vinmec.com/eng/medical-tourism/ ; 야간엔 전화 통역 — https://www.trvlogue.com/en/vinmec-hospital-da-nang-review
- [확인] 호이안 세계문화유산보존센터 (+84) 235 3862367 / 3862946, 10B Trần Hưng Đạo — https://hoianheritage.danang.gov.vn/en/about.html

## 건강
- [확인] 다낭 뎅기열 2026-10-04 기준 4,200건 초과, 전년 동기 2.4배 — Tuổi Trẻ https://tuoitre.vn/bo-gay.html (태그 페이지, 2026-10-04 기사), 보조 https://tienphong.vn/da-nang-gan-4000-ca-mac-sot-xuat-huyet-tang-hon-2-lan-cung-ky-nam-truoc-post1880276.tpo
- [확인] 전국 2026년 1~5월 5만 건 초과, 2.5배 — Tuổi Trẻ 2026-06-11 (검색 요약)
- [확인 못 함] 다낭 CDC 공식 권고문. JSON은 "기피제 바르기" 일반 권고만.

## 수문(출발 전 확인)
- [확인] nchmf.gov.vn에 "BẢN TIN DỰ BÁO THỦY VĂN HÀNG NGÀY ... SÔNG VU GIA – THU BỒN TRONG MÙA LŨ (28/10/2026)" 게시 — https://nchmf.gov.vn/Kttv/vi-VN/1/index.html (2026-10-28 열람). 호이안 지점명은 홈페이지에 직접 표기되지 않음.

## 쇼핑
- [확인] 남오 피시소스 500ml 플라스틱 7만5천~9만동, 유리 2병 선물세트 18만~25만동, 판매처 한시장·꼰시장, OCOP 인증 확인 권고 — https://www.vietnambooking.com/du-lich/blog-du-lich/nuoc-mam-nam-o-da-nang.html (2026-04-02)
- [확인] 한시장 Bạch Đằng 쪽 입구 "Điểm giới thiệu và bán sản phẩm hàng Việt, OCOP" 100여 품목 — https://nhandan.vn/ocop/cho-diem-du-lich-da-nang-doi-moi-don-khach-du-lich-post746209.html (2023-04-04), https://nhandan.vn/da-nang-dua-vao-hoat-dong-cac-diem-ban-va-gioi-thieu-san-pham-post745894.html
- [확인 못 함] 해당 OCOP 판매점에 남오 피시소스가 현재 진열돼 있는지. JSON은 "판매점, 꼰시장"으로 적고 OCOP 표시 확인 권고.
- [확인] Àla 로스터리 K113/27(27, Alley 113) Nguyễn Chí Thanh, 07:30~18:00 — https://sprudge.com/the-sprudge-guide-to-coffee-in-da-nang-vietnam-308055.html , https://vinpearl.com/en/cafes-in-da-nang
- [부분] PASSPORT Coffee Roastery 03 Trường Thi 6, Hòa Cường(공항 근처), 현장 로스팅 — https://freakingnomads.com/workspace/passport-coffee-roastery (단일 출처)
- [부분] XLIII Specialty Coffee 422 Ngô Thị Sĩ, "베트남산 원두 없음(기준 미달)" 바리스타 발언 — https://amthuchiendai.vn/en/best-specialty-coffee-shops-in-da-nang-a-personal-selection/
- [확인 못 함] Lighthouse Coffee 주소·베트남 원두 판매 여부 → JSON에서 제외. 원두 가격 → "매장 확인".
- [확인] WinMart 빈컴 플라자 910A Ngô Quyền; 롯데마트 6 Nại Nam; 한시장 119 Trần Phú 06:00~19:00; 꼰시장 290 Hùng Vương 06:00~18:00 — https://mia.vn/cam-nang-du-lich/vincom-plaza-da-nang-18988 , https://vietnamspot.ru/en/blog/da-nang-shopping , https://www.localiiz.com/post/travel-guides-itineraries-vietnam-da-nang-shopping-markets-malls
- [부분] 캐슈 500g 124,000동(온라인, 날짜 불명) — https://chiaki.vn/hat-dieu-rang-muoi-tam-an-food-hop-500g-gion-bui-giau-dinh-duong → JSON에 "온라인 기준" 표기
- [확인 못 함] 다낭 WinMart·롯데마트 캐슈·말린 망고 2026 매장가 → 말린 망고는 "매장 확인".
- [확인] 다낭 마른 오징어 kg당 상품 110만, 중품 80만, 소형 70만동 (2025년 기준 표) — https://sunparadiseland.com/ko/SunParadiseLandDaNang/tin-tuc/danang-geon-eomul-pumjil-joh-eun-seonmul-gumae-chucheon-jangso-11856 (2025-10-21)
- [확인] Reaching Out Arts & Crafts 131 Trần Phú, 월~금 08:00~18:30, 토·일 09:00~16:30, +84 935 323 626 — https://www.arrivalguides.com/en/Travelguide/HOIAN/shopping/reaching-out-arts-crafts-129737 ; 공식 https://reachingoutvietnam.com/ (주소 미표기)
- [부분] 103 Nguyễn Thái Học 매장 주소는 날짜 불명 1건 — https://vietnam-concierge.webnode.vn/news-/da-nang-hoi-an/shops-and-supermarkets/ → JSON은 131 Trần Phú 사용
- [확인] 탄하 도자기 마을 입장 35,000동(성인) — https://hoiandaytrip.com/hoi-an-entrance-fee/ (2025 갱신); 50,000동 표기 출처도 있음(Vietnam Airlines 가이드) → JSON은 35,000동
- [부분] 코코넛 캔디 250g 48,000~88,000동 — https://beta.chus.vn/cocoa-palm-sugar-coconut-candy/ , https://beta.chus.vn/mixed-flavor-palm-sugar-coconut-candy-250g/ (브랜드 제품, 날짜 불명)
- [확인] 아티초크 티백 Ladophar 100개 105,000동 — https://www.pharmacity.vn/ (검색 요약; 페이지 날짜 미표기)
- [확인] Cao Sao Vàng 10g 18,000동/개 — https://nhathuoclongchau.com.vn/thuoc/cao-sao-vang-10g-opc-12-lo-4094.html ; 20g 40,000동 — https://www.pharmacity.vn/cao-sao-vang-20g.html
- [확인 못 함] 핀 필터 베트남 현지 2026 가격, 연꽃차 표준 가격, 라탄 가방 가격 → 핀은 "매장 확인", 연꽃차·라탄은 가격 없이 언급만/제외.

## 기타 메모
- 하이반 고개 정상 기온(시내보다 5~7℃ 낮음)은 검증하지 않음 → JSON은 "바람 세고 시내보다 서늘함"으로만 표기.
- 스파 4곳 주소·예약은 사용자 계획값 그대로 사용(검증 대상 아님).
- 베트남어 발음 표기는 중부·남부 발음 기준(rau → 라우).
