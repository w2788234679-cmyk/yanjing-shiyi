/* ============================================================
   燕京拾遗 · 图片兜底验证（jsdom）
   强制所有 .jpg 请求失败，统计三个位置的兜底结果。
   说明：jsdom 不会在图片加载失败时派发 error 事件（已知限制），
   故本脚本在“服务端对 .jpg 返回 404”的基础上，额外对每个
   <img src$=".jpg"> 派发 error 事件，以驱动真实的 ui.js 兜底逻辑。
   用法：node tools/imgfallback-test.js
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.BJT_PORT || 8902);
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.json':'application/json' };

const report = [];
const say = (s) => { report.push(s); };

/* 本地服务：.jpg 一律 404（模拟发布时整目录被排除的场景），其余文件正常服务 */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p === '/') p = '/index.html';
  if (/\.jpe?g(\?|#|$)/i.test(p)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': (MIME[path.extname(file).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
});

const { JSDOM, VirtualConsole } = require('jsdom');
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  if (/Could not load|not found|Could not parse CSS|Not implemented/i.test(e.message)) return;
  say('  [jsdomError] ' + e.message);
});
vc.on('error', (m) => { if (!/scrollTo/.test(String(m))) say('  [console.error] ' + m); });

function start() {
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

start().then(() => JSDOM.fromURL(BASE, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
})).then(async (dom) => {
  const win = dom.window, doc = win.document;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await wait(400);

  /* 模拟“图片请求失败”：对文档内每一个指向 .jpg 的 <img> 派发 error 事件，
     真实触发 ui.js:265 的 document 捕获阶段兜底监听 */
  function failAllImgs(root) {
    const scope = root || doc;
    const imgs = Array.prototype.slice.call(scope.querySelectorAll('img[src$=".jpg"]'));
    imgs.forEach((img) => { try { img.dispatchEvent(new win.Event('error')); } catch (e) {} });
    return imgs.length;
  }
  function go(hash) { win.location.hash = hash; return wait(140); }

  const BJT = win.BJT;

  /* ============ [1] 首页卡片墙（30 张） ============ */
  say('========== [1] 首页卡片墙（30 张） ==========');
  await go('#/');
  await wait(200);
  const nHomeBefore = failAllImgs();
  await wait(120);
  const cards = Array.prototype.slice.call(doc.querySelectorAll('.spot-card'));
  let homeAsImg = 0, homeAsSvg = 0, homeNeither = 0;
  const svgFrags = [];
  cards.forEach((c) => {
    const v = c.querySelector('.spot-card-visual');
    const hasImg = v && v.querySelector('img[src$=".jpg"]');
    const hasSvg = v && v.querySelector('svg');
    if (hasImg) homeAsImg++;
    else if (hasSvg) { homeAsSvg++; if (svgFrags.length < 2) svgFrags.push(v.querySelector('svg').outerHTML); }
    else homeNeither++;
  });
  const residualHome = doc.querySelectorAll('img[src$=".jpg"]').length;
  say('  卡片总数：' + cards.length);
  say('  初始 <img src=.jpg> 数（被强制失败）：' + nHomeBefore);
  say('  最终状态 → 仍是 <img>：' + homeAsImg + '，已替换成 <svg>：' + homeAsSvg + '，两者皆无：' + homeNeither);
  say('  全文档残留 <img src=.jpg>：' + residualHome);
  say('  替换后的 SVG 片段（前 2 个，截断 700 字）：');
  svgFrags.forEach((f, i) => say('  --- SVG#' + (i + 1) + ' ---\n' + f.slice(0, 700)));

  /* ============ [2] 景点详情页主视觉 spot-banner ============ */
  say('');
  say('========== [2] 景点详情页主视觉 spot-banner ==========');
  await go('#/spot/gugong');
  await wait(200);
  failAllImgs();
  await wait(120);
  const banner = doc.querySelector('.spot-banner');
  const bannerImg = banner ? banner.querySelector('img[src$=".jpg"]') : null;
  const bannerSvg = banner ? banner.querySelector('svg') : null;
  say('  spot-banner 内：仍是 <img>=' + !!bannerImg + '，已替换 <svg>=' + !!bannerSvg);
  if (bannerImg) say('  ⚠ 残留 <img src=.jpg>：' + bannerImg.getAttribute('src'));

  /* ============ [3] 图片画廊弹层（ui.js gallery）+ 轻图层 ============ */
  say('');
  say('========== [3] 图片画廊弹层 + 轻图层 ==========');
  await go('#/spot/gugong/gallery');
  await wait(200);
  const openBtn = doc.querySelector('[data-open-group]');
  if (openBtn) {
    openBtn.click();
    await wait(200);
    failAllImgs(doc.getElementById('galleryModalBody'));
    await wait(120);
    const cells = Array.prototype.slice.call(doc.querySelectorAll('#galleryModalBody .gallery-cell'));
    let gImg = 0, gSvg = 0, gBlank = 0;
    cells.forEach((cell) => {
      if (cell.querySelector('img[src$=".jpg"]')) gImg++;
      else if (cell.querySelector('svg')) gSvg++;
      else gBlank++;
    });
    say('  画廊弹层单元数：' + cells.length);
    say('  画廊单元 → <img>=' + gImg + '，<svg>=' + gSvg + '，空白(二者皆无)=' + gBlank);
    /* 轻图层 */
    const firstCell = cells[0];
    if (firstCell) {
      firstCell.click();
      await wait(150);
      failAllImgs(doc.querySelector('.gallery-lightbox'));
      await wait(120);
      const lb = doc.querySelector('.gallery-lightbox');
      const figImg = lb && lb.querySelector('figure img[src$=".jpg"]');
      const figSvg = lb && lb.querySelector('figure svg');
      say('  轻图层 figure → <img>=' + !!figImg + '，<svg>=' + !!figSvg);
    }
  } else {
    say('  （未找到画廊打开按钮，跳过）');
  }

  /* ============ [4] 潜在缺口验证：给某画廊项注入 image 路径后失败 ============ */
  say('');
  say('========== [4] 潜在缺口验证（画廊 <img> 缺少 data-spot） ==========');
  const spot = BJT.data.byId('gugong');
  if (spot && spot.galleries && spot.galleries[0] && spot.galleries[0].items[0]) {
    spot.galleries[0].items[0].image = 'assets/img/spots/gugong-1.jpg'; // 人为制造一张会 404 的画廊图
    await go('#/spot/gugong/gallery');
    await wait(200);
    const ob = doc.querySelector('[data-open-group]');
    if (ob) {
      ob.click();
      await wait(200);
      const beforeImgs = doc.querySelectorAll('#galleryModalBody img[src$=".jpg"]').length;
      failAllImgs(doc.getElementById('galleryModalBody'));
      await wait(120);
      const cell0 = doc.querySelector('#galleryModalBody .gallery-cell');
      const afterImg = cell0 && cell0.querySelector('img[src$=".jpg"]');
      const afterSvg = cell0 && cell0.querySelector('svg');
      say('  注入 image 后，画廊单元初始 <img> 数=' + beforeImgs);
      say('  失败后：该单元 仍是<img>=' + !!afterImg + '，被替换<svg>=' + !!afterSvg + '，结果空白(二者皆无)=' + (!afterImg && !afterSvg));
      say('  → 结论：画廊 <img>（ui.js:138 / :174，spot.js:179）缺少 data-spot 属性，byId("") 为空，兜底不补 SVG，单元变空白。');
    }
  }

  /* ============ SVG 风格与尺寸 ============ */
  say('');
  say('========== 兜底插画：尺寸 / 风格 ==========');
  say('  coverTag 调用 BJT.art(spot,null,800,500) → SVG viewBox 800x500（画廊 640x480 / 900x640）。');
  say('  风格：svgart.js 程序化国风插画——渐变天空 + 山峦 + 云 + 屋顶/长城/园林/塔寺/现代场馆/市井/星象等场景 + 右下角景名印章。');
  say('  用户看到的是“有图但不是照片”的矢量插画，不是空白，也不是浏览器破图图标。');

  dom.window.close();
  server.close();
  fs.writeFileSync(path.join(ROOT, 'tools', 'imgfallback-report.txt'), report.join('\n'), 'utf8');
  process.exit(0);
}).catch((e) => {
  say('测试启动失败：' + e.message + '\n' + (e.stack || ''));
  try { fs.writeFileSync(path.join(ROOT, 'tools', 'imgfallback-report.txt'), report.join('\n'), 'utf8'); } catch (_) {}
  try { server.close(); } catch (_) {}
  process.exit(1);
});
