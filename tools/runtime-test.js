/* ============================================================
   燕京拾遗 · 运行时测试（jsdom）
   真实加载 index.html，遍历全部路由与交互，捕获任何 JS 运行时错误

   用法： node tools/runtime-test.js
   脚本会自己起一个本地静态服务（端口占用则复用），无需另外准备。

   也可用 BJT_BASE 指定别的地址，默认 http://127.0.0.1:8848/index.html
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PORT = Number(process.env.BJT_PORT || 8848);
const BASE = process.env.BJT_BASE || ('http://127.0.0.1:' + PORT + '/index.html');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const report = [];
const say = (s) => { report.push(s); console.log(s); };

let jsdomPkg = null;
try {
  jsdomPkg = require('jsdom');
} catch (e) {
  say('未安装 jsdom，跳过运行时测试（npm i jsdom）');
  fs.writeFileSync(path.join(ROOT, 'tools', 'runtime-report.txt'), report.join('\n'), 'utf8');
  process.exit(0);
}
const JSDOM = jsdomPkg.JSDOM;

const errors = [];
const vc = new jsdomPkg.VirtualConsole();
vc.on('jsdomError', (e) => {
  // 资源 404 / 图片加载失败在 jsdom 里以 jsdomError 出现，单独归类，不算致命
  if (/Could not load|not found|Could not parse CSS|not implemented/i.test(e.message)) return;
  errors.push('jsdomError: ' + e.message + (e.detail ? '\n    ' + e.detail : ''));
});
vc.on('error', (m) => errors.push('console.error: ' + m));

/* 只放行文档/脚本/样式，图片交给 SVG 兜底逻辑，避免测试下载十几兆图片 */
class Loader extends jsdomPkg.ResourceLoader {
  fetch(url, options) {
    if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|svgz)(\?|#|$)/i.test(url)) return null;
    return super.fetch(url, options);
  }
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => { req.destroy(); resolve(false); });
  });
}

/* 没有现成的静态服务就自己起一个，让本脚本可以一条命令跑完 */
async function ensureServer() {
  if (await ping(BASE)) { say('复用已有服务：' + BASE); return null; }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return;
    }
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  say('已启动本地服务：http://127.0.0.1:' + PORT);
  return server;
}

