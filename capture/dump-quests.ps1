# LoliLand TechnoMagic RPG — захват heap-дампа для извлечения дерева квестов.
# Запускать в PowerShell (Win+X -> Terminal/PowerShell), НАХОДЯСЬ НА СЕРВЕРЕ.
# Перед запуском: зайди на сервер и ОТКРОЙ КВЕСТ-БУК один раз (чтобы данные точно были в памяти).
#
# Если авто-определение не сработает — пришли мне вывод первого блока (jps -lv).

$ErrorActionPreference = 'Continue'

# 1) Путь к бандл-JDK. Поменяй букву диска, если loliland не на H:
$bin = 'H:\Games\loliland\runtimes\java-25\bin'
$out = "$env:USERPROFILE\Desktop\loli_quest.hprof"

if (-not (Test-Path "$bin\jps.exe")) { Write-Host "JDK не найден: $bin — поправь путь." -ForegroundColor Red; return }

Write-Host "=== Запущенные JVM (jps -lv) ===" -ForegroundColor Cyan
$lines = & "$bin\jps.exe" -lv
$lines | ForEach-Object { Write-Host $_ }

# 2) Выбираем JVM игры = с самым большим -Xmx (у лаунчера он маленький)
function XmxMB([string]$s){
  if($s -match '-Xmx(\d+)([kKmMgG])'){
    $n=[int]$Matches[1]
    switch($Matches[2].ToLower()){ 'g'{$n*1024} 'm'{$n} 'k'{[int]($n/1024)} default{$n} }
  } else { 0 }
}
$cand = $lines | Where-Object { $_ -match '^\d+\s' -and $_ -notmatch 'Jps' }
$game = $cand | Sort-Object { XmxMB $_ } -Descending | Select-Object -First 1
if (-not $game) { Write-Host "Не нашёл JVM игры. Пришли вывод выше." -ForegroundColor Yellow; return }

$gpid = ($game -split '\s+')[0]
$attachOff = ($game -match 'DisableAttachMechanism')
Write-Host "`nИгра: PID=$gpid  Xmx=$(XmxMB $game)MB  AttachDisabled=$attachOff" -ForegroundColor Green

# 3) Дамп: jcmd (если attach доступен), иначе jhsdb/SA (обходит запрет)
if (-not $attachOff) {
  Write-Host "Дамп через jcmd (live heap)..." -ForegroundColor Cyan
  & "$bin\jcmd.exe" $gpid GC.heap_dump $out
} else {
  Write-Host "Attach отключён — дамп через jhsdb (SA)..." -ForegroundColor Cyan
  & "$bin\jhsdb.exe" jmap --pid $gpid --binaryheap --dumpfile $out
}

# 4) Сжать и сообщить размер
if (Test-Path $out) {
  $zip = "$out.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path $out -DestinationPath $zip
  $mb = [math]::Round((Get-Item $zip).Length/1MB, 1)
  Write-Host "`nГОТОВО -> $zip  ($mb МБ)" -ForegroundColor Green
  Write-Host "Скопируй этот .zip на Linux в: /home/def/projects/misc/loliland-guidence/capture/" -ForegroundColor Green
} else {
  Write-Host "Файл дампа не создан. Пришли вывод jps -lv выше — подберу команду вручную." -ForegroundColor Yellow
}
