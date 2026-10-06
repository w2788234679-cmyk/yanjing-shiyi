/* ============================================================
   燕京拾遗 · 构建脚本（Node）
   1) 合并 data/part_*.json → assets/js/data.js
   2) 校验字段完整性与典故 id 关联
   3) 按 assets/img/spots/<id>-N.jpg 实际存在情况注入 cover / image
   用法: node tools/build.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const IMG_DIR = path.join(ROOT, 'assets', 'img', 'spots');
const OUT = path.join(ROOT, 'assets', 'js', 'data.js');

const REQUIRED = ['id', 'name', 'category', 'district', 'visitTime', 'ticket', 'coords', 'summary', 'highlights'];
const LISTS = {
  history: ['era', 'title', 'text'],
  facts: ['title', 'text'],
  figures: ['name', 'role', 'text'],
  artifacts: ['name', 'where', 'text'],
  clues: ['q', 'hint', 'answer', 'reveal'],
  stories: ['id', 'title', 'text'],
  galleries: ['name', 'items']
};

const errs = [];
const warns = [];

function err(scope, msg) { errs.push(scope + ': ' + msg); }
function warn(scope, msg) { warns.push(scope + ': ' + msg); }

/* ---------- 1. 读取分片 ---------- */
const parts = fs.readdirSync(DATA_DIR)
  .filter(f => /^part_\d+\.json$/i.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

if (!parts.length) {
  console.error('未找到 data/part_*.json，构建中止');
  process.exit(1);
}

const spots = [];
parts.forEach(p => {
  let raw;
  try {
    raw = fs.readFileSync(path.join(DATA_DIR, p), 'utf8').replace(/^\uFEFF/, '');
    JSON.parse(raw);
  } catch (e) {
    err(p, 'JSON 解析失败 — ' + e.message);
    return;
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) { err(p, '顶层不是数组'); return; }
    arr.forEach(s => spots.push(s));
  } catch (e) {
    err(p, '解析异常 — ' + e.message);
  }
});

/* ---------- 2. 校验 ---------- */
const seenIds = new Set();
const storyIdOwner = new Map();

spots.forEach(s => {
  const tag = s.id || s.name || '(未命名)';
  REQUIRED.forEach(k => {
    if (s[k] === undefined || s[k] === null || s[k] === '') err(tag, '缺少必填字段 ' + k);
  });
  if (seenIds.has(s.id)) err(tag, 'id 重复');
  seenIds.add(s.id);

  if (!Array.isArray(s.coords) || s.coords.length !== 2) err(tag, 'coords 格式错误');
  else if (typeof s.coords[0] !== 'number' || s.coords[1] !== undefined && typeof s.coords[1] !== 'number') warn(tag, 'coords 需为数字');

  Object.keys(LISTS).forEach(key => {
    const arr = s[key];
    if (!Array.isArray(arr) || !arr.length) { err(tag, '缺少 ' + key + '（至少 1 条）'); return; }
    arr.forEach((item, i) => {
      LISTS[key].forEach(f => {
        if (item[f] === undefined || item[f] === '') err(tag, key + '[' + i + '] 缺少 ' + f);
      });
    });
    if (key === 'clues' && arr.length < 2) warn(tag, '故事线索不足 2 条');
    if (key === 'stories') {
      arr.forEach((st, i) => {
        if (storyIdOwner.has(st.id)) err(tag, '典故 id 重复：' + st.id + '（已属 ' + storyIdOwner.get(st.id) + '）');
        storyIdOwner.set(st.id, tag);
        if (st.id && st.id.indexOf(s.id) !== 0) warn(tag, '典故 id "' + st.id + '" 未以景点 id 开头');
      });
    }
  });

  const storyIds = new Set((s.stories || []).map(x => x.id));
  (s.galleries || []).forEach((g, gi) => {
    (g.items || []).forEach((it, ii) => {
      if (it.story && !storyIds.has(it.story)) err(tag, 'gallery[' + gi + '][' + ii + '] 的 story 指向不存在的典故：' + it.story);
    });
  });
});

