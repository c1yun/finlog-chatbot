# Build the single-file app: app.tmpl.html + data.json + manual.json + lists.json + images -> danang-app.html
import json, os, base64, glob, sys
H = os.path.dirname(os.path.abspath(__file__))
P2 = H  # img/ and img/credits/ live next to this script in the repo

def load(p, default):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception as e: print('WARN', p, e); return default

data = load(os.path.join(H, 'data.json'), {'days': [], 'budget': [], 'skips': []})
manual = load(os.path.join(H, 'manual.json'), {})
lists = load(os.path.join(H, 'lists.json'), {})
old_credits = load(os.path.join(P2, 'final_credits.json'), {})

# image keys actually referenced
keys = set()
for d in data['days'] + [manual.get('thu'), manual.get('tue')]:
    if d: keys.update(s.get('img') for s in d.get('stops', []) if s.get('img'))
keys.update(e.get('img') for e in manual.get('extra', []) if e.get('img'))
keys.discard('')

IMG, CREDITS, missing = {}, {}, []
for k in sorted(keys):
    new, old = os.path.join(P2, 'img', k + '.jpg'), os.path.join(P2, 'final', k + '.jpg')
    p = new if os.path.exists(new) else (old if os.path.exists(old) else None)
    if not p: missing.append(k); continue
    IMG[k] = 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
    cj = os.path.join(P2, 'img', 'credits', k + '.json')
    c = load(cj, None) if p == new else None
    if c: CREDITS[k] = {'title': c.get('title'), 'author': c.get('author'), 'license': c.get('license') or 'Flickr'}
    elif isinstance(old_credits.get(k), dict): CREDITS[k] = {'title': old_credits[k].get('title'), 'author': old_credits[k].get('author'), 'license': 'Flickr'}

MAPD = {}
for mp in (os.path.join(H, 'places_final.json'), os.path.join(H, '..', 'map', 'places_final.json')):
    if os.path.exists(mp): MAPD = load(mp, {}); break
tmpl = open(os.path.join(H, 'app.tmpl.html'), encoding='utf-8').read()
def J(o): return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
out = (tmpl.replace('/*DATA*/{}', J(data)).replace('/*LISTS*/{}', J(lists)).replace('/*MANUAL*/{}', J(manual))
       .replace('/*IMG*/{}', J(IMG)).replace('/*CREDITS*/{}', J(CREDITS))
       .replace('/*MAP*/{}', J(MAPD)))
dst = os.path.join(H, 'danang-app.html')
open(dst, 'w', encoding='utf-8').write(out)
print(f'built {dst}: {os.path.getsize(dst)/1e6:.2f} MB, images {len(IMG)} (new {sum(1 for k in IMG if os.path.exists(os.path.join(P2, "img", k + ".jpg")))}), missing {missing}, lists {list(lists.keys())}')
