param([switch]$IncludeInfra)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$manifest=Join-Path $projectRoot '.runtime\app-processes.json'
if(Test-Path $manifest){
 # Do not wrap ConvertFrom-Json in @(): Windows PowerShell 5.1 delivers the JSON
 # array as one Object[] element, so the loop would see a nested array instead of
 # the saved service entries and silently stop nothing.
 foreach($saved in (Get-Content $manifest -Raw|ConvertFrom-Json)){
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.id)" -ErrorAction SilentlyContinue
  if(!$p){continue}
  if(!$p.CommandLine -or !$p.CommandLine.Contains($saved.marker) -or !$p.CommandLine.Contains($projectRoot)){throw "Refusing to stop unverified PID $($saved.id)"}
  Stop-Process -Id $saved.id
  Write-Host "Stopped $($saved.name) ($($saved.id))"
 }
}
if($IncludeInfra){& (Join-Path $PSScriptRoot 'runtime-stop.ps1')}

