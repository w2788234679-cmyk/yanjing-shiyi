/* ============================================================
   燕京拾遗 · 视图：景点文化卡片详情
   包含：概览 / 历史沿革 / 近代趣闻 / 相关名人 / 馆藏文物 /
        故事线索（可打卡）/ 图片典故（标签弹层 → 画廊 → 典故）
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT, ui = BJT.ui;
  var esc = ui.esc;

  var TABS = [
    { key: 'overview', label: '文化卡片', en: 'Overview' },
    { key: 'history', label: '历史沿革', en: 'Chronicle' },
    { key: 'facts', label: '近代趣闻', en: 'Anecdotes' },
    { key: 'figures', label: '相关名人', en: 'Figures' },
    { key: 'artifacts', label: '馆藏文物', en: 'Artifacts' },
    { key: 'clues', label: '故事线索', en: 'Trails' },
    { key: 'gallery', label: '图片典故', en: 'Gallery' }
  ];

  function render(root, params) {
    var spot = BJT.data.byId(params.id);
    if (!spot) {
      root.innerHTML = '<div class="wrap section"><div class="empty-state">' +
        '<h2>没有找到这个景点</h2><p>链接可能已失效。</p>' +
        '<a class="btn btn-primary btn-sm" href="#/" data-link>回到景点总览</a></div></div>';
      return;
    }

    var tab = (params.tab || 'overview') && TABS.some(function (t) { return t.key === (params.tab || 'overview'); })
      ? params.tab : 'overview';
    var idx = BJT.data.all().indexOf(spot);

    BJT.store.markVisited(spot.id);

    var favOn = BJT.store.isFavorite(spot.id);

    root.innerHTML = '' +
      '<section class="wrap spot-hero">' +
        '<div class="spot-banner">' + ui.coverTag(spot, spot.name + ' 主视觉') +
          '<div class="spot-banner-cap">' +
            '<h1>' + esc(spot.name) + '</h1>' +
            '<div class="spot-alias">' + (spot.alias || []).map(function (a) { return '<span class="alias-chip">' + esc(a) + '</span>'; }).join('') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="spot-actions">' +
          '<button class="spot-fav-btn' + (favOn ? ' is-on' : '') + '" type="button" data-fav="' + esc(spot.id) + '" ' +
            'data-fav-label="★ 已收藏|☆ 收藏这处" aria-pressed="' + favOn + '">' +
            (favOn ? '★ 已收藏' : '☆ 收藏这处') + '</button>' +
          '<span class="tiny muted">收藏后可在「我的收藏」里查看，进度只保存在本机浏览器</span>' +
        '</div>' +
        '<div class="spot-info-bar">' +
          '<div>类别<b>' + esc(spot.category) + '</b></div>' +
          '<div>位置<b>' + esc(spot.district) + '</b></div>' +
          '<div>建议时长<b>' + esc(spot.visitTime) + '</b></div>' +
          '<div>门票<b>' + esc(spot.ticket) + '</b></div>' +
          '<div>图片<b>' + galleryCount(spot) + ' 幅</b></div>' +
        '</div>' +
        '<div style="margin-top:16px">' + tabBar(spot, tab) + '</div>' +
        '<div id="spotTabBody"></div>' +
        '<nav class="adjacent-nav">' + neighbor(idx, -1) + neighbor(idx, 1) + '</nav>' +
      '</section>';

    mount(root, spot, tab);
  }

  function galleryCount(spot) {
    return (spot.galleries || []).reduce(function (n, g) { return n + g.items.length; }, 0);
  }

  function tabBar(spot, active) {
    return '<div class="spot-tabs">' + TABS.map(function (t) {
      return '<a href="#/spot/' + esc(spot.id) + '/' + t.key + '" data-link' +
        (t.key === active ? ' class="is-active"' : '') + '>' + esc(t.label) + '</a>';
    }).join('') + '</div>';
  }

  function neighbor(idx, dir) {
    var list = BJT.data.all();
    var i = (idx + dir + list.length) % list.length;
    if (i === idx) return '<span></span>';
    return '<a href="#/spot/' + esc(list[i].id) + '" data-link>' +
      '<span class="tiny">' + (dir < 0 ? '‹ 上一处' : '下一处 ›') + '</span>' +
      '<b>' + esc(list[i].name) + '</b></a>';
  }

  function blockHead(title, en, count) {
    return '<div class="block-head"><span class="en">' + esc(en) + '</span><h2>' + esc(title) + '</h2>' +
      '<span class="count">' + esc(count) + '</span></div>';
  }

  function paintBody(root, spot, tab) {
    var body = root.querySelector('#spotTabBody');
    if (!body) return;

    if (tab === 'overview') {
      body.innerHTML = '<div class="block">' +
        blockHead('一句话概览', 'Summary', spot.summary.slice(0, 0) || '') +
        '<div class="summary-box">' + esc(spot.summary) + '</div>' +
        blockHead('必看之处', 'Highlights', (spot.highlights || []).length + ' 处') +
        '<div class="highlight-bar">' + (spot.highlights || []).map(function (h) {
          return '<button class="tag tag-zhu" type="button" data-goto-story="' + esc(h) + '">' + esc(h) + '</button>';
        }).join('') + '</div>' +
        '<div class="items-grid">' +
          miniCard(spot, 'history', '历史沿革', (spot.history || []).length + ' 个节点', '去查看 →') +
          miniCard(spot, 'facts', '近代趣闻', (spot.facts || []).length + ' 条', '去查看 →') +
          miniCard(spot, 'figures', '相关名人', (spot.figures || []).length + ' 位', '去查看 →') +
          miniCard(spot, 'artifacts', '馆藏文物与遗迹', (spot.artifacts || []).length + ' 项', '去查看 →') +
          miniCard(spot, 'clues', '故事线索', (spot.clues || []).length + ' 条待解', '去探索 →') +
          miniCard(spot, 'gallery', '图片与典故', galleryCount(spot) + ' 幅', '看图 →') +
        '</div></div>';
      return;
    }

    if (tab === 'history') {
      body.innerHTML = '<div class="block">' + blockHead('历史沿革', 'Chronicle', (spot.history || []).length + ' 个节点') +
        '<div class="timeline">' + (spot.history || []).map(function (h) {
          return '<div class="timeline-item"><span class="timeline-era">' + esc(h.era) + '</span>' +
            '<h4>' + esc(h.title) + '</h4><p>' + esc(h.text) + '</p></div>';
        }).join('') + '</div></div>';
      return;
    }

    if (tab === 'facts') {
      body.innerHTML = '<div class="block">' + blockHead('近代趣闻', 'Anecdotes', (spot.facts || []).length + ' 条') +
        '<div class="items-grid">' + (spot.facts || []).map(function (f, i) {
          return '<article class="item-card"><h4><span class="idx">0' + (i + 1) + '</span>' + esc(f.title) + '</h4>' +
            '<p>' + esc(f.text) + '</p></article>';
        }).join('') + '</div></div>';
      return;
    }

    if (tab === 'figures') {
      body.innerHTML = '<div class="block">' + blockHead('相关名人', 'Figures', (spot.figures || []).length + ' 位') +
        '<div class="items-grid">' + (spot.figures || []).map(function (f, i) {
          return '<article class="item-card figure-card"><h4><span class="idx">' + esc(f.role) + '</span>' + esc(f.name) + '</h4>' +
            '<p>' + esc(f.text) + '</p></article>';
        }).join('') + '</div></div>';
      return;
    }

    if (tab === 'artifacts') {
      body.innerHTML = '<div class="block">' + blockHead('馆藏文物与遗迹', 'Artifacts', (spot.artifacts || []).length + ' 项') +
        '<div class="items-grid">' + (spot.artifacts || []).map(function (a) {
          return '<article class="item-card"><span class="item-where">' + esc(a.where) + '</span>' +
            '<h4>' + esc(a.name) + '</h4><p>' + esc(a.text) + '</p></article>';
        }).join('') + '</div></div>';
      return;
    }

    if (tab === 'clues') {
      body.innerHTML = '<div class="block">' + blockHead('故事线索', 'Trails', (spot.clues || []).length + ' 条') +
        '<p class="muted">到现场按提示找答案，解开后答案与背后的故事会展开，进度会保存在本机。</p>' +
        '<div class="clue-list">' + (spot.clues || []).map(function (c, i) {
          var done = BJT.store.isClueDone(spot.id, i);
          return '<article class="clue' + (done ? ' is-done' : '') + '" data-clue="' + i + '">' +
            '<div class="clue-num">' + (i + 1) + '</div>' +
            '<div><p class="clue-q">' + esc(c.q) + '</p>' +
            '<p class="clue-hint">◇ 提示：' + esc(c.hint) + '</p>' +
            '<div class="clue-reveal"><b>答案：' + esc(c.answer) + '</b><br>' + esc(c.reveal) + '</div>' +
            '<div class="clue-actions">' +
              '<button class="btn ' + (done ? 'btn-outline' : 'btn-primary') + ' btn-sm" type="button" data-toggle-clue="' + i + '">' +
                (done ? '已解开 ✓（点击收回）' : '我在现场，解开线索') + '</button>' +
              (c.story ? '<button class="btn btn-outline btn-sm" type="button" data-story="' + esc(c.story) + '">读关联典故 ›</button>' : '') +
            '</div></div></article>';
        }).join('') + '</div></div>';
      return;
    }

    /* gallery */
    body.innerHTML = '<div class="block">' + blockHead('图片与典故', 'Gallery', galleryCount(spot) + ' 幅') +
      '<p class="muted">点击上方的分组标签，可弹出该景点的图片集合；点开任意一张，就能读到与它相关的典故故事。</p>' +
      tagBar(spot) +
      '<div class="gallery-strip">' + (spot.galleries || []).map(function (g) {
        var first = g.items[0] || {};
        return '<button class="gallery-cell" type="button" data-open-group="' + esc(g.name) + '">' +
          (first.image ? '<img src="' + esc(first.image) + '" alt="' + esc(first.caption) + '" loading="lazy">' : BJT.art(spot, null, 640, 480)) +
          '<span class="cap">' + esc(g.name) + '<span class="story-badge">' + g.items.length + ' 幅 · 点击查看</span></span></button>';
      }).join('') + '</div></div>';
  }

  function miniCard(spot, tab, title, sub, cta) {
    return '<a class="item-card" href="#/spot/' + esc(spot.id) + '/' + tab + '" data-link style="text-decoration:none">' +
      '<h4>' + esc(title) + '</h4><p>' + esc(sub) + '</p>' +
      '<p class="tiny" style="color:var(--zhu);margin-top:8px">' + esc(cta) + '</p></a>';
  }

  /* 标签条：点击标签 → 弹出该景点的图片集合 */
  function tagBar(spot) {
    var tags = (spot.galleries || []).map(function (g) {
      return '<button class="tag tag-zhu" type="button" data-open-group="' + esc(g.name) + '">◈ ' + esc(g.name) + '（' + g.items.length + '）</button>';
    });
    tags = tags.concat((spot.highlights || []).slice(0, 4).map(function (h) {
      return '<button class="tag tag-dai" type="button" data-goto-story="' + esc(h) + '">' + esc(h) + '</button>';
    }));
    return '<div class="highlight-bar" style="margin-bottom:16px">' + tags.join('') + '</div>';
  }

  /* ---------- 事件绑定 ----------
     ⚠ paintBody() 是整体替换 #spotTabBody 的 innerHTML，
       里面所有按钮的监听器都会随旧节点一起被销毁。
       所以凡是会触发重绘的交互（解开/收回线索），
       必须在重绘之后重新调用 mountBody() 补绑，否则按钮只有第一次能点。 */
  function mount(root, spot, tab) {
    /* 首次进入：先把内容画出来，再绑事件 */
    paintBody(root, spot, tab);

    /* 收藏按钮在 #spotTabBody 之外，重绘不会销毁它，这里只绑一次 */
    var favBtn = root.querySelector('[data-fav]');
    if (favBtn) {
      favBtn.addEventListener('click', function () {
        var on = BJT.store.isFavorite(spot.id);
        favBtn.classList.toggle('is-on', on);
        favBtn.setAttribute('aria-pressed', String(on));
        var labels = (favBtn.getAttribute('data-fav-label') || '').split('|');
        if (labels.length === 2) favBtn.textContent = on ? labels[0] : labels[1];
        BJT.app.refreshChrome();
      });
    }

    mountBody(root, spot, tab);
  }

  /** 只绑定 #spotTabBody 内部的按钮——每次 paintBody() 之后都要重跑一次 */
  function mountBody(root, spot, tab) {
    ui.$$('[data-toggle-clue]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-toggle-clue'), 10);
        var done = BJT.store.toggleClue(spot.id, i);
        var clue = (spot.clues || [])[i];
        if (done) {
          ui.toast('线索解开：' + (clue ? clue.answer : ''));
          if (clue && clue.story) setTimeout(function () { ui.openStory(ui.findStory(spot, clue.story), spot); }, 320);
        }
        BJT.app.refreshChrome();
        /* 重绘把旧按钮连同监听器一起清空了，必须补绑 */
        paintBody(root, BJT.data.byId(spot.id), tab);
        mountBody(root, BJT.data.byId(spot.id), tab);
      });
    });

    ui.$$('[data-story]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.openStory(ui.findStory(spot, btn.getAttribute('data-story')), spot);
      });
    });

    ui.$$('[data-open-group]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.openGallery(BJT.data.byId(spot.id), btn.getAttribute('data-open-group'));
      });
    });

    ui.$$('[data-goto-story]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-goto-story');
        openStoryByKeyword(spot, key);
      });
    });
  }

  /* 点击「必看之处」标签：优先定位到相关典故，有则打开，没有则打开图片集合 */
  function openStoryByKeyword(spot, key) {
    var hit = (spot.stories || []).filter(function (s) {
      return (s.title + s.subtitle + s.text).indexOf(key) !== -1;
    });
    if (hit.length) { ui.openStory(hit[0], spot); return; }
    var g = (spot.galleries || []).filter(function (x) {
      return x.items.some(function (it) { return it.story && (ui.findStory(spot, it.story) || {}).title === key; });
    });
    if (g.length) { ui.openGallery(spot, g[0].name); return; }
    ui.openGallery(spot);
  }

  BJT.views = BJT.views || {};
  BJT.views.spot = { render: render };
})(window, document);
