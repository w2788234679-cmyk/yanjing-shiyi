/* ============================================================
   燕京拾遗 · 纯逻辑测试（不依赖 DOM）
   覆盖：数据 API / SVG 插画引擎 / 本地状态层
   用法: node tools/logic-test.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const out = [];
const say = (s) => { out.push(s); console.log(s); };
let bad = 0;
const fail = (s) => { bad++; say('  ✗ ' + s); };
const ok = (s) => say('  ✓ ' + s);

/* 最小 window 桩 */
const mem = new Map();
const win = {
  localStorage: {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k)
  },
  location: { hash: '' }
};
const sandbox = { window: win, console: console, setTimeout, clearTimeout, Object, Array, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

['assets/js/data.js', 'assets/js/svgart.js', 'assets/js/store.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const BJT = win.BJT;

say('[1] 数据 API');
const d = BJT.data;
if (!d.ready()) fail('data 未就绪');
else {
  const spots = d.all();
  if (spots.length === 30) ok('景点 30 个'); else fail('景点数 ' + spots.length);
  if (d.byId('gugong') && d.byId('gugong').name) ok('byId() 可用'); else fail('byId() 异常');
  const st = d.stats();
  if (st.spotTotal === 30 && st.clueTotal > 100 && st.picTotal > 200) ok('统计 API：' + JSON.stringify(st));
  else fail('统计 API 异常：' + JSON.stringify(st));
  if (d.randomId()) ok('randomId() 可用');
}

say('\n[2] SVG 插画引擎');
let artBad = 0, artTotal = 0;
spots: for (const s of d.all()) {
  const svg = BJT.art(s, null, 800, 500);
  artTotal++;
  if (!svg.startsWith('<svg')) artBad++;
  else if (svg.indexOf('undefined') !== -1) { artBad++; say('    ' + s.id + ' 含 undefined'); }
  else if (svg.indexOf('NaN') !== -1) { artBad++; say('    ' + s.id + ' 含 NaN'); }
  if (artBad > 5) break spots;
}
if (!artBad) ok(artTotal + ' 个景点的插画均正常生成（无 undefined / NaN）');
else fail(artBad + ' 个景点插画异常');

const kinds = ['palace', 'wall', 'garden', 'tower', 'modern', 'skyline', 'nature', 'astro'];
const kindBad = kinds.filter(k => {
  const svg = BJT.art(d.byId('gugong'), k, 640, 480);
  return !svg.startsWith('<svg') || svg.indexOf('NaN') !== -1;
});
if (!kindBad.length) ok('8 种场景模板均可渲染：' + kinds.join(' / '));
else fail('异常模板：' + kindBad.join(', '));

say('\n[3] 本地状态层');
const store = BJT.store;
if (store.isFavorite('gugong') === false) ok('初始收藏为空');
else fail('初始收藏不为空');
if (store.toggleFavorite('gugong') === true && store.isFavorite('gugong')) ok('收藏 toggle 生效');
else fail('收藏 toggle 失败');
if (store.toggleFavorite('gugong') === false && !store.isFavorite('gugong')) ok('收藏可取消');
else fail('收藏取消失败');

if (store.toggleClue('gugong', 0) === true && store.isClueDone('gugong', 0)) ok('线索打卡生效');
else fail('线索打卡失败');
if (store.toggleClue('gugong', 0) === false && !store.isClueDone('gugong', 0)) ok('线索可收回');
else fail('线索收回失败');
if (store.clueDoneCount('gugong', 4) === 0) ok('线索计数归零');
else fail('线索计数异常');

store.setPlan(['gugong', 'tiantan']);
if (store.getPlan().length === 2) ok('路线草稿读写正常');
else fail('路线草稿异常');
store.reset();
if (!store.isFavorite('gugong') && store.getPlan().length === 0) ok('reset() 清空状态');
else fail('reset() 未清空');

say('\n[4] 内容覆盖度抽样');
const sample = ['gugong', 'badaling', 'yiheyuan', 'guobo', 'yonghegong', 'shougang'];
let thin = [];
sample.forEach(id => {
  const s = d.byId(id);
  const words = [].concat(
    s.history.map(x => x.text), s.facts.map(x => x.text),
    s.figures.map(x => x.text), s.artifacts.map(x => x.text),
    s.clues.map(x => x.q + x.reveal), s.stories.map(x => x.text)
  ).join('').length;
  if (words < 1500) thin.push(id + '(' + words + '字)');
});
if (!thin.length) ok('抽样 6 个景点，内容量均 ≥ 1500 字');
else fail('内容偏薄：' + thin.join(', '));

say('\n==== ' + (bad ? '存在 ' + bad + ' 项问题' : '全部通过') + ' ====');
fs.writeFileSync(path.join(ROOT, 'tools', 'logic-report.txt'), out.join('\n'), 'utf8');
process.exit(bad ? 1 : 0);
