/* ============================================================
   燕京拾遗 · 视图：我的收藏与探索进度
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT, ui = BJT.ui;
  var esc = ui.esc;

  var BADGES = [
    { at: 1, name: '初来乍到', desc: '解锁了第一个景点' },
    { at: 5, name: '半个北京市民', desc: '探索 5 处景点' },
    { at: 10, name: '京城常客', desc: '探索 10 处景点' },
    { at: 20, name: '燕京行家', desc: '探索 20 处景点' },
    { at: 30, name: '中轴通', desc: '探索全部 30 处景点' },
    { clue: 5, name: '线索猎人', desc: '解开 5 条故事线索' },
    { clue: 20, name: '故事接续者', desc: '解开 20 条故事线索' },
    { clue: 60, name: '讲故事的人', desc: '解开全部故事线索' },
    { fav: 5, name: '收藏夹满', desc: '收藏 5 处景点' }
  ];

  function unlocked() {
    var vCount = BJT.store.visitedCount();
    var clueDone = Object.keys(BJT.store.all().clueDone).length;
    var fav = BJT.store.favoriteCount();
    return BADGES.filter(function (b) {
      return (b.at ? vCount >= b.at : b.clue ? clueDone >= b.clue : fav >= b.fav);
    });
  }

  function render(root) {
    var spots = BJT.data.all();
    var favs = BJT.store.all().favorites.map(function (id) { return BJT.data.byId(id); }).filter(Boolean);
    var visited = spots.filter(function (s) { return BJT.store.isVisited(s.id); });
    var clueDone = Object.keys(BJT.store.all().clueDone).length;
    var d = BJT.data.stats();

    root.innerHTML = '' +
      '<section class="wrap section">' +
        '<div class="section-head"><div><span class="eyebrow">My Book</span><h2>我的收藏与探索</h2></div>' +
          '<p class="muted tiny" style="margin:0">进度保存在本机浏览器，换设备不会同步。</p></div>' +

        '<div class="profile-grid">' +
          '<div class="profile-card"><b>' + favs.length + '</b><span>收藏的景点</span></div>' +
          '<div class="profile-card"><b>' + visited.length + '</b><span>已探索景点</span></div>' +
          '<div class="profile-card"><b>' + clueDone + '</b><span>已解故事线索</span></div>' +
          '<div class="profile-card"><b>' + unlocked().length + '</b><span>已获得徽章</span></div>' +
        '</div>' +

        '<div class="block">' +
          '<div class="block-head"><span class="en">Badges</span><h2>徽章</h2></div>' +
          '<div class="items-grid">' + BADGES.map(function (b) {
            var on = unlocked().indexOf(b) !== -1;
            return '<div class="item-card" style="' + (on ? 'border-color:var(--gold-soft);background:#FFFDF7' : 'opacity:.62') + '">' +
              '<h4>' + (on ? '✦ ' : '◇ ') + esc(b.name) + '</h4><p>' + esc(b.desc) + '</p></div>';
          }).join('') + '</div>' +
        '</div>' +

        '<div class="block">' +
          '<div class="block-head"><span class="en">Favorites</span><h2>我的收藏</h2>' +
            '<span class="count">' + favs.length + ' 处</span></div>' +
          (favs.length
            ? '<div class="spot-grid">' + favs.map(function (s, i) { return ui.spotCard(s, i); }).join('') + '</div>'
            : '<div class="empty-state"><p>还没有收藏。在任意景点卡片上点 ☆ 就能收进来。</p></div>') +
        '</div>' +

        '<div class="block">' +
          '<div class="block-head"><span class="en">Trails solved</span><h2>已解开的线索</h2></div>' +
          clueList() +
        '</div>' +

        '<p class="tiny muted" style="margin-top:34px">' +
          '<button class="btn btn-outline btn-sm" type="button" id="resetAll">清空本机进度</button>' +
          '（会清空收藏、线索打卡与探索记录，不可撤销）</p>' +
      '</section>';

    mount(root);
  }

  function clueList() {
    var doneMap = BJT.store.all().clueDone;
    var keys = Object.keys(doneMap);
    if (!keys.length) return '<div class="empty-state"><p>还没有解开任何线索。去任一景点的「故事线索」里试试。</p></div>';

    return '<div class="items-grid">' + keys.map(function (k) {
      var p = k.split(':');
      var s = BJT.data.byId(p[0]);
      if (!s) return '';
      var i = parseInt(p[1], 10);
      var c = (s.clues || [])[i];
      return '<div class="item-card"><span class="item-where">' + esc(s.name) + '</span>' +
        '<h4>线索 ' + (i + 1) + (c ? '：' + esc(c.answer) : '') + '</h4>' +
        '<p>' + (c ? esc(c.reveal) : '') + '</p></div>';
    }).join('') + '</div>';
  }

  function mount(root) {
    var btn = root.querySelector('#resetAll');
    if (btn) btn.addEventListener('click', function () {
      if (!window.confirm('确定清空本机保存的收藏、线索打卡与探索记录吗？')) return;
      BJT.store.reset();
      BJT.app.refreshChrome();
      ui.toast('已清空本机进度');
      BJT.app.go('#/collection');
    });
  }

  BJT.views = BJT.views || {};
  BJT.views.collection = { render: render };
})(window, document);
