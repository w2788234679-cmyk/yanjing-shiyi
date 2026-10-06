/* ============================================================
   燕京拾遗 · 应用外壳：hash 路由 / 全局委托 / 启动
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT, ui = BJT.ui;
  var esc = ui.esc;
  var root = document.getElementById('main');
  var app = {};
  BJT.app = app;

  /* ---------- 路由 ---------- */
  var ROUTES = [
    { re: /^\/?$/, name: 'home' },
    { re: /^\/spot\/([\w-]+)(?:\/([\w-]+))?\/?$/, name: 'spot', keys: ['id', 'tab'] },
    { re: /^\/plan\/?$/, name: 'plan' },
    { re: /^\/storyline\/?$/, name: 'storyline' },
    { re: /^\/storyline\/([\w-]+)\/?$/, name: 'storyline', keys: ['thread'] },
    { re: /^\/collection\/?$/, name: 'collection' }
  ];

  app.params = {};

  function parse() {
    var h = window.location.hash.replace(/^#/, '');
    for (var i = 0; i < ROUTES.length; i++) {
      var m = h.match(ROUTES[i].re);
      if (m) {
        var keys = ROUTES[i].keys || [];
        app.params = {};
        keys.forEach(function (k, idx) { app.params[k] = m[idx + 1]; });
        return ROUTES[i].name;
      }
    }
    return 'home';
  }

  app.go = function (hash) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  };

  function route() {
    if (!BJT.data || !BJT.data.ready()) {
      root.innerHTML = '<div class="wrap section"><div class="empty-state">' +
        '<h2>数据还没加载完</h2><p>' +
        esc('assets/js/data.js 未能读取，或数据文件为空。请确认文件位置后刷新页面。') + '</p></div></div>';
      return;
    }
    var name = parse();
    var view = BJT.views[name] || BJT.views.home;
    root.innerHTML = '';
    view.render(root, app.params);
    syncNav(name);
    app.refreshChrome();
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = titleOf(name);
  }

  function titleOf(name) {
    var map = {
      home: '景点总览',
      spot: '文化卡片',
      plan: '路线规划',
      storyline: '故事线索',
      collection: '我的收藏'
    };
    var p = app.params;
    if (name === 'spot' && p.id) {
      var s = BJT.data.byId(p.id);
      if (s) return s.name + ' · 燕京拾遗';
    }
    if (name === 'storyline' && p.thread) {
      var ps = BJT.THREADS && BJT.THREADS.filter(function (t) { return t.id === p.thread; })[0];
      if (ps) return ps.name + ' · 燕京拾遗';
    }
    return (map[name] || '燕京拾遗') + ' · 燕京拾遗';
  }

  function syncNav(name) {
    ui.$$('.site-nav a').forEach(function (a) {
      var key = a.getAttribute('data-nav');
      a.classList.toggle('is-active', key === name || (name === 'spot' && key === 'home'));
    });
  }

  /* ---------- 顶栏：探索进度 ---------- */
  app.refreshChrome = function () {
    var el = document.getElementById('progressText');
    if (!el || !BJT.data) return;
    var done = Object.keys(BJT.store.all().clueDone).length;
    var total = BJT.data.stats().clueTotal;
    el.textContent = total ? ('探索 ' + done + '/' + total) : '探索 0';
  };

  /* ---------- 全局事件委托 ---------- */
  document.addEventListener('click', function (e) {
    var fav = e.target.closest ? e.target.closest('[data-fav]') : null;
    if (fav) {
      e.preventDefault();
      var id = fav.getAttribute('data-fav');
      var on = BJT.store.toggleFavorite(id);
      fav.classList.toggle('is-on', on);
      fav.setAttribute('aria-pressed', String(on));
      /* data-fav-label="已收藏文案|未收藏文案"：图标按钮可省略 */
      var labels = (fav.getAttribute('data-fav-label') || '').split('|');
      if (labels.length === 2) fav.textContent = on ? labels[0] : labels[1];
      if (BJT.app) BJT.app.refreshChrome();
      ui.toast(on ? '已加入收藏：' + BJT.data.byId(id).name : '已取消收藏');
      return;
    }

    var prog = e.target.closest ? e.target.closest('#progressBtn') : null;
    if (prog) { app.go('#/collection'); return; }

    var burger = e.target.closest ? e.target.closest('#burger') : null;
    if (burger) {
      var nav = document.querySelector('.site-nav');
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      return;
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    if (!window.location.hash) window.location.replace('#/');
    window.addEventListener('hashchange', route);
    route();
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        var inp = document.getElementById('spotSearch');
        if (inp) { e.preventDefault(); inp.focus(); }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
