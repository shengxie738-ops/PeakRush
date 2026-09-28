param([switch]$IncludeInfra)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$manifest=Join-Path $projectRoot '.runtime\app-processes.json'
if(Test-Path $manifest){
 foreach($saved in @(Get-Content $manifest -Raw|ConvertFrom-Json)){
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.id)" -ErrorAction SilentlyContinue
  if(!$p){continue}
  if(!$p.CommandLine -or !$p.CommandLine.Contains($saved.marker) -or !$p.CommandLine.Contains($projectRoot)){throw "Refusing to stop unverified PID $($saved.id)"}
  Stop-Process -Id $saved.id
  Write-Host "Stopped $($saved.name) ($($saved.id))"
 }
}
if($IncludeInfra){& (Join-Path $PSScriptRoot 'runtime-stop.ps1')}

