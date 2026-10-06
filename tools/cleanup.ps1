$root = Split-Path -Parent $PSScriptRoot
$tmp  = Join-Path $root "tools\_tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$files = @(
  "_line.txt", "_check2.py", "_check3.py", "_check_out.txt", "_out3.txt", "_out4.txt", "_out5.txt",
  "_check_part6.py", "build.log", "build-report.txt", "diag.log", "diag-report.txt",
  "fix.log", "fix-report.txt", "ids.txt", "img-list.txt", "pillow-check.txt",
  "rename-report.txt", "convert-report.txt", "budget-log.txt", "edge-path.txt", "edge-stderr.txt",
  "dom-dump.html", "browser-dom.html", "browser-test.ps1", "headless.log",
  "headless-selftest.html", "headless-home.html", "probe-edge.log", "probe-edge.ps1",
  "run-headless.ps1", "run-stderr.txt", "quick-check.log", "cfg.log",
  "npm.log", "npm2.log", "npm3.log", "npm4.log", "npmview.log", "serve.log", "smoke-run.log"
)

$log = New-Object System.Collections.ArrayList
foreach ($f in $files) {
  $src = Join-Path $root "tools\$f"
  if (Test-Path $src) {
    try { Move-Item -LiteralPath $src -Destination $tmp -Force; [void]$log.Add("moved  $f") }
    catch { [void]$log.Add("FAIL   $f : " + $_.Exception.Message) }
  } else { [void]$log.Add("skip   $f (absent)") }
}

# 误建在工作区根目录的临时文件
$stray = Join-Path (Split-Path -Parent $root) "beiking-tmp.log"
if (Test-Path $stray) {
  try { Move-Item -LiteralPath $stray -Destination $tmp -Force; [void]$log.Add("moved  beiking-tmp.log") }
  catch { [void]$log.Add("FAIL   beiking-tmp.log") }
}

[System.IO.File]::WriteAllLines((Join-Path $root "tools\_tmp\cleanup.log"), $log, [System.Text.UTF8Encoding]::new($false))
