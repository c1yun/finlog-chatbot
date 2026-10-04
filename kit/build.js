#!/usr/bin/env node
/*
 * FAQ 챗봇 키트 — 빌드 스크립트 (Node 18 이상, 설치할 것 없음)
 *
 *   node kit/build.js                  예시 4개를 kit/dist/ 에 만들고 kit/builder.html 도 새로 만든다
 *   node kit/build.js 고객폴더          고객폴더/config.json + faq.csv → kit/dist/<이름>/
 *   node kit/build.js 고객폴더 --out 출력폴더
 */
'use strict';
const fs = require('fs');
const path = require('path');
const A = require('./src/assemble.js');

const KIT = __dirname;
const SRC = path.join(KIT, 'src');
const read = (f) => fs.readFileSync(f, 'utf8');

function parts() {
  return {
    template: read(path.join(SRC, 'template.html')),
    css: read(path.join(SRC, 'style.css')),
    engine: read(path.join(SRC, 'engine.js')),
    ui: read(path.join(SRC, 'ui.js'))
  };
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function loadProject(dir) {
  const cfgPath = path.join(dir, 'config.json');
  const csvPath = path.join(dir, 'faq.csv');
  if (!fs.existsSync(cfgPath)) throw new Error(cfgPath + ' 파일이 없어요.');
  if (!fs.existsSync(csvPath)) throw new Error(csvPath + ' 파일이 없어요.');
  const config = JSON.parse(read(cfgPath).replace(/^﻿/, ''));
  // 로고 이미지 파일을 쓰면 HTML 안에 넣는다
  if (config.avatarFile) {
    const img = path.join(dir, config.avatarFile);
    const type = MIME[path.extname(img).toLowerCase()];
    if (!type) throw new Error('로고는 png, jpg, gif, webp, svg 파일만 쓸 수 있어요: ' + config.avatarFile);
    const buf = fs.readFileSync(img);
    if (buf.length > 300 * 1024) console.warn('  ⚠ 로고 파일이 300KB보다 커요. 챗봇이 느리게 열릴 수 있어요.');
    config.avatarImg = 'data:' + type + ';base64,' + buf.toString('base64');
    delete config.avatarFile;
  }
  const { items, errors } = A.rowsToItems(A.parseCSV(read(csvPath)));
  return { config, items, errors };
}

function buildProject(dir, outRoot, outName, publicUrl) {
  const name = outName || path.basename(path.resolve(dir));
  const { config, items, errors } = loadProject(dir);
  const fatal = errors.filter((e) => !e.warn);
  errors.forEach((e) => console.log(`  ${e.warn ? '⚠' : '✖'} ${e.row}번째 줄: ${e.msg}`));
  if (fatal.length) throw new Error(`${name}: 고쳐야 할 줄이 ${fatal.length}개 있어요.`);
  if (!items.length) throw new Error(`${name}: 질문·답변이 하나도 없어요.`);

  const out = path.join(outRoot, name);
  fs.mkdirSync(out, { recursive: true });
  const html = A.assemble(parts(), config, items);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.copyFileSync(path.join(SRC, 'widget.js'), path.join(out, 'widget.js'));
  fs.writeFileSync(path.join(out, '설치안내.txt'), guide(config, publicUrl));
  const cats = new Set(items.map((e) => e.cat).filter(Boolean)).size;
  console.log(`✔ ${name}: 질문 ${items.length}개 · 분류 ${cats}개 · ${(html.length / 1024).toFixed(0)}KB → ${path.relative(process.cwd(), out)}/`);
  return out;
}

function guide(config, publicUrl) {
  const url = publicUrl || 'https://○○○.netlify.app/';
  return [
    `${config.name || 'FAQ 챗봇'} — 설치 안내`,
    '',
    publicUrl ? '1) 챗봇 주소' : '1) 인터넷에 올리기 (무료)',
    publicUrl ? '   ' + publicUrl
      : '   GitHub Pages나 Netlify(가입 후 Drop)에 이 폴더를 올리면 https://○○○ 주소가 생깁니다.',
    '   이 주소를 인스타그램 프로필, 카카오톡 채널, 네이버 플레이스 소개에 넣으면 됩니다.',
    '',
    '2) 홈페이지에 떠 있는 버튼으로 붙이기 (선택)',
    '   홈페이지의 </body> 바로 앞에 아래 한 줄을 넣어 주세요.' + (publicUrl ? '' : ' 주소는 1)에서 받은 주소로 바꿔 주세요.'),
    '   ' + A.embedSnippet(url, config),
    '',
    '3) 매장 안내용 QR 코드',
    '   네이버 QR코드 같은 무료 생성기에 1)의 주소를 넣어 QR 이미지를 만들고, 계산대·테이블에 붙여 두세요.',
    '',
    '질문·답변을 고치려면 faq.csv(엑셀로 열림)를 고친 뒤 다시 빌드하세요.',
    ''
  ].join('\n');
}

/** 브라우저에서 쓰는 노코드 제작 도구(builder.html)를 만든다 */
function buildBuilder() {
  const examples = {};
  const exRoot = path.join(KIT, 'examples');
  fs.readdirSync(exRoot).forEach((slug) => {
    const dir = path.join(exRoot, slug);
    if (!fs.statSync(dir).isDirectory()) return;
    examples[slug] = { config: JSON.parse(read(path.join(dir, 'config.json'))), csv: read(path.join(dir, 'faq.csv')).replace(/^﻿/, '') };
  });
  const p = parts();
  const payload = { parts: p, widget: read(path.join(SRC, 'widget.js')), examples };
  const scriptSafe = (s) => s.replace(/<\/script/gi, '<\\/script');
  const map = {
    ASSEMBLE: scriptSafe(read(path.join(SRC, 'assemble.js'))),
    ENGINE: scriptSafe(p.engine),
    PAYLOAD: A.safeJson(payload)
  };
  // 한 번에 바꿔서, 끼워 넣은 코드 속 자리표시가 다시 바뀌지 않게 한다
  const html = read(path.join(SRC, 'builder.src.html'))
    .replace(/\/\*@@BUILDER_(ASSEMBLE|ENGINE|PAYLOAD)@@\*\/(null)?/g, (m, k) => map[k]);
  fs.writeFileSync(path.join(KIT, 'builder.html'), html);
  console.log(`✔ builder.html (${(html.length / 1024).toFixed(0)}KB)`);
}

function main() {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--out');
  const outRoot = oi >= 0 ? path.resolve(args[oi + 1]) : path.join(KIT, 'dist');
  const dirs = args.filter((a, i) => oi < 0 || (i !== oi && i !== oi + 1));
  try {
    if (dirs.length) dirs.forEach((d) => buildProject(d, outRoot));
    else {
      const exRoot = path.join(KIT, 'examples');
      fs.readdirSync(exRoot).filter((s) => fs.statSync(path.join(exRoot, s)).isDirectory())
        .forEach((s) => buildProject(path.join(exRoot, s), outRoot));
      buildBuilder();
    }
  } catch (err) {
    console.error('✖ ' + err.message);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { buildProject, buildBuilder, loadProject, parts };
