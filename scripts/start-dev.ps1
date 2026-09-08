# Huobao Drama 开发环境一键启动（Windows，支持局域网分享）
$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$BackendDir = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$ConfigPath = Join-Path $Root 'configs\config.yaml'
$ConfigExamplePath = Join-Path $Root 'configs\config.example.yaml'

$FrontendPort = 3013
$BackendPort = 5679
$BackendUrl = "http://127.0.0.1:$BackendPort/api/v1/health"
$FrontendUrl = "http://localhost:$FrontendPort"
$MaxWaitSeconds = 60
$PollIntervalSeconds = 2

function Write-Info([string]$Message) {
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host $Message -ForegroundColor Green
}

function Write-Err([string]$Message) {
  Write-Host $Message -ForegroundColor Red
}

function Write-Warn([string]$Message) {
  Write-Host $Message -ForegroundColor Yellow
}

function Test-CommandAvailable([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-ServiceReady([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-ReadyText([bool]$Ready) {
  if ($Ready) { return '就绪' }
  return '等待中'
}

function Get-LanIpAddresses {
  $addresses = @()

  if (Get-Command Get-NetIPAddress -ErrorAction SilentlyContinue) {
    $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*'
      } |
      Select-Object -ExpandProperty IPAddress -Unique)
  }

  if ($addresses.Count -eq 0) {
    $addresses = @([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object {
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $_.ToString() -notlike '127.*' -and
        $_.ToString() -notlike '169.254.*'
      } |
      ForEach-Object { $_.ToString() })
  }

  return $addresses | Select-Object -Unique
}

function Ensure-NpmInstall([string]$Dir, [string]$Label) {
  $modulesPath = Join-Path $Dir 'node_modules'
  if (Test-Path $modulesPath) {
    return
  }

  Write-Info "[$Label] 未找到 node_modules，正在执行 npm install..."
  Push-Location $Dir
  try {
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    npm install
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevErrorAction

    if ($exitCode -ne 0) {
      Write-Err "[$Label] npm install 失败，退出码: $exitCode"
      exit 1
    }

    Write-Ok "[$Label] 依赖安装完成。"
  } finally {
    Pop-Location
  }
}

function Try-AllowFirewallPort([int]$Port, [string]$DisplayName) {
  if (-not (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue)) {
    return
  }

  try {
    $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
    if ($existing) {
      return
    }

    New-NetFirewallRule `
      -DisplayName $DisplayName `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $Port `
      -Profile Private `
      -ErrorAction Stop | Out-Null

    Write-Ok "已添加防火墙入站规则: $DisplayName (TCP $Port / 专用网络)"
  } catch {
    Write-Warn "未能自动放行端口 $Port（通常需要「以管理员身份运行」）。同事连不上时请手动放行 Node.js 或 TCP $Port。"
  }
}

function Set-ClipboardText([string]$Text) {
  try {
    Set-Clipboard -Value $Text -ErrorAction Stop
    return $true
  } catch {
    try {
      $Text | clip.exe
      return $true
    } catch {
      return $false
    }
  }
}

Write-Info '=== Huobao Drama 开发环境启动（局域网可分享）==='
Write-Info "项目目录: $Root"
Write-Host ''

if (-not (Test-CommandAvailable 'node')) {
  Write-Err '未找到 Node.js，请先安装 Node.js 20+ 并加入 PATH。'
  exit 1
}

if (-not (Test-CommandAvailable 'npm')) {
  Write-Err '未找到 npm，请确认 Node.js 安装完整。'
  exit 1
}

Write-Ok "Node.js: $(node -v)"
Write-Ok "npm: $(npm -v)"
Write-Host ''

Ensure-NpmInstall -Dir $BackendDir -Label 'backend'
Ensure-NpmInstall -Dir $FrontendDir -Label 'frontend'

if (-not (Test-Path $ConfigPath)) {
  if (-not (Test-Path $ConfigExamplePath)) {
    Write-Err "缺少配置文件模板: $ConfigExamplePath"
    exit 1
  }
  Copy-Item $ConfigExamplePath $ConfigPath
  Write-Ok '已从 config.example.yaml 创建 configs/config.yaml'
}

$lanIps = @(Get-LanIpAddresses)

Write-Info "尝试放行防火墙端口 $FrontendPort / $BackendPort（专用网络）..."
Try-AllowFirewallPort -Port $FrontendPort -DisplayName 'Huobao Drama Frontend (dev)'
Try-AllowFirewallPort -Port $BackendPort -DisplayName 'Huobao Drama Backend (dev)'
Write-Host ''

Write-Info "正在启动后端 (0.0.0.0:$BackendPort，允许局域网访问)..."
$backendCmd = @"
Set-Location -LiteralPath '$BackendDir'
`$env:HOST = '0.0.0.0'
`$env:PORT = '$BackendPort'
Write-Host '=== Huobao Drama Backend (LAN) ===' -ForegroundColor Cyan
Write-Host '监听 0.0.0.0:$BackendPort；CORS 允许 localhost 与内网私有 Origin' -ForegroundColor DarkGray
npm run dev
"@
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $backendCmd)

Start-Sleep -Seconds 2

Write-Info "正在启动前端 (0.0.0.0:$FrontendPort，--host 局域网访问)..."
$frontendCmd = @"
Set-Location -LiteralPath '$FrontendDir'
Write-Host '=== Huobao Drama Frontend (LAN) ===' -ForegroundColor Cyan
Write-Host '同事请用下方「内网 IP:$FrontendPort」，不要用 localhost' -ForegroundColor DarkGray
npm run dev
"@
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $frontendCmd)

Write-Info "等待服务就绪（最多 ${MaxWaitSeconds} 秒）..."
$elapsed = 0
$backendReady = $false
$frontendReady = $false

while ($elapsed -lt $MaxWaitSeconds) {
  if (-not $backendReady) {
    $backendReady = Test-ServiceReady $BackendUrl
  }
  if (-not $frontendReady) {
    $frontendReady = Test-ServiceReady $FrontendUrl
  }

  if ($backendReady -and $frontendReady) {
    break
  }

  Start-Sleep -Seconds $PollIntervalSeconds
  $elapsed += $PollIntervalSeconds

  $backendText = Get-ReadyText $backendReady
  $frontendText = Get-ReadyText $frontendReady
  Write-Host "  后端: $backendText | 前端: $frontendText"
}

Write-Host ''
if ($backendReady -and $frontendReady) {
  Write-Ok '前后端均已就绪。'
} else {
  Write-Warn '部分服务尚未就绪，仍将打开浏览器，请稍候刷新页面。'
  if (-not $backendReady) {
    Write-Host "  - 后端未响应: $BackendUrl" -ForegroundColor Yellow
  }
  if (-not $frontendReady) {
    Write-Host "  - 前端未响应: $FrontendUrl" -ForegroundColor Yellow
  }
}

Start-Process $FrontendUrl

Write-Host ''
Write-Ok "本机访问: $FrontendUrl"
Write-Info "后端 API (本机): http://localhost:$BackendPort/api/v1"

if ($lanIps.Count -gt 0) {
  Write-Host ''
  Write-Ok '内网访问地址（复制给同事，必须带端口）:'
  $firstLanUrl = $null
  foreach ($ip in $lanIps) {
    $lanUrl = "http://${ip}:$FrontendPort"
    if (-not $firstLanUrl) { $firstLanUrl = $lanUrl }
    Write-Host "  $lanUrl" -ForegroundColor Green
  }

  if ($firstLanUrl -and (Set-ClipboardText $firstLanUrl)) {
    Write-Ok "已复制到剪贴板: $firstLanUrl"
  }

  Write-Host ''
  Write-Warn '重要：不要把 http://localhost:3013 或 127.0.0.1 发给同事——那是他们自己的电脑。'
  Write-Info '同事通过上述内网地址访问；/api 与 /static 由你机器上的前端开发服务器代理到本机后端。'
  Write-Info '后端 CORS 已允许 10/172.16-31/192.168 等私有网段 Origin；额外域名可设环境变量 CORS_ORIGINS。'
} else {
  Write-Host ''
  Write-Warn '未检测到可用内网 IP，请在本机执行 ipconfig 查看 IPv4 地址。'
  Write-Info "同事访问格式: http://<你的内网IP>:$FrontendPort"
}

Write-Host ''
Write-Info '若同事无法打开页面：以管理员运行本脚本以自动放行防火墙，或手动放行 Node.js / TCP 3013、5679。'
Write-Info '日志请查看弹出的两个 PowerShell 窗口。'
Write-Info '停止服务: 关闭 Backend / Frontend 两个窗口即可。'
