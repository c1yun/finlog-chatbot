# Build Sapporo map outputs from notes/places.json (coordinates checked against Google Maps names on 2026-10-29):
#   ../places_final.json     (the app's 지도 view: categories, pins, day routes)
#   ../sapporo-places.kml    (Google My Maps import: one folder per category, colored pins)
#   ../sapporo-places.csv    (alternative My Maps import)
import json, os, csv, re, urllib.parse
from xml.sax.saxutils import escape
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '..')
SRC = {p['id']: p for p in json.load(open(os.path.join(R, 'notes', 'places.json'), encoding='utf-8'))}

CATS = [  # order = folder/section order
  ('stay', '숙소·공항·역', 'wht', '#5B6877'),
  ('see', '가볼 곳', 'blu', '#1F4E79'),
  ('food', '맛집', 'red', '#B3262E'),
  ('cafe', '카페·디저트', 'ylw', '#9A6A0B'),
  ('onsen', '온천·족욕·마사지', 'purple', '#6E4BA8'),
  ('shop', '쇼핑', 'grn', '#2E7D5B'),
  ('help', '병원·비상', 'pink', '#C2185B'),
]
# id: (category, Korean label, when, Google Maps query, short note)
PL = {
  'hotel': ('stay', '삿포로 그랜드 호텔 (숙소)', '3/9 화 ~ 3/12 금', 'Sapporo Grand Hotel', '체크인 15:00 · 체크아웃 11:00. 지하보행공간(치카호)과 바로 연결. 대욕장·사우나 없음.'),
  'cts_intl': ('stay', '신치토세 공항 국제선', '화 11:30 도착 · 금 12:30 출발', 'New Chitose Airport International Terminal', '출국 날에는 짐 부치기 전에 면세 환급 키오스크.'),
  'cts_dom': ('stay', '신치토세 공항 국내선 (3층 식당·2층 기념품·지하 JR)', '화 점심 · 금 기념품', 'New Chitose Airport Domestic Terminal', '국제선 2층에서 연결통로로 10~12분.'),
  'sapporo_stn': ('stay', 'JR 삿포로역', '화 도착 · 수 투어 집합(북쪽 출구) · 금 출발', 'Sapporo Station', '호텔에서 지하로 엄마 걸음 12분, 택시 5분.'),
  'kappa_liner_stop': ('stay', '갓파라이너 승강장 (삿포로역앞 27번)', '목 09:35 (A안)', '43.066778,141.354333', '호쿠렌빌딩 앞. 26번과 헷갈리지 않기.'),
  'clock': ('see', '삿포로 시계탑', '화 16:00', 'Sapporo Clock Tower', '8:45~17:10 · ¥350. 길 건너 촬영 플라자에서 정면 사진.'),
  'odori_park': ('see', '오도리공원', '화 17:00', 'Odori Park Sapporo', '3월엔 눈이 질척해요. 짧게 걷기.'),
  'tvtower': ('see', '삿포로 TV타워 전망대', '화 17:15', 'Sapporo TV Tower', '9:00~22:00 · ¥1,200. 일몰 17:33.'),
  'akapla': ('see', '아카프라 일루미네이션', '화 20:40', 'Sapporo Kita 3-jo Plaza Akapla', '3월 14일까지. 호텔 바로 북쪽.'),
  'biei_shirahige': ('see', '흰수염폭포', '수 투어', 'Shirahige Waterfall Biei', '다리 위가 얼어 있어요. 아이젠.'),
  'biei_xmastree': ('see', '크리스마스트리 나무', '수 투어', 'Christmas Tree Biei', '밭 안 출입 금지.'),
  'biei_takushinkan': ('see', '탁신관 자작나무숲', '수 투어', 'Takushinkan Biei', '갤러리 무료, 겨울 10:00~16:00.'),
  'biei_kenmary': ('see', '켄과메리 나무', '수 투어(차창)', 'Ken and Mary Tree Biei', '대부분 버스 창으로 봐요.'),
  'biei_shikisai': ('see', '시키사이노오카 설원', '수 투어', 'Shikisai no Oka Biei', '9:10~17:00 · 썰매·알파카. 식당은 수요일 휴무.'),
  'biei_bluepond': ('see', '청의 호수 (라이트업 투어만)', '수 저녁 (선택)', 'Shirogane Blue Pond', '3월 낮엔 눈에 덮여요. 저녁 조명 투어에서만.'),
  'jozankei_gensen_park': ('onsen', '조잔케이 원천공원 족욕', '목 10:40 (A안)', 'Jozankei Gensen Park', '7:00~21:00 · 무료. 수건 챙기기.'),
  'jozankei_futami_ashiyu': ('onsen', '후타미 족욕 (지붕 있음)', '목 (A안)', 'Futami Foot Bath Jozankei', '눈 와도 이용 가능 · 무료.'),
  'jozankei_kappa_tegyu': ('onsen', '갓파 가족 소원 손온천', '목 (A안)', 'Kappa Kazoku no Negaikake Teyu Jozankei', '갓파 동상에 물을 끼얹고 소원 빌기.'),
  'jozankei_millione': ('onsen', '호텔 밀리오네 당일 온천', '목 12:00 (A안)', 'Jozankei Manseikaku Hotel Milione', '12:00~20:00(접수 18:00) · ¥1,500. 온천패스로 입장.'),
  'momiriko': ('onsen', '모미리코 발마사지', '목 20:20 (선택)', 'Momileeco Massage Sapporo', '풋케어 60분 ¥6,300 · 개인룸 · 카드 OK.'),
  'yukakyo': ('onsen', '스스키노 천연온천 유카쿄', '목 저녁 (선택)', 'Susukino Tennen Onsen Yukakyo', '10:00~24:00 · ¥2,750 · 011-513-8107.'),
  'honoka': ('onsen', '여성 전용 고미치노유 호노카', '아무 저녁 (여성만)', 'Komichinoyu Honoka Sapporo', '24시간 · ¥1,350~ · 암반욕.'),
  'otaru_canal': ('see', '오타루 운하 (아사쿠사바시)', '목 10:00 (B안)', 'Asakusa Bridge Otaru Canal', '엽서 구도 사진 명소. 얼음길 주의.'),
  'otaru_sakaimachi': ('shop', '사카이마치 거리', '목 10:45 (B안)', 'Sakaimachi Street Otaru', '가게 대부분 9:00~18:00.'),
  'otaru_orgel': ('shop', '오타루 오르골당 본관', '목 12:00 (B안)', 'Otaru Music Box Museum Main Building', '9:00~18:00 · 무료 입장 · 앞에 증기시계.'),
  'susukino_nikka': ('see', '스스키노 니카 간판', '목 18:40', 'Susukino Nikka Whisky Sign', '호객꾼은 따라가지 않기.'),
  'cts_matsuo': ('food', '마쓰오 징기스칸 (공항 국내선 3층)', '화 12:45', 'Matsuo Jingisukan New Chitose Airport', '68석 · 램 세트 ¥2,600 · 밥 리필.'),
  'cts_ramen_dojo': ('food', '라멘도장 · 에비소바 이치겐 (공항 3층)', '화 점심 대안', 'Ebisoba Ichigen New Chitose Airport', '새우 라멘 ¥990.'),
  'suage4': ('food', '스아게4 수프카레', '화 19:35', 'Soup Curry Suage4 Sapporo', '11:00~21:00(LO 20:30) · 카드 OK · 예약 없음.'),
  'suage_plus': ('food', '스아게+ 수프카레 (미나미4조, 대안)', '화 저녁 대안', 'Soup Curry Suage+ Sapporo', '현금·PayPay만 · 계단 2층 · 줄 김.'),
  'junpei': ('food', '준페이 에비동', '수 12:40 (투어)', 'Junpei Biei', '11:00~15:00 · 월요일 휴무 · ¥1,800 · 현금.'),
  'shiki_hanamaru': ('food', '시키하나마루 시계탑점 (스시)', '수 19:15', 'Shiki Hanamaru Tokeidai Sapporo', '전화 예약 011-231-0870(2/1부터).'),
  'hanamaru_miredo': ('food', '회전초밥 하나마루 miredo점 (대안)', '수 저녁 대안', 'Nemuro Hanamaru miredo Sapporo', '11:00~22:00 · 예약 없음 · 발권기.'),
  'kani_honke': ('food', '카니혼케 역앞 본점 (게 요리)', '목 17:00', 'Kani Honke Sapporo Station Main Branch', '11:30~22:00 · 예약 011-222-0018.'),
  'ramen_yokocho': ('food', '원조 삿포로 라멘요코초 (대안)', '목 저녁 대안', 'Ganso Ramen Yokocho Sapporo', '가게마다 시간이 달라요.'),
  'kinotoya': ('cafe', '키노토야 오도리공원점', '화 16:30', 'Kinotoya cafe Odori Park Sapporo', '오무파르페 ¥754 · 지하 13번 출구 직결.'),
  'otaru_letao': ('cafe', '르타오 본점 (오타루)', '목 (B안)', 'LeTAO Main Store Otaru', '2층 카페 · 더블프로마주.'),
  'otaru_kitakaro': ('cafe', '키타카로 오타루 본관', '목 (B안)', 'Kitakaro Otaru Main Shop', '슈크림 · 공항 2층에서도 팔아요.'),
  'tokyu': ('shop', '도큐백화점', '화 18:40', 'Tokyu Department Store Sapporo', '10:00~20:00 · 면세 10층 · 7층 유니클로·GU.'),
  'donki': ('shop', 'MEGA 돈키호테 다누키코지 본점', '목 19:15', 'MEGA Don Quijote Sapporo Tanukikoji', '24시간 · 여권 챙기기.'),
  'cts_royce': ('shop', '공항 국내선 2층 기념품 (로이즈 등)', '금 09:30', "Royce' New Chitose Airport", '로이즈 8:00~19:30, 키타카로·르타오 8:00~20:00.'),
  'consulate_kr': ('help', '주삿포로 대한민국 총영사관', '여권 분실 때', 'Consulate General of the Republic of Korea in Sapporo', '011-218-0288 · 근무시간 외 +82-2-3210-0404.'),
  'hosp_city': ('help', '시립삿포로병원 (구급센터)', '응급할 때', 'Sapporo City General Hospital', '011-726-2211 · 먼저 #7119나 119.'),
  'hosp_tokushukai': ('help', '삿포로히가시 도쿠슈카이병원', '외국어 진료', 'Sapporo Higashi Tokushukai Hospital', '외국어 지원 · 가기 전에 전화.'),
}
ROUTES = [  # (label, stops, travel mode). Mobile browsers take at most 3 waypoints, and transit takes none
  ('화 공항 → 호텔 (JR)', ['cts_dom', 'hotel'], 'transit'),
  ('화 오후 시계탑·TV타워', ['hotel', 'clock', 'kinotoya', 'tvtower'], 'walking'),
  ('화 저녁 도큐·수프카레', ['tvtower', 'hotel', 'tokyu', 'suage4', 'akapla'], 'walking'),
  ('수 비에이 투어 (버스)', ['sapporo_stn', 'biei_shirahige', 'biei_takushinkan', 'junpei', 'biei_shikisai'], 'driving'),
  ('목 온천: 호텔 → 조잔케이', ['hotel', 'jozankei_gensen_park'], 'transit'),
  ('목 온천: 족욕·온천 산책', ['jozankei_gensen_park', 'jozankei_kappa_tegyu', 'jozankei_futami_ashiyu', 'jozankei_millione'], 'walking'),
  ('목 오타루: 호텔 → 운하', ['hotel', 'otaru_canal'], 'transit'),
  ('목 오타루: 운하 → 오르골당', ['otaru_canal', 'otaru_sakaimachi', 'otaru_letao', 'otaru_orgel'], 'walking'),
  ('목 저녁: 게 요리 → 스스키노', ['kani_honke', 'susukino_nikka'], 'transit'),
  ('목 저녁: 다누키코지 산책', ['susukino_nikka', 'donki', 'momiriko'], 'walking'),
  ('금 호텔 → 공항 (JR)', ['hotel', 'cts_intl'], 'transit'),
]
clean = lambda a: re.sub(r'\s*\((?:[^()]*[가-힣][^()]*)\)', '', a or '').strip()
out = []
for pid, (cat, ko, when, q, note) in PL.items():
    src = SRC[pid]
    out.append({'id': pid, 'cat': cat, 'ko': ko, 'vi': src.get('ja', ''), 'addr': clean(src.get('addr', '')), 'q': q, 'when': when, 'note': note,
                'lat': src['lat'], 'lng': src['lng']})
