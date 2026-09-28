[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Status','Kill','Start')][string]$Action)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runRoot = Join-Path $projectRoot '.runtime'
$manifest = Join-Path $runRoot 'app-processes.json'
$javaHome = if ($env:PEAKRUSH_JAVA_HOME) { $env:PEAKRUSH_JAVA_HOME } else { $env:JAVA_HOME }
if (-not $javaHome) { throw 'Set PEAKRUSH_JAVA_HOME or JAVA_HOME.' }
$java = Join-Path $javaHome 'bin\java.exe'
if (-not (Test-Path -LiteralPath $manifest)) { throw 'Run app-start.ps1 -Lab first; application ownership manifest is required.' }
$entries = @(Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)
$matchesBackend = @($entries | Where-Object { $_.name -eq 'backend' })
if ($matchesBackend.Count -ne 1) { throw 'Manifest must contain exactly one backend record.' }
$backend = $matchesBackend[0]
$jar = [IO.Path]::GetFullPath([string]$backend.marker)
$backendTarget = [IO.Path]::GetFullPath((Join-Path $projectRoot 'backend\target')) + '\'
if (-not $jar.StartsWith($backendTarget,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($jar) -ne '.jar' -or -not (Test-Path -LiteralPath $jar)) {
    throw 'Backend jar marker is not an existing jar inside this workspace backend/target.'
}
if ([int]$backend.port -ne 8081) { throw 'Only the recorded backend port 8081 may be controlled.' }
function Verified-Backend {
    $process = Get-Process -Id ([int]$backend.id) -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
    if (-not $info.CommandLine -or
        $info.CommandLine.IndexOf($projectRoot,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or
        $info.CommandLine.IndexOf($jar,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or
        $info.CommandLine -notmatch '(?i)--spring.profiles.active=local,lab(?:\s|$)' -or
        $process.Path -ne $java) {
        throw 'Refusing process: workspace, backend jar, local,lab profile, or Java17 executable does not match.'
    }
    $recorded = ([datetime]$backend.startedAt).ToUniversalTime()
    if ([Math]::Abs(($process.StartTime.ToUniversalTime()-$recorded).TotalSeconds) -gt 15) {
        throw 'Backend PID start time does not match its manifest; possible PID reuse.'
    }
    return $process
}
function Port-Owners {
    $owners = @()
    foreach($line in (netstat -ano -p tcp)) {
        if ($line -match '^\s*TCP\s+\S+:8081\s+\S+\s+LISTENING\s+(\d+)\s*$') { $owners += [int]$Matches[1] }
    }
    return @($owners | Sort-Object -Unique)
}
function Write-BackendRecord($record) {
    $latest = @(Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)
    $current = @($latest | Where-Object { $_.name -eq 'backend' })
    if ($current.Count -ne 1 -or $current[0].id -ne $backend.id) {
        throw 'Another controller changed the backend manifest. Refusing overwrite.'
    }
    $merged = @($latest | ForEach-Object { if ($_.name -eq 'backend') { $record } else { $_ } })
    $temporary = Join-Path $runRoot 'app-processes.crash.tmp'
    [IO.File]::WriteAllText($temporary, (ConvertTo-Json -InputObject $merged -Depth 10), (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $manifest -Force
}
function Unchanged-Services {
    return @($entries | Where-Object {$_.name -ne 'backend'} | Select-Object name,id)
}
$process = Verified-Backend
if ($Action -eq 'Status') {
    [pscustomobject]@{action='Status';running=($null -ne $process);pid=$backend.id;jar=$jar;otherProcesses=(Unchanged-Services)} | ConvertTo-Json -Depth 5
    exit 0
}
if ($Action -eq 'Kill') {
    if ($null -eq $process) { throw 'Expected backend is not running; no crash was injected.' }
    $owners = @(Port-Owners)
    if (@($owners | Where-Object { $_ -ne $process.Id }).Count -gt 0) { throw 'Backend port is owned by a different process.' }
    Stop-Process -Id $process.Id -Force
    try { Wait-Process -Id $process.Id -Timeout 15 -ErrorAction Stop } catch {
        if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { throw }
    }
    [pscustomobject]@{action='Kill';pid=$process.Id;forced=$true;jar=$jar;otherProcesses=(Unchanged-Services);at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 5
    exit 0
}
if ($null -eq $process) {
    if (@(Port-Owners).Count -gt 0) { throw 'Port 8081 is occupied; refusing to replace an unverified process.' }
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $java)
    $arguments = '-Xms256m -Xmx1024m -Dfile.encoding=UTF-8 -jar "' + $jar + '" --spring.profiles.active=local,lab'
    $process = Start-Process -FilePath $java -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runRoot 'backend.out.log') -RedirectStandardError (Join-Path $runRoot 'backend.err.log') -PassThru
    $record = $backend | Select-Object *
    $record.id = $process.Id
    $record.startedAt = $process.StartTime.ToUniversalTime().ToString('o')
    Write-BackendRecord $record
    $backend = $record
}
$ready = $false
for ($attempt=0; $attempt -lt 75; $attempt++) {
    if ($null -eq (Verified-Backend)) { throw 'Backend exited after restart; inspect .runtime/backend.err.log.' }
    try {
        $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/actuator/health' -TimeoutSec 2 -UseBasicParsing
        if ($health.StatusCode -eq 200) { $ready=$true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Backend restart did not become healthy in time.' }
$owners = @(Port-Owners)
if ($owners.Count -eq 0 -or @($owners | Where-Object { $_ -ne $process.Id }).Count -gt 0) { throw 'Healthy backend port ownership does not match the restarted process.' }
[pscustomobject]@{action='Start';pid=$process.Id;ready=$true;jar=$jar;profiles='local,lab';otherProcesses=(Unchanged-Services);at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 5
