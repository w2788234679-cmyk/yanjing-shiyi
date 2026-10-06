/* ============================================================
   燕京拾遗 · 视图：路线规划
   - 勾选景点 → 按地理邻接与停留时长生成行程
   - 每一站都带该景点的历史 / 人物 / 趣事 / 文物文化亮点
   - 「逐点查看文化亮点」：可手动或自动巡览每一站
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT, ui = BJT.ui;
  var esc = ui.esc;
  var transit = BJT.transit;

  var CATS = ['皇家宫殿', '长城关隘', '皇家园林', '博物馆艺文', '宗教古迹', '城市场景'];
  var state = { q: '', cat: 'all' };
  var timer = null;
  var current = -1;

  /* ---------- 计算 ---------- */
  function minutesOf(spot) {
    var m = String(spot.visitTime || '').match(/(\d+(?:\.\d+)?)/);
    if (!m) return 90;
    var v = parseFloat(m[1]);
    if (/小时|h/.test(spot.visitTime)) return v * 60;
    return v;
  }

  /* 距离计算已经收敛到交通层，这里直接复用，避免两份实现走样 */
  function distKm(a, b) { return transit.distKm(a.coords, b.coords); }

  function fmtDur(min) {
    if (min < 60) return min + ' 分钟';
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }

  function fmtClock(mins) {
    var m = ((mins % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /** 路线：先按行政区聚成簇，簇内用最近邻串联；簇之间按地理就近排序 */
  function buildRoute(ids) {
    if (ids.length < 2) return ids.slice();
    var spots = ids.map(function (id) { return BJT.data.byId(id); }).filter(Boolean);

    var clusters = [];
    spots.forEach(function (s) {
      var placed = false;
      for (var i = 0; i < clusters.length; i++) {
        var c = clusters[i];
        var near = c.some(function (x) { return distKm(x, s) < 22; });
        if (near) { c.push(s); placed = true; break; }
      }
      if (!placed) clusters.push([s]);
    });

    if (clusters.length > 1) {
      clusters.sort(function (a, b) {
        var ca = centroid(a), cb = centroid(b);
        return distKm({ coords: ca }, { coords: cb }) - distKm({ coords: cb }, { coords: ca });
      });
    }

    var route = [];
    clusters.forEach(function (c) {
      var pool = c.slice(1), cur = c[0];
      route.push(cur);
      while (pool.length) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < pool.length; i++) {
          var d = distKm(cur, pool[i]);
          if (d < bd) { bd = d; best = i; }
        }
        cur = pool.splice(best, 1)[0];
        route.push(cur);
      }
    });
    return route;
  }

  function centroid(list) {
    var la = 0, lo = 0;
    list.forEach(function (s) { la += s.coords[0]; lo += s.coords[1]; });
    return [la / list.length, lo / list.length];
  }

  /** 统计一段路线的时间与距离；通勤部分交给交通层算真实方案 */
  function analyze(route) {
    var visit = 0, km = 0;
    route.forEach(function (s) { visit += minutesOf(s); });
    var moves = transit.plans(route);
    var move = moves.reduce(function (n, p) { return n + p.minutes; }, 0);
    km = moves.reduce(function (n, p) { return n + (p.km || 0); }, 0);
    return { visit: visit, drive: Math.round(move), km: Math.round(km * 10) / 10, span: visit + move, moves: moves };
  }

  /* ---------- 渲染 ---------- */
  function render(root) {
    var picked = BJT.store.getPlan();
    root.innerHTML = '' +
      '<section class="wrap section">' +
        '<div class="section-head"><div><span class="eyebrow">Route Planner</span>' +
          '<h2>路线规划 · 边走边看文化</h2></div>' +
          '<p class="muted tiny" style="margin:0">先在左侧勾选想去的景点，右侧会自动生成行程时间与每一站的文化亮点。</p></div>' +
        '<div class="plan-layout">' +
          '<div class="panel">' +
            '<div class="panel-head"><h3>选择景点</h3>' +
              '<button class="btn btn-outline btn-sm" type="button" id="clearPlan">清空</button></div>' +
            '<div class="search-box" style="margin-bottom:10px"><span class="ico">⌕</span>' +
              '<input id="planSearch" type="search" placeholder="搜索景点" aria-label="搜索景点"></div>' +
            '<div class="chip-row" id="planCats" style="margin-bottom:12px">' +
              '<button class="chip is-active" type="button" data-cat="all">全部</button>' +
              CATS.map(function (c) { return '<button class="chip" type="button" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
            '</div>' +
            '<div class="plan-picker" id="planPicker"></div>' +
          '</div>' +
          '<div>' +
            '<div class="panel" style="margin-bottom:16px">' +
              '<div class="panel-head"><h3>我的路线</h3>' +
                '<span class="tiny muted" id="planMeta"></span></div>' +
              '<div class="picked-list" id="pickedList"></div>' +
              '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
                '<button class="btn btn-primary btn-sm" type="button" id="genRoute">生成路线行程</button>' +
                '<button class="btn btn-outline btn-sm" type="button" id="autoPick">帮我选 5 处经典</button>' +
              '</div>' +
            '</div>' +
            '<div id="routeOut"></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    mount(root);
    paintPicker();
    paintPicked();
  }

  function paintPicker() {
    var wrap = document.getElementById('planPicker');
    if (!wrap) return;
    var q = state.q.trim().toLowerCase();
    var list = BJT.data.all().filter(function (s) {
      if (state.cat !== 'all' && s.category !== state.cat) return false;
      if (!q) return true;
      return [s.name].concat(s.alias || []).concat(s.district).join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var picked = BJT.store.getPlan();

    wrap.innerHTML = list.map(function (s) {
      var on = picked.indexOf(s.id) !== -1;
      return '<button class="picker-row' + (on ? ' is-picked' : '') + '" type="button" data-pick="' + esc(s.id) + '">' +
        '<span class="tick">' + (on ? '✓' : '') + '</span>' +
        '<span><b>' + esc(s.name) + '</b><br><span>' + esc(s.district) + ' · ' + esc(s.visitTime) + '</span></span>' +
        '</button>';
    }).join('') || '<p class="muted tiny">没有匹配的景点。</p>';

    ui.$$('#planPicker [data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var added = BJT.store.togglePlan(b.getAttribute('data-pick'));
        ui.toast(added ? '已加入：' + BJT.data.byId(b.getAttribute('data-pick')).name : '已移出路线');
        paintPicker(); paintPicked();
      });
    });
  }

  function paintPicked() {
    var wrap = document.getElementById('pickedList');
    if (!wrap) return;
    var picked = BJT.store.getPlan();
    var meta = document.getElementById('planMeta');
    if (!picked.length) {
      wrap.innerHTML = '<p class="muted tiny" style="margin:0">还没有选择景点。可以从上方勾选，或用「帮我选 5 处经典」。</p>';
      if (meta) meta.textContent = '';
      return;
    }
    var mins = picked.reduce(function (n, id) { var s = BJT.data.byId(id); return n + (s ? minutesOf(s) : 0); }, 0);
    if (meta) meta.textContent = picked.length + ' 处 · 纯游玩约 ' + fmtDur(mins);

    wrap.innerHTML = picked.map(function (id, i) {
      var s = BJT.data.byId(id);
      if (!s) return '';
      return '<div class="picked-item"><span class="ord">' + (i + 1) + '</span>' +
        '<span><b>' + esc(s.name) + '</b><span class="tiny">' + esc(s.category) + ' · ' + esc(s.visitTime) + '</span></span>' +
        '<span class="mv">' +
          '<button type="button" data-up="' + esc(id) + '" aria-label="上移">▲</button>' +
          '<button type="button" data-down="' + esc(id) + '" aria-label="下移">▼</button>' +
          '<button type="button" data-rm="' + esc(id) + '" aria-label="移出">✕</button>' +
        '</span></div>';
    }).join('');

    ui.$$('#pickedList [data-up]').forEach(function (b) {
      b.addEventListener('click', function () { move(b.getAttribute('data-up'), -1); });
    });
    ui.$$('#pickedList [data-down]').forEach(function (b) {
      b.addEventListener('click', function () { move(b.getAttribute('data-down'), 1); });
    });
    ui.$$('#pickedList [data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        BJT.store.togglePlan(b.getAttribute('data-rm')); paintPicker(); paintPicked();
      });
    });
  }

  function move(id, dir) {
    var plan = BJT.store.getPlan(), i = plan.indexOf(id);
    var j = i + dir;
    if (i === -1 || j < 0 || j >= plan.length) return;
    var t = plan[i]; plan[i] = plan[j]; plan[j] = t;
    BJT.store.setPlan(plan);
    paintPicked();
  }

  /* ---------- 行程输出 ---------- */
  function paintRoute() {
    var out = document.getElementById('routeOut');
    if (!out) return;
    var route = BJT.store.getLastRoute();
    if (route.length < 1) {
      out.innerHTML = '<div class="empty-state"><p>还没有生成路线。勾选 1 处以上景点后点「生成路线行程」。</p></div>';
      return;
    }

    var spots = route.map(function (id) { return BJT.data.byId(id); }).filter(Boolean);
    var a = analyze(spots);
    var clock = 8 * 60 + 30;
    current = -1;

    var moves = a.moves || [];

    var summary =
      '<div class="route-summary">' +
        '<div class="rs"><b>' + spots.length + '</b><span>处景点</span></div>' +
        '<div class="rs"><b>' + fmtDur(a.span) + '</b><span>行程总时长</span></div>' +
        '<div class="rs"><b>' + fmtDur(a.visit) + '</b><span>其中游玩</span></div>' +
        '<div class="rs"><b>' + fmtDur(a.drive) + '</b><span>其中路上交通</span></div>' +
        '<div class="rs"><b>' + a.km.toFixed(1) + '</b><span>移动距离（km，估）</span></div>' +
      '</div>';

    var blocks = [];
    spots.forEach(function (s, i) {
      var stay = minutesOf(s);
      var startAt = clock;
      clock += stay + (i > 0 ? moves[i - 1].minutes : 0);
      var gl = glance(s);
      blocks.push('<article class="route-step" data-step="' + i + '">' +
        '<div class="when">' + (i + 1) + '. ' + esc(s.category) + '<span>' + fmtClock(startAt) + ' 抵达 · 建议停留 ' + fmtDur(stay) + '</span></div>' +
        '<div>' +
          '<h4>' + esc(s.name) + '<span class="tag tag-outline">' + esc(s.district) + '</span></h4>' +
          '<p class="glance">' + esc(s.summary) + '</p>' +
          '<div class="mini-culture">' +
            mini('史', gl.history, '') +
            mini('人', gl.figure, '') +
            mini('趣', gl.fact, '') +
            mini('物', gl.artifact, '') +
          '</div>' +
          '<div class="clue-actions">' +
            '<button class="btn btn-primary btn-sm" type="button" data-expand="' + i + '">逐点查看文化亮点 ›</button>' +
            '<button class="btn btn-outline btn-sm" type="button" data-story="' + esc((s.stories || [])[0] ? (s.stories[0].id) : '') + '">听一个典故 ›</button>' +
            '<a class="btn btn-outline btn-sm" href="#/spot/' + esc(s.id) + '" data-link>打开文化卡片</a>' +
          '</div>' +
          '<div class="clue-reveal" id="expand-' + i + '"></div>' +
        '</div></article>');

      /* 站点之间插一段交通衔接 */
      if (i > 0 && moves[i - 1]) blocks.push(transitBlock(moves[i - 1], i - 1));
    });
    var steps = '<div class="route-steps">' + blocks.join('') + '</div>';

    out.innerHTML =
      '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>行程概览</h3>' +
        '<span class="tiny muted">建议 08:30 出发 · ' + (spots.length > 6 ? '分两天更从容' : '一天可完成') + '</span></div>' +
        summary + '</div>' +
      steps +
      '<div class="play-bar">' +
        '<button class="btn btn-outline btn-sm" type="button" id="playPrev">‹ 上一站</button>' +
        '<button class="btn btn-primary btn-sm" type="button" id="playAuto">▶ 逐点巡览</button>' +
        '<button class="btn btn-outline btn-sm" type="button" id="playNext">下一站 ›</button>' +
        '<span class="tiny muted" id="playHint">逐点查看 = 时间轴自动展开每一站的亮点，边走边听。</span>' +
      '</div>';

    bindRoute(spots);
  }

  function glance(s) {
    return {
      history: (s.history || [])[0] || null,
      figure: (s.figures || [])[0] || null,
      fact: (s.facts || [])[0] || null,
      artifact: (s.artifacts || [])[0] || null
    };
  }

  /** 一站到下一站的交通衔接卡片：步行写时长，乘车写「几号线 + 上下车站 + 方向 + 出站怎么走」 */
  function transitBlock(p, idx) {
    var kind = p.mode === 'walk' ? 'walk' : (p.mode === 'metro' ? 'metro' : 'bus');
    var items = (p.items || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    return '<section class="route-transit rt-' + kind + '" data-transit="' + idx + '" aria-label="' +
      esc(p.from.name) + ' 到 ' + esc(p.to.name) + ' 的交通衔接">' +
      '<div class="rt-head">' +
        '<span class="rt-badge">' + esc(p.badge) + '</span>' +
        '<span class="rt-pair">' + esc(p.from.name) + '<i>→</i>' + esc(p.to.name) + '</span>' +
        '<span class="rt-time">约 ' + esc(transit.fmtMin(p.minutes)) + '</span>' +
      '</div>' +
      '<ol class="rt-steps">' + items + '</ol>' +
      '</section>';
  }

  function mini(k, o, unit) {
    if (!o) return '';
    var title = o.title || o.name || '';
    var text = o.text || '';
    return '<div class="mini"><span class="k">' + esc(k) + '</span><span>' +
      '<span class="t">' + esc(title) + (unit ? '：' : '') + '</span> ' + esc(text) + '</span></div>';
  }

  function expandStep(spots, i) {
    var box = document.getElementById('expand-' + i);
    var s = spots[i];
    if (!box || !s) return;
    if (box.dataset.opened === '1') { box.dataset.opened = '0'; box.style.display = 'none'; return; }
    box.dataset.opened = '1';
    var g = glance(s);
    box.innerHTML =
      '<div style="margin-top:12px;font-size:14.5px;color:var(--ink-2)">' +
        (g.history ? '<p><b style="color:var(--zhu-deep)">· 历史：</b>' + esc(g.history.era + ' ' + g.history.title) + '——' + esc(g.history.text) + '</p>' : '') +
        (g.figure ? '<p><b style="color:var(--zhu-deep)">· 人物：</b>' + esc(g.figure.role + ' ' + g.figure.name) + '——' + esc(g.figure.text) + '</p>' : '') +
        (g.fact ? '<p><b style="color:var(--zhu-deep)">· 趣事：</b>' + esc(g.fact.title) + '——' + esc(g.fact.text) + '</p>' : '') +
        (g.artifact ? '<p><b style="color:var(--zhu-deep)">· 文物：</b>' + esc(g.artifact.where + ' ' + g.artifact.name) + '——' + esc(g.artifact.text) + '</p>' : '') +
        ((s.clues || []).length ? '<p><b style="color:var(--zhu-deep)">· 线索：</b>现场可解开 ' + (s.clues || []).length + ' 条故事线索，' +
          '<a href="#/spot/' + esc(s.id) + '/clues" data-link>去详情页 ›</a></p>' : '') +
      '</div>';
    box.style.display = 'block';
    highlight(i);
    if (typeof box.scrollIntoView === 'function') {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function highlight(i) {
    ui.$$('#routeOut .route-step').forEach(function (el, k) {
      el.style.borderColor = (k === i) ? 'var(--gold-soft)' : '';
      el.style.background = (k === i) ? '#fff' : '';
    });
    var hint = document.getElementById('playHint');
    if (hint) hint.textContent = '正在查看第 ' + (i + 1) + ' / ' + ui.$$('#routeOut .route-step').length + ' 站';
  }

  function stepCount() { return document.querySelectorAll('#routeOut .route-step').length; }

  function gotoStep(i) {
    if (i < 0) i = stepCount() - 1;
    if (i > stepCount() - 1) i = 0;
    var spots = BJT.store.getLastRoute().map(function (id) { return BJT.data.byId(id); }).filter(Boolean);
    expandStep(spots, i);
  }

  function bindRoute(spots) {
    ui.$$('#routeOut [data-expand]').forEach(function (b) {
      b.addEventListener('click', function () { expandStep(spots, parseInt(b.getAttribute('data-expand'), 10)); });
    });
    ui.$$('#routeOut [data-story]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-story');
        if (!id) { ui.toast('这一站还没有预设典故'); return; }
        var spot = spots.filter(function (s) { return (s.stories || []).some(function (x) { return x.id === id; }); })[0];
        ui.openStory(ui.findStory(spot, id), spot);
      });
    });

    var prev = document.getElementById('playPrev');
    var next = document.getElementById('playNext');
    var auto = document.getElementById('playAuto');
    if (prev) prev.addEventListener('click', function () { stopAuto(); gotoStep(current - 1); });
    if (next) next.addEventListener('click', function () { stopAuto(); gotoStep(current + 1); });
    if (auto) auto.addEventListener('click', function () {
      if (timer) { stopAuto(); return; }
      auto.textContent = '⏸ 暂停巡览';
      gotoStep(current + 1);
      timer = setInterval(function () { gotoStep(current + 1); }, 6000);
    });
  }

  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
    var auto = document.getElementById('playAuto');
    if (auto) auto.textContent = '▶ 逐点巡览';
  }

  function mount(root) {
    var search = document.getElementById('planSearch');
    if (search) {
      var t = null;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { state.q = search.value; paintPicker(); }, 150);
      });
    }
    ui.$$('#planCats .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        state.cat = c.getAttribute('data-cat');
        ui.$$('#planCats .chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        paintPicker();
      });
    });

    var clear = document.getElementById('clearPlan');
    if (clear) clear.addEventListener('click', function () {
      BJT.store.setPlan([]); BJT.store.setLastRoute([]);
      paintPicker(); paintPicked(); paintRoute();
    });

    var gen = document.getElementById('genRoute');
    if (gen) gen.addEventListener('click', function () {
      var picked = BJT.store.getPlan();
      if (!picked.length) { ui.toast('先勾选至少一处景点'); return; }
      var route = buildRoute(picked);
      BJT.store.setLastRoute(route.map(function (s) { return s.id; }));
      paintRoute();
      ui.toast('已生成 ' + route.length + ' 处景点的行程');
      setTimeout(function () {
        var el = document.getElementById('routeOut');
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    });

    var autoPick = document.getElementById('autoPick');
    if (autoPick) autoPick.addEventListener('click', function () {
      var picks = ['gugong', 'tiantan', 'jingshan', 'yiheyuan', 'badaling']
        .filter(function (id) { return !!BJT.data.byId(id); });
      BJT.store.setPlan(picks);
      BJT.store.setLastRoute(buildRoute(picks).map(function (s) { return s.id; }));
      paintPicker(); paintPicked(); paintRoute();
      ui.toast('已为你选好 5 处经典：故宫、天坛、景山、颐和园、八达岭');
    });
  }

  BJT.views = BJT.views || {};
  BJT.views.plan = { render: render };
})(window, document);