byid = {p['id']: p for p in out}
for _, stops, mode in ROUTES:
    assert len(stops) <= 5 and (mode != 'transit' or len(stops) == 2)
    for s in stops: assert s in byid, s
json.dump({'cats': [{'k': k, 'label': l, 'color': c} for k, l, _, c in CATS], 'places': out,
           'routes': [{'label': l, 'stops': s, 'mode': m} for l, s, m in ROUTES]},
          open(os.path.join(R, 'places_final.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

gm = lambda p: 'https://www.google.com/maps/search/?api=1&query=' + urllib.parse.quote(p['q'])
k = ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2">', '<Document>',
     '<name>2027삿포로여행 — 가볼 곳·맛집·쇼핑·온천</name>',
     '<description>엄마와 삿포로 4일 (2027-03-09 ~ 03-12). 색: 파랑 가볼 곳 · 빨강 맛집 · 노랑 카페 · 보라 온천·마사지 · 초록 쇼핑 · 분홍 병원 · 흰색 숙소·공항.</description>']
for key, label, icon, _ in CATS:
    k.append(f'<Style id="s-{key}"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/{icon}-circle.png</href></Icon></IconStyle></Style>')
for key, label, _, _ in CATS:
    k.append(f'<Folder><name>{escape(label)}</name>')
    for p in [p for p in out if p['cat'] == key]:
        desc = f"{p['when']}\n{p['vi']}\n{p['addr']}\n{p['note']}\n구글 지도: {gm(p)}"
        k.append(f'<Placemark><name>{escape(p["ko"])}</name><description>{escape(desc)}</description><styleUrl>#s-{key}</styleUrl>'
                 f'<Point><coordinates>{p["lng"]},{p["lat"]},0</coordinates></Point></Placemark>')
    k.append('</Folder>')
k += ['</Document>', '</kml>']
open(os.path.join(R, 'sapporo-places.kml'), 'w', encoding='utf-8').write('\n'.join(k))
with open(os.path.join(R, 'sapporo-places.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['Name', 'Category', 'Latitude', 'Longitude', 'When', 'Japanese name', 'Address', 'Note'])
    lab = {k: l for k, l, _, _ in CATS}
    for p in out: w.writerow([p['ko'], lab[p['cat']], p['lat'], p['lng'], p['when'], p['vi'], p['addr'], p['note']])
print(len(out), 'places;', {l: sum(1 for p in out if p['cat'] == k) for k, l, _, _ in CATS})
