/* ============================================================
   燕京拾遗 · 交通衔接层
   ------------------------------------------------------------
   负责回答「上一站到下一站怎么走」：
     · 距离近  → 步行方案（距离 + 预估步行时长）
     · 距离远  → 公共交通方案（地铁优先，其次是郊县旅游专线）
   公共交通方案会写清楚：坐几号线、从哪个站上车、到哪个站下车、
   往哪个方向开、中途在哪换乘、出站后怎么走。

   设计约束（和整个项目一致）：
     · 纯前端、运行时零依赖、可断网、可 file:// 双击打开
     · 线路站序为静态数据，站名即「节点」，同一站名出现在两条线
       里就自动识别为换乘站，不需要额外维护换乘表

   数据来源：bjsubway.com、北京地铁官网 mtr.bj.cn、维基百科等公开
   资料的站序，经多来源交叉核对。运营时间、票价、末班车会变，
   出行前请以官方信息为准。
   ============================================================ */
(function (window) {
  'use strict';

  var BJT = window.BJT = window.BJT || {};

  /* ---------- 1. 地铁线路站序 ---------- */
  /*  stops 从一端站到另一端站，完整站序；首尾站名与 term 一致。
      2 号线是环线，首尾同为「西直门」。                        */
  var LINES = [
    {
      id: 'l1', name: '1号线', color: '#A62134',
      term: ['苹果园', '环球度假区'],
      stops: ['苹果园', '古城', '八角游乐园', '八宝山', '玉泉路', '五棵松', '万寿路', '公主坟',
        '军事博物馆', '木樨地', '南礼士路', '复兴门', '西单', '天安门西', '天安门东', '王府井',
        '东单', '建国门', '永安里', '国贸', '大望路', '四惠', '四惠东', '高碑店', '传媒大学',
        '双桥', '管庄', '八里桥', '通州北苑', '果园', '九棵树', '梨园', '临河里', '土桥', '花庄',
        '环球度假区']
    },
    {
      id: 'l2', name: '2号线', color: '#00557F', loop: true,
      term: ['西直门', '西直门'],
      stops: ['西直门', '积水潭', '鼓楼大街', '安定门', '雍和宫', '东直门', '东四十条', '朝阳门',
        '建国门', '北京站', '崇文门', '前门', '和平门', '宣武门', '长椿街', '复兴门', '阜成门',
        '车公庄', '西直门']
    },
    {
      id: 'l4', name: '4号线', color: '#0273C5',
      term: ['安河桥北', '天宫院'],
      stops: ['安河桥北', '北宫门', '西苑', '圆明园', '北京大学东门', '中关村', '海淀黄庄',
        '人民大学', '魏公村', '国家图书馆', '动物园', '西直门', '新街口', '平安里', '西四',
        '灵境胡同', '西单', '宣武门', '菜市口', '陶然亭', '北京南站', '马家堡', '角门西',
        '公益西桥', '新宫', '西红门', '高米店北', '高米店南', '枣园', '清源路', '黄村西大街',
        '黄村火车站', '义和庄', '生物医药基地', '天宫院']
    },
    {
      id: 'l5', name: '5号线', color: '#A6217F',
      term: ['天通苑北', '宋家庄'],
      stops: ['天通苑北', '天通苑', '天通苑南', '立水桥', '立水桥南', '北苑路北', '大屯路东',
        '惠新西街北口', '惠新西街南口', '和平西桥', '和平里北街', '雍和宫', '北新桥', '张自忠路',
        '东四', '灯市口', '东单', '崇文门', '磁器口', '天坛东门', '蒲黄榆', '刘家窑', '宋家庄']
    },
    {
      id: 'l6', name: '6号线', color: '#C48C6A',
      term: ['金安桥', '潞阳'],
      stops: ['金安桥', '苹果园', '杨庄', '西黄村', '廖公庄', '田村', '海淀五路居', '慈寿寺',
        '花园桥', '白石桥南', '二里沟', '车公庄西', '车公庄', '平安里', '北海北', '南锣鼓巷',
        '东四', '朝阳门', '东大桥', '呼家楼', '金台路', '十里堡', '青年路', '褡裢坡', '黄渠',
        '常营', '草房', '物资学院路', '通州北关', '通运门', '北运河西', '北运河东', '郝家府',
        '东夏园', '潞城', '潞阳']
    },
    {
      id: 'l8', name: '8号线', color: '#009BB5',
      term: ['朱辛庄', '瀛海'],
      stops: ['朱辛庄', '育知路', '平西府', '回龙观东大街', '霍营', '育新', '西小口', '永泰庄',
        '林萃桥', '森林公园南门', '奥林匹克公园', '奥体中心', '北土城', '安华桥', '安德里北街',
        '鼓楼大街', '什刹海', '南锣鼓巷', '中国美术馆', '金鱼胡同', '王府井', '前门', '珠市口',
        '天桥', '永定门外', '木樨园', '海户屯', '大红门', '大红门南', '和义', '东高地',
        '火箭万源', '五福堂', '德茂', '瀛海']
    },
    {
      id: 'l11', name: '11号线', color: '#9A6FB0',
      term: ['模式口', '新首钢'],
      stops: ['模式口', '金安桥', '北辛安', '新首钢']
    },
    {
      id: 'l14', name: '14号线', color: '#AA7C40',
      term: ['张郭庄', '善各庄'],
      stops: ['张郭庄', '园博园', '大瓦窑', '郭庄子', '大井', '七里庄', '西局', '东管头',
        '丽泽商务区', '菜户营', '西铁营', '景风门', '北京南站', '永定门外', '景泰', '蒲黄榆',
        '方庄', '十里河', '北工大西门', '平乐园', '九龙山', '大望路', '金台路', '朝阳公园',
        '枣营', '东风北桥', '将台', '望京南', '阜通', '望京', '东湖渠', '来广营', '善各庄']
    },
    {
      id: 'l15', name: '15号线', color: '#7C6BA8',
      term: ['清华东路西口', '俸伯'],
      stops: ['清华东路西口', '六道口', '北沙滩', '奥林匹克公园', '安立路', '大屯路东', '关庄',
        '望京西', '望京', '望京东', '崔各庄', '马泉营', '孙河', '国展', '花梨坎', '后沙峪',
        '南法信', '石门', '顺义', '俸伯']
    },
    {
      id: 'l16', name: '16号线', color: '#4E6A88',
      term: ['北安河', '宛平城'],
      stops: ['北安河', '温阳路', '稻香湖路', '屯佃', '永丰', '永丰南', '西北旺', '马连洼',
        '农大南路', '西苑', '万泉河桥', '苏州街', '苏州桥', '万寿寺', '国家图书馆', '二里沟',
        '甘家口', '玉渊潭东门', '木樨地', '达官营', '红莲南路', '丽泽商务区', '东管头南',
        '丰台站', '丰台南路', '富丰桥', '看丹', '榆树庄', '洪泰庄', '宛平城']
    }
  ];

  /* ---------- 2. 景点最近的地铁站 ---------- */
  /*   s  该景点最近的地铁站名（必须在上方 LINES 的站序里出现过）
      l  该站所属线路（一句文案里点明）
      w  从地铁站出站走到景点 scenic 口的大致步行分钟数
      g  出站后的步行导向：往哪个口出、沿哪条街、从哪个门进
      没有 s 的景点 = 不在地铁网内（远郊），走 PUBLIC 方案       */
  var ANCHORS = {
    gugong: { s: '天安门东', l: '1号线', w: 6, g: '出 A 口沿长安街由东向西，到天安门城楼南侧后即到；故宫默认从天安门（午门方向）进。' },
    tiananmen: { s: '天安门东', l: '1号线', w: 3, g: '出 A 口沿长安街由东向西，过汉白玉华表即到广场北侧观礼区。' },
    jingshan: { s: '中国美术馆', l: '8号线', w: 15, g: '出 B 口沿美术馆东街向北到五四大街，左转向西，从景山公园东门进；出南门往北两分钟即到万春亭。' },
    tiantan: { s: '天坛东门', l: '5号线', w: 2, g: '出 A 口即到天坛公园东门，进门沿东内墙西行可达祈年殿。' },
    zhonggulou: { s: '鼓楼大街', l: '2号线', w: 3, g: '出 A 口沿鼓楼下坡西行即到鼓楼；往北沿中轴路走五分钟是钟楼。' },
    lugouqiao: { s: '宛平城', l: '16号线', w: 6, g: '出 C1 口（抗战雕塑园、七七事变弹坑遗址方向）步行 5–10 分钟即到卢沟桥景区东门与宛平城西门。' },
    yiheyuan: { s: '北宫门', l: '4号线', w: 7, g: '出 A 口沿颐和园路南行即到北宫门／东宫门；从东宫门进可直取长廊、排云殿一线。' },
    yuanmingyuan: { s: '圆明园', l: '4号线', w: 5, g: '出 A 口沿清华西路东行，五分钟到圆明园南门一带。' },
    shichahai: { s: '什刹海', l: '8号线', w: 2, g: '出 A 口沿什刹海东岸南行即到荷花市场、南门与银锭桥。' },
    nanluoguxiang: { s: '南锣鼓巷', l: '6号线/8号线', w: 1, g: '出 A 口即到南锣鼓巷北口，沿主街南行一公里逛到南口。' },
    guobo: { s: '天安门东', l: '1号线', w: 4, g: '出 C 口（天安门东侧）向北即到中国国家博物馆南门。' },
    shoudubowuguan: { s: '南礼士路', l: '1号线', w: 6, g: '出 A 口沿复兴门外大街东行，到复兴门桥东北角即到首博西馆；从木樨地站下车过河也能到。' },
    meishuguan: { s: '中国美术馆', l: '8号线', w: 0, g: '出站即到中国美术馆东门（五四大街一侧）。' },
    guanxiangtai: { s: '建国门', l: '1号线/2号线', w: 3, g: '出 C 西南口，沿建国门内大街向北三百米即到北京古观象台。' },
    yiqi: { s: '望京南', l: '14号线', w: 18, g: '出 A 口或 D 口沿酒仙桥路向北步行约 1.5 公里（15–20 分钟）到 798 艺术区南门。' },
    yonghegong: { s: '雍和宫', l: '2号线/5号线', w: 0, g: '出站即到雍和宫南门。' },
    baiyunguan: { s: '木樨地', l: '1号线', w: 7, g: '出 C 口沿护城河西行即到白云观东路；16 号线木樨地站是另一处出口，两站之间需出付费区。' },
    guozijian: { s: '雍和宫', l: '2号线/5号线', w: 6, g: '出 A 口向北穿过雍和宫西侧胡同，沿国子监街西行即到孔庙与国子监。' },
    zhihuasi: { s: '东直门', l: '2号线', w: 6, g: '出 B 口沿东直门南小街向北约 500 米即到智化寺。' },
    fahaisi: { s: '模式口', l: '11号线', w: 12, g: '出站沿模式口大街东行走到底，法海寺在大街北侧模式口村内。' },
    dongwuyuan: { s: '动物园', l: '4号线', w: 0, g: '出站即到北京动物园南门。' },
    /* 北京植物园不在此表：它离最近的 4 号线「北宫门」站实测约 6 公里，
       没有任何地铁站是步行可达的，硬挂上去会算出一趟车都不用坐的假「地铁方案」。
       它走下面的 BUS 表。 */
    olympicpark: { s: '奥林匹克公园', l: '8号线', w: 5, g: '出 A 口沿国家体育场北路东行即到鸟巢，过安立路往南即到水立方。' },
    shougang: { s: '新首钢', l: '11号线', w: 6, g: '出站向东沿石景山路即到首钢园西十筒仓、三高炉一带。' },
    dazhalan: { s: '前门', l: '2号线', w: 4, g: '出 B 口沿前门大街南行即到大栅栏路口；从北口进正街是招牌一段。' }
  };

  /* ---------- 3. 远郊景点：不在地铁网内，用主流公交/旅游专线 ---------- */
  var BUS = {
    badaling: {
      title: '德胜门西 / 北土城 → 八达岭',
      minutes: 90,
      guide: '德胜门西公交场站（地铁 2 号线积水潭站北侧）发 877 路大站快车，走 G6 京藏高速几乎一站直达，在八达岭景区停车楼／北一楼下车，步行几分钟进景区。',
      tips: '877 路约 90 分钟，比 919 路快约 30 分钟，但德胜门西发车仅 6:00–12:30、末班回城约 17:00，旺季要赶早班。',
      altGuide: '也可在地铁 8 号线／10 号线北土城站乘 919 路普通线到「八达岭森林公园站」，下车还要坐景区摆渡车或步行三公里。'
    },
    mutianyu: {
      title: '东直门 → 慕田峪长城',
      minutes: 105,
      guide: '东直门枢纽站旁的「东直门外」站乘慕田峪旅游专线直达车，一站到景区正门，不用换乘；返程在景区门口同线回城。',
      tips: '单程约 30 元、往返 60 元，但每天基本只有一两班（早 8:30 前后发车、16:00 前后返程），必须提前查班次。',
      altGuide: '省钱走法是东直门枢纽站坐 916 路快车（认准「快车」标识）到怀柔北大街，换 H23 路（铁矿峪方向）到慕田峪环岛，全程约 20 元，但 H23 班次稀、末班早。'
    },
    gubeikou: {
      title: '东直门 → 古北口 · 司马台长城',
      minutes: 120,
      guide: '东直门公共交通枢纽站北侧（942 路、855 路场站内）乘古北水镇直通车，全程约 134 公里两小时直达，在古北水镇游客集散中心下车，出站步行 200 米进司马台长城／古北水镇景区。',
      tips: '单程 48 元、往返约 96 元，比公交贵但省去换乘；东直门发车 9:00、12:00、15:30（周末加 11:00、14:00），返程 13:00、17:00、21:00，适合玩到夜景。',
      altGuide: '省钱走法是东直门枢纽站乘 980 路快车到密云西大桥，换密 51 路（司马台方向）到古北水镇站，约 20 余元，但班次不密，建议中午前到密云换乘。'
    },
    yinshan: {
      title: '德胜门西 / 天通苑北 → 银山塔林',
      minutes: 145,
      guide: '德胜门西乘 345 路快车到昌平，「昌平东关」或「昌平北站」下车，换昌平文旅 1 路／文旅 2 路（银山塔林方向）坐到「银山塔林」站，下车即到景区门口。',
      tips: '文旅 1 路发车 7:00、11:00、17:00，文旅 2 路 6:00、11:00、16:00，都是定班少班次，务必按班次安排，错过只能打车进山。',
      altGuide: '从北边来可乘昌平线到天通苑北站，换 537 路到兴寿，再换昌平文旅 1 路或昌 31 路到银山塔林，避开了德胜门方向的进城拥堵。'
    },
    shisanling: {
      title: '德胜门西 → 明十三陵',
      minutes: 100,
      guide: '德胜门西乘 345 路快车到昌平，「西环南路」站下车换 872 路（长陵方向）坐到「长陵」「定陵」；去总神道则在「南新村」「大宫门」下车。',
      tips: '872 路已改为「马甸桥南—长陵」，不再从德胜门发车，所以在昌平换车最省事；各陵相距 1–3 公里，可乘园内 314 路接驳车串联。',
      altGuide: '昌平线「十三陵景区站」是个「站名骗人」的站：离定陵还有约 4 公里，光换乘就要 40 分钟以上，赶时间不如走 345 快 + 872 路。'
    },
    zhiwuyuan: {
      title: '北宫门 / 巴沟 → 北京植物园',
      minutes: 40,
      hub: '4 号线「北宫门」站或 10 号线「巴沟」站',
      guide: '北京植物园不在任何一条地铁线的步行范围内，常走两条路：①地铁 4 号线「北宫门」站出 A 口，' +
        '换乘 331 路或 563 路（北京植物园南门方向），到「北京植物园南门」站下车；' +
        '②地铁 10 号线「巴沟」站换乘西郊线有轨电车，到「植物园」站下车，出站即到东南门。',
      tips: '植物园与颐和园在地图上看着挨着，实际相距约 6 公里，别当成可以步行顺路的一站。' +
        '西郊线沿香山一线、旺季排队较长，331 路班次更密。',
      altGuide: '若把香山排在同一天，西郊线把「植物园」和「香山」串在同一条线上，按「植物园 → 香山」的顺序走即可，不用折回市区。'
    }
  };

  /* ---------- 4. 计算参数 ---------- */
  var R = 6371, rad = Math.PI / 180;
  var ROAD = 1.35;        // 街区绕行系数：直线距离 → 实际步行距离
  var WALK_REAL_MAX = 2.0; // 实际步行距离 ≤ 2 公里就算「走得过去」
  var WALK_KMH = 4.6;      // 正常步速
  var RIDE_PER_HOP = 3;    // 地铁每站运行 + 停站
  var TRANSFER_MIN = 6;    // 站内换乘（出站换向、安检）
  var LINE_CHANGE_PENALTY = 5; // 路网寻路时的换线惩罚：站数相同则优先换乘少的走法
  var BOARD_WAIT = 4;      // 候车进站
  var DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

  /** 两点球面距离（公里）。coords 为 [纬度, 经度] */
  function distKm(a, b) {
    var la1 = a[0] * rad, la2 = b[0] * rad;
    var dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** 从 a 看向 b 的方位角，换算成中文八向 */
  function bearing(a, b) {
    var la1 = a[0] * rad, la2 = b[0] * rad, dLng = (b[1] - a[1]) * rad;
    var y = Math.sin(dLng) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    var deg = (Math.atan2(y, x) / rad + 360) % 360;
    return DIRS[Math.round(deg / 45) % 8];
  }

  function lineByName(name) {
    for (var i = 0; i < LINES.length; i++) if (LINES[i].name === name) return LINES[i];
    return null;
  }

  /* ---------- 5. 建站点索引与路网 ---------- */
  var IDX = {};      // 站名 -> [{ line, i }]
  var ADJ = {};      // 站名 -> [{ to, line, w }]

  (function build() {
    LINES.forEach(function (ln) {
      var stops = ln.stops, loop = !!ln.loop;
      var list = loop ? stops.slice(0, -1) : stops;   // 环线去掉重复的收尾站
      list.forEach(function (name, i) {
        if (!IDX[name]) IDX[name] = [];
        IDX[name].push({ line: ln.name, i: i });
        if (!ADJ[name]) ADJ[name] = [];
        if (i > 0) ADJ[name].push({ to: list[i - 1], line: ln.name, w: RIDE_PER_HOP });
        if (i < list.length - 1) ADJ[name].push({ to: list[i + 1], line: ln.name, w: RIDE_PER_HOP });
      });
      if (loop && list.length > 2) {
        ADJ[list[list.length - 1]].push({ to: list[0], line: ln.name, w: RIDE_PER_HOP });
      }
    });
  })();

  function isHub(name) { return IDX[name] && IDX[name].length > 1; }

  /** 乘车方向描述：环线说顺/逆时针，其他线说「开往哪一站」 */
  function dirText(ln, fromStation, toStation) {
    if (!ln) return '';
    var i = findIdx(fromStation, ln.name), j = findIdx(toStation, ln.name);
    if (i === null || j === null) return '';
    if (ln.loop) {
      return j > i ? '沿环线顺时针（外环）方向' : '沿环线逆时针（内环）方向';
    }
    return '开往 ' + (j < i ? ln.term[0] : ln.term[1]);
  }

  function findIdx(station, line) {
    var arr = IDX[station];
    if (!arr) return null;
    for (var k = 0; k < arr.length; k++) if (arr[k].line === line) return arr[k].i;
    return null;
  }

  /* ---------- 6. 最短路径（Dijkstra） ----------
     ⚠ 状态必须同时记住「到哪个站」和「到这一站时坐的是哪条线」。
     因为从同一站继续往前，坐的是不是同一条线，决定要不要付换乘代价；
     而「到达某站的代价」也因此取决于来路，不是一个标量能装下的。

     只拿站点当状态（每个站一个 dist / 一个 pLine）时，后到达的线路会覆盖
     前一条线的记录，使本该「同线直达」的后续路段被误判成一次换乘，于是
     选出更差的路线。实测修复前的反例：

       西直门 → 北宫门
         错：4号线→国家图书馆→16号线→西苑→4号线（2 次换乘，代价 34）
         对：4号线 西直门→北宫门 同线直达        （0 次换乘，代价 30）
     而 4 号线本身就从西直门直通北宫门，绕行纯属算法自伤。

     返回值：{ nodes: [站名...], legs: [{from, to, line}...] }
     legs 把每一跳实际乘坐的线路带出来，下游不必再回头去 ADJ 里猜——
     猜在多条线并行的区间上会标错线路号。 */
  function shortest(from, to) {
    if (from === to) return { nodes: [from], legs: [] };

    var SEP = '\u0000';                       /* 站名里不会出现，可安全做分隔符 */
    var KEY = function (s, l) { return s + SEP + l; };

    var dist = {}, prev = {}, pq = [];
    dist[KEY(from, '')] = 0;                  /* 起点尚未上车，线路记为空串 */
    pq.push({ d: 0, node: from, line: '' });

    var endKey = null;
    while (pq.length) {
      /* 取当前累计代价最小的状态（图不大，线性扫描足够） */
      var bi = 0;
      for (var i = 1; i < pq.length; i++) { if (pq[i].d < pq[bi].d) bi = i; }
      var cur = pq.splice(bi, 1)[0];
      var ck = KEY(cur.node, cur.line);
      if (dist[ck] === undefined || cur.d > dist[ck]) continue;   /* 该状态已被更优解取代 */
      if (cur.node === to) { endKey = ck; break; }

      var nb = ADJ[cur.node] || [];
      for (var m = 0; m < nb.length; m++) {
        var e = nb[m];
        /* 换了一条线就要多算一次换乘代价，这样「站数相同但换乘更少」的路线会胜出 */
        var extra = (cur.line && cur.line !== e.line) ? LINE_CHANGE_PENALTY : 0;
        var nd = cur.d + e.w + extra;
        var nk = KEY(e.to, e.line);
        if (dist[nk] === undefined || nd < dist[nk]) {
          dist[nk] = nd;
          prev[nk] = { node: cur.node, line: cur.line };
          pq.push({ d: nd, node: e.to, line: e.line });
        }
      }
    }
    if (!endKey) return null;

    /* 回溯：同时取出站点序列与每一跳实际乘坐的线路 */
    var nodes = [to], legs = [], k = endKey;
    while (prev[k]) {
      var p = prev[k];
      var sep = k.lastIndexOf(SEP);
      legs.unshift({ from: p.node, to: k.slice(0, sep), line: k.slice(sep + 1) });
      nodes.unshift(p.node);
      k = KEY(p.node, p.line);
    }
    if (nodes[0] !== from) return null;
    return { nodes: nodes, legs: legs };
  }

  /* ---------- 7. 方案生成 ---------- */
  function fmtMin(m) {
    m = Math.round(m);
    if (m < 60) return m + ' 分钟';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + ' 小时 ' + r + ' 分' : h + ' 小时';
  }

  /** 步行方案 */
  function walkPlan(from, to, straight) {
    var road = straight * ROAD;
    var min = road / WALK_KMH * 60 + 2;   // +2 分钟：过路口、找路口
    return {
      mode: 'walk',
      minutes: Math.round(min),
      km: road,
      badge: '步行',
      title: '步行前往 · ' + from.name + ' → ' + to.name,
      items: [
        '两段景点之间直线约 ' + straight.toFixed(1) + ' 公里，按街区绕行算实际要走约 ' +
          road.toFixed(1) + ' 公里，正常步速约 ' + fmtMin(min) + '。',
        '整体朝' + bearing(from.coords, to.coords) + '方向走，沿街跟着主流地图导航不会错；' +
          '这一段靠街巷连接，路口多一点，留两分钟余量。'
      ]
    };
  }

  /** 远郊/无地铁：公交或旅游专线方案 */
  function busPlan(from, to, straight) {
    var toRemote = !!BUS[to.id], b = BUS[toRemote ? to.id : from.id];
    if (!b) {
      return {
        mode: 'taxi',
        minutes: Math.round(straight / 26 * 60),
        km: straight,
        badge: '打车',
        title: from.name + ' → ' + to.name,
        items: ['这段直线距离约 ' + straight.toFixed(1) + ' 公里，附近没有合适的公共交通，建议直接打车或网约车，约 ' +
          fmtMin(straight / 26 * 60) + '。']
      };
    }
    var items = [];
    if (toRemote) {
      items.push('两地直线约 ' + straight.toFixed(1) + ' 公里，而「' + to.name + '」不在地铁网内，' +
        '建议按下面这条主流线路走：' + b.title + '——' + b.guide);
      items.push('全程约 ' + fmtMin(b.minutes) + '。' + b.altGuide);
      items.push('注意：行程里若紧挨着这一站，出发前先回到 ' +
        (b.hub || '市区枢纽（东直门枢纽站 / 德胜门西公交场站）') +
        '，别把它当成顺路的一站。' + b.tips);
    } else {
      /* 反方向走：这一站是行程里的上一站，给的是「怎么回到市区」 */
      items.push('从「' + from.name + '」继续上路：这一段同样按「' + b.title + '」这条线走——' + b.guide);
      items.push('全程约 ' + fmtMin(b.minutes) + '。' + b.tips);
    }
    return {
      mode: 'bus', minutes: b.minutes, km: straight, badge: '公交',
      title: from.name + ' → ' + to.name,
      items: items
    };
  }

  /** 地铁方案 */
  function metroPlan(from, to, straight) {
    var A = ANCHORS[from.id], B = ANCHORS[to.id];
    var aWalk = A.w, bWalk = B.w;
    var route = shortest(A.s, B.s);
    var items = [];
    if (!route) {
      return busPlan(from, to, straight);
    }
    var path = route.nodes;

    /* 起点：先走到上车站 */
    if (aWalk) {
      items.push('从「' + from.name + '」步行 ' + aWalk + ' 分钟到 ' + A.s + ' 站（' + A.l + '）');
    } else {
      items.push('从「' + from.name + '」出来就是 ' + A.s + ' 站（' + A.l + '），直接进站');
    }

    /* 车程：把同一条线路的连续区间合成一段。
       线路号直接取寻路结果带出来的 legs，不再回头从 ADJ 里挑第一条匹配的边——
       两站之间若有多条线并行，那样挑会标错线路号。 */
    var rides = [];
    route.legs.forEach(function (leg) {
      var last = rides[rides.length - 1];
      if (last && last.line === leg.line) { last.to = leg.to; last.hops++; }
      else rides.push({ line: leg.line, from: leg.from, to: leg.to, hops: 1 });
    });

    var rideMin = 0, wait = BOARD_WAIT;
    rides.forEach(function (seg, si) {
      rideMin += seg.hops * RIDE_PER_HOP;
      var ln = lineByName(seg.line);
      var dir = dirText(ln, seg.from, seg.to);
      var via = '';
      var i1 = findIdx(seg.from, seg.line), i2 = findIdx(seg.to, seg.line);
      if (seg.hops >= 5 && ln && ln.stops) {
        var st = ln.stops, a = Math.min(i1, i2), b = Math.max(i1, i2) - 1, keep = [];
        var cut = ln.loop ? 1 : 0;
        for (var t = a + 1; t <= b && t < st.length - cut; t++) keep.push(st[t]);
        if (keep.length) via = '，途经 ' + keep.slice(0, 3).join('、') + (keep.length > 3 ? ' 等' : '');
      }
      /* 第 2 段及以后：先说在哪里换、换什么线 */
      if (si > 0) {
        wait += TRANSFER_MIN;
        items.push('在「' + seg.from + '」站换 ' + seg.line + '（站内换乘约 ' + TRANSFER_MIN +
          ' 分钟，跟着站内换乘标识走）。');
      }
      items.push('乘 ' + seg.line + ' ' + dir + '，坐 ' + seg.hops + ' 站在「' + seg.to + '」下车' + via + '。');
    });

    /* 终点：出站后的步行导向 */
    items.push('在「' + B.s + '」站下车后：' + B.g);

    return {
      mode: 'metro',
      minutes: Math.round(aWalk + bWalk + wait + rideMin),
      km: Math.round((aWalk + bWalk) * WALK_KMH / 60 * 10) / 10,
      badge: '地铁',
      title: from.name + ' → ' + to.name,
      lines: rides.map(function (s) { return s.line; }),
      stations: path,
      items: items
    };
  }

  /** 对外主入口：算出 from → to 的交通方案 */
  function plan(fromSpot, toSpot) {
    if (!fromSpot || !toSpot || fromSpot.id === toSpot.id) return null;
    var straight = distKm(fromSpot.coords, toSpot.coords);
    var road = straight * ROAD;
    var A = ANCHORS[fromSpot.id], B = ANCHORS[toSpot.id];

    if (!A || !B) return busPlan(fromSpot, toSpot, straight);
    if (A.s === B.s && road <= 3.5) return walkPlan(fromSpot, toSpot, straight);
    /* 共用同一个上车站、但两地实际离得很远：说明这个站对其中一处只是名义锚点，
       不能拿它当中转，否则会生成一趟车都没坐的「地铁方案」。退回公交/打车兜底。 */
    if (A.s === B.s) return busPlan(fromSpot, toSpot, straight);
    if (road <= WALK_REAL_MAX) return walkPlan(fromSpot, toSpot, straight);
    return metroPlan(fromSpot, toSpot, straight);
  }

  /** 一条路线串起的所有衔接方案 */
  function plans(route) {
    var out = [];
    for (var i = 1; i < route.length; i++) {
      var p = plan(route[i - 1], route[i]);
      if (p) { p.from = route[i - 1]; p.to = route[i]; out.push(p); }
    }
    return out;
  }

  BJT.transit = {
    LINES: LINES,
    ANCHORS: ANCHORS,
    BUS: BUS,
    distKm: distKm,
    bearing: bearing,
    plan: plan,
    plans: plans,
    fmtMin: fmtMin,
    isHub: isHub,
    anchor: function (id) { return ANCHORS[id] || null; },
    lineMeta: lineByName
  };
})(window);
