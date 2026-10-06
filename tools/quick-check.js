/* 快速定位：加载页面后按 runtime-test 的顺序切路由，打印每一步的 DOM 长度与错误 */
'use strict';
const jsdomPkg = require('jsdom');
const errors = [];
const vc = new jsdomPkg.VirtualConsole();
vc.on('jsdomError', (e) => {
  if (/Not implemented/i.test(e.message)) return;
  errors.push('jsdomError: ' + e.message + '\n' + (e.detail || '').split('\n').slice(0, 6).join('\n'));
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

class Loader extends jsdomPkg.ResourceLoader {
  fetch(url, options) {
    if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|svgz)(\?|#|$)/i.test(url)) return null;
    return super.fetch(url, options);
  }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

jsdomPkg.JSDOM.fromURL('http://127.0.0.1:8848/index.html', {
  runScripts: 'dangerously', resources: new Loader(), pretendToBeVisual: true, virtualConsole: vc
}).then(async (dom) => {
  const win = dom.window, doc = win.document;
  win.addEventListener('error', (e) => errors.push('window.error: ' + (e.message || e.type)));

  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await wait(800);

  console.log('hash after boot =', JSON.stringify(win.location.hash));
  const main = () => doc.getElementById('main');
  console.log('boot main len =', main().innerHTML.length);

  for (const h of ['#/', '#/plan', '#/storyline', '#/storyline/axis', '#/collection', '#/spot/gugong', '#/spot/gugong/gallery']) {
    win.location.hash = h;
    await wait(90);
    console.log(h.padEnd(24), 'main len =', String(main().innerHTML.length).padStart(7),
      '| spotTabBody =', !!doc.getElementById('spotTabBody'),
      '| hero =', !!doc.querySelector('.hero'),
      '| plan =', !!doc.querySelector('.plan-layout'));
  }

  console.log('errors:', errors.length);
  errors.slice(0, 6).forEach((e, i) => console.log('---[' + i + ']\n' + e));
  process.exit(0);
}).catch(e => { console.log('BOOT FAIL', e.message, '\n', e.stack); process.exit(1); });
