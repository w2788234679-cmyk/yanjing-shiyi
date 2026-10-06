"""把 assets/img/spots 下的 png 转为压缩 jpg，避免 30 张 PNG 占 80MB+。

用法：
  <venv>/Scripts/python.exe tools/convert.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "img", "spots")
REPORT = os.path.join(ROOT, "tools", "convert-report.txt")

try:
    from PIL import Image
except ImportError:
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write("缺少 Pillow，请先安装：pip install pillow")
    sys.exit(1)

if not os.path.isdir(SRC):
    exit("图片目录不存在：" + SRC)

lines = []
pngs = sorted(fn for fn in os.listdir(SRC) if fn.lower().endswith((".png", ".bmp", ".webp")))
lines.append("找到待转换图片：%d" % len(pngs))

for fn in pngs:
    src = os.path.join(SRC, fn)
    dst = os.path.splitext(src)[0] + ".jpg"
    try:
        with Image.open(src) as im:
            if im.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", im.size, (247, 243, 234))
                im = im.convert("RGBA")
                bg.paste(im, mask=im.split()[-1] if im.mode == "RGBA" else None)
                im = bg
            else:
                im = im.convert("RGB")
            im.save(dst, "JPEG", quality=82, optimize=True, progressive=True)
        kb = round(os.path.getsize(dst) / 1024)
        lines.append("%s -> %d KB" % (fn, kb))
        os.remove(src)
    except Exception as e:  # 单张失败不影响其余
        lines.append("FAIL %s : %s" % (fn, e))

jpgs = sorted(fn for fn in os.listdir(SRC) if fn.lower().endswith(".jpg"))
total = sum(os.path.getsize(os.path.join(SRC, fn)) for fn in jpgs)
lines.append("转换完成：%d 张 jpg，合计 %.0f KB" % (len(jpgs), total / 1024))

with open(REPORT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("\n".join(lines))
