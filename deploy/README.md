# PeakRush dependency runtime

The application runs locally against real MySQL, Redis, and Kafka. All native data
and logs live under this project's ignored .runtime directory. Native scripts
never install services or alter other database, Redis, or Kafka installations.

## Start, inspect, stop (Windows)

Run from the project directory in PowerShell:

~~~powershell
.\scripts\runtime-start.ps1
.\scripts\runtime-status.ps1
.\scripts\runtime-stop.ps1
~~~

Startup is idempotent. An occupied port is accepted only when it belongs to the
recorded project process. A process is checked against its PID, start time,
executable path, and project-specific command-line marker before it is managed.
Stopping preserves all data. There is deliberately no automatic reset/delete
command, and nonempty unrecognized data directories are never formatted.

Windows MySQL starts with --no-monitor, so there is one owned process. Relative
configuration paths accommodate MySQL's native Windows handling of Chinese
directory names. A dedicated local account with only SHUTDOWN permission performs
graceful shutdown. Redis closes with SHUTDOWN NOSAVE; every write is already
persisted by AOF appendfsync always. A hidden Windows Kafka JVM has no portable
SIGTERM facility in this script; stopping terminates only the verified owned JVM,
and Kafka replays its persisted KRaft log when restarted.

| Dependency | Host endpoint | Native version |
| --- | --- | --- |
| MySQL | 127.0.0.1:13306 | 8.0.30 |
| Redis | 127.0.0.1:16379 | Windows Redis 5.0.9 |
| Kafka | 127.0.0.1:19092 | Apache Kafka 4.3.0 |
| Kafka controller | 127.0.0.1:19093 | Internal KRaft endpoint |

Database: peakrush. Application user: peakrush. Set unique local passwords in
PEAKRUSH_DB_PASSWORD, PEAKRUSH_RUNTIME_PASSWORD, and PEAKRUSH_ROOT_PASSWORD
before starting native dependencies. Each must use at least 16 letters, digits,
underscores or hyphens. Existing .runtime/ data requires the same passwords
used when that data was initialized. Redis has no password and binds only to
loopback. Kafka uses local plaintext listeners. These are development-only settings.

JDBC example:

~~~text
jdbc:mysql://127.0.0.1:13306/peakrush?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false
~~~

Set PEAKRUSH_JAVA_HOME, PEAKRUSH_MYSQL_BIN, PEAKRUSH_REDIS_BIN and
PEAKRUSH_KAFKA_HOME to the corresponding local installation directories.

Only the process environment's JAVA_HOME is changed. Global PATH and JAVA_HOME
are not modified. The installed Java 25 remains unchanged.

Redis uses appendonly=yes, appendfsync=always, maxmemory=256mb, and
maxmemory-policy=noeviction. Kafka uses one broker/controller, replication factor
1, three default partitions, and a 512 MiB heap. These settings exercise real
Lua, persistence, and broker acknowledgements; they do not demonstrate multi-node
availability. Application tests should create their own topics and use the
application's own transactional/idempotency invariants. The runtime's
peakrush.runtime.health topic only proves broker topic operations.

## Docker Compose alternative

Docker and WSL were not available on the inspected machine. Compose is supplied
for machines that already have Docker; native validation does not certify this
unexecuted alternative.

~~~powershell
.\scripts\runtime-stop.ps1
docker compose -f deploy/compose.yml up -d --wait
docker compose -f deploy/compose.yml ps
docker compose -f deploy/compose.yml down
~~~

Compose exposes the same application ports and uses persistent named volumes.
It uses MySQL 8.0.30, Redis 7.4.2, and Kafka 4.3.0. The application runs on the host;
a future containerized application should use mysql:3306, redis:6379, and
kafka:9092. Redis7 remains the intended portable environment; native Redis5 Lua
verification must be reported separately from Redis7 compatibility.

Do not run native and Compose dependencies on these ports simultaneously.
Do not add --volumes to docker compose down unless permanent data deletion is
intended. Optional PEAKRUSH_DB_PASSWORD and PEAKRUSH_ROOT_PASSWORD environment
variables must be set to unique values before initial volume creation.

Kafka container listener configuration follows the upstream versioned example:
https://github.com/apache/kafka/blob/4.3.0/docker/examples/docker-compose-files/single-node/plaintext/docker-compose.yml
