# Build the Sapporo single-file app: app.tmpl.html + data.json + manual.json + notes/lists.json + places_final.json + img/ -> sapporo-app.html
import json, os, base64
H = os.path.dirname(os.path.abspath(__file__))
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception as e: print('WARN', p, e); return d
data = load(os.path.join(H, 'data.json'), {'days': [], 'budget': [], 'skips': []})
manual = load(os.path.join(H, 'manual.json'), {})
lists = load(os.path.join(H, 'notes', 'lists.json'), {})
MAPD = load(os.path.join(H, 'places_final.json'), {})
keys = {s.get('img') for d in data['days'] for s in d.get('stops', []) if s.get('img')} | {e.get('img') for e in manual.get('extra', []) if e.get('img')}
keys.add((manual.get('cover') or {}).get('img') or 'poster')
keys.discard(None); keys.discard('')
IMG, CREDITS, missing = {}, {}, []
for k in sorted(keys):
    p = os.path.join(H, 'img', k + '.jpg')
    if not os.path.exists(p): missing.append(k); continue
    IMG[k] = 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
    c = load(os.path.join(H, 'img', 'credits', k + '.json'), None)
    if c: CREDITS[k] = {'title': c.get('title'), 'author': c.get('author'), 'license': c.get('license') or 'Flickr'}
def J(o): return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
t = open(os.path.join(H, 'app.tmpl.html'), encoding='utf-8').read()
out = (t.replace('/*DATA*/{}', J(data)).replace('/*LISTS*/{}', J(lists)).replace('/*MANUAL*/{}', J(manual))
        .replace('/*IMG*/{}', J(IMG)).replace('/*CREDITS*/{}', J(CREDITS)).replace('/*MAP*/{}', J(MAPD)))
dst = os.path.join(H, 'sapporo-app.html'); open(dst, 'w', encoding='utf-8').write(out)
print(f'built {dst}: {os.path.getsize(dst)/1e6:.2f} MB, images {len(IMG)}, missing {missing}, days {[d["date"] for d in data["days"]]}')
