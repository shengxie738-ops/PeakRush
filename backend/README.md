# PeakRush backend

Java 17 / Spring Boot 3.5.14 / JDBC MySQL / Redis / Kafka. Port 8081; API contract is in ../docs/API_CONTRACT.md. All source in this directory is a new implementation.

## Run locally

Start the isolated MySQL13306, Redis16379 and Kafka19092 services using the root project scripts, then:

```powershell
$env:JAVA_HOME=$env:PEAKRUSH_JAVA_HOME
$env:PATH=$env:JAVA_HOME+'/bin;'+$env:PATH
$env:DB_PASSWORD=$env:PEAKRUSH_DB_PASSWORD
mvn.cmd package
& "$env:JAVA_HOME/bin/java.exe" -jar target/peakrush-backend-1.0.0.jar --spring.profiles.active=local,lab
```

Only local/demo profiles seed admin/admin12345 and demo/demo12345. The three storefront demo activities use V3; V0–V3 comparison activities start as admin-only DRAFT records. Existing data and dates are not reset. Outside those profiles JWT_SECRET must contain at least 32 characters. Set SERVER_ADDRESS=0.0.0.0 only when an intended container deployment requires it; local default is 127.0.0.1.

Environment: DB_URL, DB_USER, DB_PASSWORD, REDIS_HOST, REDIS_PORT, KAFKA_BOOTSTRAP_SERVERS, JWT_SECRET, ORDER_TTL_SECONDS (900 default), PENDING_TIMEOUT_SECONDS (1800 default). JDBC connections execute SET time_zone='+00:00'. Recovery scheduling timestamps are explicitly UTC.

## Delivery scope: V0–V3

- V0: row-locked synchronous database transaction, unique request and user/item keys.
- V1: conditional SQL stock update plus the same business constraints.
- V2: atomic Redis time/stock/eligibility/idempotency reservation, synchronous transactional order.
- V3: reservation then asynchronous Kafka, with pending request recovery.
- V4 (experimental, retained for later work; outside this delivery and acceptance scope): Lua also appends a Redis Stream event; bridge acknowledges Stream only after Kafka acknowledgement. PEL is recovered through XPENDING/XCLAIM, compatible with isolated Redis 5 and Compose Redis 7.

Quantity must be an integer in 1..limitPerUser. One user gets one order per activity/item, including previously closed/cancelled orders. Failed reservations release eligibility; closing a created order restores stock but retains eligibility use. A reused idempotency key with changed quantity returns409.

MySQL conditionally decrements stock even in V2–V4 as the final no-oversell guard. Request, order, allocation log and recovery outbox commit together. FAILED request tombstones block late events. Payment and closure serialize on the order/request. Compensation checks its released flag and increments stock in one Lua operation. Older confirmations cannot overwrite terminal results.

Warmup is idempotent. RUNNING inventory missing metadata or stock is never reconstructed from current database stock, because that would ignore queued reservations. Existing request/user/stream/pending residues also prevent reinitialization. Recovery requires draining or resolving in-flight requests before an operator designs a new inventory generation.

Orders retry finitely then publish to seckill-dlq. The dead-letter persistence listener has its own infinite-retry handler: a database outage does not republish DLT records back into the same topic. ADMIN retry preserves requestId; ADMIN abort writes a FAILED fence before compensation. Outbox tasks survive process exit and are retried independently.

## Local fault controls

Only the lab profile exposes ADMIN GET/POST /api/admin/faults:

```json
{
  "consumerPaused": false,
  "consumerDelayMs": 0,
  "failConsumer": false,
  "pauseBridge": false,
  "pauseOutbox": false,
  "afterDbCommitPauseMs": 0,
  "afterRedisApplyPauseMs": 0
}
```

The two after... pauses are consumed once, range 0–30000ms, and log FAULT_AFTER_DB_COMMIT / FAULT_AFTER_REDIS_APPLY before sleeping. An external test harness can kill/restart the application inside that exact window. No process-kill endpoint is provided.

## Verification

```powershell
# Requires the real isolated MySQL and Redis services; no H2 replacement.
$env:PEAKRUSH_INTEGRATION_TESTS='true'
mvn.cmd test
```

The command above runs the 15 input/MySQL/Redis tests; it does not start the V4 Kafka bridge test. That experimental test requires the separate explicit environment flag `PEAKRUSH_V4_TESTS=true` and a real Kafka broker, MySQL and Redis. Leave the flag unset for the V0–V3 acceptance run. It creates a unique `peakrush-bridge-test-*` topic and intentionally retains it for manual cleanup: deleting a topic on this native Windows Kafka installation can fail during log-directory rename and take the broker offline. The test never deletes Kafka topics automatically.
Tests cover actual MySQL 100-request contention for 10 units, duplicate allocation rollback, failure tombstones, cancellation idempotence and UTC outbox eligibility. The real Stream bridge test sends fresh entries and abandoned PEL entries through the real Kafka broker, then runs the production order consumer handler twice per event against MySQL and verifies one order per request. Actual Redis tests cover 100-request contention, replay/payload conflicts, wrong-type Stream rejection before writes, fail-closed warmup, repeated warmup, idempotent release/old message ordering, and activity windows. Root verification scripts exercise authenticated HTTP and actual Kafka for V0–V3. V4 remains experimental and is not accepted as part of this delivery; its existing bridge test is retained for later work.

## Metrics and limits

/api/admin/metrics/summary includes inventory rows with totalStock, availableStock, redisAvailableStock, occupiedQuantity, pendingReservations and requestStates. V0/V1 redisAvailableStock is null: their authoritative inventory is MySQL. kafkaLag is read from broker offsets (cached five seconds), null when unavailable. latencyP95Ms is measured from application request timers. Experiment results remain null until actual harness results are submitted; no benchmark numbers are fabricated.

In a settled item: totalStock = database availableStock + CREATED/PAID quantities. Redis-managed items converge to the same available stock once pending reservations and compensation finish. Historical closed orders are not counted as occupied stock.

Use Redis AOF always with a persistent volume and noeviction for the durability demonstration. This implementation does not guarantee preservation of accepted requests if the Redis volume is permanently lost before Stream events reach Kafka, or during asynchronous replica failover that loses writes. Missing working state fails closed. A local single-broker Kafka setup demonstrates process recovery, not multi-broker high availability.
