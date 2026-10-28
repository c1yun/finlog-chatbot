# Parse pamphlet2 day fragments into app/data.json
# usage: python3 -I to_app.py [pamphlet_dir=../pamphlet2] [out=data.json]
import sys, re, json, os
from bs4 import BeautifulSoup

src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pamphlet2')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')

IMG_RE = re.compile(r'\{\{img:([a-z0-9_]+)\}\}')

def inner(el):
    return ''.join(str(c) for c in el.contents).strip() if el else ''

def text(el):
    return re.sub(r'\s+', ' ', el.get_text(' ', strip=True)) if el else ''

def parse_days(html):
    soup = BeautifulSoup(html, 'lxml')
    days = []
    for sec in soup.select('section.day'):
        head = sec.select_one('.day-meta')
        h2 = head.select_one('h2')
        wx = h2.select_one('.wx')
        wx_t = text(wx) if wx else ''
        if wx: wx.extract()
        day = {
            'num': text(sec.select_one('.day-num')),
            'date': text(head.select_one('.date')),
            'title': text(h2),
            'wx': wx_t,
            'summary': text(head.select_one('.small.muted')),
            'notes': [inner(n) for n in sec.select(':scope > .note')],
            'stops': [],
            'planb': inner(sec.select_one('.planb')),
        }
        for st in sec.select('.stop'):
            t = st.select_one('.t')
            sub = t.select_one('.small') if t else None
            variant = text(sub) if sub else ''
            if sub: sub.extract()
            img = st.select_one('.ph img')
            m = IMG_RE.search(img['src']) if img else None
            meta = {}
            dl = st.select_one('dl.meta')
            if dl:
                for dt, dd in zip(dl.select('dt'), dl.select('dd')):
                    meta[text(dt)] = inner(dd)
            day['stops'].append({
                'time': text(t).replace(' ', ''),
                'variant': variant,
                'img': m.group(1) if m else '',
                'chips': [text(c) for c in st.select('.chip')],
                'title': text(st.select_one('h3')),
                'vi': text(st.select_one('.vi')),
                'why': inner(st.select_one('p.why')),
                'meta': meta,
            })
        days.append(day)
    return days

days = []
for f in ('days_fri_sat_mon.html', 'days_sun.html'):
    days += parse_days(open(os.path.join(src, f), encoding='utf-8').read())
order = {'FRI': 0, 'SAT': 1, 'SUN': 2, 'MON': 3}
days.sort(key=lambda d: order.get(d['date'][:3], 9))
LONG = {'FRI': '10월 30일 금요일', 'SAT': '10월 31일 토요일', 'SUN': '11월 1일 일요일 — 호이안', 'MON': '11월 2일 월요일 — 밤 비행기'}
for d in days: d['long'] = LONG.get(d['date'][:3], d['date'])

# budget rows
bsoup = BeautifulSoup(open(os.path.join(src, 'budget.html'), encoding='utf-8').read(), 'lxml')
budget = []
for tr in bsoup.select('tr'):
    tds = tr.select('td')
    if len(tds) >= 3:
        budget.append({'item': text(tds[0]), 'krw': text(tds[1]), 'note': text(tds[2]), 'total': 'pick' in (tr.get('class') or [])})

# skips
ssoup = BeautifulSoup(open(os.path.join(src, 'skips.html'), encoding='utf-8').read(), 'lxml')
skips = []
for row in ssoup.select('.row'):
    v = row.select_one('.verdict'); b = row.select_one('b'); s = row.select_one('.small')
    skips.append({'verdict': text(v), 'name': text(b), 'why': text(s)})

json.dump({'days': days, 'budget': budget, 'skips': skips}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('days', [(d['date'], len(d['stops'])) for d in days], '| budget', len(budget), '| skips', len(skips), '->', out)
