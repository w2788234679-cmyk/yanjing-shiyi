/* ============================================================
   燕京拾遗 · 冒烟测试
   1) JS 语法检查
   2) 数据完整性（id / 典故关联 / 统计）
   3) 静态资源可访问性（起临时 http 服务逐个请求）
   用法: node tools/smoke.js [port]
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2], 10) || 8848;
const report = [];
const say = (s) => { report.push(s); console.log(s); };
let failures = 0;
const fail = (s) => { failures++; say('  ✗ ' + s); };
const ok = (s) => say('  ✓ ' + s);

/* ---------- 1. 语法检查 ---------- */
say('[1] JS 语法检查');
const jsFiles = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    if (d.name === 'node_modules') return;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (d.name.endsWith('.js')) jsFiles.push(path.relative(ROOT, p));
  });
})(ROOT);
let syntaxOk = 0;
jsFiles.forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try { new vm.Script(src, { filename: f }); syntaxOk++; }
  catch (e) { fail(f + ' 语法错误 — ' + e.message); }
});
if (!failures) ok(jsFiles.length + ' 个 JS 文件语法全部通过（含 data.js）');

/* ---------- 2. 数据 ---------- */
say('\n[2] 数据完整性');
const sandbox = { window: {}, console: console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8'), sandbox);
const BJT = sandbox.window.BJT;
const d = BJT.data;
if (!d.ready()) fail('data.js 未挂载 BJT.data');
else {
  const spots = d.all();
  ok('景点数：' + spots.length);
  const noCover = spots.filter(s => !s.cover);
  if (noCover.length) fail('缺少 cover 的景点：' + noCover.map(s => s.id).join(', '));
  else ok('全部景点都有封面图');

  let badStory = 0, storyIds = new Set();
  spots.forEach(s => {
    (s.stories || []).forEach(st => {
      if (storyIds.has(st.id)) badStory++;
      storyIds.add(st.id);
    });
    (s.galleries || []).forEach(g => (g.items || []).forEach(it => {
      if (it.story && !(s.stories || []).some(x => x.id === it.story)) badStory++;
    }));
  });
  if (badStory) fail('典故关联异常 ' + badStory + ' 处'); else ok('典故 id 唯一且画廊关联正确');

  const st = d.stats();
  ok('统计：典故 ' + st.storyTotal + ' / 线索 ' + st.clueTotal + ' / 图片位 ' + st.picTotal + ' / 名人 ' + st.figureTotal);
  if (st.spotTotal < 30) fail('景点不足 30 个');
  if (st.clueTotal < 60) fail('线索数量偏少：' + st.clueTotal);
}

/* ---------- 3. 静态资源 ---------- */
say('\n[3] 静态资源（http://127.0.0.1:' + PORT + '）');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': (MIME[path.extname(file).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
});

function get(url) {
  return new Promise((resolve) => {
    require('http').get(url, res => { res.resume(); resolve(res.statusCode); })
      .on('error', () => resolve(0));
  });
}

/* 端口被占用时，先确认对端是不是本项目本身（比如 runtime-test 起的静态服务），
   是就复用，不是才报错退出——避免两个测试脚本抢同一个端口就崩 */
server.on('error', async (err) => {
  if (err.code !== 'EADDRINUSE') { say('本地服务启动失败：' + err.message); process.exit(1); }
  const code = await get('http://127.0.0.1:' + PORT + '/index.html');
  if (code === 200) {
    say('（端口 ' + PORT + ' 已被占用，复用已有静态服务）');
    await run('http://127.0.0.1:' + PORT);
    return;
  }
  say('端口 ' + PORT + ' 被占用，且对端不是本项目静态服务');
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', async () => {
  await run('http://127.0.0.1:' + PORT);
});

async function run(base) {
  const assets = ['/index.html', '/assets/css/base.css', '/assets/css/components.css', '/assets/css/views.css',
    '/assets/js/data.js', '/assets/js/svgart.js', '/assets/js/store.js', '/assets/js/ui.js',
    '/assets/js/views/home.js', '/assets/js/views/spot.js', '/assets/js/views/plan.js',
    '/assets/js/views/storyline.js', '/assets/js/views/collection.js', '/assets/js/app.js'];

  let bad = 0;
  for (const a of assets) { const code = await get(base + a); if (code !== 200) { fail(a + ' → ' + code); bad++; } }
  if (!bad) ok(assets.length + ' 个核心文件全部 200');

  if (d.ready()) {
    let imgBad = 0, n = 0;
    d.all().forEach(s => {
      if (!s.cover) return;
      n++;
      if (fs.existsSync(path.join(ROOT, s.cover))) return;
      imgBad++; fail('封面文件缺失：' + s.cover);
    });
    if (!imgBad) ok(n + ' 张封面图文件均存在');
  }

  /* 内联引用的脚本标签是否齐全 */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const linked = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const missing = linked.filter(s => !fs.existsSync(path.join(ROOT, s)));
  if (missing.length) fail('index.html 引用了不存在的脚本：' + missing.join(', '));
  else ok('index.html 引用的 ' + linked.length + ' 个脚本全部存在');

  const cssLinks = [...html.matchAll(/<link[^>]+href="(assets[^"]+)"/g)].map(m => m[1]);
  const cssMissing = cssLinks.filter(s => !fs.existsSync(path.join(ROOT, s)));
  if (cssMissing.length) fail('样式文件缺失：' + cssMissing.join(', '));
  else ok('样式文件全部存在');

  server.close();
  say('\n==== ' + (failures ? '存在 ' + failures + ' 项问题' : '全部通过') + ' ====');
  fs.writeFileSync(path.join(ROOT, 'tools', 'smoke-report.txt'), report.join('\n'), 'utf8');
  process.exit(failures ? 1 : 0);
}
