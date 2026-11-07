"""删除 V4 事件 Stream 中“已 ACK 但未删除”的历史残留条目。

PR #3 之前的 bridge 先 XACK 再 XDEL，两条命令之间失败会留下既不在 PEL、也不会再被
ReadOffset.lastConsumed 读到或 claim 的条目，这些条目只能人工清理。

本脚本只删除同时满足两个条件的条目，其它条目一律保留：
  1. ID <= 消费组 last-delivered-id（已经投递过）
  2. 不在 PEL 中（已经 XACK，没有任何消费者还会重试）
未投递条目（ID > last-delivered-id）和仍在 PEL 的条目不会被删除。

上线用法（停机窗口）：
  1. 先停 backend，或把 faults.pauseBridge 置为 true，确认没有 bridge 正在读写这些流。
  2. 空跑统计（默认行为，不写 Redis）：
       python scripts/cleanup_stream_residue.py --host 127.0.0.1 --port 16379 --dry-run
  3. 确认 dry-run 的 wouldRemove 与历史告警量级一致后执行：
       python scripts/cleanup_stream_residue.py --host 127.0.0.1 --port 16379 --apply
  4. 记录输出中的 removed / remaining，再恢复 backend。
  5. 脚本可重复执行；已删除的条目不会再次出现，remaining 为 0 即表示该流已清理干净。

依赖：pip install -r scripts/requirements.txt（redis>=5）
"""
import argparse
import sys

import redis


def _field(info, name):
    if isinstance(info, dict):
        value = info.get(name) or info.get(name.encode())
    else:
        value = None
        for index in range(0, len(info) - 1, 2):
            if info[index] in (name, name.encode()):
                value = info[index + 1]
                break
    return value.decode() if isinstance(value, bytes) else value


def group_state(client, key, group):
    for info in client.xinfo_groups(key):
        if _field(info, "name") == group:
            return info
    return None


def _stream_targets(key):
    return key.decode() if isinstance(key, bytes) else key


def _emit(stream, last_id, scanned, candidates, removed, pending_kept, apply):
    return {
        "stream": stream,
        "lastDeliveredId": last_id,
        "scanned": scanned,
        "ackedResidue": candidates,
        "wouldRemove": 0 if apply else candidates,
        "removed": removed,
        "pendingKept": pending_kept,
    }


def _sid(value):
    return value.decode() if isinstance(value, bytes) else value


def clean_stream(client, stream, group, batch, apply):
    info = group_state(client, stream, group)
    if info is None:
        return {"stream": stream, "skipped": "group %s not found" % group}
    last_id = _field(info, "last-delivered-id")
    scanned = candidates = removed = pending_kept = 0
    start = None
    while last_id and last_id != "0-0":
        # Redis 5.0 不支持 XRANGE 的独占区间 "(id"，这里用闭区间并在客户端跳过上一页最后一条。
        raw = client.xrange(stream, min=start or "-", max=last_id, count=batch)
        full = len(raw) == batch
        if start:
            raw = [entry for entry in raw if _sid(entry[0]) != start]
        if not raw:
            break
        ids = [_sid(entry_id) for entry_id, _ in raw]
        scanned += len(ids)
        pipeline = client.pipeline(transaction=False)
        for entry_id in ids:
            pipeline.xpending_range(stream, group, min=entry_id, max=entry_id, count=1)
        pending = pipeline.execute()
        residue = [entry_id for entry_id, rows in zip(ids, pending) if not rows]
        pending_kept += len(ids) - len(residue)
        candidates += len(residue)
        if apply and residue:
            removed += client.xdel(stream, *residue)
        if not full:
            break
        start = ids[-1]
    return _emit(stream, last_id, scanned, candidates, removed, pending_kept, apply)


def main(argv=None):
    parser = argparse.ArgumentParser(description="清理已 ACK 但未删除的 V4 Stream 残留条目")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=16379)
    parser.add_argument("--db", type=int, default=0)
    parser.add_argument("--password", default=None)
    parser.add_argument("--group", default="bridge")
    parser.add_argument("--pattern", default="pr:*:events", help="SCAN 匹配的事件流 key")
    parser.add_argument("--batch", type=int, default=200)
    parser.add_argument("--apply", action="store_true", help="真正删除；缺省只统计")
    parser.add_argument("--dry-run", action="store_true", help="只统计（默认行为）")
    args = parser.parse_args(argv)
    if args.apply and args.dry_run:
        parser.error("--apply 与 --dry-run 不能同时使用")
    if args.batch < 1:
        parser.error("--batch 必须为正数")
    client = redis.Redis(host=args.host, port=args.port, db=args.db, password=args.password, decode_responses=False)
    client.ping()
    results = [clean_stream(client, _stream_targets(key), args.group, args.batch, args.apply) for key in client.scan_iter(match=args.pattern, count=200)]
    total = sum(row.get("removed", 0) for row in results)
    would = sum(row.get("wouldRemove", 0) for row in results)
    for row in results:
        print(row, flush=True)
    print({"streams": len(results), "removed": total, "wouldRemove": would, "mode": "apply" if args.apply else "dry-run"}, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
