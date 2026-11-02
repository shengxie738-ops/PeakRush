[CmdletBinding()]
param(
    [string[]]$JavaHomes = @(),
    [ValidateRange(16,256)][int]$Tasks = 80,
    [ValidateRange(1,250)][int]$DelayMs = 40,
    [ValidateRange(20,180)][int]$TimeoutSeconds = 90
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourceRoot = Join-Path $projectRoot 'courses/src'
$buildRoot = Join-Path $projectRoot 'courses/build'
$artifactRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $buildRoot,$artifactRoot | Out-Null

if ($JavaHomes.Count -eq 0) {
    $candidates = @($env:PEAKRUSH_JAVA_HOME, $env:JAVA_HOME, 'G:\Java WEB\jdk-17.0.2')
    $userJdks = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.jdks'
    if (Test-Path -LiteralPath $userJdks) {
        $candidates += @(Get-ChildItem -LiteralPath $userJdks -Directory | Sort-Object Name | Select-Object -ExpandProperty FullName)
    }
    $command = Get-Command javac.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += Split-Path -Parent (Split-Path -Parent $command.Source) }
    $JavaHomes = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin/javac.exe')) } | Select-Object -Unique)
}
if ($JavaHomes.Count -eq 0) { throw 'No JDK found. Pass -JavaHomes with a directory containing bin/java.exe and bin/javac.exe.' }

function Invoke-LabProcess([string]$Executable,[string[]]$Arguments,[string]$WorkingDirectory,[string]$LogName) {
    $quote = { param([string]$value) '"' + $value.Replace('"','\"') + '"' }
    $argText = ($Arguments | ForEach-Object { & $quote $_ }) -join ' '
    $stdout = Join-Path $buildRoot ($LogName + '.stdout.log')
    $stderr = Join-Path $buildRoot ($LogName + '.stderr.log')
    $process = Start-Process -FilePath $Executable -ArgumentList $argText -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    try {
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            # This variable is the exact Process object started above, never an existing application PID.
            if (-not $process.HasExited) { Stop-Process -InputObject $process -Force }
            throw "Course subprocess exceeded ${TimeoutSeconds}s; the launched course process was terminated."
        }
        $process.WaitForExit()
        $process.Refresh()
        if (Test-Path -LiteralPath $stdout) { Get-Content -LiteralPath $stdout -Encoding UTF8 }
        if ($process.ExitCode -ne 0) {
            if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Encoding UTF8 }
            throw "Course subprocess failed with exit code $($process.ExitCode)."
        }
    } finally { $process.Dispose() }
}

$reports = @()
foreach ($jdk in $JavaHomes) {
    $resolvedJdk = [IO.Path]::GetFullPath($jdk)
    $javac = Join-Path $resolvedJdk 'bin/javac.exe'
    $java = Join-Path $resolvedJdk 'bin/java.exe'
    if (-not (Test-Path -LiteralPath $javac) -or -not (Test-Path -LiteralPath $java)) { throw "JDK incomplete: $resolvedJdk" }
    $jdkLabel = (Split-Path -Leaf $resolvedJdk) -replace '[^a-zA-Z0-9._-]','_'
    $outputDir = Join-Path $buildRoot $jdkLabel
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    $sources = @(Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'peakrush/courses') -Filter '*.java' | Select-Object -ExpandProperty FullName)
    Write-Host "Compiling course suite with $resolvedJdk (release 17)"
    Invoke-LabProcess $javac (@('--release','17','-encoding','UTF-8','-d',$outputDir) + $sources) $projectRoot ($jdkLabel + '-compile')
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
    $report = Join-Path $artifactRoot ("course-labs-$jdkLabel-$stamp.json")
    Invoke-LabProcess $java @('-Xms64m','-Xmx256m','-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-cp',$outputDir,'peakrush.courses.CourseLabs','--output',$report,'--tasks',"$Tasks",'--delay-ms',"$DelayMs") $projectRoot ($jdkLabel + '-run')
    $data = Get-Content -LiteralPath $report -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $data.passed -or @($data.labs).Count -ne 10 -or @($data.labs | Where-Object status -ne 'PASSED').Count -ne 0) { throw "Failed/incomplete course report: $report" }
    $io = @($data.labs | Where-Object id -eq 'blocking-io')[0].details
    Write-Host "Verified Java $($data.environment.javaVersion): 10 experiments; virtual=$($io.virtual.status); platform avg=$($io.platform.avgLatencyMs)ms, P95=$($io.platform.p95LatencyMs)ms"
    $reports += $report
}
Write-Host 'Verified course reports:'
$reports | ForEach-Object { Write-Host $_ }
