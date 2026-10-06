/* ============================================================
   燕京拾遗 · 图片归位
   把 ImageGen 按中文名输出的 png 重命名为 assets/img/spots/<spotId>-0.png
   用法: node tools/rename-imgs.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'assets', 'img', 'spots');

const RULES = [
  [/^中国国家博物馆/, 'guobo'],        // 必须先于天安门匹配，文件名里含「天安门广场」
  [/故宫|太和殿/, 'gugong'],
  [/天安门城楼/, 'tiananmen'],
  [/景山/, 'jingshan'],
  [/天坛/, 'tianantan'],
  [/钟鼓楼/, 'zhonggulou'],
  [/八达岭/, 'badaling'],
  [/慕田峪|箭扣/, 'mutianyu'],
  [/司马台|古北口/, 'gubeikou'],
  [/卢沟桥/, 'lugouqiao'],
  [/银山/, 'yinshan'],
  [/颐和园/, 'yiheyuan'],
  [/圆明园/, 'yuanmingyuan'],
  [/十三陵/, 'shisanling'],
  [/什刹海|前海/, 'shichahai'],
  [/南锣鼓巷/, 'nanluoguxiang'],
  [/首都博物馆/, 'shoudubowuguan'],
  [/中国美术馆/, 'meishuguan'],
  [/古观象台|观象台/, 'guanxiangtai'],
  [/798/, 'yiqi'],
  [/雍和宫/, 'yonghegong'],
  [/白云观/, 'baiyunguan'],
  [/孔庙|国子监/, 'guozijian'],
  [/智化寺/, 'zhihuasi'],
  [/法海寺/, 'fahaisi'],
  [/动物园/, 'dongwuyuan'],
  [/植物园/, 'zhiwuyuan'],
  [/奥林匹克|鸟巢|水立方/, 'olympicpark'],
  [/首钢/, 'shougang'],
  [/大栅栏|前门/, 'dazhalan']
];
RULES.forEach(r => { if (r[1] === 'tianantan') r[1] = 'tiantan'; });

if (!fs.existsSync(DIR)) { console.log('图片目录不存在：' + DIR); process.exit(1); }

const files = fs.readdirSync(DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
const used = new Set();
const report = [];

files.sort().forEach(f => {
  const hit = RULES.find(r => r[0].test(f));
  if (!hit) { report.push('未识别：' + f); return; }
  const id = hit[1];
  if (used.has(id)) { report.push('重复，跳过：' + f + ' → ' + id); return; }
  used.add(id);
  const to = path.join(DIR, id + '-0' + path.extname(f).toLowerCase());
  try {
    fs.renameSync(path.join(DIR, f), to);
    report.push('✓ ' + f.slice(0, 28) + '… → ' + path.basename(to));
  } catch (e) {
    report.push('✗ 重命名失败 ' + f + ' — ' + e.message);
  }
});

const missing = RULES.map(r => r[1]).filter(id => !used.has(id));
fs.writeFileSync(
  path.join(__dirname, 'rename-report.txt'),
  report.join('\n') + (missing.length ? '\n\n未匹配到图片的景点：' + missing.join(', ') : '\n\n全部 ' + used.size + ' 张已归位'),
  'utf8'
);
console.log(report.join('\n'));
if (missing.length) console.log('未匹配：' + missing.join(', '));
