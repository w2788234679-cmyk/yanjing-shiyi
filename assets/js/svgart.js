/* ============================================================
   燕京拾遗 · 程序化国风插画引擎
   - 无 AI 图片时自动生成某一景点的可视化插画，保证离线可用
   - 同一 id 永远得到同一张图（确定性随机），不会每次刷新跳变
   ============================================================ */
(function (window) {
  'use strict';

  var PALETTES = [
    { sky: ['#F7EBD2', '#E6D2AC'], far: '#CBB994', mid: '#A88C68', near: '#6D573D', roof: '#8E2A24', ink: '#3A2E22' },
    { sky: ['#DCE8EC', '#B6CED7'], far: '#A2Bbc4', mid: '#6E8E9A', near: '#3C5A66', roof: '#2E4A55', ink: '#22373F' },
    { sky: ['#F4E2D8', '#E2C3B0'], far: '#CFA898', mid: '#A87A68', near: '#6F4A3C', roof: '#9B3A2E', ink: '#4A2E26' },
    { sky: ['#EAEFDF', '#CAD8BE'], far: '#B0C0A6', mid: '#7E9A78', near: '#4E6A4A', roof: '#5D4A38', ink: '#31402C' },
    { sky: ['#E8E3F0', '#C9C2DC'], far: '#B5ADD0', mid: '#837BA4', near: '#4E4870', roof: '#5A3F63', ink: '#332B44' }
  ];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* mulberry32：确定性伪随机 */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 中式屋顶（举折曲线 + 起翘） */
  function eave(cx, y, hw, dip, th) {
    return 'M' + (cx - hw) + ',' + y +
      ' Q' + cx + ',' + (y - dip) + ' ' + (cx + hw) + ',' + y +
      ' L' + (cx + hw * 0.82) + ',' + (y + th) +
      ' Q' + cx + ',' + (y + th - dip * 0.7) + ' ' + (cx - hw * 0.82) + ',' + (y + th) + ' Z';
  }

  function ridge(cx, y, hw) {
    return 'M' + (cx - hw) + ',' + y + ' l' + (-12) + ',' + (-15) + ' l' + (20) + ',' + (5) +
      ' Z M' + (cx + hw) + ',' + y + ' l' + (12) + ',' + (-15) + ' l' + (-20) + ',' + (5) + ' Z';
  }

  /* 山峦层 */
  function mountains(r, p, baseY, amp, color, opacity) {
    var d = 'M0,' + baseY;
    var x = 0;
    while (x < 820) {
      var w = 130 + r() * 190;
      var peak = baseY - amp * (0.45 + r() * 0.55);
      d += ' Q' + (x + w * 0.42) + ',' + peak + ' ' + (x + w) + ',' + (baseY - r() * 14);
      x += w;
    }
    d += ' L820,520 L0,520 Z';
    return '<path d="' + d + '" fill="' + color + '" opacity="' + (opacity || 1) + '"/>';
  }

  function clouds(r, color, yBase) {
    var out = '';
    for (var i = 0; i < 3; i++) {
      var cx = 90 + r() * 620, cy = yBase - r() * 40, s = 0.6 + r() * 0.8;
      out += '<g opacity=".5" fill="' + color + '">' +
        '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (58 * s) + '" ry="' + (13 * s) + '"/>' +
        '<ellipse cx="' + (cx + 30 * s) + '" cy="' + (cy - 7 * s) + '" rx="' + (38 * s) + '" ry="' + (11 * s) + '"/>' +
        '</g>';
    }
    return out;
  }

  var SCENES = {};

  /* 皇家宫殿 / 坛庙：多重屋檐 + 台基 + 立柱 */
  SCENES.palace = function (r, p) {
    var s = '';
    var baseY = 430;
    s += mountains(r, p, 400, 90, p.far, '.55');
    s += clouds(r, '#FFFFFF', 120);
    /* 台基 */
    s += '<rect x="120" y="' + baseY + '" width="560" height="' + (520 - baseY) + '" fill="' + p.near + '" opacity=".9"/>';
    s += '<rect x="150" y="' + (baseY - 26) + '" width="500" height="30" fill="' + p.mid + '"/>';
    /* 三层屋檐 */
    var tiers = [
      { y: 356, hw: 300, w: 250, h: 210 },
      { y: 240, hw: 226, w: 186, h: 148 },
      { y: 140, hw: 150, w: 120, h: 96 }
    ];
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      s += '<path d="' + eave(400, t.y, t.hw, 46, 30) + '" fill="' + p.roof + '"/>';
      s += '<path d="' + ridge(400, t.y, t.hw) + '" fill="' + p.roof + '"/>';
      s += '<rect x="' + (400 - t.w / 2) + '" y="' + (t.y + 30) + '" width="' + t.w + '" height="' + (t.h) + '" fill="' + p.near + '" opacity=".92"/>';
      /* 檐下斗拱暗部 */
      s += '<rect x="' + (400 - t.w / 2 - 6) + '" y="' + (t.y + 22) + '" width="' + (t.w + 12) + '" height="12" fill="' + p.ink + '" opacity=".55"/>';
    }
    /* 立柱 */
    for (var c = 0; c < 8; c++) {
      var cx = 178 + c * 42;
      s += '<rect x="' + cx + '" y="300" width="9" height="104" fill="' + p.roof + '" opacity=".85"/>';
    }
    /* 宝顶 */
    s += '<circle cx="400" cy="120" r="15" fill="' + p.roof + '"/><rect x="396" y="100" width="8" height="20" fill="' + p.ink + '"/>';
    /* 宫墙与地面 */
    s += '<rect x="150" y="382" width="500" height="24" fill="' + p.roof + '" opacity=".9"/>';
    return s;
  };

  /* 长城：山脊 + 城墙 + 敌楼 + 烽火 */
  SCENES.wall = function (r, p) {
    var s = '';
    s += mountains(r, p, 360, 130, p.far, '.5');
    s += mountains(r, p, 420, 150, p.mid, '.85');
    s += clouds(r, '#FFFFFF', 100);
    /* 城墙沿山脊 */
    var pts = [[-40, 500], [90, 430], [230, 392], [380, 372], [530, 386], [670, 424], [820, 470]];
    var d = 'M' + pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' L');
    s += '<path d="' + d + ' L820,520 L-40,520 Z" fill="' + p.near + '"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + p.mid + '" stroke-width="42" stroke-linejoin="round"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + p.ink + '" stroke-width="6" opacity=".35"/>';
    /* 垛口 */
    for (var x = -20; x < 840; x += 26) {
      var ratio = 1 - (x / 840);
      var y = 500 - (x + 40) * 0.62;
      if (ratio > 0.62 || ratio < 0.12) continue;
      s += '<rect x="' + x + '" y="' + (y - 14) + '" width="13" height="18" fill="' + p.mid + '"/>';
    }
    /* 敌楼 */
    s += '<g><rect x="352" y="270" width="96" height="110" fill="' + p.near + '"/>';
    s += '<path d="' + eave(400, 262, 74, 26, 20) + '" fill="' + p.roof + '"/>';
    s += '<rect x="386" y="306" width="28" height="30" fill="' + p.ink + '" opacity=".7"/>';
    s += '<rect x="366" y="352" width="68" height="28" fill="' + p.ink + '" opacity=".45"/></g>';
    /* 烽火 */
    s += '<g><rect x="586" y="300" width="34" height="92" fill="' + p.near + '"/>';
    s += '<path d="' + eave(603, 294, 30, 18, 16) + '" fill="' + p.roof + '"/>';
    s += '<path d="M602,286 q14,-22 26,-6 q16,-10 4,-28 l18,4 q6,26 -14,34 q10,18 -6,24 Z" fill="#E08A3C" opacity=".9"/></g>';
    return s;
  };

  /* 园林：水岸 + 拱桥 + 垂柳 + 假山 */
  SCENES.garden = function (r, p) {
    var s = '';
    s += mountains(r, p, 330, 100, p.far, '.45');
    s += clouds(r, '#FFFFFF', 96);
    /* 远处的殿 */
    s += '<g opacity=".9"><path d="' + eave(250, 300, 120, 30, 20) + '" fill="' + p.roof + '"/>';
    s += '<rect x="196" y="320" width="108" height="86" fill="' + p.near + '" opacity=".9"/></g>';
    /* 湖面 */
    s += '<rect x="0" y="392" width="800" height="128" fill="' + p.mid + '" opacity=".75"/>';
    for (var i = 0; i < 6; i++) {
      var y = 404 + i * 19, w = 60 + r() * 130;
      s += '<rect x="' + (r() * 500) + '" y="' + y + '" width="' + w + '" height="3" rx="1.5" fill="#FFFFFF" opacity=".28"/>';
    }
    /* 拱桥 */
    s += '<path d="M150,404 Q300,318 452,404 L452,392 Q300,300 150,392 Z" fill="' + p.near + '"/>';
    s += '<path d="M150,392 Q300,306 452,392" fill="none" stroke="' + p.ink + '" stroke-width="4" opacity=".5"/>';
    for (var b = 0; b < 9; b++) {
      var t = b / 8, bx = 150 + (452 - 150) * t, by = 392 - 86 * Math.sin(Math.PI * t) * 0.9;
      s += '<rect x="' + (bx - 2) + '" y="' + (by - 26) + '" width="4" height="26" fill="' + p.ink + '" opacity=".55"/>';
    }
    s += '<rect x="144" y="366" width="314" height="6" rx="3" fill="' + p.ink + '" opacity=".55"/>';
    /* 垂柳 */
    s += '<g><rect x="690" y="330" width="14" height="76" fill="' + p.ink + '"/>';
    for (var l = 0; l < 9; l++) {
      var lx = 664 + l * 6;
      s += '<path d="M697,336 q' + ((r() - 0.5) * 40) + ',' + (60 + r() * 60) + ' ' + ((r() - 0.5) * 24) + ',' + 96 + '" fill="none" stroke="#5C7A52" stroke-width="2" opacity=".7"/>';
    }
    s += '<ellipse cx="697" cy="332" rx="56" ry="20" fill="#6E8C5E" opacity=".8"/><ellipse cx="697" cy="318" rx="40" ry="14" fill="#7F9C6B" opacity=".7"/></g>';
    /* 假山 */
    s += '<path d="M60,430 l14,-52 l26,20 l18,-40 l22,34 l16,-22 l20,60 Z" fill="' + p.ink + '" opacity=".55"/>';
    /* 亭 */
    s += '<g><path d="' + eave(560, 356, 46, 18, 14) + '" fill="' + p.roof + '"/>';
    s += '<rect x="548" y="370" width="10" height="40" fill="' + p.ink + '" opacity=".7"/>';
    s += '<rect x="574" y="370" width="10" height="40" fill="' + p.ink + '" opacity=".7"/></g>';
    return s;
  };

  /* 塔寺：多层塔 + 松 */
  SCENES.tower = function (r, p) {
    var s = '';
    s += mountains(r, p, 350, 110, p.far, '.45');
    s += clouds(r, '#FFFFFF', 90);
    var tiers = 5, top = 120, bottom = 396, cx = 420;
    for (var i = 0; i < tiers; i++) {
      var f = i / (tiers - 1);
      var y = bottom - (bottom - top) * f;
      var hw = 96 - 62 * f;
      s += '<path d="' + eave(cx, y, hw, hw * 0.34, hw * 0.24) + '" fill="' + p.roof + '"/>';
      s += '<path d="' + ridge(cx, y, hw) + '" fill="' + p.roof + '"/>';
      s += '<rect x="' + (cx - hw * 0.66) + '" y="' + (y + hw * 0.24) + '" width="' + hw * 1.32 + '" height="' + (hw * 0.72) + '" fill="' + p.near + '" opacity=".92"/>';
      if (i % 2 === 0) s += '<rect x="' + (cx - 8) + '" y="' + (y + hw * 0.4) + '" width="16" height="' + (hw * 0.42) + '" fill="' + p.ink + '" opacity=".55"/>';
    }
    s += '<rect x="' + (cx - 4) + '" y="112" width="8" height="26" fill="' + p.ink + '"/>';
    s += '<circle cx="' + cx + '" cy="106" r="11" fill="' + p.roof + '"/><circle cx="' + cx + '" cy="92" r="6" fill="' + p.roof + '"/>';
    s += '<circle cx="' + cx + '" cy="80" r="4" fill="' + p.roof + '"/>';
    /* 松树 */
    s += '<g><rect x="150" y="366" width="12" height="64" fill="' + p.ink + '"/>';
    for (var t2 = 0; t2 < 3; t2++) {
      var ty = 386 - t2 * 22;
      s += '<ellipse cx="156" cy="' + ty + '" rx="' + (34 - t2 * 8) + '" ry="' + (13 - t2 * 2) + '" fill="#4F6B49" opacity=".85"/>';
    }
    s += '<rect x="676" y="382" width="11" height="48" fill="' + p.ink + '"/>';
    s += '<ellipse cx="681" cy="378" rx="30" ry="12" fill="#5C7A52" opacity=".8"/></g>';
    s += '<rect x="220" y="416" width="400" height="14" rx="4" fill="' + p.mid + '"/>';
    return s;
  };

  /* 现代场馆 / 艺术区 / 工业遗址 */
  SCENES.modern = function (r, p) {
    var s = '';
    s += '<rect x="0" y="0" width="800" height="520" fill="' + p.sky[1] + '" opacity=".55"/>';
    for (var i = 0; i < 26; i++) {
      var w = 26 + r() * 60, h = 60 + r() * 230;
      var x = -20 + i * 33 + r() * 10;
      s += '<rect x="' + x + '" y="' + (430 - h) + '" width="' + w + '" height="' + h + '" fill="' + p.far + '" opacity="' + (0.35 + r() * 0.4) + '"/>';
    }
    s += clouds(r, '#FFFFFF', 80);
    /* 主体：拱形穹顶（鸟巢感）+ 膜结构 */
    s += '<g>';
    s += '<path d="M250,420 Q400,206 550,420 Z" fill="none" stroke="' + p.near + '" stroke-width="7" opacity=".85"/>';
    for (var a = 0; a < 9; a++) {
      var ax = 250 + a * 25;
      s += '<path d="M' + ax + ',420 Q' + ((250 + 550) / 2) + ',' + (210 + a * 4) + ' ' + ax + ',420" fill="none" stroke="' + p.near + '" stroke-width="2.4" opacity=".45"/>';
    }
    s += '<rect x="236" y="416" width="330" height="14" rx="6" fill="' + p.near + '"/>';
    s += '</g>';
    /* 方形馆 */
    s += '<g><rect x="86" y="316" width="152" height="108" fill="' + p.mid + '" opacity=".9"/>';
    for (var c2 = 0; c2 < 6; c2++) s += '<rect x="' + (98 + c2 * 24) + '" y="330" width="10" height="82" fill="' + p.ink + '" opacity=".3"/>';
    s += '<rect x="78" y="306" width="168" height="12" fill="' + p.near + '"/></g>';
    /* 另一侧弧形（水立方感） */
    s += '<g><rect x="580" y="330" width="150" height="96" rx="14" fill="' + p.mid + '" opacity=".85"/>';
    for (var q = 0; q < 5; q++) s += '<rect x="' + (592 + q * 28) + '" y="342" width="14" height="72" fill="' + p.ink + '" opacity=".22"/>';
    s += '</g>';
    /* 高炉剪影 */
    s += '<g opacity=".9"><rect x="150" y="238" width="52" height="196" fill="' + p.near + '"/>';
    s += '<rect x="136" y="220" width="80" height="24" fill="' + p.ink + '"/>';
    s += '<rect x="162" y="286" width="26" height="148" fill="' + p.ink + '" opacity=".5"/></g>';
    s += '<rect x="0" y="430" width="800" height="90" fill="' + p.near + '" opacity=".9"/>';
    return s;
  };

  /* 市井 / 老城：坡屋顶街区 + 招牌 */
  SCENES.skyline = function (r, p) {
    var s = '';
    s += mountains(r, p, 300, 80, p.far, '.4');
    s += clouds(r, '#FFFFFF', 86);
    var x = -20;
    while (x < 830) {
      var w = 56 + r() * 66, h = 90 + r() * 130;
      s += '<rect x="' + x + '" y="' + (424 - h) + '" width="' + w + '" height="' + h + '" fill="' + p.near + '" opacity="' + (0.85 + r() * 0.15) + '"/>';
      s += '<path d="M' + (x - 8) + ',' + (424 - h) + ' L' + (x + w / 2) + ',' + (424 - h - 34) + ' L' + (x + w + 8) + ',' + (424 - h) + ' Z" fill="' + p.roof + '" opacity=".9"/>';
      for (var ww = 0; ww < 3; ww++) {
        s += '<rect x="' + (x + 10 + r() * (w - 26)) + '" y="' + (424 - h + 18 + ww * 30) + '" width="12" height="16" fill="#F0D9A0" opacity="' + (0.35 + r() * 0.5) + '"/>';
      }
      s += '<rect x="' + (x + 8) + '" y="' + (424 - 46) + '" width="' + (w - 16) + '" height="26" rx="4" fill="' + p.roof + '" opacity=".8"/>';
      x += w + 6;
    }
    s += '<rect x="0" y="424" width="800" height="96" fill="' + p.ink + '" opacity=".85"/>';
    /* 灯笼 */
    for (var l = 0; l < 4; l++) {
      var lx = 120 + l * 190;
      s += '<line x1="' + lx + '" y1="150" x2="' + lx + '" y2="188" stroke="' + p.ink + '" stroke-width="2"/>';
      s += '<ellipse cx="' + lx + '" cy="200" rx="13" ry="16" fill="#C6412F" opacity=".92"/>';
      s += '<rect x="' + (lx - 5) + '" y="184" width="10" height="4" fill="' + p.ink + '"/>';
    }
    return s;
  };

  /* 自然 / 生灵 */
  SCENES.nature = function (r, p) {
    var s = '';
    s += mountains(r, p, 320, 110, p.far, '.42');
    s += clouds(r, '#FFFFFF', 84);
    var trees = [[110, 1], [190, .7], [640, .9], [726, 1.1], [560, .6], [70, .55]];
    for (var i = 0; i < trees.length; i++) {
      var t = trees[i], cx = t[0], sc = t[1];
      s += '<rect x="' + (cx - 5 * sc) + '" y="' + (400 - 46 * sc) + '" width="' + (10 * sc) + '" height="' + (60 * sc) + '" fill="' + p.ink + '"/>';
      s += '<circle cx="' + cx + '" cy="' + (380 - 26 * sc) + '" r="' + (38 * sc) + '" fill="#5E7E52" opacity=".88"/>';
      s += '<circle cx="' + (cx - 14 * sc) + '" cy="' + (396 - 22 * sc) + '" r="' + (26 * sc) + '" fill="#6E8C5E" opacity=".8"/>';
      s += '<circle cx="' + (cx + 16 * sc) + '" cy="' + (398 - 30 * sc) + '" r="' + (22 * sc) + '" fill="#4F6B49" opacity=".75"/>';
    }
    /* 湖 */
    s += '<rect x="0" y="404" width="800" height="116" fill="' + p.mid + '" opacity=".7"/>';
    for (var w = 0; w < 7; w++) {
      s += '<rect x="' + (r() * 420) + '" y="' + (414 + w * 15) + '" width="' + (50 + r() * 150) + '" height="3" rx="1.5" fill="#FFFFFF" opacity=".3"/>';
    }
    /* 小径 */
    s += '<path d="M330,520 Q360,460 300,418" fill="none" stroke="#E5D8BE" stroke-width="26" opacity=".7"/>';
    /* 生灵 */
    s += '<g opacity=".92"><ellipse cx="600" cy="452" rx="34" ry="20" fill="#C8B79A"/>';
    s += '<circle cx="632" cy="440" r="12" fill="#C8B79A"/><circle cx="636" cy="436" r="3" fill="' + p.ink + '"/>';
    s += '<path d="M566,446 q-16,10 -20,22 q16,-4 22,-14 Z" fill="#E8DFC9"/></g>';
    return s;
  };

  /* 星象 / 古观象台 */
  SCENES.astro = function (r, p) {
    var s = '';
    s += '<rect x="0" y="0" width="800" height="520" fill="#1E2E38" opacity=".9"/>';
    for (var i = 0; i < 60; i++) {
      s += '<circle cx="' + (r() * 800) + '" cy="' + (r() * 340) + '" r="' + (0.6 + r() * 1.4) + '" fill="#F3E9CE" opacity="' + (0.3 + r() * 0.6) + '"/>';
    }
    s += '<circle cx="640" cy="110" r="42" fill="#F0D6A0" opacity=".18"/><circle cx="640" cy="110" r="24" fill="#F0D6A0" opacity=".55"/>';
    /* 简仪 */
    s += '<g stroke="#F0D6A0" fill="none" stroke-width="2.4" opacity=".85">';
    s += '<circle cx="380" cy="290" r="120"/><circle cx="380" cy="290" r="86"/><circle cx="380" cy="290" r="52"/>';
    s += '<ellipse cx="380" cy="290" rx="120" ry="42"/>';
    s += '<line x1="380" y1="150" x2="380" y2="430"/><line x1="260" y1="290" x2="500" y2="290"/>';
    s += '<line x1="300" y1="196" x2="460" y2="384"/><line x1="460" y1="196" x2="300" y2="384"/>';
    s += '</g>';
    s += '<rect x="300" y="404" width="180" height="16" rx="6" fill="#F0D6A0" opacity=".7"/>';
    s += '<rect x="366" y="404" width="26" height="60" fill="#F0D6A0" opacity=".5"/>';
    return s;
  };

  var KIND_BY_CATEGORY = {
    '皇家宫殿': 'palace',
    '长城关隘': 'wall',
    '皇家园林': 'garden',
    '博物馆艺文': 'modern',
    '宗教古迹': 'tower',
    '城市场景': 'skyline'
  };

  function kindFor(spot) {
    if (!spot) return 'palace';
    var name = (spot.name || '') + ' ' + (spot.summary || '') + ' ' + (spot.highlights || []).join(' ');
    if (/观象台|天文|浑仪|简仪|星/.test(name)) return 'astro';
    if (/动物园|植物园|熊猫|金丝猴|麋鹿|生灵/.test(name)) return 'nature';
    if (/798|艺术区|展览|美术馆|首钢|高炉|奥林匹克|鸟巢|水立方|双奥/.test(name)) return 'modern';
    if (/胡同|大栅栏|前门|老街|市井|南锣/.test(name)) return 'skyline';
    if (/长城|关隘|敌楼|烽火|箭楼/.test(name)) return 'wall';
    if (/园|湖|桥|水|柳|亭/.test(name)) return 'garden';
    if (/寺|庙|观|塔|庵/.test(name)) return 'tower';
    if (KIND_BY_CATEGORY[spot.category]) return KIND_BY_CATEGORY[spot.category];
    return 'palace';
  }

  var cache = {};

  /**
   * 生成景点插画 SVG 字符串
   * @param {object} spot 景点对象
   * @param {string} [kind] 场景类型，缺省自动判断
   * @param {number} [w] 逻辑宽（默认 800）
   * @param {number} [h] 逻辑高（默认 500）
   */
  function art(spot, kind, w, h) {
    if (!spot) return '';
    w = w || 800; h = h || 500;
    var key = (spot.id || '') + '|' + (kind || 'auto') + '|' + w + 'x' + h;
    if (cache[key]) return cache[key];

    kind = kind || kindFor(spot);
    var seed = hash(spot.id || spot.name || 'bj');
    var r = rng(seed);
    var p = PALETTES[seed % PALETTES.length];
    var scene = SCENES[kind] || SCENES.palace;

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" ' +
      'preserveAspectRatio="xMidYMid slice" role="img" aria-label="' +
      String(spot.name || '').replace(/[<>&]/g, '') + '插画">' +
      '<defs><linearGradient id="sky_' + spot.id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.sky[0] + '"/><stop offset="1" stop-color="' + p.sky[1] + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="url(#sky_' + spot.id + ')"/>';

    /* 场景绘制基于 800x500 坐标系，等比缩放 */
    var sx = w / 800, sy = h / 500;
    svg += '<g transform="scale(' + Math.max(sx, sy).toFixed(3) + ')" transform-origin="0 0">';
    svg += scene(r, p);
    svg += '</g>';
    /* 印章 */
    svg += '<g opacity=".9"><rect x="' + (w - 96) + '" y="' + (h - 96) + '" width="52" height="52" rx="8" fill="#B3302C" opacity=".88"/>';
    svg += '<text x="' + (w - 92) + '" y="' + (h - 68) + '" font-size="19" fill="#FBF8F1" font-family="serif">' +
      String((spot.name || '京').slice(0, 1)) + '</text>';
    svg += '<text x="' + (w - 92) + '" y="' + (h - 48) + '" font-size="13" fill="#FBF8F1" font-family="serif">' +
      String((spot.name || '京').slice(1, 2) || '京') + '</text></g>';
    svg += '</svg>';

    cache[key] = svg;
    return svg;
  }

  window.BJT = window.BJT || {};
  window.BJT.art = art;
  window.BJT.kindFor = kindFor;
})(window);
