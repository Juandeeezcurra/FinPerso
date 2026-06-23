param(
  [int]$Port = 8080,
  [switch]$Lan,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$url = "http://localhost:$Port/index.html"
$bindHost = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$lanIp = $null
$pythonCommand = $null
$pythonArgs = $null
$nodeCommand = $null

function Test-CommandWorks {
  param(
    [string]$Command,
    [string[]]$Args
  )

  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    return $false
  }

  try {
    & $Command @Args *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

if (Test-CommandWorks "py" @("-3", "--version")) {
  $pythonCommand = "py"
  $pythonArgs = @("-3", "-m", "http.server", "$Port", "--bind", "$bindHost")
} elseif (Test-CommandWorks "python" @("--version")) {
  $pythonCommand = "python"
  $pythonArgs = @("-m", "http.server", "$Port", "--bind", "$bindHost")
} elseif (Test-CommandWorks "node" @("--version")) {
  $nodeCommand = "node"
} else {
  throw "No encontre Python ni Node. Instala uno de los dos o abri index.html con otro servidor local."
}

if ($Lan) {
  try {
    $lanIp = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
  } catch {
    $lanIp = $null
  }
}

Write-Host "FinPerso local: $url"
if ($Lan -and $lanIp) {
  Write-Host "FinPerso en tu telefono: http://$lanIp`:$Port/index.html"
  Write-Host "Tu PC y tu telefono tienen que estar en la misma WiFi. Si Windows pregunta, permiti acceso en red privada."
}
Write-Host "Servidor en $bindHost`:$Port. Para frenar: Ctrl+C."

if (-not $NoBrowser) {
  Start-Job -ScriptBlock {
    param($AppUrl)
    Start-Sleep -Seconds 1
    Start-Process $AppUrl
  } -ArgumentList $url | Out-Null
}

if ($pythonCommand) {
  & $pythonCommand @pythonArgs
} else {
  $nodeScript = @'
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = process.cwd();
  const port = Number(process.argv[1] || 8080);
  const host = process.argv[2] || '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const route = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.resolve(root, `.${decodeURIComponent(route)}`);

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}/`);
});
'@

  & $nodeCommand -e $nodeScript "$Port" "$bindHost"
}
