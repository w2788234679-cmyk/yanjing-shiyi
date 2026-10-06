/* ============================================================
   燕京拾遗 · 通用 UI 层
   - 转义与 DOM 小工具
   - 景点卡片、画廊弹层、故事阅读弹层、轻图层、Toast
   - 图片策略：优先使用 assets/img 下的实拍/生成图，缺失时回退程序化 SVG
   ============================================================ */
(function (window, document) {
  'use strict';

  var BJT = window.BJT = window.BJT || {};

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Toast ---------- */
  function toast(msg) {
    var stack = $('#toastStack');
    if (!stack) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 1900);
  }

  /* ---------- 图片 ---------- */
  /**
   * 生成图片 HTML：
   * - 数据里有 cover 且文件存在 → 用实体图
   * - 否则直接输出程序化 SVG（离线也不缺图）
   * 实体图加载失败时，由 document 上的 error 委托事件兜底替换为 SVG
   */
  function coverTag(spot, alt) {
    if (!spot || !spot.cover) return BJT.art(spot, null, 800, 500);
    return '<img src="' + esc(spot.cover) + '" alt="' + esc(alt || spot.name) + '" ' +
      'data-spot="' + esc(spot.id) + '" loading="lazy" decoding="async">';
  }

  /* ---------- 景点卡片 ---------- */
  function spotCard(spot, index) {
    var fav = BJT.store.isFavorite(spot.id);
    var clueTotal = (spot.clues || []).length;
    var doneNum = BJT.store.clueDoneCount(spot.id, clueTotal);
    var artHtml = coverTag(spot);
    var storyNum = (spot.stories || []).length;
    var picNum = (spot.galleries || []).reduce(function (n, g) { return n + g.items.length; }, 0);

    return '' +
      '<article class="card card-hover spot-card" data-spot="' + esc(spot.id) + '">' +
        '<button class="spot-card-fav' + (fav ? ' is-on' : '') + '" type="button" ' +
          'data-fav="' + esc(spot.id) + '" aria-label="收藏 ' + esc(spot.name) + '" aria-pressed="' + fav + '">' +
          (fav ? '★' : '☆') + '</button>' +
        '<a href="#/spot/' + esc(spot.id) + '" data-link>' +
          '<div class="spot-card-visual">' +
            (typeof index === 'number' ? '<span class="spot-card-index">' + (index + 1) + '</span>' : '') +
            artHtml +
          '</div>' +
          '<div class="spot-card-body">' +
            '<h3>' + esc(spot.name) + '</h3>' +
            '<div class="spot-card-meta"><span>' + esc(spot.category) + '</span><span>·</span><span>' + esc(spot.district) + '</span></div>' +
            '<p class="spot-card-desc ellipsis-2">' + esc(spot.summary) + '</p>' +
            '<div class="spot-card-tags">' +
              '<span class="tag tag-gold">' + picNum + ' 幅图</span>' +
              '<span class="tag tag-dai">' + storyNum + ' 个典故</span>' +
              '<span class="tag">' + clueTotal + ' 条线索</span>' +
            '</div>' +
            '<div class="spot-card-foot">' +
              '<span>' + esc(spot.visitTime) + ' · ' + esc(spot.ticket) + '</span>' +
              (clueTotal ? '<span>' + doneNum + '/' + clueTotal + ' 线索已解</span>' : '<span>查看详情 ›</span>') +
            '</div>' +
          '</div>' +
        '</a>' +
      '</article>';
  }

  /* ---------- 弹层基础 ---------- */
  var openStack = [];
  function openModal(node, onClose) {
    node.hidden = false;
    document.body.classList.add('no-scroll');
    openStack.push({ node: node, onClose: onClose });
    var focusable = node.querySelector('button, [href], input');
    if (focusable) focusable.focus();
  }
  function closeModal(node) {
    node.hidden = true;
    document.body.classList.remove('no-scroll');
    for (var i = openStack.length - 1; i >= 0; i--) {
      if (openStack[i].node === node) { if (openStack[i].onClose) openStack[i].onClose(); openStack.splice(i, 1); break; }
    }
  }
  function topModal() { return openStack.length ? openStack[openStack.length - 1].node : null; }

  /* ---------- 画廊弹层 ---------- */
  var galleryState = { items: [], idx: 0, spot: null };

  function galleryItems(spot) {
    var out = [];
    (spot.galleries || []).forEach(function (g) {
      (g.items || []).forEach(function (it) {
        out.push({
          caption: it.caption, story: it.story || '', group: g.name,
          image: it.image || '', spot: spot
        });
      });
    });
    return out;
  }

  function openGallery(spot, groupName) {
    var modal = $('#galleryModal');
    var items = galleryItems(spot);
    if (!items.length) { toast('该景点还没有图片集合'); return; }
    galleryState.spot = spot;
    galleryState.items = items;

    $('#galleryModalTitle').textContent = spot.name + ' · 图片集合';
    var pics = 0;
    (spot.galleries || []).forEach(function (g) { pics += g.items.length; });
    $('#galleryModalSub').textContent = (spot.galleries || []).length + ' 个主题分组 · 共 ' + pics + ' 幅，点击图片可阅读背后的典故';

    var html = (spot.galleries || []).map(function (g) {
      var cells = (g.items || []).map(function (it) {
        var hasStory = !!it.story;
        var svg = it.image ? '' : BJT.art(spot, null, 640, 480);
        var inner = it.image
          ? '<img src="' + esc(it.image) + '" alt="' + esc(it.caption) + '" loading="lazy">'
          : svg;
        return '<button class="gallery-cell" type="button" data-idx="' + (items.findIndex(function (x) { return x.caption === it.caption; })) + '">' +
          inner +
          '<span class="cap">' + esc(it.caption) +
          (hasStory ? '<span class="story-badge">点击读典故</span>' : '') +
          '</span></button>';
      }).join('');
      return '<section class="gallery-group"><h4>' + esc(g.name) + ' <span class="tiny muted">(' + g.items.length + ')</span></h4>' +
        '<div class="gallery-grid">' + cells + '</div></section>';
    }).join('');

    $('#galleryModalBody').innerHTML = html;
    openModal(modal);

    $$('#galleryModalBody .gallery-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        openLightbox(parseInt(cell.getAttribute('data-idx'), 10) || 0);
      });
    });
  }

  /* ---------- 轻图层 ---------- */
  function openLightbox(idx) {
    var items = galleryState.items;
    if (!items.length) return;
    idx = (idx + items.length) % items.length;
    galleryState.idx = idx;
    var it = items[idx];

    var lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.innerHTML =
      '<button class="lb-close" type="button" aria-label="关闭">✕</button>' +
      '<button class="lb-nav lb-prev" type="button" aria-label="上一幅">‹</button>' +
      '<figure class="lb-figure">' +
        (it.image ? '<img src="' + esc(it.image) + '" alt="' + esc(it.caption) + '">' : BJT.art(it.spot, null, 900, 640)) +
        '<figcaption class="lb-cap">' +
          '<b>' + esc(it.caption) + '</b>' +
          (it.story ? '<br><span class="tiny">点此阅读典故</span>' : '<br><span class="tiny">' + esc(it.group) + '</span>') +
        '</figcaption>' +
      '</figure>' +
      '<button class="lb-nav lb-next" type="button" aria-label="下一幅">›</button>' +
      '<div class="lb-hint">← → 切换 · Esc 关闭 · 共 ' + items.length + ' 幅</div>';

    /* 点击图片/图注：读典故 */
    var cap = lb.querySelector('.lb-cap');
    if (it.story) {
      cap.style.cursor = 'pointer';
      cap.addEventListener('click', function () {
        var story = findStory(it.spot, it.story);
        closeLightbox(lb);
        openStory(story, it.spot);
      });
    }

    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); openLightbox(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); openLightbox(idx + 1); });
    lb.querySelector('.lb-close').addEventListener('click', function (e) { e.stopPropagation(); closeLightbox(lb); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(lb); });

    document.body.appendChild(lb);
    document.body.classList.add('no-scroll');
    setTimeout(function () { lb.querySelector('.lb-close').focus(); }, 30);
  }

  function closeLightbox(lb) {
    if (lb && lb.parentNode) lb.parentNode.removeChild(lb);
    if (!document.querySelector('.gallery-lightbox')) document.body.classList.remove('no-scroll');
  }

  function findStory(spot, storyId) {
    var list = (spot && spot.stories) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === storyId) return list[i];
    return null;
  }

  /* ---------- 故事阅读弹层 ---------- */
  function openStory(story, spot) {
    if (!story) { toast('未找到该典故'); return; }
    var modal = $('#storyModal');
    var body = $('#storyModalBody');

    var paras = String(story.text || '').split(/\n+/).filter(function (x) { return x.trim(); });
    var html =
      '<p class="kicker">' + esc(spot ? spot.name : '') + ' · 典故</p>' +
      '<h2>' + esc(story.title) + '</h2>' +
      (story.subtitle ? '<p class="subtitle">' + esc(story.subtitle) + '</p>' : '') +
      '<p class="lead">' + esc(paras[0] || '') + '</p>' +
      '<div class="story-rule"></div>' +
      paras.slice(1).map(function (p) { return '<p class="ftext">' + esc(p) + '</p>'; }).join('') +
      '<div class="story-rule"></div>' +
      (spot ? '<a class="btn btn-outline btn-sm" href="#/spot/' + esc(spot.id) + '" data-link data-close-modal>' +
        '查看 ' + esc(spot.name) + ' 的文化卡片 ›</a>' : '');

    body.innerHTML = html;
    openModal(modal);
    var link = body.querySelector('[data-close-modal]');
    if (link) link.addEventListener('click', function () { closeModal(modal); });
  }

  /* 全局事件：点击关闭 / Esc 关闭 */
  document.addEventListener('click', function (e) {
    var closer = e.target.closest ? e.target.closest('[data-close-modal]') : null;
    if (closer) {
      var m = closer.closest('.modal');
      if (m) closeModal(m);
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var lb = document.querySelector('.gallery-lightbox');
    if (lb) { closeLightbox(lb); return; }
    var top = topModal();
    if (top) closeModal(top);
  });

  document.addEventListener('keydown', function (e) {
    var lb = document.querySelector('.gallery-lightbox');
    if (!lb) return;
    if (e.key === 'ArrowLeft') openLightbox(galleryState.idx - 1);
    if (e.key === 'ArrowRight') openLightbox(galleryState.idx + 1);
  });

  /* 图片错误兜底：实体图缺失时原地换成程序化 SVG，页面不会出现破图 */
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.fallback === '1') return;
    var spot = BJT.data ? BJT.data.byId(img.dataset.spot || '') : null;
    img.dataset.fallback = '1';
    if (spot) img.insertAdjacentHTML('afterend', BJT.art(spot, null, 800, 500));
    if (img.parentNode) img.parentNode.removeChild(img);
  }, true);

  BJT.ui = {
    esc: esc, $: $, $$: $$, toast: toast,
    spotCard: spotCard, coverTag: coverTag,
    openGallery: openGallery, openStory: openStory, openLightbox: openLightbox,
    closeModal: closeModal, openModal: openModal,
    findStory: findStory, galleryItems: galleryItems
  };
})(window, document);
