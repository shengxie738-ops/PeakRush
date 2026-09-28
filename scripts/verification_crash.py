"""Real backend process crashes, with exact owned-process checks.

Run exclusively after app-start.ps1 -Lab; this deliberately crashes only backend.
Root must coordinate other acceptance traffic before passing --execute.
No mock persistence, fake crash, dependency shutdown, or database reset is used.
"""
import argparse
import asyncio
import datetime
import json
import os
import pathlib
import re
import shutil
import time
import uuid

import aiohttp
from verification_api import Api, ROOT

RESET = dict(consumerPaused=False, failConsumer=False, pauseBridge=False,
             pauseOutbox=False, consumerDelayMs=0, afterDbCommitPauseMs=0,
             afterRedisApplyPauseMs=0)
LOG = ROOT / ".runtime" / "backend.out.log"
PROCESS_SCRIPT = ROOT / "scripts" / "verification_backend_process.ps1"
RID_RE = re.compile(r"^[0-9]+\.[0-9]+\.[a-f0-9]{32}$")


async def command(*args, timeout=120, env=None):
    process = await asyncio.create_subprocess_exec(
        *map(str, args), stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE, env=env)
    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout)
    if process.returncode:
        raise RuntimeError(f"Command failed ({process.returncode}): "
                           f"{stdout.decode('utf-8', 'replace')[-1500:]} "
                           f"{stderr.decode('utf-8', 'replace')[-1500:]}")
    return stdout.decode("utf-8-sig", "replace").strip()


