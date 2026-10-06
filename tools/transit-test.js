/* ============================================================
   交通衔接层自检（不进浏览器，node 里直接跑）
   ------------------------------------------------------------
   验证三件事：
     ① 数据完整：每个景点要么有地铁站锚点、要么有公交方案，
        且锚点站名必须真的出现在地铁线路站序里
     ② 方案合理：近距离判步行、远距离判地铁/公交，
        地铁方案必须写出线路号、上下车站、乘车方向、出站导向
     ③ 覆盖全面：30 个景点两两之间都有方案，耗时在合理区间

   用法： node tools/transit-test.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
/* 坐标真值放在 tools/data/（受版本控制），不能放 tools/_tmp/——
   那个目录整个被 .gitignore 忽略，一旦依赖它，clone 下来的仓库 npm test 必崩 */
const coordsPath = path.join(ROOT, 'tools', 'data', 'coords.txt');

let pass = 0, fail = 0;
const log = [];
function say(s) { log.push(s); console.log(s); }
function ok(cond, msg) {
  if (cond) { pass++; say('  ✓ ' + msg); }
  else { fail++; say('  ✗ ' + msg); }
}

/* ---------- 载入交通层 ---------- */
const coords = fs.readFileSync(coordsPath, 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean)
  .map(l => {
    const p = l.split('|').map(s => s.trim());
    return { id: p[0], name: p[1], coords: p[3].split(',').map(Number) };
  });
const byId = Object.fromEntries(coords.map(s => [s.id, s]));

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'transit.js'), 'utf8'), sandbox, { filename: 'transit.js' });
const T = sandbox.window.BJT.transit;

/* ---------- 1. 数据完整性 ---------- */
say('\n[1] 数据完整性');
const stationNames = new Set();
T.LINES.forEach(l => l.stops.forEach(s => stationNames.add(s)));

let badAnchor = 0;
Object.keys(T.ANCHORS).forEach((id) => {
  const a = T.ANCHORS[id];
  if (!stationNames.has(a.s)) { say('    锚点站不在任何线路里：' + id + ' → ' + a.s); badAnchor++; }
  if (typeof a.w !== 'number' || a.w < 0) { say('    锚点步行分钟数异常：' + id); badAnchor++; }
  if (!a.g || a.g.length < 8) { say('    锚点缺少出站步行导向：' + id); badAnchor++; }
});
ok(badAnchor === 0, '所有景区锚点都能在地铁站序里找到（共 ' + Object.keys(T.ANCHORS).length + ' 个）');

const uncovered = coords.filter(s => !T.ANCHORS[s.id] && !T.BUS[s.id]);
ok(uncovered.length === 0, '30 个景区要么有地铁锚点、要么有公交方案（缺：' + uncovered.map(s => s.id).join(',') + '）');

/* 站点索引自洽：每个站都应能在某条线里被找到 */
let ghost = 0;
Object.keys(T.ANCHORS).forEach(id => { if (!stationNames.has(T.ANCHORS[id].s)) ghost++; });
ok(ghost === 0, '锚点站名与线路站序完全对齐（无幽灵站点）');

/* 环线首尾一致 */
let loopBad = 0;
T.LINES.forEach(l => {
  if (l.loop && l.stops[0] !== l.stops[l.stops.length - 1]) loopBad++;
  if (!l.loop && (l.stops[0] !== l.term[0] || l.stops[l.stops.length - 1] !== l.term[1])) loopBad++;
});
ok(loopBad === 0, '线路首尾站与 term 一致（含 2 号线环线闭合）');

/* ---------- 2. 关键路段 ---------- */
say('\n[2] 关键路段方案');
const CASES = [
  ['tiananmen', 'jingshan'], ['gugong', 'jingshan'], ['gugong', 'tiananmen'],
  ['gugong', 'guobo'], ['tiananmen', 'guobo'], ['meishuguan', 'jingshan'],
  ['yonghegong', 'guozijian'], ['yonghegong', 'tiantan'], ['nanluoguxiang', 'yiqi'],
  ['dazhalan', 'tiantan'], ['yiheyuan', 'yuanmingyuan'], ['dongwuyuan', 'meishuguan'],
  ['badaling', 'yiheyuan'], ['shisanling', 'mutianyu'], ['olympicpark', 'shichahai']
];
CASES.forEach(([a, b]) => {
  const p = T.plan(byId[a], byId[b]);
  const head = '\n  ▸ ' + byId[a].name + ' → ' + byId[b].name + '  【' + p.badge + ' · ' + T.fmtMin(p.minutes) + '】';
  say(head);
  if (p.stations) say('      路网路径：' + p.stations.join(' → '));
  p.items.forEach(s => say('      · ' + s));
});

