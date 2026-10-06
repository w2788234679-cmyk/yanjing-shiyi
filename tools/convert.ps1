# 把 assets/img/spots 下的 png 转为压缩 jpg
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "assets\img\spots"
$report = Join-Path $root "tools\convert-report.txt"
Add-Type -AssemblyName System.Drawing
$out = New-Object System.Collections.Generic.List[string]
$pngs = @(Get-ChildItem -LiteralPath $src -Filter "*.png" -File)
$out.Add("找到 png：" + $pngs.Count)
foreach ($p in $pngs) {
  $jpg = Join-Path $src ($p.BaseName + ".jpg")
  try {
    $img = [System.Drawing.Image]::FromFile($p.FullName)
    $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 82L)
    $bmp.Save($jpg, $codec, $ep)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    $out.Add(("{0} -> {1} KB" -f $p.Name, [math]::Round((Get-Item $jpg).Length / 1KB)))
    Remove-Item -LiteralPath $p.FullName -Force
  } catch {
    $out.Add("FAIL " + $p.Name + " : " + $_.Exception.Message)
  }
}
$jpgs = @(Get-ChildItem -LiteralPath $src -Filter "*.jpg" -File)
$totalKB = [math]::Round((($jpgs | ForEach-Object { $_.Length } | Measure-Object -Sum).Sum / 1KB))
$out.Add("转换完成：" + $jpgs.Count + " 张 jpg，合计 " + $totalKB + " KB")
[System.IO.File]::WriteAllLines($report, $out, [System.Text.UTF8Encoding]::new($false))
