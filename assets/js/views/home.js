/* ============================================================
   燕京拾遗 · 视图：景点总览（筛选 / 搜索 / 卡片墙 / 地图）
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT, ui = BJT.ui;
  var esc = ui.esc;

  var state = { cat: 'all', q: '', view: 'grid', sort: 'default' };
  var CATS = ['皇家宫殿', '长城关隘', '皇家园林', '博物馆艺文', '宗教古迹', '城市场景'];

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = BJT.data.all().filter(function (s) {
      if (state.cat !== 'all' && s.category !== state.cat) return false;
      if (!q) return true;
      var hay = [s.name].concat(s.alias || []).concat([s.category, s.district, s.summary])
        .concat(s.highlights || []).join(' ').toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      var inHistory = (s.history || []).some(function (h) { return String(h.title + h.text).toLowerCase().indexOf(q) !== -1; });
      var inStories = (s.stories || []).some(function (t) { return String(t.title + t.text).toLowerCase().indexOf(q) !== -1; });
      return inHistory || inStories;
    });

    if (state.sort === 'name') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); });
    } else if (state.sort === 'progress') {
      list.sort(function (a, b) {
        var pa = BJT.store.clueDoneCount(a.id, (a.clues || []).length);
        var pb = BJT.store.clueDoneCount(b.id, (b.clues || []).length);
        return pb - pa;
      });
    }
    return list;
  }

  function render(root) {
    var spots = BJT.data.all();
    var d = BJT.data.stats();

    root.innerHTML = '' +
      '<section class="hero"><div class="wrap hero-inner">' +
        '<div class="anim-in">' +
          '<span class="hero-kicker">◈ 北京文化知识科普 · 旅行应用</span>' +
          '<h1>旅行不操心，<br>文化我来讲 —— <em>燕京拾遗</em></h1>' +
          '<p class="hero-lede">' + d.spotTotal + ' 处北京主要景点，每处都建有一套文化知识卡片：' +
            '历史沿革、近代趣闻、相关名人、馆藏文物与遗迹。' +
            '规划路线时逐点查看文化亮点，点开图片还能读到背后的典故。</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-primary" href="#/spot/' + esc(spots[0].id) + '" data-link>从' + esc(spots[0].name) + '开始 ›</a>' +
            '<a class="btn btn-outline" href="#/plan" data-link>规划一条路线</a>' +
            '<a class="btn btn-outline" href="#/storyline" data-link>按故事线索探索</a>' +
          '</div>' +
          '<div class="hero-stats">' +
            '<div class="hero-stat"><b>' + d.spotTotal + '</b><span>处文化景点</span></div>' +
            '<div class="hero-stat"><b>' + d.picTotal + '</b><span>幅图片素材</span></div>' +
            '<div class="hero-stat"><b>' + d.storyTotal + '</b><span>个典故故事</span></div>' +
            '<div class="hero-stat"><b>' + d.clueTotal + '</b><span>条探索线索</span></div>' +
          '</div>' +
        '</div>' +
        '<aside class="hero-card anim-in">' +
          '<h3>今天先看哪儿？</h3>' +
          '<div class="quick-list">' +
            quick('◈', '中轴线上的皇家', '紫禁城 · 天安门 · 景山 · 天坛', 'gugong') +
            quick('▲', '登高望远的长城', '八达岭 · 慕田峪 · 古北口', 'badaling') +
            quick('❁', '园林与湖山', '颐和园 · 圆明园 · 什刹海', 'yiheyuan') +
            quick('❖', '馆里的中国', '国家博物馆 · 首博 · 美术馆', 'guobo') +
            quick('☾', '寺塔与香火', '雍和宫 · 白云观 · 智化寺', 'yonghegong') +
          '</div>' +
        '</aside>' +
      '</div></section>' +

      '<div class="toolbar"><div class="wrap toolbar-inner">' +
        '<div class="search-box"><span class="ico">⌕</span>' +
          '<input id="spotSearch" type="search" placeholder="搜索景点、名人、典故，如「和珅」「壁画」" aria-label="搜索景点">' +
        '</div>' +
        '<div class="chip-row" id="catChips">' +
          '<button class="chip is-active" type="button" data-cat="all">全部</button>' +
          CATS.map(function (c) {
            var n = spots.filter(function (s) { return s.category === c; }).length;
            return '<button class="chip" type="button" data-cat="' + esc(c) + '">' + esc(c) + '<span class="muted"> ' + n + '</span></button>';
          }).join('') +
        '</div>' +
        '<div class="view-toggle" role="group" aria-label="切换视图">' +
          '<button type="button" data-view="grid" class="is-active">▦ 卡片墙</button>' +
          '<button type="button" data-view="map">◉ 地图</button>' +
        '</div>' +
      '</div></div>' +

      '<section class="wrap" style="padding-top:18px;padding-bottom:8px">' +
        '<div class="result-bar" id="resultBar"></div>' +
        '<div id="listWrap"></div>' +
      '</section>';

    mount(root);
    paintList();
  }

  function quick(icon, title, desc, spotId) {
    return '<a class="hero-quick" href="#/spot/' + esc(spotId) + '" data-link>' +
      '<span class="ico">' + icon + '</span>' +
      '<span><b>' + esc(title) + '</b><span>' + esc(desc) + '</span></span></a>';
  }

  function paintList() {
    var list = filtered();
    var wrap = document.getElementById('listWrap');
    var bar = document.getElementById('resultBar');
    if (!wrap) return;

    var d = BJT.data.stats();
    bar.textContent = '共 ' + list.length + ' 处景点' + (state.cat === 'all' ? '' : '（' + state.cat + '）') +
      ' · 已探索 ' + BJT.store.visitedCount() + ' 处 · 已解线索 ' +
      Object.keys(BJT.store.all().clueDone).length + ' / ' + d.clueTotal;

    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><p>没有匹配的景点，换个词试试。</p>' +
        '<button class="btn btn-outline btn-sm" type="button" id="resetFilters">清空筛选</button></div>';
      var rz = document.getElementById('resetFilters');
      if (rz) rz.addEventListener('click', function () {
        state.cat = 'all'; state.q = '';
        var inp = document.getElementById('spotSearch'); if (inp) inp.value = '';
        syncChips(); paintList();
      });
      return;
    }

    if (state.view === 'map') {
      wrap.innerHTML = '<div class="map-view">' + mapSvg(list) + mapLegend() + '</div>';
      bindMap();
      return;
    }

    wrap.innerHTML = '<div class="spot-grid">' + list.map(function (s, i) { return ui.spotCard(s, i); }).join('') + '</div>';
  }

  function syncChips() {
    ui.$$('#catChips .chip').forEach(function (c) {
      c.classList.toggle('is-active', c.getAttribute('data-cat') === state.cat);
    });
  }

  /* ---------- 地图 ---------- */
  function project(lat, lng) {
    var W = 800, H = 470;
    var minLat = 39.55, maxLat = 41.05, minLng = 115.30, maxLng = 117.55;
    var x = (lng - minLng) / (maxLng - minLng) * W;
    var y = (maxLat - lat) / (maxLat - minLat) * H;
    return [x, y];
  }

  function mapSvg(list) {
    var spots = BJT.data.all();
    var ringColor = '#C9BDA6';
    var rings = [
      { r: 62, label: '二环' }, { r: 96, label: '三环' },
      { r: 132, label: '四环' }, { r: 176, label: '五环' }
    ];
    var g = '';
    rings.forEach(function (r) {
      g += '<circle cx="352" cy="252" r="' + r.r + '" fill="none" stroke="' + ringColor + '" stroke-width="1.5" stroke-dasharray="5 6"/>';
      g += '<text x="' + (352 + r.r + 6) + '" y="249" font-size="10.5" fill="#9A8F7C">' + r.label + '</text>';
    });
    g += '<line x1="352" y1="20" x2="352" y2="470" stroke="' + ringColor + '" stroke-width="1" stroke-dasharray="3 5"/>';
    g += '<line x1="0" y1="252" x2="800" y2="252" stroke="' + ringColor + '" stroke-width="1" stroke-dasharray="3 5"/>';

    var pins = spots.map(function (s) {
      var p = project(s.coords[0], s.coords[1]);
      var on = list.indexOf(s) !== -1;
      var visited = BJT.store.isVisited(s.id);
      var r = on ? 7 : 4.5;
      var fill = !on ? '#C9C0AF' : (visited ? '#2E6B4F' : '#B3302C');
      var label = on ? '<text x="' + p[0] + '" y="' + (p[1] - 12) + '" text-anchor="middle">' + esc(s.name) + '</text>' : '';
      return '<g class="map-pin" data-spot="' + esc(s.id) + '" transform="translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')">' +
        (on ? '<circle r="14" fill="rgba(179,48,44,.10)"/>' : '') +
        '<circle class="dot" r="' + r + '" fill="' + fill + '"/>' +
        label + '</g>';
    }).join('');

    return '<svg viewBox="0 0 800 470" role="img" aria-label="北京主要景点分布示意图">' +
      '<rect width="800" height="470" fill="#F3EDE0"/>' +
      '<text x="16" y="26" font-size="13" fill="#7C7367" font-family="serif">北京主要景点分布示意（按经纬度投影）</text>' +
      g + pins + '</svg>';
  }

  function mapLegend() {
    return '<div class="map-legend">' +
      '<span><i style="background:#B3302C"></i>待探索</span>' +
      '<span><i style="background:#2E6B4F"></i>已探索</span>' +
      '<span><i style="background:#C9C0AF"></i>已被筛掉</span>' +
      '<span class="muted">（示意图仅表达相对方位，非实际地形比例）</span></div>';
  }

  function bindMap() {
    ui.$$('#listWrap .map-pin').forEach(function (pin) {
      pin.addEventListener('click', function () {
        var id = pin.getAttribute('data-spot');
        window.location.hash = '#/spot/' + id;
      });
    });
  }

  /* ---------- 绑定 ---------- */
  function mount(root) {
    var input = document.getElementById('spotSearch');
    if (input) {
      var timer = null;
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { state.q = input.value; paintList(); }, 160);
      });
    }

    ui.$$('#catChips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        state.cat = c.getAttribute('data-cat');
        syncChips(); paintList();
      });
    });

    ui.$$('.view-toggle button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.getAttribute('data-view');
        ui.$$('.view-toggle button').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        paintList();
      });
    });
  }

  BJT.views = BJT.views || {};
  BJT.views.home = { render: render, invalidate: function () { paintList(); } };
})(window, document);
