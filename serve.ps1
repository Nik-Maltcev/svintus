# Tiny static file server for local testing (no Node/Python needed).
# Usage: powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try { $listener.Start() } catch {
  Write-Error "Cannot bind http://127.0.0.1:$Port/ : $_"
  exit 1
}
Write-Host "Serving $Root  ->  http://127.0.0.1:$Port/"

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.woff2'= 'font/woff2'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = $ctx.Request.Url.AbsolutePath
    if ($path -eq '/') { $path = '/index.html' }
    $rel = $path.TrimStart('/') -replace '/', '\'
    $file = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    if (-not $file.StartsWith($rootFull) -or -not (Test-Path $file -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('404 not found')
    } else {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      if ($types.ContainsKey($ext)) { $res.ContentType = $types[$ext] }
      $res.StatusCode = 200
    }
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