/* ---------- 3. 断言 ---------- */
say('\n[3] 断言');
const p1 = T.plan(byId['tiananmen'], byId['jingshan']);
ok(p1.mode === 'metro', '天安门 → 景山 判定为公共交通（实际为 ' + p1.badge + '）');
const j1 = p1.items.join(' ');
ok(/1号线/.test(j1) && /8号线/.test(j1), '文案含线路号（1 号线、8 号线）');
ok(/天安门东/.test(j1) && /王府井/.test(j1) && /中国美术馆/.test(j1), '文案含上车站、换乘站、下车站');
ok(/开往|方向/.test(j1), '文案含乘车方向');
ok(/下车后/.test(j1), '文案含出站后的步行导向');

ok(T.plan(byId['gugong'], byId['tiananmen']).mode === 'walk', '故宫 → 天安门 判定为步行');
ok(T.plan(byId['meishuguan'], byId['jingshan']).mode === 'walk', '中国美术馆 → 景山 判定为步行');
ok(T.plan(byId['badaling'], byId['yiheyuan']).mode === 'bus', '八达岭 → 颐和园 判定为公交方案');
ok(T.plan(byId['yonghegong'], byId['tiantan']).mode === 'metro', '雍和宫 → 天坛 判定为地铁');

/* 步行方案必须给出距离与时长 */
const wp = T.plan(byId['gugong'], byId['tiananmen']);
ok(/公里/.test(wp.items.join('')) && /分钟|小时/.test(wp.items.join('')), '步行方案含距离与时长');

/* 同一条线路内的直达不应出现换乘 */
const dp = T.plan(byId['yiheyuan'], byId['yuanmingyuan']);
ok(!/换乘/.test(dp.items.join('')), '颐和园 → 圆明园 同线直达，不出现换乘描述');

/* ---------- 3b. 换乘寻路的最优性 （防止退回「以站点为状态」的旧实现） ----------
   背景：旧的 shortest() 只拿「站点」当状态，每个站一个 dist / 一个 pLine。
   但「到达某站的代价」取决于你是从哪条线到的，所以后到的线路会覆盖 pLine，
   把本该同线直达的后续路段误判成换乘。当时的最短反例：
     西直门 → 北宫门  错解绕成 4号线→16号线→4号线（2 次换乘），
     而 4 号线本身就直通，同线直达才是对的。
   这里用正确的 (站点, 线路) 状态做参考实现，逐一比对全部景点方向。 */
say('\n[3b] 地铁方案最优性');
const RIDE_W = 3, PEN_W = 5;
const ADJX = {};
T.LINES.forEach(function (ln) {
  const loop = !!ln.loop, list = loop ? ln.stops.slice(0, -1) : ln.stops;
  list.forEach(function (name, i) {
    const a = (ADJX[name] = ADJX[name] || []);
    if (i > 0) a.push({ to: list[i - 1], line: ln.name });
    if (i < list.length - 1) a.push({ to: list[i + 1], line: ln.name });
  });
  if (loop && list.length > 2) {
    const lastN = list[list.length - 1];
    (ADJX[lastN] = ADJX[lastN] || []).push({ to: list[0], line: ln.name });
  }
});
function refOptimum(from, to) {
  if (from === to) return 0;
  const SEP = '\u0000', KEY = (s, l) => s + SEP + l;
  const dist = {}, pq = [[0, from, '']];
  dist[KEY(from, '')] = 0;
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u, lu] = pq.shift();
    const ck = KEY(u, lu);
    if (d > (dist[ck] === undefined ? Infinity : dist[ck])) continue;
    if (u === to) return d;
    for (const e of (ADJX[u] || [])) {
      const nd = d + RIDE_W + ((lu && lu !== e.line) ? PEN_W : 0);
      const nk = KEY(e.to, e.line);
      if (dist[nk] === undefined || nd < dist[nk]) { dist[nk] = nd; pq.push([nd, e.to, e.line]); }
    }
  }
  return Infinity;
}
let optChecked = 0, optWorse = 0, zeroRide = 0;
const optBad = [];
for (const a of coords) {
  for (const b of coords) {
    if (a.id === b.id) continue;
    const A = T.ANCHORS[a.id], B = T.ANCHORS[b.id];
    if (!A || !B) continue;
    const p = T.plan(a, b);
    if (!p || p.mode !== 'metro') continue;
    if (!p.stations || p.stations.length < 2) { zeroRide++; continue; }
    optChecked++;
    const rides = p.stations.length - 1;
    const lines = p.lines || [];
    let transfers = 0;
    for (let i = 1; i < lines.length; i++) if (lines[i] !== lines[i - 1]) transfers++;
    if (rides * RIDE_W + transfers * PEN_W > refOptimum(A.s, B.s)) {
      optWorse++;
      if (optBad.length < 5) optBad.push(a.id + '→' + b.id);
    }
  }
}
ok(optWorse === 0, '全部 ' + optChecked + ' 个地铁方向均达成最优换乘' +
  (optWorse ? '（劣化 ' + optWorse + ' 个：' + optBad.join('、') + '）' : ''));
