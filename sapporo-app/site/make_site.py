# Wrap the artifact page into a full standalone PWA site for Netlify: index.html + manifest + service worker + icons
import os, re
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__))
app = open(os.path.join(H, '..', 'sapporo-app.html'), encoding='utf-8').read()
head = '''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17202B" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="2027삿포로여행">
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
app = app.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '').replace('<title>2027삿포로여행</title>', '<title>2027삿포로여행</title>', 1)
open(os.path.join(H, 'index.html'), 'w', encoding='utf-8').write(head + body_start + app + tail)

open(os.path.join(H, 'manifest.webmanifest'), 'w', encoding='utf-8').write('''{
  "name": "2027삿포로여행",
  "short_name": "2027삿포로여행",
  "description": "엄마와 삿포로 4일: 날짜별 일정, 먹기, 쇼핑, 할 것, 준비물·지도",
  "start_url": "./index.html#schedule",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F2F5F8",
  "theme_color": "#FFFFFF",
  "lang": "ko",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
''')
open(os.path.join(H, 'sw.js'), 'w', encoding='utf-8').write('''// Offline cache. The whole app is one HTML file: serve it cache-first (stale-while-revalidate) so weak hotel wifi never leaves a blank screen.
const CACHE = 'sapporo-app-v1';
const SHELL = './index.html';
const ASSETS = [SHELL, './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts and map links go straight to the network
  const key = e.request.mode === 'navigate' ? SHELL : e.request;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(key, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const r = await net; return r || (await c.match(SHELL)) || Response.error();
  }));
});
''')
open(os.path.join(H, '_headers'), 'w').write('''/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Robots-Tag: noindex, nofollow
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Content-Type: application/manifest+json
''')
# icons: navy rounded square with the red Sapporo star over snow lines (no text, no font dependency)
def icon(size, maskable=False, path='icon.png'):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pad = 0 if maskable else int(size * 0.04); r = int(size * (0.22 if not maskable else 0))
    d.rounded_rectangle([pad, pad, size - pad - 1, size - pad - 1], radius=r, fill=(31, 78, 121, 255))
    cx, cy = size * 0.5, size * 0.42; rr = size * 0.19
    import math
    pts = [(cx + (rr if i % 2 == 0 else rr * 0.45) * math.sin(math.pi * i / 5), cy - (rr if i % 2 == 0 else rr * 0.45) * math.cos(math.pi * i / 5)) for i in range(10)]
    d.polygon(pts, fill=(179, 38, 46, 255))  # Sapporo red star over snowfields
    for i, w in enumerate((0.62, 0.48, 0.34)):
        y = size * (0.66 + i * 0.075); d.rounded_rectangle([size * 0.5 - size * w / 2, y, size * 0.5 + size * w / 2, y + size * 0.035], radius=size * 0.02, fill=(236, 241, 246, 255))
    im.save(os.path.join(H, path))
icon(192, path='icon-192.png'); icon(512, path='icon-512.png'); icon(512, maskable=True, path='icon-512-maskable.png'); icon(180, maskable=True, path='apple-touch-icon.png')
print('site files:', sorted(os.listdir(H)))
# map file for Google My Maps import (linked from the app's 지도 view on hosted copies)
import shutil as _sh
for _src in (os.path.join(H, '..', 'sapporo-places.kml'),):
    if os.path.exists(_src): _sh.copyfile(_src, os.path.join(H, 'sapporo-places.kml')) if os.path.abspath(_src) != os.path.abspath(os.path.join(H, 'sapporo-places.kml')) else None; break