/* ---------- 3. 注入图片路径 ---------- */
let imgRoot = IMG_DIR;
if (!fs.existsSync(imgRoot)) {
  try { fs.mkdirSync(imgRoot, { recursive: true }); } catch (e) {}
}

spots.forEach(s => {
  if (!fs.existsSync(imgRoot)) return;
  const files = fs.readdirSync(imgRoot)
    .filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))
    .filter(f => f.startsWith(s.id + '-'))
    .sort((a, b) => {
      const na = parseInt(a.split('-')[1], 10) || 0;
      const nb = parseInt(b.split('-')[1], 10) || 0;
      return na - nb;
    });
  if (!files.length) return;
  s.cover = 'assets/img/spots/' + files[0];
  const flat = [];
  (s.galleries || []).forEach(g => (g.items || []).forEach(it => flat.push(it)));
  files.slice(1).forEach((f, i) => {
    if (flat[i]) flat[i].image = 'assets/img/spots/' + f;
  });
});

/* ---------- 4. 输出 data.js ---------- */
const payload = JSON.stringify(spots);
const header = `/* 燕京拾遗 · 景点文化数据（由 tools/build.js 自动生成，请勿手改）
 * 来源：data/part_*.json
 * 景点数：${spots.length}
 */
(function (window) {
  'use strict';
  var RAW = ${payload};

  var index = {};
  RAW.forEach(function (s) { index[s.id] = s; });

  window.BJT = window.BJT || {};
  window.BJT.RAW = RAW;

  window.BJT.data = {
    ready: function () { return RAW.length > 0; },
    all: function () { return RAW; },
    byId: function (id) { return index[String(id)] || null; },
    randomId: function () { return RAW[Math.floor(Math.random() * RAW.length)].id; },
    stats: function () {
      var t = { spotTotal: RAW.length, storyTotal: 0, clueTotal: 0, picTotal: 0,
                figureTotal: 0, factTotal: 0, artifactTotal: 0, historyTotal: 0 };
      RAW.forEach(function (s) {
        t.storyTotal += (s.stories || []).length;
        t.clueTotal += (s.clues || []).length;
        t.figureTotal += (s.figures || []).length;
        t.factTotal += (s.facts || []).length;
        t.artifactTotal += (s.artifacts || []).length;
        t.historyTotal += (s.history || []).length;
        (s.galleries || []).forEach(function (g) { t.picTotal += (g.items || []).length; });
      });
      return t;
    }
  };
})(window);
`;

fs.writeFileSync(OUT, header, 'utf8');

/* ---------- 5. 报告（同时写入 tools/build-report.txt，避免终端编码问题） ---------- */
const kb = (Buffer.byteLength(header, 'utf8') / 1024).toFixed(1);
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

log('合并分片：' + parts.join(', '));
log('景点数：' + spots.length);
const st = { stories: 0, clues: 0, pics: 0, figures: 0 };
spots.forEach(s => {
  st.stories += (s.stories || []).length;
  st.clues += (s.clues || []).length;
  st.pics += (s.galleries || []).reduce((n, g) => n + g.items.length, 0);
  st.figures += (s.figures || []).length;
});
log('典故 ' + st.stories + ' · 线索 ' + st.clues + ' · 图片位 ' + st.pics + ' · 名人 ' + st.figures);
log('输出：' + path.relative(ROOT, OUT) + '（' + kb + ' KB）');

if (warns.length) {
  log('\n⚠ 警告 ' + warns.length + ' 条');
  warns.slice(0, 20).forEach(w => log('  · ' + w));
}
if (errs.length) {
  log('\n✗ 校验错误 ' + errs.length + ' 条');
  fs.writeFileSync(path.join(DATA_DIR, 'errors.txt'), errs.join('\n'), 'utf8');
  errs.slice(0, 40).forEach(e => log('  · ' + e));
} else {
  log('\n✓ 数据校验全部通过');
}
fs.writeFileSync(path.join(ROOT, 'tools', 'build-report.txt'), lines.join('\n'), 'utf8');
