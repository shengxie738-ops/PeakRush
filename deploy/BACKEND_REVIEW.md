# Backend reliability review

Reviewed 2026-09-28 while implementation was in progress. This is a static source
review, not a claim that the crash tests have already run. No backend source was
changed by this reviewer.

## Confirmed findings

### P1 — warmup can reconstruct live stock from an incomplete Redis state

Status at initial review: open.
Locations: backend/src/main/java/com/peakrush/Reservations.java:27-30,
Admin.java:13-16, DemoData.java:30.

warmup treats an absent meta key as permission to SET stock from the database.
The database does not yet include accepted Redis reservations waiting for Kafka.

Reproduction: create V4 stock=1; pause bridge; accept user A (Redis=0, DB=1);
lose only the meta key; warmup; user B is now also admitted. After resuming,
A consumes the one DB unit, B is rejected by the DB stock guard, and B's Redis
release restores cached stock to 1 although DB available stock is 0.
This breaks cache conservation despite the final database oversell guard.

Required fix: distinguish first initialization from recovery using persistent
state; missing live Redis keys must fail closed. Repeated warmup may be a no-op
only for complete, valid metadata of the same generation. It must never reset
in-flight inventory from DB availability. Demo startup must use the same guard.

### P1 — a DLQ database failure is re-published to the same DLQ

Status at initial review: open.
Locations: backend/src/main/java/com/peakrush/Messaging.java:18-22,39-48;
backend/src/main/resources/application.yml:43-44.

The only DefaultErrorHandler bean uses a recoverer that always publishes to
seckill-dlq. Both listeners use Boot's default container factory. Consequently,
failure to INSERT the DLQ record while MySQL is unavailable exhausts two retries,
publishes to the same partition of seckill-dlq, advances recovery to a new offset,
and repeats. This amplifies messages and exception headers during a DB outage.

Required fix: a separate factory/error handler for the deadletters listener that
retains its record/offset and retries with bounded delay indefinitely, or stops
the container. It must not route failure back into its own topic. Normal order
consumption should retain its finite retry and DLQ publishing behavior.

Primary documentation:
https://docs.spring.io/spring-kafka/reference/3.3-SNAPSHOT/kafka/annotation-error-handling.html
explains that Boot installs an error-handler bean in its auto-configured factory.

### P2 — concurrent retry can overwrite an ABORTED dead-letter state

Status at initial review: open.
Location: backend/src/main/java/com/peakrush/Admin.java:34-46.

Retry reads OPEN, publishes, and then updates where status<>'RESOLVED'.
An abort that commits between the read and update leaves a FAILED request
tombstone but has its ABORTED DLQ state overwritten by REPLAYED. The request
fence prevents an extra order, but the admin queue reopens a terminal record.

Required fix: the retry status transition must only match OPEN/REPLAYED; preserve
ABORTED and RESOLVED. Repeated admin actions should remain idempotent.

## Boundaries with consistent safeguards in the reviewed source

- Lua reservation -> application crash: V2/V3 pending ZSET and V4 same-script
  Stream admission journal retain work (reserve.lua:27-31, Workers.java:61-76).
- Kafka acknowledgement -> XACK crash: bridge acknowledges the Stream only after
  Kafka send completion (Workers.java:39-40). Re-delivery is expected and DB
  request primary key, row lock and terminal-state check deduplicate it.
- DB commit -> consumer offset crash: Orders.process commits request/order/stock/
  stock log/outbox in one TransactionTemplate; record acknowledgement occurs only
  after the listener returns (Orders.java:24-49; Messaging.java:30-37).
- Redis apply -> outbox DONE crash: released prevents repeated inventory INCR;
  stateVersion prevents older state overwrites (finalize.lua:8-22). The outbox
  marks DONE after apply (Workers.java:49-52).
- DLQ abort -> late message: orders.fail creates/locks the durable request and
  commits a FAILED tombstone before administrative record bookkeeping
  (Admin.java:39-41; Orders.java:58-65).
- Pay/cancel/expiry: all acquire request then order locks, and stock release is
  conditional on CREATED (Orders.java:74-109). Payment and cancellation cannot
  both acquire an actionable order state.

These conclusions require actual process-crash, duplicate-delivery, and
inventory assertions. They do not claim Redis-volume-loss durability or
multi-node availability.

## Native runtime verification

Actual isolated dependencies were started, stopped, and restarted on 2026-09-28:
MySQL 8.0.30 at 13306, Redis 5.0.9 at 16379, Kafka 4.3.0 at 19092/19093.
App-user SQL login, PING, Kafka create/describe, repeated startup without new
processes, graceful MySQL/Redis stop, and ownership verification passed.
Redis AOF retained a probe value across restart; the Kafka health topic retained
its topic ID. Redis settings were appendonly=yes, appendfsync=always,
maxmemory-policy=noeviction. Existing MySQL3306 PID7424 was unchanged.
Compose with Redis7 is provided but unexecuted because Docker is absent.

## Re-review ledger

No finding is marked fixed without a follow-up source inspection. Integration
and crash verification reports are maintained separately in artifacts/.


### Follow-up source inspection — 2026-09-28

All three originally reported findings have now been corrected in source:

| Finding | Follow-up location | Observed correction | Verification limit |
| --- | --- | --- | --- |
| Warmup resets live stock | Reservations.java:27-35; warmup.lua:1-13; DemoData.java:27-33 | Initialization requires DRAFT/PREHEATED with full DB stock, no partial meta/stock, no request remnants, and no users/events/pending remnants. The Lua script rechecks generation/types and refuses partial state. Existing demo inventory is no longer rebuilt on restart. | Source re-reviewed; targeted missing-key integration test still needed. |
| DLQ self-publishing loop | Messaging.java:18-23,46 | deadletters explicitly selects deadLetterFactory with RECORD acknowledgement and unlimited retry. Its error handler classifies all exceptions as retryable and has no DLQ publisher. | Source re-reviewed; real DB outage test still needed. |
| Abort overwritten by retry | Admin.java:46 | Retry bookkeeping matches only OPEN/REPLAYED, preserving ABORTED/RESOLVED. | Source re-reviewed; concurrent admin-action test still needed. |

The three coordinated process-crash checks have been implemented in
scripts/verification_crash.py and scripts/verification_backend_process.ps1.
Only syntax checks have been run by this reviewer at this stage. Execution needs
the root agent's exclusive test window and an app-start.ps1 -Lab manifest.
The scripts explicitly report the exact Kafka-ack-to-XACK window as uncovered.
