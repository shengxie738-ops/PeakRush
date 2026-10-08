param([switch]$SkipBuild,[switch]$SkipInfra,[switch]$Lab)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$runRoot=Join-Path $projectRoot '.runtime'
[IO.Directory]::CreateDirectory($runRoot)|Out-Null
$jdkCandidates=@($env:PEAKRUSH_JAVA_HOME,$env:JAVA_HOME)
$jdk=$jdkCandidates|Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) }|Select-Object -First 1
if(!$jdk){throw 'Set PEAKRUSH_JAVA_HOME to a Java17 JDK.'}
$env:JAVA_HOME=$jdk
$env:PATH="$jdk\bin;$env:PATH"
$maven=Get-Command mvn.cmd -ErrorAction SilentlyContinue|Select-Object -ExpandProperty Source -First 1
if(!$maven -and $env:PEAKRUSH_MAVEN_CMD -and (Test-Path $env:PEAKRUSH_MAVEN_CMD)){$maven=$env:PEAKRUSH_MAVEN_CMD}
$node=(Get-Command node.exe -ErrorAction Stop).Source
if(!$SkipInfra){& (Join-Path $PSScriptRoot 'runtime-start.ps1')}
if(-not $env:DB_PASSWORD -and $env:PEAKRUSH_DB_PASSWORD){$env:DB_PASSWORD=$env:PEAKRUSH_DB_PASSWORD}
if(-not $env:DB_PASSWORD){throw 'Set DB_PASSWORD (or PEAKRUSH_DB_PASSWORD) for the application database.'}
if(!$SkipBuild) {
 if(!$maven){throw 'Maven3.9+ is required.'}
 foreach($module in @('backend','gateway')){
  & $maven -q -f (Join-Path $projectRoot "$module\pom.xml") package
  if($LASTEXITCODE -ne 0){throw "$module build failed"}
 }
 Push-Location (Join-Path $projectRoot 'frontend')
 try {
  if(Test-Path 'package-lock.json'){& npm.cmd ci --no-audit --no-fund}else{& npm.cmd install --no-audit --no-fund}
  if($LASTEXITCODE -ne 0){throw 'Frontend install failed'}
  & npm.cmd run build
  if($LASTEXITCODE -ne 0){throw 'Frontend build failed'}
 } finally {Pop-Location}
}
$manifest=Join-Path $runRoot 'app-processes.json'
$owned=@()
# Do not wrap ConvertFrom-Json in @(): in Windows PowerShell 5.1 the JSON array arrives as a
# single Object[], so $owned becomes a nested one-element array and the "already running"
# branch below can never match a name. Re-running this script with services up then fails with
# "Port 8081 is occupied by a process not verified as this project's backend".
if(Test-Path $manifest){foreach($o in (Get-Content $manifest -Raw|ConvertFrom-Json)){$owned+=$o}}
function Start-App($Name,$File,$Arguments,$Directory,$Port,$Marker) {
 $listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
 if($listener) {
  $match=$owned|Where-Object {$_.name -eq $Name -and $_.id -in $listener.OwningProcess}
  $existing=if($match){Get-CimInstance Win32_Process -Filter "ProcessId=$($match[0].id)"}
  if($existing -and $existing.CommandLine.Contains($Marker)){Write-Host "$Name already running on $Port";return $match[0]}
  throw "Port $Port is occupied by a process not verified as this project's $Name"
 }
 $out=Join-Path $runRoot "$Name.out.log";$err=Join-Path $runRoot "$Name.err.log"
 $p=Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
 return [pscustomobject]@{name=$Name;id=$p.Id;marker=$Marker;port=$Port;startedAt=(Get-Date).ToUniversalTime().ToString('o')}
}
$profiles=if($Lab){'local,lab'}else{'local'}
$started=@()
foreach($module in @('backend','gateway')){
 $jar=Get-ChildItem -LiteralPath (Join-Path $projectRoot "$module\target") -Filter '*.jar'|Where-Object {$_.Name -notmatch 'sources|javadoc'}|Select-Object -First 1
 if(!$jar){throw "Missing $module jar; run without -SkipBuild"}
 $port=if($module -eq 'backend'){8081}else{8080}
 $jvm=if($module -eq 'backend'){'-Xms256m -Xmx1024m'}else{'-Xms128m -Xmx512m'}
 $started+=Start-App $module (Join-Path $jdk 'bin\java.exe') "$jvm -Dfile.encoding=UTF-8 -jar `"$($jar.FullName)`" --spring.profiles.active=$profiles" $projectRoot $port $jar.FullName
 $started|ConvertTo-Json|Set-Content -LiteralPath $manifest -Encoding utf8
}
$vite=Join-Path $projectRoot 'frontend\node_modules\vite\bin\vite.js'
if(!(Test-Path $vite)){throw 'Vite not installed; run without -SkipBuild'}
$started+=Start-App 'frontend' $node "`"$vite`" --host 127.0.0.1 --port 5400 --strictPort" (Join-Path $projectRoot 'frontend') 5400 $vite
$started|ConvertTo-Json|Set-Content -LiteralPath $manifest -Encoding utf8
foreach($url in @('http://127.0.0.1:8081/actuator/health','http://127.0.0.1:8080/actuator/health','http://127.0.0.1:5400/app/')){
 $ready=$false
 for($attempt=0;$attempt -lt 60;$attempt++){
  try {
   if($url -eq 'http://127.0.0.1:5400/app/'){$r=Invoke-WebRequest -Uri $url -Headers @{Accept='text/html'} -TimeoutSec 2 -UseBasicParsing}else{$r=Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing}
   if($r.StatusCode -eq 200){$ready=$true;break}
  }catch{}
  Start-Sleep -Seconds 1
 }
 if(!$ready){throw "Not ready: $url. Inspect logs in $runRoot"}
}
Write-Host 'PeakRush ready: http://127.0.0.1:5400'
Write-Host 'Local demo users: demo / demo12345, admin / admin12345'
Write-Host "Lab faults enabled: $Lab"

