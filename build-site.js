#!/usr/bin/env node
/*
 * 물어봇 사이트 빌드 — 데모, 소개 챗봇, 제작 도구, 고객 챗봇을 한 번에 만든다.
 *   node build-site.js
 * 고객 챗봇: clients/<이름>/config.json + faq.csv  →  c/<이름>/ (https://c1yun.github.io/mureobot/c/<이름>/)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { buildProject, buildBuilder } = require('./kit/build.js');

const ROOT = __dirname;
const BASE = 'https://c1yun.github.io/mureobot/';
const EX = path.join(ROOT, 'kit', 'examples');
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();

try {
  ['cafe', 'pension', 'academy', 'club'].forEach((s) => buildProject(path.join(EX, s), path.join(ROOT, 'demo'), s, BASE + 'demo/' + s + '/'));
  buildProject(path.join(EX, 'mureobot'), ROOT, 'bot', BASE + 'bot/');
  buildBuilder();
  fs.mkdirSync(path.join(ROOT, 'builder'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'kit', 'builder.html'), path.join(ROOT, 'builder', 'index.html'));
  const C = path.join(ROOT, 'clients');
  if (isDir(C)) {
    fs.readdirSync(C).filter((n) => isDir(path.join(C, n))).forEach((n) => buildProject(path.join(C, n), path.join(ROOT, 'c'), n, BASE + 'c/' + n + '/'));
  }
} catch (err) {
  console.error('✖ ' + err.message);
  process.exit(1);
}
