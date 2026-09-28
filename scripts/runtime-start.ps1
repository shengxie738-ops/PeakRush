[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
foreach ($name in @('PEAKRUSH_JAVA_HOME','PEAKRUSH_MYSQL_BIN','PEAKRUSH_REDIS_BIN','PEAKRUSH_KAFKA_HOME')) {
    if (-not (Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue)) { throw "Set $name to the local installation path." }
}
foreach ($name in @('PEAKRUSH_DB_PASSWORD','PEAKRUSH_RUNTIME_PASSWORD','PEAKRUSH_ROOT_PASSWORD')) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    if (-not $item -or $item.Value -notmatch '^[A-Za-z0-9_-]{16,}$') { throw "Set $name to at least 16 letters, digits, underscores or hyphens." }
}
$env:DB_PASSWORD = $env:PEAKRUSH_DB_PASSWORD
$env:JAVA_HOME = $script:JavaHome
$java = Join-Path $script:JavaHome 'bin\java.exe'
$mysqld = Join-Path $script:MysqlBin 'mysqld.exe'
$mysql = Join-Path $script:MysqlBin 'mysql.exe'
$redis = Join-Path $script:RedisBin 'redis-server.exe'
$redisCli = Join-Path $script:RedisBin 'redis-cli.exe'
foreach ($file in @($java,$mysqld,$mysql,$redis,$redisCli,"$script:KafkaHome/libs/kafka_2.13-4.3.0.jar")) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Required local binary missing: $file. See deploy/README.md." }
}
[IO.Directory]::CreateDirectory($script:RuntimeRoot) | Out-Null
foreach ($name in @('mysql','redis','kafka')) { [IO.Directory]::CreateDirectory((Join-Path $script:RuntimeRoot $name)) | Out-Null }
Get-RuntimeState | Out-Null
Assert-PortAvailable 'mysql' 13306
Assert-PortAvailable 'redis' 16379
Assert-PortAvailable 'kafka' 19092
Assert-PortAvailable 'kafka' 19093

$mysqlDir = Join-Path $script:RuntimeRoot 'mysql'
$mysqlConfigName = "peakrush-$script:RuntimeId-mysql.ini"
$mysqlConfig = Join-Path $mysqlDir $mysqlConfigName
$mysqlData = Join-Path $mysqlDir 'data'
$mysqlUnix = $mysqlDir.Replace('\','/')
$mysqlBase = (Split-Path -Parent $script:MysqlBin).Replace('\','/')
$clientConfig = Join-Path $mysqlDir 'client.ini'
Write-RuntimeText $clientConfig @"
[client]
host=127.0.0.1
port=13306
protocol=TCP
user=peakrush
password=$env:PEAKRUSH_DB_PASSWORD
default-character-set=utf8mb4
"@
Write-RuntimeText (Join-Path $mysqlDir 'root-client.ini') @"
[client]
host=127.0.0.1
port=13306
protocol=TCP
user=peakrush_runtime
password=$env:PEAKRUSH_RUNTIME_PASSWORD
"@
if ($null -eq (Get-VerifiedProcess 'mysql')) {
    Write-RuntimeText $mysqlConfig @"
[mysqld]
basedir="$mysqlBase"
datadir="./data"
port=13306
bind-address=127.0.0.1
mysqlx=OFF
skip-name-resolve
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
max-connections=160
innodb-buffer-pool-size=134217728
log-error="mysql-error.log"
pid-file="mysqld.pid"
init-file="../bootstrap.sql"
"@
    Write-RuntimeText (Join-Path $mysqlDir 'bootstrap.sql') @"
CREATE DATABASE IF NOT EXISTS peakrush CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'peakrush'@'127.0.0.1' IDENTIFIED BY '$env:PEAKRUSH_DB_PASSWORD';
CREATE USER IF NOT EXISTS 'peakrush'@'localhost' IDENTIFIED BY '$env:PEAKRUSH_DB_PASSWORD';
GRANT ALL PRIVILEGES ON peakrush.* TO 'peakrush'@'127.0.0.1';
GRANT ALL PRIVILEGES ON peakrush.* TO 'peakrush'@'localhost';
CREATE USER IF NOT EXISTS 'peakrush_runtime'@'127.0.0.1' IDENTIFIED BY '$env:PEAKRUSH_RUNTIME_PASSWORD';
GRANT SHUTDOWN ON *.* TO 'peakrush_runtime'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$env:PEAKRUSH_ROOT_PASSWORD';
"@
    if (-not (Test-Path -LiteralPath (Join-Path $mysqlData 'mysql'))) {
        if ((Test-Path -LiteralPath $mysqlData) -and @(Get-ChildItem -LiteralPath $mysqlData -Force).Count -gt 0) { throw 'MySQL data directory is not empty and not initialized. Refusing to overwrite it.' }
        Write-Host 'Initializing isolated MySQL data directory...'
        $initArguments = @('--no-defaults','--initialize-insecure',"--basedir=$mysqlBase","--datadir=$mysqlData",'--console')
        $init = Start-Process -FilePath $mysqld -ArgumentList (($initArguments | ForEach-Object { Quote-Native $_ }) -join ' ') -WorkingDirectory $mysqlDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $mysqlDir 'initialize.stdout.log') -RedirectStandardError (Join-Path $mysqlDir 'initialize.stderr.log') -Wait -PassThru
        if ($init.ExitCode -ne 0) { throw 'MySQL initialization failed; inspect .runtime/mysql/initialize.stderr.log.' }
    }
    Start-OwnedProcess 'mysql' $mysqld @("--defaults-file=$mysqlConfigName",'--no-monitor','--console') $mysqlConfigName 13306 | Out-Null
}
Wait-NativePort 'mysql' 13306
Push-Location $mysqlDir
try { & $mysql '--defaults-file=client.ini' '--execute=SELECT VERSION() AS version, DATABASE() AS db;' 'peakrush' } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'MySQL app-user readiness check failed.' }