ensureServer().then((localServer) => JSDOM.fromURL(BASE, {
  runScripts: 'dangerously',
  resources: new Loader(),
  pretendToBeVisual: true,
  virtualConsole: vc
}).then(async (dom) => {
  const win = dom.window;
  const doc = win.document;
  win.addEventListener('error', (e) => errors.push('window.error: ' + (e.message || e.type)));

  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 800));

  const BJT = win.BJT;
  let failures = 0;
  const fail = (s) => { failures++; say('  ✗ ' + s); };
  const ok = (s) => say('  ✓ ' + s);

  say('[1] 启动');
  if (!BJT || !BJT.data || !BJT.data.ready()) { fail('BJT.data 未就绪'); dump(); return; }
  else ok('BJT.data 就绪，景点 ' + BJT.data.all().length + ' 个');

  const main = () => doc.getElementById('main');
  function go(hash) {
    win.location.hash = hash;
    return new Promise(r => setTimeout(r, 90));
  }

  say('\n[2] 路由渲染');
  const cases = [
    ['#/', '首页', () => !!doc.querySelector('.hero') && !!doc.querySelector('.spot-grid')],
    ['#/plan', '路线规划', () => !!doc.querySelector('.plan-layout')],
    ['#/storyline', '故事线索', () => !!doc.querySelector('.storyline-hero')],
    ['#/storyline/axis', '故事线索（中轴线）', () => !!doc.querySelector('.thread')],
    ['#/collection', '我的收藏', () => !!doc.querySelector('.profile-grid')]
  ];
  for (const [hash, label, check] of cases) {
    await go(hash);
    if (!main().innerHTML.trim()) fail(label + ' 未渲染');
    else if (!check()) fail(label + ' 结构不符合预期');
    else ok(label + ' 渲染正常');
  }

  say('\n[3] 全部景点详情页（30 处）');
  let spotBad = 0;
  for (const s of BJT.data.all()) {
    await go('#/spot/' + s.id);
    const okDetail = !!doc.querySelector('.spot-banner') && main().innerHTML.indexOf(s.name) !== -1;
    if (!okDetail) { spotBad++; fail(s.id + ' 详情页渲染异常'); }
  }
  if (!spotBad) ok('30 个景点详情页全部渲染正常');

  say('\n[4] 详情页分区（以故宫为例）');
  await go('#/spot/gugong');
  const tabs = ['overview', 'history', 'facts', 'figures', 'artifacts', 'clues', 'gallery'];
  for (const t of tabs) {
    await go('#/spot/gugong/' + t);
    if (!doc.getElementById('spotTabBody').innerHTML.trim()) fail('分区 ' + t + ' 为空');
    else ok('分区 ' + t + ' 正常');
  }

  say('\n[5] 交互');
  /* 5.1 筛选 */
  await go('#/');
  const chip = doc.querySelector('#catChips .chip[data-cat="长城关隘"]');
  if (chip) {
    chip.click();
    await new Promise(r => setTimeout(r, 60));
    const cards = doc.querySelectorAll('.spot-card').length;
    if (cards === 5) ok('分类筛选「长城关隘」→ ' + cards + ' 张卡片');
    else fail('分类筛选结果异常：' + cards);
    chip.click();
    await new Promise(r => setTimeout(r, 60));
  } else fail('未找到分类筛选按钮');

  /* 5.2 搜索 */
  const search = doc.getElementById('spotSearch');
  if (search) {
    search.value = '长城';
    search.dispatchEvent(new win.Event('input'));
    await new Promise(r => setTimeout(r, 260));
    if (doc.querySelectorAll('.spot-card').length > 0) ok('搜索「长城」有结果');
    else fail('搜索「长城」无结果');
    search.value = '';
    search.dispatchEvent(new win.Event('input'));
  } else fail('未找到搜索框');

  /* 5.3 地图视图 */
  const mapBtn = doc.querySelector('.view-toggle button[data-view="map"]');
  if (mapBtn) {
    mapBtn.click();
    await new Promise(r => setTimeout(r, 60));
    if (doc.querySelector('.map-view svg')) ok('地图视图渲染正常');
    else fail('地图视图未渲染');
    doc.querySelector('.view-toggle button[data-view="grid"]').click();
  } else fail('未找到视图切换');

  /* 5.4 收藏 */
  await go('#/spot/gugong');
  const favBtn = doc.querySelector('[data-fav]');
  if (favBtn) {
    favBtn.click();
    await new Promise(r => setTimeout(r, 40));
    if (BJT.store.isFavorite('gugong')) ok('收藏按钮生效');
    else fail('收藏按钮无效');
    favBtn.click();
  } else fail('详情页未找到收藏按钮');

  /* 5.5 故事线索打卡 */
  await go('#/spot/gugong/clues');
  const clueBtn = doc.querySelector('[data-toggle-clue]');
  if (clueBtn) {
    clueBtn.click();
    await new Promise(r => setTimeout(r, 60));
    if (BJT.store.isClueDone('gugong', 0)) ok('故事线索打卡生效');
    else fail('故事线索打卡无效');
  } else fail('详情页未找到线索按钮');

  /* 5.6 画廊弹层 + 典故 */
  await go('#/spot/gugong/gallery');
  const groupBtn = doc.querySelector('[data-open-group]');
  if (groupBtn) {
    groupBtn.click();
    await new Promise(r => setTimeout(r, 60));
    const modal = doc.getElementById('galleryModal');
    const cells = modal.querySelectorAll('.gallery-cell').length;
    if (modal.hidden || cells === 0) fail('画廊弹层未打开');
    else ok('画廊弹层打开，' + cells + ' 张图');
    const withStory = [...modal.querySelectorAll('.gallery-cell')].find(c => c.querySelector('.story-badge'));
    if (withStory) {
      withStory.click();
      await new Promise(r => setTimeout(r, 60));
      if (doc.querySelector('.gallery-lightbox')) ok('点击图片进入轻图层');
      else fail('点击图片未进入轻图层');
      const cap = doc.querySelector('.lb-cap');
      if (cap) { cap.click(); await new Promise(r => setTimeout(r, 80)); }
      if (doc.getElementById('storyModalBody').innerHTML.indexOf('典故') !== -1) ok('图片 → 典故阅读链路正常');
      else fail('图片 → 典故阅读链路异常');
    } else fail('画廊中没有带典故的图片');
  } else fail('画廊页未找到分组按钮');

  /* 5.7 路线规划 */
  await go('#/plan');
  const autoPick = doc.getElementById('autoPick');
  if (autoPick) {
    autoPick.click();
    await new Promise(r => setTimeout(r, 80));
    const steps = doc.querySelectorAll('.route-step').length;
    if (steps === 5) ok('路线生成：' + steps + ' 站');
    else fail('路线站数异常：' + steps);
    const expand = doc.querySelector('[data-expand="0"]');
    if (expand) {
      expand.click();
      await new Promise(r => setTimeout(r, 50));
      const box = doc.getElementById('expand-0');
      if (box && box.innerHTML.length > 60) ok('逐点查看文化亮点展开正常');
      else fail('文化亮点展开为空');
    } else fail('未找到「逐点查看文化亮点」按钮');

    /* 交通衔接：站点之间的方案区块 */
    const transits = doc.querySelectorAll('.route-transit');
    if (transits.length === steps - 1) ok('交通衔接区块：' + transits.length + ' 段（' + steps + ' 站之间）');
    else fail('交通衔接区块数异常：' + transits.length + '，应为 ' + (steps - 1));

    const t0 = transits[0];
    if (t0) {
      const txt = t0.textContent;
      if (/分钟|小时/.test(txt)) ok('交通衔接含时长：' + (txt.match(/约 [^\s]+/) || [''])[0]);
      else fail('交通衔接缺少时长');
      const metro = doc.querySelector('.route-transit.rt-metro');
      if (metro) {
        const m = metro.textContent;
        const hasLine = /\d+号线/.test(m);
        const hasStops = /站/.test(m) && /下车|出站/.test(m);
        if (hasLine) ok('乘车方案含线路号：' + (m.match(/\d+号线/) || [''])[0]);
        else fail('乘车方案没写出几号线');
        if (hasStops) ok('乘车方案含下车站与出站导向');
        else fail('乘车方案缺少下车站或出站导向');
      }
      /* 逐段体检：每段都要有时长，地铁站之间的方案必须写清线路 */
      let badTransit = 0;
      transits.forEach((el) => {
        if (!/分钟|小时/.test(el.textContent)) badTransit++;
        if (el.classList.contains('rt-metro') && !/\d+号线/.test(el.textContent)) badTransit++;
        if (el.classList.contains('rt-walk') && !/公里|分钟/.test(el.textContent)) badTransit++;
      });
      if (badTransit === 0) ok('全部 ' + transits.length + ' 段衔接信息完整（时长 + 线路/距离）');
      else fail(badTransit + ' 段衔接信息不完整');
    }
  } else fail('路线页未找到「帮我选 5 处经典」');

  say('\n[6] 运行时错误（http 会话）');
  if (errors.length) { errors.slice(0, 15).forEach(e => fail(e)); }
  else ok('无 JS 运行时错误');
  dom.window.close();

  /* ---------- 7. 离线模式：双击 index.html（file:// 协议） ---------- */
  say('\n[7] 离线 file:// 冒烟（对应「双击 index.html」）');
  const fileErrors = [];
  const vc2 = new jsdomPkg.VirtualConsole();
  vc2.on('jsdomError', (e) => {
    if (/Could not load|not implemented|Could not parse CSS/i.test(e.message)) return;
    fileErrors.push(e.message);
  });
  vc2.on('error', (m) => fileErrors.push('console.error: ' + m));

  const dom2 = await JSDOM.fromFile(INDEX, {
    runScripts: 'dangerously',
    resources: new Loader(),
    pretendToBeVisual: true,
    virtualConsole: vc2
  });
  const win2 = dom2.window, doc2 = win2.document;
  win2.addEventListener('error', (e) => fileErrors.push('window.error: ' + (e.message || e.type)));
  await new Promise(r => win2.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 500));

  if (!win2.BJT || !win2.BJT.data.ready()) fail('file:// 下 BJT.data 未就绪');
  else ok('file:// 下数据加载正常，景点 ' + win2.BJT.data.all().length + ' 个');

  for (const [hash, label] of [['#/spot/gugong', '详情页'], ['#/plan', '路线页'], ['#/storyline/axis', '故事线']]) {
    win2.location.hash = hash;
    await new Promise(r => setTimeout(r, 90));
    if (!doc2.getElementById('main').innerHTML.trim()) fail('file:// 下 ' + label + ' 未渲染');
    else ok('file:// 下 ' + label + ' 渲染正常');
  }
  /* localStorage 在 file:// 下可能不可用，状态层必须能降级而不是报错 */
  let storeOk = true;
  try { win2.BJT.store.toggleFavorite('gugong'); win2.BJT.store.toggleFavorite('gugong'); }
  catch (e) { storeOk = false; fail('file:// 下状态层抛错：' + e.message); }
  if (storeOk) ok('file:// 下本地状态层可降级工作');
  if (fileErrors.length) fileErrors.slice(0, 8).forEach(e => fail('file:// ' + e));
  else ok('file:// 下无 JS 运行时错误');
  dom2.window.close();

  if (localServer) localServer.close();
  function dump() {
    fs.writeFileSync(path.join(ROOT, 'tools', 'runtime-report.txt'), report.join('\n'), 'utf8');
    process.exit(failures ? 1 : 0);
  }
  dump();
})).catch(e => {
  say('测试启动失败：' + e.message + '\n' + e.stack);
  fs.writeFileSync(path.join(ROOT, 'tools', 'runtime-report.txt'), report.join('\n'), 'utf8');
  process.exit(1);
});
