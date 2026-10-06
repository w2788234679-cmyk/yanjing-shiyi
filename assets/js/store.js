/* ============================================================
   燕京拾遗 · 本地状态层（localStorage 持久化）
   - 收藏、故事线索打卡、路线、探索进度全部存本地，断网可用
   - 所有读取都做容错，存储不可用时退化为内存态
   ============================================================ */
(function (window) {
  'use strict';

  var KEY = 'bjt.state.v1';

  var DEFAULTS = {
    favorites: [],          // 景点 id 数组
    clueDone: {},           // { "<spotId>:<clueIndex>": true }
    visited: {},            // { spotId: timestamp }
    plan: [],               // 路线中的景点 id
    lastRoute: []           // 上次生成的路线
  };

  var memory = null;

  function readRaw() {
    if (memory) return memory;
    var data = {};
    try {
      var raw = window.localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = {};
    }
    memory = {
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      clueDone: data.clueDone && typeof data.clueDone === 'object' ? data.clueDone : {},
      visited: data.visited && typeof data.visited === 'object' ? data.visited : {},
      plan: Array.isArray(data.plan) ? data.plan : [],
      lastRoute: Array.isArray(data.lastRoute) ? data.lastRoute : []
    };
    return memory;
  }

  function write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(memory));
    } catch (e) { /* 隐私模式或配额已满时静默降级 */ }
  }

  var store = {
    all: function () { return readRaw(); },

    isFavorite: function (id) { return readRaw().favorites.indexOf(id) !== -1; },

    toggleFavorite: function (id) {
      var s = readRaw();
      var i = s.favorites.indexOf(id);
      if (i === -1) { s.favorites.push(id); write(); return true; }
      s.favorites.splice(i, 1); write(); return false;
    },

    favoriteCount: function () { return readRaw().favorites.length; },

    isClueDone: function (spotId, index) { return !!readRaw().clueDone[spotId + ':' + index]; },

    toggleClue: function (spotId, index) {
      var done = !store.isClueDone(spotId, index);
      store.markClue(spotId, index, done);
      return done;
    },

    markClue: function (spotId, index, done) {
      var s = readRaw();
      var key = spotId + ':' + index;
      if (done === false) delete s.clueDone[key];
      else s.clueDone[key] = true;
      write();
    },

    clueDoneCount: function (spotId, total) {
      var n = 0;
      for (var i = 0; i < total; i++) if (store.isClueDone(spotId, i)) n++;
      return n;
    },

    markVisited: function (spotId) {
      var s = readRaw();
      if (!s.visited[spotId]) { s.visited[spotId] = Date.now(); write(); }
    },

    isVisited: function (spotId) { return !!readRaw().visited[spotId]; },

    visitedCount: function () { return Object.keys(readRaw().visited).length; },

    /* ---- 路线草稿 ---- */
    setPlan: function (ids) { readRaw().plan = ids.slice(); write(); },
    getPlan: function () { return readRaw().plan.slice(); },
    togglePlan: function (id) {
      var s = readRaw(), i = s.plan.indexOf(id);
      if (i === -1) s.plan.push(id); else s.plan.splice(i, 1);
      write();
      return i === -1;
    },
    setLastRoute: function (ids) { readRaw().lastRoute = ids.slice(); write(); },
    getLastRoute: function () { return readRaw().lastRoute.slice(); },

    reset: function () {
      memory = null;
      try { window.localStorage.removeItem(KEY); } catch (e) {}
    }
  };

  window.BJT = window.BJT || {};
  window.BJT.store = store;
})(window);
