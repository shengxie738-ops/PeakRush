[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
foreach ($name in @('kafka','redis','mysql')) {
    $process = Get-VerifiedProcess $name
    if ($null -eq $process) { Write-Host "$name already stopped."; continue }
    $record = Get-ServiceRecord $name
    Assert-PortAvailable $name $record.port
    Write-Host "Stopping owned $name process $($process.Id)..."
    if ($name -eq 'redis') {
        & (Join-Path $script:RedisBin 'redis-cli.exe') '-h' '127.0.0.1' '-p' '16379' 'SHUTDOWN' 'NOSAVE'
    } elseif ($name -eq 'mysql') {
        Push-Location (Join-Path $script:RuntimeRoot 'mysql')
        try { & (Join-Path $script:MysqlBin 'mysqladmin.exe') '--defaults-file=root-client.ini' 'shutdown' } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'MySQL graceful shutdown was unavailable; leaving process running.'
            throw 'MySQL shutdown failed. No unrelated process was stopped.'
        }
    } else {
        # Windows has no portable SIGTERM API for a hidden JVM. Only the verified
        # project JVM is terminated; Kafka recovers its persisted KRaft log on restart.
        Stop-Process -Id $process.Id -Force
    }
    try { Wait-Process -Id $process.Id -Timeout 30 -ErrorAction Stop } catch {
        if ($null -ne (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { throw "$name did not stop within 30 seconds." }
    }
}
Write-Host 'Native dependencies stopped. Data and process ownership records were preserved.'
