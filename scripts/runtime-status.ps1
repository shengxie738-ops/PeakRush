[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
foreach ($name in @('mysql','redis','kafka')) {
    $record = Get-ServiceRecord $name
    $process = Get-VerifiedProcess $name
    $port = switch ($name) { 'mysql' {13306} 'redis' {16379} 'kafka' {19092} }
    $owners = @(Get-PortOwner $port)
    [pscustomobject]@{
        Service = $name
        Port = $port
        Running = ($null -ne $process)
        OwnedListener = ($null -ne $process -and $owners -contains $process.Id)
        PID = $(if ($null -ne $process) {$process.Id} else {$null})
        RuntimeDirectory = Join-Path $script:RuntimeRoot $name
    }
}
