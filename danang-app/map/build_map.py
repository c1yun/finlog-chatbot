# Build map outputs from places.json + geo.json:
#   map/places_final.json  (for the app's 지도 view)
#   map/danang-places.kml  (Google My Maps import: folders per category, colored pins)
#   map/danang-places.csv  (alternative My Maps import: Latitude/Longitude/Category columns)
import json, os, csv
from xml.sax.saxutils import escape
H = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(H, 'places.json'), encoding='utf-8'))
G = json.load(open(os.path.join(H, 'geo.json'), encoding='utf-8'))

DROP = {'cruise'}  # pier coordinates could not be confirmed; the pier is described on the Dragon Bridge pin instead
CATS = [  # order = folder/section order
  ('stay', '숙소·공항', 'wht', '#5E6B79'),
  ('see', '가볼 곳', 'blu', '#1E4E8C'),
  ('food', '맛집', 'red', '#C8382B'),
  ('cafe', '카페·디저트', 'ylw', '#A86A12'),
  ('spa', '마사지·찜질방', 'purple', '#7A4FB0'),
  ('shop', '쇼핑', 'grn', '#2E7D5B'),
  ('help', '병원·비상', 'pink', '#C2185B'),
]
ROUTES = [  # per-day route stops (place ids, in order)
  ('금 10/30', ['hotel', 'bunchaca', 'hanmarket', 'museum', 'banhcanh', 'fineart', 'goldenlotus', 'namhien', 'apec', 'hotel']),
  ('토 10/31', ['hotel', 'bavui', 'jolie', 'queenspa', 'xliii', 'beni2', 'chexuantrang', 'hotel']),
  ('일 오전 호이안', ['hotel', 'hoianticket', 'chuacau', 'phuckien', 'reachingout', 'precious', 'caolau']),
  ('일 오후·저녁', ['caolau', 'traque', 'thanhha', 'chamriverside', 'quexua', 'hotel']),
  ('월 A안 하이반', ['hotel', 'miquang', 'haivanquan', 'lapan', 'hotel']),
  ('월 B안 시내', ['hotel', 'miquang', 'herbalspa', 'chammuseum', 'conmarket', 'lenspa', 'bepcuon', 'hotel']),
]

out = []
for p in P:
    if p['id'] in DROP: continue
    g = G.get(p['id']) or {}
    if not g.get('lat'): raise SystemExit('no coords for ' + p['id'])
    if p['id'] == 'dragonbridge':
        p = dict(p, note=p['note'] + ' 한강 유람선(일 21:00편)은 박당(Bạch Đằng) 강변 선착장에서 타요.')
    out.append(dict(p, lat=g['lat'], lng=g['lng']))
byid = {p['id']: p for p in out}
for _, stops in ROUTES:
    for s in stops: assert s in byid, s
json.dump({'cats': [{'k': k, 'label': l, 'color': c} for k, l, _, c in CATS], 'places': out,
           'routes': [{'label': l, 'stops': s} for l, s in ROUTES]},
          open(os.path.join(H, 'places_final.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

def gmaps(p): return 'https://www.google.com/maps/search/?api=1&query=' + __import__('urllib.parse').parse.quote(p['q'])
k = ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2">', '<Document>',
     '<name>2026다낭여행 — 가볼 곳·맛집·쇼핑</name>',
     '<description>엄마와 다낭 5일 (2026-10-29 ~ 11-03). 색: 파랑 가볼 곳 · 빨강 맛집 · 노랑 카페 · 보라 마사지 · 초록 쇼핑 · 분홍 병원 · 흰색 숙소.</description>']
for key, label, icon, _ in CATS:
    k.append(f'<Style id="s-{key}"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/{icon}-circle.png</href></Icon></IconStyle></Style>')
for key, label, _, _ in CATS:
    items = [p for p in out if p['cat'] == key]
    k.append(f'<Folder><name>{escape(label)}</name>')
    for p in items:
        desc = f"{p['when']}\n{p['vi']}\n{p['addr']}\n{p['note']}\n구글 지도: {gmaps(p)}"
        k.append(f'<Placemark><name>{escape(p["ko"])}</name><description>{escape(desc)}</description><styleUrl>#s-{key}</styleUrl>'
                 f'<Point><coordinates>{p["lng"]},{p["lat"]},0</coordinates></Point></Placemark>')
    k.append('</Folder>')
k += ['</Document>', '</kml>']
open(os.path.join(H, 'danang-places.kml'), 'w', encoding='utf-8').write('\n'.join(k))

with open(os.path.join(H, 'danang-places.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['Name', 'Category', 'Latitude', 'Longitude', 'When', 'Vietnamese name', 'Address', 'Note'])
    lab = {k: l for k, l, _, _ in CATS}
    for p in out: w.writerow([p['ko'], lab[p['cat']], p['lat'], p['lng'], p['when'], p['vi'], p['addr'], p['note']])
print(len(out), 'places;', {l: sum(1 for p in out if p['cat'] == k) for k, l, _, _ in CATS})
