# Wrap the artifact page into a full standalone PWA site for Netlify: index.html + manifest + service worker + icons
import os, re
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__))
app = open(os.path.join(H, '..', 'app', 'danang-app.html'), encoding='utf-8').read()
head = '''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1E4E8C" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F161F" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="엄마와 다낭">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)} body{margin:0} img{max-width:100%} [hidden]{display:none!important}</style>
'''
body_start = '</head>\n<body>\n'
tail = '''
<script>
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); }); }
</script>
</body>
</html>
'''
# the artifact file starts with <title> and a claude-specific meta; keep title, drop the claude meta
app = app.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
open(os.path.join(H, 'index.html'), 'w', encoding='utf-8').write(head + body_start + app + tail)

open(os.path.join(H, 'manifest.webmanifest'), 'w', encoding='utf-8').write('''{
  "name": "엄마와 다낭 5일",
  "short_name": "엄마와 다낭",
  "description": "다낭·호이안 5박 가이드: 날짜별 일정, 먹기, 마사지, 할 것, 쇼핑·준비물",
  "start_url": "./index.html#schedule",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F4F6F9",
  "theme_color": "#1E4E8C",
  "lang": "ko",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
''')
open(os.path.join(H, 'sw.js'), 'w', encoding='utf-8').write('''// Offline cache: the whole app is one HTML file, so cache it plus the manifest/icons.
const CACHE = 'danang-app-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts/maps go to the network as usual
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
''')
open(os.path.join(H, '_headers'), 'w').write('''/*
  Cache-Control: public, max-age=0, must-revalidate
/sw.js
  Cache-Control: no-cache
''')
# icons: indigo rounded square, lantern-orange sun over a river line (no text, no font dependency)
def icon(size, maskable=False, path='icon.png'):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pad = 0 if maskable else int(size * 0.04); r = int(size * (0.22 if not maskable else 0))
    d.rounded_rectangle([pad, pad, size - pad - 1, size - pad - 1], radius=r, fill=(30, 78, 140, 255))
    cx, cy = size * 0.5, size * 0.42; rr = size * 0.19
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(240, 148, 103, 255))
    for i, w in enumerate((0.62, 0.48, 0.34)):
        y = size * (0.66 + i * 0.075); d.rounded_rectangle([size * 0.5 - size * w / 2, y, size * 0.5 + size * w / 2, y + size * 0.035], radius=size * 0.02, fill=(236, 241, 246, 255))
    im.save(os.path.join(H, path))
icon(192, path='icon-192.png'); icon(512, path='icon-512.png'); icon(512, maskable=True, path='icon-512-maskable.png'); icon(180, path='apple-touch-icon.png')
print('site files:', sorted(os.listdir(H)))
