<#
  ProofSync demo keep-alive.

  The demo runs on a free Atlas M0 (project "Proofsyncs", host proofsync-demo),
  and Atlas pauses an M0 after 30 days with no connections. Nothing on a schedule
  currently touches that cluster: vercel.json registers only poll-completions,
  and the /api/cron/demo-tick backstop is not in the cron list.

  So this hits /api/demo/state — a read-only route that reads all three demo
  databases and writes nothing — every 10 days. One connection resets Atlas's
  30-day clock, and 10 days leaves two missed runs of headroom if the machine is
  off, since the task only runs when Paul is logged in.

  Registered as Windows Scheduled Task "ProofSync demo keep-alive".
  Log: %LOCALAPPDATA%\proofsync-keepalive.log
#>
$ErrorActionPreference = 'Stop'
$url = 'https://www.proofsync.co.uk/api/demo/state'
$log = Join-Path $env:LOCALAPPDATA 'proofsync-keepalive.log'
$ts  = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 90
    # A 200 with ok:false means the route answered but the database did not.
    $ok = ($res.Content | ConvertFrom-Json).ok
    "$ts  http=$($res.StatusCode)  ok=$ok" | Add-Content -Path $log -Encoding utf8
    if (-not $ok) { exit 1 }
} catch {
    "$ts  FAILED  $($_.Exception.Message)" | Add-Content -Path $log -Encoding utf8
    exit 1
}
