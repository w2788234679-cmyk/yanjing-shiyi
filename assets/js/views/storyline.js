/* ============================================================
   燕京拾遗 · 视图：故事线索总线
   把每个景点的预设线索串成若干条可打卡的「故事线」
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT, ui = BJT.ui;
  var esc = ui.esc;

  /* 每条故事线：若干节点，节点 = [景点 id, 该景点第几条线索] */
  var THREADS = [
    {
      id: 'axis', name: '中轴线上的中国', cat: '皇家宫殿',
      desc: '从永定的宫墙到天坛的祭天，一条 7.8 公里的中轴线上，埋着明清两代为什么要这么排、又排了什么。',
      nodes: [['gugong', 0], ['tiananmen', 0], ['jingshan', 0], ['zhonggulou', 0], ['tiantan', 0]]
    },
    {
      id: 'wall', name: '墙与关：北京的目光', cat: '长城关隘',
      desc: '北京的山海关口，是从周幽王烽火台一路走到明代九边的一条线。每一段墙，都对应过一次真实的边界。',
      nodes: [['badaling', 0], ['mutianyu', 0], ['gubeikou', 0], ['lugouqiao', 0], ['yinshan', 0]]
    },
    {
      id: 'garden', name: '皇家园林的黄昏', cat: '皇家园林',
      desc: '一座圆明园、一座颐和园，外加什刹海的水系：皇帝的山庄与园林，是北京最早的「城市理想」。',
      nodes: [['shichahai', 0], ['yiheyuan', 0], ['yuanmingyuan', 0], ['shisanling', 0]]
    },
    {
      id: 'museum', name: '馆里的中国', cat: '博物馆艺文',
      desc: '从后母戊鼎到简仪，北京的国家级博物馆把「中国从哪里来」摆成了一条可走的路。',
      nodes: [['guobo', 0], ['shoudubowuguan', 0], ['meishuguan', 0], ['guanxiangtai', 0]]
    },
    {
      id: 'temple', name: '香火与石板', cat: '宗教古迹',
      desc: '藏传佛寺、全真祖庭、国子监的石板：北京城里的信仰与礼制，共用同一套砖。',
      nodes: [['yonghegong', 0], ['baiyunguan', 0], ['guozijian', 0], ['zhihuasi', 0], ['fahaisi', 0]]
    },
    {
      id: 'city', name: '城与园的今天', cat: '城市场景',
      desc: '从双奥场馆到老城胡同、从高炉到动物园：这座城市怎么把 1919 年、1958 年与 2022 年叠在一起。',
      nodes: [['olympicpark', 0], ['shougang', 0], ['nanluoguxiang', 0], ['dazhalan', 0], ['dongwuyuan', 0], ['zhiwuyuan', 0]]
    }
  ];

  function threadProgress(th) {
    var done = 0, total = 0;
    th.nodes.forEach(function (n) {
      var s = BJT.data.byId(n[0]);
      if (!s) return;
      total += (s.clues || []).length;
      done += BJT.store.clueDoneCount(s.id, (s.clues || []).length);
    });
    return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 0 };
  }

  function render(root) {
    var pctAll = (function () {
      var d = BJT.data.stats();
      var done = Object.keys(BJT.store.all().clueDone).length;
      return { done: done, total: d.clueTotal, pct: d.clueTotal ? Math.round(done / d.clueTotal * 100) : 0 };
    })();

    root.innerHTML = '' +
      '<section class="wrap section">' +
        '<div class="storyline-hero">' +
          '<span class="eyebrow">Story Trails</span>' +
          '<h2 style="margin:6px 0 8px">故事线索 · 按线索把一座城串起来</h2>' +
          '<p>每个景点都预先准备了一组线索。到了现场照着提示找答案，解开后故事自动展开；' +
            '把同一条线上的几个景点依次走完，景点背后的故事线就串成了一条完整脉络。</p>' +
          '<div class="progress"><span style="width:' + pctAll.pct + '%"></span></div>' +
          '<div class="storyline-meta"><span>已完成 ' + pctAll.done + ' / ' + pctAll.total + ' 条线索</span><span>' + pctAll.pct + '%</span></div>' +
        '</div>' +
        '<div class="items-grid" style="margin-bottom:34px">' +
          THREADS.map(function (th) {
            var p = threadProgress(th);
            return '<a class="item-card" href="#/storyline/' + esc(th.id) + '" data-link style="text-decoration:none">' +
              '<h4>' + esc(th.name) + ' <span class="tag tag-gold">' + esc(th.cat) + '</span></h4>' +
              '<p>' + esc(th.desc) + '</p>' +
              '<div class="progress" style="margin-top:10px"><span style="width:' + p.pct + '%"></span></div>' +
              '<p class="tiny muted" style="margin:6px 0 0">' + p.done + ' / ' + p.total + ' 条线索 · ' + th.nodes.length + ' 处景点</p>' +
              '</a>';
          }).join('') +
        '</div>' +
        '<div id="threadBody"></div>' +
      '</section>';

    mount(root);
  }

  function mount(root) {
    var body = root.querySelector('#threadBody');
    var hashId = (BJT.app && BJT.app.params && BJT.app.params.thread) || '';
    paintThread(body, hashId);
  }

  function paintThread(body, thId) {
    if (!body) return;
    var th = THREADS.filter(function (t) { return t.id === thId; })[0] || THREADS[0];
    if (!th) { body.innerHTML = ''; return; }

    body.innerHTML = '' +
      '<div class="block-head"><span class="en">Track · ' + esc(th.id) + '</span><h2>' + esc(th.name) + '</h2></div>' +
      '<p class="muted" style="margin-bottom:20px">' + esc(th.desc) + '</p>' +
      '<div class="thread">' + th.nodes.map(function (n, i) {
        var s = BJT.data.byId(n[0]);
        if (!s) return '';
        var clue = (s.clues || [])[n[1]];
        var done = BJT.store.isClueDone(s.id, n[1]);
        return '<div class="thread-node' + (done ? ' is-done' : '') + '">' +
          '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:260px">' +
              '<h4 style="margin:0 0 4px">' + (i + 1) + '. ' + esc(s.name) +
                '<span class="tag ' + (done ? 'tag-gold' : 'tag-outline') + '">' + (done ? '已解开 ✓' : '待探索') + '</span></h4>' +
              (clue ? '<p class="clue-q" style="margin:6px 0 4px;font-size:15px">' + esc(clue.q) + '</p>' +
                '<p class="clue-hint">◇ 提示：' + esc(clue.hint) + '</p>' : '') +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<a class="btn btn-outline btn-sm" href="#/spot/' + esc(s.id) + '/clues" data-link>去现场解线索</a>' +
              '<a class="btn ' + (done ? 'btn-outline' : 'btn-primary') + ' btn-sm" href="#/spot/' + esc(s.id) + '" data-link>打开卡片</a>' +
            '</div>' +
          '</div></div>';
      }).join('') + '</div>';
  }

  BJT.THREADS = THREADS;
  BJT.views = BJT.views || {};
  BJT.views.storyline = { render: render };
})(window, document);