$redisDir = Join-Path $script:RuntimeRoot 'redis'
$redisConfigName = "peakrush-$script:RuntimeId-redis.conf"
$redisConfig = Join-Path $redisDir $redisConfigName
if ($null -eq (Get-VerifiedProcess 'redis')) {
    Write-RuntimeText $redisConfig @"
bind 127.0.0.1
protected-mode yes
port 16379
timeout 0
tcp-keepalive 60
databases 16
dir .
dbfilename peakrush.rdb
appendonly yes
appendfilename peakrush.aof
appendfsync always
maxmemory 256mb
maxmemory-policy noeviction
save ""
logfile "redis.log"
"@
    Start-OwnedProcess 'redis' $redis @($redisConfigName) $redisConfigName 16379 | Out-Null
}
Wait-NativePort 'redis' 16379
& $redisCli '-h' '127.0.0.1' '-p' '16379' 'PING'
if ($LASTEXITCODE -ne 0) { throw 'Redis PING failed.' }

$kafkaDir = Join-Path $script:RuntimeRoot 'kafka'
$kafkaConfig = Join-Path $kafkaDir 'server.properties'
$kafkaData = Join-Path $kafkaDir 'data'
Write-RuntimeText (Join-Path $kafkaDir 'log4j2.xml') @'
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN">
  <Appenders>
    <Console name="Console" target="SYSTEM_OUT"><PatternLayout pattern="%d{HH:mm:ss} %-5p %c{1} - %m%n"/></Console>
  </Appenders>
  <Loggers><Root level="WARN"><AppenderRef ref="Console"/></Root></Loggers>
</Configuration>
'@
if ($null -eq (Get-VerifiedProcess 'kafka')) {
    $kafkaDataProperty = $kafkaData.Replace('\','/')
    $kafkaDataProperty = -join ($kafkaDataProperty.ToCharArray() | ForEach-Object { if ([int]$_ -gt 127) { '\u{0:x4}' -f [int]$_ } else { [string]$_ } })
    Write-RuntimeText $kafkaConfig @"
process.roles=broker,controller
node.id=1
controller.quorum.bootstrap.servers=127.0.0.1:19093
listeners=PLAINTEXT://127.0.0.1:19092,CONTROLLER://127.0.0.1:19093
advertised.listeners=PLAINTEXT://127.0.0.1:19092
controller.listener.names=CONTROLLER
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
inter.broker.listener.name=PLAINTEXT
log.dirs=$kafkaDataProperty
num.partitions=3
num.network.threads=2
num.io.threads=4
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
group.initial.rebalance.delay.ms=0
auto.create.topics.enable=false
log.retention.hours=24
log.segment.bytes=134217728
"@
    if (-not (Test-Path -LiteralPath (Join-Path $kafkaData 'meta.properties'))) {
        if ((Test-Path -LiteralPath $kafkaData) -and @(Get-ChildItem -LiteralPath $kafkaData -Force).Count -gt 0) { throw 'Kafka data directory is not empty and has no meta.properties. Refusing to format it.' }
        $clusterFile = Join-Path $kafkaDir 'cluster.id'
        if (-not (Test-Path -LiteralPath $clusterFile)) {
            $clusterId = [Convert]::ToBase64String([Guid]::NewGuid().ToByteArray()).TrimEnd('=').Replace('+','-').Replace('/','_')
            Write-RuntimeText $clusterFile $clusterId
        }
        $clusterId = (Get-Content -LiteralPath $clusterFile -Raw).Trim()
        Write-Host 'Formatting isolated Kafka KRaft storage...'
        Invoke-KafkaTool 'kafka.tools.StorageTool' @('format','--standalone','--cluster-id',$clusterId,'--config',$kafkaConfig)
    }
    $kafkaArguments = @('-Xms512m','-Xmx512m','-Dfile.encoding=UTF-8',"-Dlog4j2.configurationFile=$kafkaDir/log4j2.xml",'-cp',"$script:KafkaHome/libs/*",'kafka.Kafka',$kafkaConfig)
    Start-OwnedProcess 'kafka' $java $kafkaArguments $kafkaConfig 19092 | Out-Null
}
Wait-NativePort 'kafka' 19092
Invoke-KafkaTool 'org.apache.kafka.tools.TopicCommand' @('--bootstrap-server','127.0.0.1:19092','--create','--if-not-exists','--topic','peakrush.runtime.health','--partitions','1','--replication-factor','1')
Invoke-KafkaTool 'org.apache.kafka.tools.TopicCommand' @('--bootstrap-server','127.0.0.1:19092','--describe','--topic','peakrush.runtime.health')
Write-Host 'Dependencies ready: MySQL 127.0.0.1:13306, Redis 127.0.0.1:16379, Kafka 127.0.0.1:19092.'
& (Join-Path $PSScriptRoot 'runtime-status.ps1')
