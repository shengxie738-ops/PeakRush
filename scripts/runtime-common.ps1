Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ProjectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$script:RuntimeRoot = Join-Path $script:ProjectRoot '.runtime'
$script:StatePath = Join-Path $script:RuntimeRoot 'native-processes.json'
$taskRootHash = [Security.Cryptography.SHA256]::Create()
try { $script:RuntimeId = ([BitConverter]::ToString($taskRootHash.ComputeHash([Text.Encoding]::UTF8.GetBytes($script:ProjectRoot.ToLowerInvariant())))).Replace('-','').Substring(0,12).ToLowerInvariant() } finally { $taskRootHash.Dispose() }
$script:JavaHome = if ($env:PEAKRUSH_JAVA_HOME) { $env:PEAKRUSH_JAVA_HOME } else { $env:JAVA_HOME }
$script:MysqlBin = $env:PEAKRUSH_MYSQL_BIN
$script:RedisBin = $env:PEAKRUSH_REDIS_BIN
$script:KafkaHome = $env:PEAKRUSH_KAFKA_HOME

function Assert-RuntimePath([string]$Path) {
    $resolved = [IO.Path]::GetFullPath($Path)
    if (-not $resolved.StartsWith($script:RuntimeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing path outside this project's runtime directory: $resolved"
    }
    return $resolved
}
function Write-RuntimeText([string]$Path, [string]$Content) {
    $resolved = Assert-RuntimePath $Path
    [IO.Directory]::CreateDirectory((Split-Path -Parent $resolved)) | Out-Null
    [IO.File]::WriteAllText($resolved, $Content, (New-Object Text.UTF8Encoding($false)))
}
function Get-RuntimeState {
    if (Test-Path -LiteralPath $script:StatePath) {
        $data = Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json
        if ($data.projectRoot -ne $script:ProjectRoot) { throw 'Runtime ownership does not match this project.' }
        return $data
    }
    return [pscustomobject]@{ projectRoot = $script:ProjectRoot; services = [pscustomobject]@{} }
}
function Save-RuntimeService([string]$Name, $Process, [string]$Executable, [string]$Marker, [int]$Port) {
    $state = Get-RuntimeState
    $record = [pscustomobject]@{
        pid = $Process.Id
        executable = [IO.Path]::GetFullPath($Executable)
        marker = $Marker
        port = $Port
        startedUtc = $Process.StartTime.ToUniversalTime().ToString('o')
    }
    $state.services | Add-Member -NotePropertyName $Name -NotePropertyValue $record -Force
    Write-RuntimeText $script:StatePath ($state | ConvertTo-Json -Depth 6)
}
function Get-ServiceRecord([string]$Name) {
    $state = Get-RuntimeState
    $property = $state.services.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}
function Get-VerifiedProcess([string]$Name) {
    $record = Get-ServiceRecord $Name
    if ($null -eq $record) { return $null }
    $process = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    if ($process.StartTime.ToUniversalTime().Ticks -ne ([datetime]$record.startedUtc).ToUniversalTime().Ticks) { throw "PID was reused for $Name; refusing to control it." }
    if ($process.Path -ne $record.executable) { throw "Executable ownership mismatch for $Name." }
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)"
    if (-not $info.CommandLine -or $info.CommandLine.IndexOf($record.marker,[StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Command-line ownership mismatch for $Name."
    }
    return $process
}
function Get-PortOwner([int]$Port) {
    $found = @()
    foreach ($line in (netstat -ano -p tcp)) {
        if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
            $found += [int]$Matches[1]
        }
    }
    return @($found | Sort-Object -Unique)
}
function Assert-PortAvailable([string]$Name, [int]$Port) {
    $owners = @(Get-PortOwner $Port)
    if ($owners.Count -eq 0) { return }
    $process = Get-VerifiedProcess $Name
    if ($null -eq $process -or @($owners | Where-Object { $_ -ne $process.Id }).Count -gt 0) {
        throw "Port $Port belongs to another process ($($owners -join ',')). No existing service was changed."
    }
}
function Wait-NativePort([string]$Name, [int]$Port, [int]$TimeoutSeconds = 90) {
    $until = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $until) {
        $process = Get-VerifiedProcess $Name
        if ($null -eq $process) { throw "$Name exited; inspect .runtime/$Name logs." }
        $client = New-Object Net.Sockets.TcpClient
        try {
            $connecting = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
            if ($connecting.AsyncWaitHandle.WaitOne(250)) {
                $client.EndConnect($connecting)
                Assert-PortAvailable $Name $Port
                return
            }
        } catch { } finally { $client.Dispose() }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not listen on $Port within $TimeoutSeconds seconds."
}
function Quote-Native([string]$Value) { return '"' + $Value.Replace('"','\"') + '"' }
function Start-OwnedProcess([string]$Name,[string]$Executable,[string[]]$Arguments,[string]$Marker,[int]$Port) {
    $directory = Join-Path $script:RuntimeRoot $Name
    $process = Start-Process -FilePath $Executable -ArgumentList (($Arguments | ForEach-Object { Quote-Native $_ }) -join ' ') -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $directory 'stdout.log') -RedirectStandardError (Join-Path $directory 'stderr.log') -PassThru
    Save-RuntimeService $Name $process $Executable $Marker $Port
    return $process
}
function Invoke-KafkaTool([string]$Class, [string[]]$ToolArguments) {
    & (Join-Path $script:JavaHome 'bin\java.exe') '-Dfile.encoding=UTF-8' "-Dlog4j2.configurationFile=$script:RuntimeRoot/kafka/log4j2.xml" '-cp' "$script:KafkaHome/libs/*" $Class @ToolArguments
    if ($LASTEXITCODE -ne 0) { throw "Kafka tool $Class failed with exit code $LASTEXITCODE." }
}
