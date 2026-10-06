/* ============================================================
   燕京拾遗 · JSON 修复脚本
   修复子代理产出的分片中常见问题：
   1) 字符串未闭合（行尾缺 " 或 ","）
   2) 行内注释 // 或 /* ... *\/（会破坏 JSON）
   3) 尾部多余逗号
   用法: node tools/fixjson.js part_4.json part_6.json
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

/* 统计一行中「未转义的双引号」数量 */
function quoteCount(line) {
  let n = 0, i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"') n++;
    i++;
  }
  return n;
}

function stripCommentsOutsideStrings(text) {
  const lines = text.split('\n');
  const out = [];
  let inStr = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let result = '';
    let i = 0;
    let checkedComment = false;
    while (i < line.length) {
      const c = line[i];
      if (c === '\\') { result += c + (line[i + 1] || ''); i += 2; continue; }
      if (c === '"') { inStr = !inStr; result += c; i++; continue; }
      if (!inStr && !checkedComment) {
        if (c === '/' && line[i + 1] === '/') {
          // 行注释：截断到行尾（但要避免误伤 http:// 这类出现在字符串里的）
          break;
        }
        if (c === '/' && line[i + 1] === '*') {
          const end = line.indexOf('*/', i + 2);
          if (end !== -1) { i = end + 2; continue; }
          break;
        }
      }
      if (!inStr) checkedComment = true;
      result += c;
      i++;
    }
    out.push(result);
  }
  return out.join('\n');
}

function removeTrailingCommas(text) {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

function repair(file) {
  const full = path.join(DATA_DIR, file);
  let text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');

  let parsed = null;
  try { parsed = JSON.parse(text); }
  catch (e) {
    /* 继续修复 */
  }
  if (parsed) { console.log(file + ' 已合法，无需修复'); return false; }

  const before = text;

  /* 1) 去掉字符串外的注释 */
  text = stripCommentsOutsideStrings(text);

  /* 2) 逐行补闭合引号 */
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t.startsWith('"')) continue;
    if (quoteCount(line) % 2 === 0) continue;      // 引号成对，字符串已闭合
    // 以引号开头的行若引号数为奇数，说明字符串未闭合（键名行的值漏了收尾引号）
    const next = (lines[i + 1] || '').trim();
    const closesObject = /^[}\]]/.test(next);
    const isLast = !lines[i + 1] || lines[i + 1].trim() === '';
    lines[i] = line + (closesObject || isLast ? '"' : '",');
  }
  text = lines.join('\n');

  /* 3) 尾随逗号 */
  text = removeTrailingCommas(text);

  if (text === before) { console.log(file + ' 内容未变化但仍非法，需人工检查'); return false; }
  fs.writeFileSync(full, text, 'utf8');

  try {
    JSON.parse(text);
    console.log(file + ' ✓ 修复成功');
    return true;
  } catch (e) {
    console.log(file + ' ✗ 仍无法解析：' + e.message);
    return false;
  }
}

const files = process.argv.slice(2);
if (!files.length) { console.log('用法: node tools/fixjson.js <part_*.json ...>'); process.exit(1); }
files.forEach(repair);
