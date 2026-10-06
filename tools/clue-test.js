/* ============================================================
   线索「解开 → 收回 → 再点关联典故」专项回归
   ------------------------------------------------------------
   复现的真实 bug：spot.js 的 paintBody() 整体替换 #spotTabBody
   的 innerHTML，把按钮连同监听器一起销毁，而点击回调里只重绘、
   没有重新绑定，导致：
     ① 点「已解开 ✓（点击收回）」无反应
     ② 下面的「读关联典故 ›」也点不动

   这里不 mock 服务层，直接真实加载页面、真实派发 click。

   用法： node tools/clue-test.js
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PORT = Number(process.env.BJT_PORT || 8851);
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const report = [];
const say = (s) => { report.push(s); console.log(s); };

let pass = 0, fail = 0;
const ok = (c, s) => { if (c) { pass++; say('  ✓ ' + s); } else { fail++; say('  ✗ ' + s); } };

const finish = () => {
  say('\n' + (fail ? '✗ 失败 ' + fail + ' 项，通过 ' + pass + ' 项'
                   : '✓ 全部通过（' + pass + ' 项）'));
  fs.writeFileSync(path.join(ROOT, 'tools', 'clue-report.txt'), report.join('\n') + '\n', 'utf8');
  process.exit(fail ? 1 : 0);
};

let jsdomPkg = null;
try { jsdomPkg = require('jsdom'); } catch (e) {
  say('未安装 jsdom，跳过（npm i jsdom）');
  fs.writeFileSync(path.join(ROOT, 'tools', 'clue-report.txt'), report.join('\n'), 'utf8');
  process.exit(0);
}
const JSDOM = jsdomPkg.JSDOM;

const errors = [];
const vc = new jsdomPkg.VirtualConsole();
vc.on('jsdomError', (e) => {
  if (/Could not load|not found|Could not parse CSS|not implemented/i.test(e.message)) return;
  errors.push('jsdomError: ' + e.message);
});
vc.on('error', (m) => errors.push('console.error: ' + m));

class Loader extends jsdomPkg.ResourceLoader {
  fetch(url, options) {
    if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|svgz)(\?|#|$)/i.test(url)) return null;
    return super.fetch(url, options);
  }
}

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

server.listen(PORT, '127.0.0.1', () => {
  JSDOM.fromURL(BASE, {
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
    if (!BJT || !BJT.data || !BJT.data.ready()) { say('  ✗ BJT.data 未就绪'); finish(); return; }

    const go = (hash) => { win.location.hash = hash; return new Promise(r => setTimeout(r, 120)); };
    const click = (el) => {
      if (!el) return false;
      el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    };

    /* 挑一个线索数量 >= 2 的景点，保证下面「关联典故」按钮有得测 */
    const target = BJT.data.all().find(s => (s.clues || []).length >= 2);
    if (!target) { say('  ✗ 找不到线索 >= 2 的景点'); finish(); return; }

    say('[1] 进入「故事线索」页：' + target.name);
    await go('#/spot/' + target.id + '/clues');
    const nClues = (target.clues || []).length;
    const cards = doc.querySelectorAll('#spotTabBody .clue');
    ok(cards.length === nClues, '渲染出 ' + cards.length + ' 条线索（数据 ' + nClues + ' 条）');

    const btn0 = doc.querySelector('#spotTabBody [data-toggle-clue="0"]');
    ok(!!btn0, '第 1 条的「解开线索」按钮存在');
    ok(/我在现场/.test(btn0 ? btn0.textContent : ''), '初始按钮文案是「我在现场，解开线索」');
    ok(!!doc.querySelector('#spotTabBody .clue[data-clue="0"] .clue-reveal'), '答案区存在但默认隐藏');
    const revealHidden = doc.querySelector('#spotTabBody .clue[data-clue="0"]');
    ok(revealHidden && !revealHidden.classList.contains('is-done'), '初始状态未标记 is-done（答案不可见）');

    /* --- 第 1 次点击：解开 --- */
    say('\n[2] 第 1 次点击：解开线索');
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));

    const card1 = doc.querySelector('#spotTabBody .clue[data-clue="0"]');
    ok(!!card1 && card1.classList.contains('is-done'), '卡片已标记 is-done（答案展开）');
    ok(BJT.store.isClueDone(target.id, 0), 'store 里已记录解开状态');
    const btn1 = doc.querySelector('#spotTabBody [data-toggle-clue="0"]');
    ok(!!btn1 && /点击收回/.test(btn1.textContent), '按钮文案变成「已解开 ✓（点击收回）」');

    /* --- 关键回归：第 2 次点击：收回 --- */
    say('\n[3] 第 2 次点击：收回线索（这是修复前失效的那一步）');
    const before = BJT.store.isClueDone(target.id, 0);
    ok(before === true, '收回前 store 状态为 true');
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));

    ok(BJT.store.isClueDone(target.id, 0) === false, 'store 状态已回退为 false（收回生效）');
    const card2 = doc.querySelector('#spotTabBody .clue[data-clue="0"]');
    ok(!!card2 && !card2.classList.contains('is-done'), '卡片已取消 is-done（答案重新隐藏）');
    const btn2 = doc.querySelector('#spotTabBody [data-toggle-clue="0"]');
    ok(!!btn2 && /我在现场/.test(btn2.textContent), '按钮文案恢复成「我在现场，解开线索」');

    /* --- 第 3 次点击：再次解开，验证可反复 --- */
    say('\n[4] 第 3 次点击：再次解开（验证可反复来回）');
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));
    ok(BJT.store.isClueDone(target.id, 0) === true, '再次解开成功');
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));
    ok(BJT.store.isClueDone(target.id, 0) === false, '再次收回成功');
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));
    ok(BJT.store.isClueDone(target.id, 0) === true, '第三次解开仍成功（监听器没有累积失效）');

    /* --- 关联典故按钮：修复前跟着一起失效 --- */
    say('\n[5] 同一张卡里的「读关联典故」按钮（修复前同样点不动）');
    /* 故宫的线索没有关联典故，这里换一个有 story 的线索真正测到这一项 */
    const withStory = BJT.data.all().find(s =>
      (s.clues || []).some(c => c.story) && (s.clues || []).length >= 1);
    if (withStory) {
      const sIdx = (withStory.clues || []).findIndex(c => c.story);
      await go('#/spot/' + withStory.id + '/clues');
      const cardSel = '#spotTabBody .clue[data-clue="' + sIdx + '"]';
      const storyBtn = () => doc.querySelector(cardSel + ' [data-story]');
      ok(!!storyBtn(), '「读关联典故」按钮存在（' + withStory.name + ' 第 ' + (sIdx + 1) + ' 条）');

      let opened = 0;
      const origOpen = BJT.ui.openStory;
      BJT.ui.openStory = function () { opened++; };
      click(storyBtn());
      await new Promise(r => setTimeout(r, 120));
      ok(opened === 1, '初始状态点击能打开典故（openStory 调用 ' + opened + ' 次）');

      /* 关键：先在同一个卡里点「解开线索」触发重绘，再点关联典故 */
      click(doc.querySelector('#spotTabBody [data-toggle-clue="' + sIdx + '"]'));
      await new Promise(r => setTimeout(r, 150));
      ok(!!storyBtn(), '重绘后「读关联典故」按钮仍在');
      click(storyBtn());
      await new Promise(r => setTimeout(r, 150));
      ok(opened === 2, '重绘后「读关联典故」仍能点开（openState 共调用 ' + opened + ' 次）');
      BJT.ui.openStory = origOpen;
    } else {
      say('  · 全库都没有带关联典故的线索，跳过此项');
    }

    /* --- 多条线索互不影响（先把状态归零，再逐条验证） --- */
    say('\n[6] 同一页面多条线索互不干扰');
    await go('#/spot/' + target.id + '/clues');
    const n2 = Math.min(3, nClues);
    /* 归零：把前 n2 条全部收回，确保初始状态一致 */
    for (let i = 0; i < n2; i++) {
      if (BJT.store.isClueDone(target.id, i)) {
        click(doc.querySelector('#spotTabBody [data-toggle-clue="' + i + '"]'));
        await new Promise(r => setTimeout(r, 120));
      }
    }
    let zeroed = true;
    for (let i = 0; i < n2; i++) if (BJT.store.isClueDone(target.id, i)) zeroed = false;
    ok(zeroed, '前 ' + n2 + ' 条线索已归零（解开前都是未解状态）');

    for (let i = 0; i < n2; i++) {
      click(doc.querySelector('#spotTabBody [data-toggle-clue="' + i + '"]'));
      await new Promise(r => setTimeout(r, 120));
    }
    let allDone = true;
    for (let i = 0; i < n2; i++) if (!BJT.store.isClueDone(target.id, i)) allDone = false;
    ok(allDone, '前 ' + n2 + ' 条线索全部可独立解开');

    for (let i = 0; i < n2; i++) {
      click(doc.querySelector('#spotTabBody [data-toggle-clue="' + i + '"]'));
      await new Promise(r => setTimeout(r, 120));
    }
    let allBack = true;
    for (let i = 0; i < n2; i++) if (BJT.store.isClueDone(target.id, i)) allBack = false;
    ok(allBack, '前 ' + n2 + ' 条线索全部可独立收回');

    /* --- 收藏按钮不能因为重复 mount 而被绑多次 --- */
    say('\n[7] 收藏按钮未因重复绑定而反向切换');
    await go('#/spot/' + target.id + '/clues');
    const fav = doc.querySelector('[data-fav]');
    const favBefore = BJT.store.isFavorite(target.id);
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));
    click(fav);
    await new Promise(r => setTimeout(r, 150));
    ok(BJT.store.isFavorite(target.id) === !favBefore, '收藏切换一次就够（没有双绑定导致 toggled 两次）');
    const favAfter = BJT.store.isFavorite(target.id);
    click(fav);
    await new Promise(r => setTimeout(r, 150));
    ok(BJT.store.isFavorite(target.id) === !favAfter, '再点一次能切回来');

    /* --- 切到别的 tab 再回来，监听器仍然有效 --- */
    say('\n[8] 切换 tab 后返回，线索按钮仍可用');
    await go('#/spot/' + target.id + '/history');
    ok(!!doc.querySelector('#spotTabBody .timeline'), '历史沿革 tab 正常渲染');
    await go('#/spot/' + target.id + '/clues');
    const sBefore = BJT.store.isClueDone(target.id, 0);
    click(doc.querySelector('#spotTabBody [data-toggle-clue="0"]'));
    await new Promise(r => setTimeout(r, 150));
    ok(BJT.store.isClueDone(target.id, 0) === !sBefore, '切走再切回后点击依然生效');

    say('\n[9] 运行时错误');
    if (errors.length) { fail('有 ' + errors.length + ' 条 JS 运行时错误'); errors.slice(0, 5).forEach(e => say('      ' + e)); }
    else ok('无 JS 运行时错误', '无 JS 运行时错误');

    finish();
  }).catch((e) => { say('加载失败：' + e.message); finish(); });
});