async def run(args):
    report = {
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "base": args.base, "mode": "real-owned-backend-process-crash",
        "checks": [], "scenarios": [], "processActions": [],
        "uncovered": [
            "Exact Kafka producer acknowledgement to Redis Stream XACK window: no precise fault hook.",
            "Loss or corruption of a Redis persistence volume.",
            "Multi-node broker/database/Redis availability."
        ], "passed": False
    }
    powershell = args.powershell or shutil.which("pwsh") or shutil.which("powershell")
    if not powershell:
        raise RuntimeError("PowerShell executable required")
    mysql = args.mysql or shutil.which("mysql")
    redis_cli = args.redis_cli or shutil.which("redis-cli")
    if not mysql or not redis_cli:
        raise RuntimeError("Set --mysql and --redis-cli or put both tools on PATH")
    mysql_env = os.environ.copy()
    mysql_env["MYSQL_PWD"] = os.environ["DB_PASSWORD"]
    mysql_command = [mysql, "--protocol=TCP", "--host=127.0.0.1", "--port=13306",
                     "--user=peakrush", "--database=peakrush", "--batch",
                     "--skip-column-names", "--default-character-set=utf8mb4"]
    backend_down = False
    fixture_ids = []
    native_manifest = ROOT / ".runtime" / "native-processes.json"
    native_before = json.loads(native_manifest.read_text(encoding="utf-8-sig"))["services"]

    def check(name, condition, details=None):
        report["checks"].append(dict(name=name, passed=bool(condition), details=details))
        if not condition:
            raise AssertionError(f"{name}: {details}")

    async def process_action(action):
        output = await command(powershell, "-NoProfile", "-ExecutionPolicy", "Bypass",
                               "-File", PROCESS_SCRIPT, "-Action", action, timeout=200)
        value = json.loads(output)
        report["processActions"].append(value)
        return value

    async def query(sql):
        text = await command(*mysql_command, "--execute", sql, timeout=15, env=mysql_env)
        return json.loads(text)

    async def snapshot(aid, iid, rid):
        if not RID_RE.fullmatch(rid):
            raise AssertionError("Unsafe request ID")
        aid, iid = int(aid), int(iid)
        data = await query(f"""SELECT JSON_OBJECT(
          'orders',(SELECT COUNT(*) FROM seckill_order WHERE request_id='{rid}'),
          'requests',(SELECT COUNT(*) FROM seckill_request WHERE request_id='{rid}'),
          'requestStatus',(SELECT status FROM seckill_request WHERE request_id='{rid}'),
          'orderStatus',(SELECT status FROM seckill_order WHERE request_id='{rid}'),
          'stock',(SELECT available_stock FROM seckill_item WHERE id={iid}),
          'outboxPending',(SELECT COUNT(*) FROM recovery_outbox WHERE request_id='{rid}' AND status='PENDING'),
          'releaseLogs',(SELECT COUNT(*) FROM stock_change_log WHERE operation_key='release:{rid}')
        )""")
        prefix = f"pr:{{{aid}:{iid}}}:"
        state = await command(redis_cli, "-h", "127.0.0.1", "-p", "16379",
                              "--raw", "HMGET", prefix + "req:" + rid,
                              "state", "released", "stateVersion", timeout=10)
        values = state.splitlines()
        data["redisState"] = values[0] if values else None
        data["released"] = values[1] if len(values) > 1 else None
        data["stateVersion"] = values[2] if len(values) > 2 else None
        stock = await command(redis_cli, "-h", "127.0.0.1", "-p", "16379",
                              "--raw", "GET", prefix + "stock", timeout=10)
        data["redisStock"] = int(stock) if stock else None
        return data

    async def wait_snapshot(aid, iid, rid, predicate, timeout=60):
        deadline = time.monotonic() + timeout
        while True:
            value = await snapshot(aid, iid, rid)
            if predicate(value):
                return value
            if time.monotonic() >= deadline:
                raise AssertionError(f"Snapshot timeout: {value}")
            await asyncio.sleep(.25)

    async def wait_marker(marker, rid, offset, timeout=20):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if LOG.exists():
                with LOG.open("rb") as log:
                    log.seek(offset)
                    text = log.read().decode("utf-8", "replace")
                for line in text.splitlines():
                    if marker in line and f"requestId={rid}" in line:
                        return {"line": line, "observedMonotonic": time.monotonic()}
            await asyncio.sleep(.10)
        raise AssertionError(f"Exact {marker} for {rid} was not observed; no crash claimed.")

    async def crash_and_restart(marker=None):
        nonlocal backend_down
        backend_down = True
        killed = await process_action("Kill")
        if marker:
            delta = time.monotonic() - marker["observedMonotonic"]
            check("Crash occurred during the 30-second fault pause", delta < 25,
                  {"secondsAfterObservedMarker": round(delta, 3), "pid": killed["pid"]})
        started = await process_action("Start")
        backend_down = False
        check("Backend PID changed after forced crash", started["pid"] != killed["pid"],
              {"before": killed["pid"], "after": started["pid"]})
        check("Gateway/frontend PIDs preserved",
              started["otherProcesses"] == initial_processes["otherProcesses"],
              started["otherProcesses"])
        _, switches = await api.call("GET", "/api/admin/faults", token=admin)
        check("Restart cleared all lab fault controls",
              all(switches.get(k) == v for k, v in RESET.items()), switches)

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=45)) as session:
        api = Api(session, args.base)
        admin = None
        try:
            initial_processes = await process_action("Status")
            check("Manifest validates a running local,lab backend", initial_processes["running"],
                  initial_processes)
            admin = await api.login("admin", "admin12345")
            await api.call("POST", "/api/admin/faults", RESET, admin)
            _, products = await api.call("GET", "/api/admin/products", token=admin)
            api.product = products["items"][0]["id"]

            async def fixture(label):
                activity, item = await api.activity(admin, "V4", stock=2,
                                                    name="Crash " + label + " " + uuid.uuid4().hex[:8])
                fixture_ids.append(activity["id"])
                token = await api.user("crash_" + uuid.uuid4().hex[:12])
                return activity["id"], item["id"], token

            # 1. Durable Lua admission exists, but the bridge has not sent to Kafka.
            aid, iid, token = await fixture("admission-journal")
            await api.call("POST", "/api/admin/faults", {"pauseBridge": True}, admin)
            key = uuid.uuid4().hex
            pending = await api.buy(token, aid, iid, key=key)
            check("Journal scenario is genuinely PENDING", pending.get("status") == "PENDING", pending)
            rid = pending["requestId"]
            before = await snapshot(aid, iid, rid)
            check("Lua reserved before DB persistence", before["requests"] == 0 and
                  before["orders"] == 0 and before["stock"] == 2 and before["redisStock"] == 1, before)
            await crash_and_restart()
            settled = await api.settle(token, pending, timeout=75)
            repeated = await api.buy(token, aid, iid, key=key)
            check("Restart resolves the same admitted request", settled.get("status") == "SUCCESS" and
                  repeated.get("requestId") == rid and repeated.get("orderId") == settled.get("orderId"),
                  {"settled": settled, "repeated": repeated})
            after = await wait_snapshot(aid, iid, rid, lambda x: x["outboxPending"] == 0)
            check("Journal recovery creates exactly one order and consumes one unit",
                  after["orders"] == 1 and after["stock"] == 1 and after["redisStock"] == 1, after)
            report["scenarios"].append(dict(name="Lua admission to bridge recovery", passed=True,
                                           requestId=rid, before=before, after=after))

            # 2. DB commit completed; listener is still paused before record acknowledgement.
            aid, iid, token = await fixture("db-commit-offset")
            offset = LOG.stat().st_size if LOG.exists() else 0
            await api.call("POST", "/api/admin/faults", {"afterDbCommitPauseMs": 30000}, admin)
            pending = await api.buy(token, aid, iid)
            rid = pending["requestId"]
            marker = await wait_marker("FAULT_AFTER_DB_COMMIT", rid, offset)
            before = await snapshot(aid, iid, rid)
            check("Commit is durable before offset-window crash",
                  before["orders"] == 1 and before["requestStatus"] == "SUCCESS", before)
            await crash_and_restart(marker)
            settled = await api.settle(token, pending, timeout=75)
            await asyncio.sleep(7)
            after = await wait_snapshot(aid, iid, rid, lambda x: x["outboxPending"] == 0)
            check("Offset redelivery does not duplicate the committed order",
                  settled.get("status") == "SUCCESS" and after["orders"] == 1 and
                  after["stock"] == 1 and after["redisStock"] == 1, after)
            report["scenarios"].append(dict(name="DB commit before consumer offset", passed=True,
                                           requestId=rid, marker=marker["line"], before=before, after=after))

            # 3. Ensure SUCCESS outbox is DONE before arming the release fault.
            aid, iid, token = await fixture("redis-release-outbox")
            settled = await api.settle(token, await api.buy(token, aid, iid), timeout=75)
            check("Release scenario starts with a successful order", settled.get("status") == "SUCCESS", settled)
            rid = settled["requestId"]
            await wait_snapshot(aid, iid, rid, lambda x: x["outboxPending"] == 0 and
                                x["redisState"] == "SUCCESS" and x["redisStock"] == 1)
            offset = LOG.stat().st_size if LOG.exists() else 0
            await api.call("POST", "/api/admin/faults", {"afterRedisApplyPauseMs": 30000}, admin)
            _, cancelled = await api.call("POST", f"/api/orders/{settled['orderId']}/cancel", {}, token)
            check("Cancellation committed before release fault", cancelled["status"] == "CANCELLED", cancelled)
            marker = await wait_marker("FAULT_AFTER_REDIS_APPLY", rid, offset)
            before = await snapshot(aid, iid, rid)
            check("Fault is after CANCELLED release, not the earlier SUCCESS apply",
                  before["requestStatus"] == "CANCELLED" and before["redisState"] == "CANCELLED" and
                  before["released"] == "1" and before["stock"] == 2 and before["redisStock"] == 2 and
                  before["outboxPending"] == 1 and before["releaseLogs"] == 1, before)
            await crash_and_restart(marker)
            after = await wait_snapshot(aid, iid, rid, lambda x: x["outboxPending"] == 0)
            await asyncio.sleep(2)
            after = await snapshot(aid, iid, rid)
            check("Redis release replay cannot increase stock twice",
                  after["orders"] == 1 and after["orderStatus"] == "CANCELLED" and
                  after["stock"] == 2 and after["redisStock"] == 2 and
                  after["released"] == "1" and after["releaseLogs"] == 1 and after["outboxPending"] == 0, after)
            report["scenarios"].append(dict(name="Redis release before outbox DONE", passed=True,
                                           requestId=rid, marker=marker["line"], before=before, after=after))
            native_after = json.loads(native_manifest.read_text(encoding="utf-8-sig"))["services"]
            check("Dependency process manifest unchanged", native_before == native_after)
            report["passed"] = True
        except Exception as exc:
            report["error"] = str(exc)
            raise
        finally:
            cleanup_errors = []
            if backend_down:
                try:
                    await process_action("Start")
                    backend_down = False
                except Exception as exc:
                    cleanup_errors.append("Backend recovery: " + str(exc))
            if admin and not backend_down:
                try:
                    await api.call("POST", "/api/admin/faults", RESET, admin)
                except Exception as exc:
                    cleanup_errors.append("Fault reset: " + str(exc))
                for aid in fixture_ids:
                    try:
                        await api.call("POST", f"/api/admin/activities/{aid}/offline", {}, admin)
                    except Exception as exc:
                        cleanup_errors.append(f"Fixture {aid}: {exc}")
            if cleanup_errors:
                report["cleanupErrors"] = cleanup_errors
                report["passed"] = False
            report["finishedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            target = ROOT / "artifacts" / "verification-crash.json"
            target.parent.mkdir(exist_ok=True)
            target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Report: {target}", flush=True)
            if cleanup_errors:
                raise RuntimeError("Crash test cleanup failed; inspect report")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:8080")
    parser.add_argument("--execute", action="store_true", help="Inject the three coordinated backend crashes")
    parser.add_argument("--powershell")
    parser.add_argument("--mysql")
    parser.add_argument("--redis-cli")
    options = parser.parse_args()
    if not options.execute:
        parser.error("Pass --execute only after coordinating an exclusive crash-test window.")
    asyncio.run(run(options))
