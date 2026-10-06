/* 定位 JSON 首个语法错误，打印上下文（node tools/diag.js part_4.json） */
'use strict';
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
const full = path.resolve(__dirname, '..', 'data', file);
const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
try {
  JSON.parse(text);
  console.log(file + ' 合法');
} catch (e) {
  const pos = e.position !== undefined ? e.position : (e.message.match(/position (\d+)/) || [])[1];
  if (!pos) { console.log(e.message); process.exit(0); }
  const p = parseInt(pos, 10);
  const upTo = text.slice(0, p);
  const line = upTo.split('\n').length;
  const col = p - (upTo.lastIndexOf('\n') + 1) + 1;
  const lines = text.split('\n');
  console.log(file + ' → ' + e.message);
  console.log('错误位置：第 ' + line + ' 行，第 ' + col + ' 列（字符偏移 ' + p + '）');
  for (let i = Math.max(0, line - 4); i < Math.min(lines.length, line + 3); i++) {
    console.log((i + 1 === line ? '>> ' : '   ') + (i + 1) + '| ' + lines[i]);
  }
}