ok(zeroRide === 0, '不存在「一趟车都没坐」的地铁方案（实际 ' + zeroRide + ' 个）');

/* 定点：这一条曾因「站点态」而多绕出一次换乘 */
const fixA = T.plan(byId['tiantan'], byId['yiheyuan']);
ok(fixA.mode === 'metro' && (fixA.lines || []).length - 1 <= 3,
  '天坛 → 颐和园 换乘 ≤ 3 次（修复前为 4 次）');

/* ---------- 3c. 无地铁可达的景点必须走公交 ---------- */
say('\n[3c] 无地铁锚点的景点');
ok(!T.ANCHORS['zhiwuyuan'], '北京植物园 不在地铁锚点表内（它离最近的地铁站实测约 6 公里）');
const zw = T.plan(byId['yiheyuan'], byId['zhiwuyuan']);
ok(zw.mode === 'bus', '颐和园 → 北京植物园 走公交方案（实际 ' + zw.badge + '）');
ok(/西郊线|331|563/.test(zw.items.join('')), '公交方案含真实接驳方式（西郊线 / 331 路 / 563 路）');
const zw2 = T.plan(byId['zhiwuyuan'], byId['yiheyuan']);
ok(zw2.mode === 'bus', '北京植物园 → 颐和园 也走公交方案');
ok(!/步行\s*1[0-9]\s*分钟到/.test(zw2.items.join('')),
  '不再出现「步行 12 分钟到北宫门站」这类错误引导');

/* ---------- 4. 全景区两两覆盖 ---------- */
say('\n[4] 全景区两两覆盖');
let none = 0, bad = 0;
const modes = { walk: 0, metro: 0, bus: 0, taxi: 0 };
for (let i = 0; i < coords.length; i++) {
  for (let j = 0; j < coords.length; j++) {
    if (i === j) continue;
    const p = T.plan(coords[i], coords[j]);
    if (!p || !p.items || !p.items.length) {
      none++; say('    无方案：' + coords[i].id + ' → ' + coords[j].id); continue;
    }
    modes[p.mode] = (modes[p.mode] || 0) + 1;
    if (!isFinite(p.minutes) || p.minutes <= 0 || p.minutes > 360) {
      bad++; say('    耗时异常：' + coords[i].id + '→' + coords[j].id + ' = ' + p.minutes);
    }
  }
}
ok(none === 0, coords.length * (coords.length - 1) + ' 个方向都有方案');
ok(bad === 0, '所有方案耗时都在 0–360 分钟');
say('    模式分布：' + JSON.stringify(modes));

/* routes 串联时不报错、且段数等于站数 - 1 */
const route = ['gugong', 'tiananmen', 'jingshan', 'yiheyuan', 'badaling', 'dongwuyuan']
  .filter(id => !!byId[id]).map(id => byId[id]);
const seq = T.plans(route);
ok(seq.length === route.length - 1, '串联方案数正确：' + seq.length + ' 段 / ' + route.length + ' 站');
ok(seq.every(p => p.from && p.to), '每段都带起点与终点');

const headline = fail ? '✗ 失败 ' + fail + ' 项，通过 ' + pass + ' 项'
                      : '✓ 全部通过（' + pass + ' 项）';
say('\n' + headline);

/* 自己写报告，绕开 PowerShell 控制台编码，保证中文不乱码 */
fs.writeFileSync(
  path.join(ROOT, 'tools', 'transit-report.txt'),
  log.join('\n') + '\n', 'utf8'
);

process.exit(fail ? 1 : 0);
