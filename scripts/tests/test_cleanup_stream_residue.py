"""Residue cleanup must delete only acked entries, never PEL entries or undelivered ones."""
import importlib
import os
import pathlib
import sys
import unittest
import uuid
from unittest import mock

SCRIPTS = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

try:
    import redis
except ImportError:  # pragma: no cover - requirements.txt installs it
    redis = None

cleanup = importlib.import_module("cleanup_stream_residue") if redis else None


@unittest.skipUnless(os.environ.get("PEAKRUSH_REDIS_TESTS") == "true" and redis, "set PEAKRUSH_REDIS_TESTS=true with a local Redis")
class CleanupResidueTest(unittest.TestCase):
    def setUp(self):
        self.client = redis.Redis(host=os.environ.get("REDIS_HOST", "127.0.0.1"), port=int(os.environ.get("REDIS_PORT", "16379")), db=0, decode_responses=False)
        self.client.ping()
        self.stream = "pr:{%s}:1:events" % uuid.uuid4().hex[:12]
        self.ids = [self.client.xadd(self.stream, {"payload": "e%d" % n}) for n in range(5)]
        self.client.xgroup_create(self.stream, "bridge", id="0-0")
        self.client.xreadgroup("bridge", "crashed", {self.stream: ">"}, count=4)

    def tearDown(self):
        self.client.delete(self.stream)

    def test_only_acked_residue_is_deleted(self):
        acked = [self.ids[0], self.ids[1]]
        self.client.xack(self.stream, "bridge", *acked)
        self.assertEqual(5, self.client.xlen(self.stream))
        self.assertEqual(2, len(self.client.xpending_range(self.stream, "bridge", "-", "+", 10)))

        dry = cleanup.clean_stream(self.client, self.stream, "bridge", 2, apply=False)
        self.assertEqual(2, dry["ackedResidue"])
        self.assertEqual(2, dry["wouldRemove"])
        self.assertEqual(0, dry["removed"])
        self.assertEqual(5, self.client.xlen(self.stream), "dry-run 不能修改 Stream")

        applied = cleanup.clean_stream(self.client, self.stream, "bridge", 2, apply=True)
        self.assertEqual(2, applied["removed"])
        self.assertEqual(3, self.client.xlen(self.stream), "只删除已确认的 2 条，PEL 和未投递条目必须保留")
        self.assertEqual(2, len(self.client.xpending_range(self.stream, "bridge", "-", "+", 10)))
        remaining = {entry_id.decode() if isinstance(entry_id, bytes) else entry_id for entry_id, _ in self.client.xrange(self.stream)}
        self.assertIn(self.ids[2].decode() if isinstance(self.ids[2], bytes) else self.ids[2], remaining, "未确认的 PEL 条目必须保留")
        self.assertIn(self.ids[4].decode() if isinstance(self.ids[4], bytes) else self.ids[4], remaining, "未投递条目必须保留")

        again = cleanup.clean_stream(self.client, self.stream, "bridge", 2, apply=True)
        self.assertEqual(0, again["removed"], "重复执行必须幂等")

    def test_missing_group_is_skipped(self):
        result = cleanup.clean_stream(self.client, self.stream, "absent", 2, apply=True)
        self.assertIn("skipped", result)
        self.assertEqual(5, self.client.xlen(self.stream))


@unittest.skipUnless(redis, "redis package required")
class BatchArgumentTest(unittest.TestCase):
    """--batch 校验不依赖 Redis：闭区间续页要求每页至少 2 条。"""

    def test_batch_one_is_rejected_before_connecting(self):
        with self.assertRaises(SystemExit):
            cleanup.main(["--batch", "1"])

    def test_batch_two_passes_validation(self):
        class FakeClient:
            def __init__(self, **kwargs):
                self.kwargs = kwargs

            def ping(self):
                return True

            def scan_iter(self, match=None, count=None):
                return []

        with mock.patch.object(cleanup.redis, "Redis", FakeClient):
            self.assertEqual(0, cleanup.main(["--batch", "2"]))


if __name__ == "__main__":
    unittest.main()
