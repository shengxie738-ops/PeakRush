"""Load-report convergence checks. Unknown metrics must never be read as zero (PR #3 review R4)."""
import asyncio
import importlib
import pathlib
import tempfile
import sys
import unittest
from unittest import mock

SCRIPTS = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
load = importlib.import_module("verification_load")

ACTIVITY = 7


def metrics(**overrides):
    row = {"activityId": ACTIVITY, "pendingReservations": 0, "redisAvailableStock": 0}
    values = {
        "inventory": [row],
        "outboxPending": 0,
        "v4StreamEvents": 0,
        "v4StreamPending": 0,
    }
    for key, value in overrides.items():
        if key == "inventory":
            values[key] = value
        else:
            values[key] = value
    return values


class ConvergenceTest(unittest.TestCase):
    def test_v4_converged_fixture(self):
        pending, converged = load.convergence_state(metrics(), ACTIVITY, 4)
        self.assertEqual(0, pending)
        self.assertTrue(converged)

    def test_unknown_pending_stays_none(self):
        pending, converged = load.convergence_state(metrics(inventory=[{"activityId": ACTIVITY, "pendingReservations": None, "redisAvailableStock": 0}]), ACTIVITY, 4)
        self.assertIsNone(pending)
        self.assertFalse(converged)

    def test_missing_inventory_is_not_converged(self):
        pending, converged = load.convergence_state(metrics(inventory=[]), ACTIVITY, 4)
        self.assertIsNone(pending)
        self.assertFalse(converged)

    def test_other_activity_rows_do_not_count(self):
        pending, converged = load.convergence_state(metrics(inventory=[{"activityId": ACTIVITY + 1, "pendingReservations": 0, "redisAvailableStock": 0}]), ACTIVITY, 4)
        self.assertIsNone(pending)
        self.assertFalse(converged)

    def test_unknown_outbox_is_not_converged(self):
        pending, converged = load.convergence_state(metrics(outboxPending=None), ACTIVITY, 4)
        self.assertEqual(0, pending)
        self.assertFalse(converged)

    def test_pending_outbox_is_not_converged(self):
        _, converged = load.convergence_state(metrics(outboxPending=3), ACTIVITY, 4)
        self.assertFalse(converged)

    def test_unreadable_redis_projection_is_not_converged(self):
        row = {"activityId": ACTIVITY, "pendingReservations": 0, "redisAvailableStock": None}
        _, converged = load.convergence_state(metrics(inventory=[row]), ACTIVITY, 4)
        self.assertFalse(converged)

    def test_undrained_stream_is_not_converged(self):
        for overrides in ({"v4StreamEvents": None}, {"v4StreamPending": None}, {"v4StreamEvents": 2}, {"v4StreamPending": 1}):
            with self.subTest(**overrides):
                _, converged = load.convergence_state(metrics(**overrides), ACTIVITY, 4)
                self.assertFalse(converged)

    def test_v1_does_not_require_redis_projection(self):
        row = {"activityId": ACTIVITY, "pendingReservations": 0, "redisAvailableStock": None}
        pending, converged = load.convergence_state(metrics(inventory=[row]), ACTIVITY, 1)
        self.assertEqual(0, pending)
        self.assertTrue(converged)

    def test_v2_requires_redis_projection(self):
        row = {"activityId": ACTIVITY, "pendingReservations": 0, "redisAvailableStock": None}
        _, converged = load.convergence_state(metrics(inventory=[row]), ACTIVITY, 2)
        self.assertFalse(converged)

    def test_negative_pending_is_not_converged(self):
        row = {"activityId": ACTIVITY, "pendingReservations": -1, "redisAvailableStock": 0}
        pending, converged = load.convergence_state(metrics(inventory=[row]), ACTIVITY, 4)
        self.assertIsNone(pending)
        self.assertFalse(converged)

    def test_version_parser(self):
        self.assertEqual(4, load.architecture_version("V4"))
        self.assertEqual(3, load.architecture_version("v3"))
        self.assertEqual(0, load.architecture_version("unknown"))


class InventoryTargetTest(unittest.TestCase):
    def row(self, **overrides):
        values = {"activityId": ACTIVITY, "totalStock": 10, "availableStock": 7, "occupiedQuantity": 3, "redisAvailableStock": 7}
        values.update(overrides)
        return values

    def test_conserved_fixture(self):
        self.assertEqual({"dbInventoryConserved": True, "redisMatchesDatabase": True}, load.inventory_targets([self.row()], 4))

    def test_database_shortfall_is_flagged(self):
        self.assertFalse(load.inventory_targets([self.row(occupiedQuantity=2)], 4)["dbInventoryConserved"])

    def test_redis_projection_drift_is_flagged(self):
        self.assertFalse(load.inventory_targets([self.row(redisAvailableStock=6)], 4)["redisMatchesDatabase"])

    def test_unknown_redis_projection_is_flagged(self):
        self.assertFalse(load.inventory_targets([self.row(redisAvailableStock=None)], 2)["redisMatchesDatabase"])

    def test_v1_does_not_require_redis_projection(self):
        self.assertEqual({"dbInventoryConserved": True}, load.inventory_targets([self.row(redisAvailableStock=None)], 1))

    def test_empty_inventory_is_flagged(self):
        self.assertFalse(load.inventory_targets([], 4)["dbInventoryConserved"])


class OrderTargetTest(unittest.TestCase):
    def orders(self, **overrides):
        values = {"success": 3, "uniqueAcceptedRequests": 3, "terminalStates": {"SUCCESS": 3}}
        values.update(overrides)
        return values

    def test_all_accepted_requests_settled(self):
        self.assertEqual({"ordersTerminal": True}, load.order_targets(self.orders()))

    def test_unsettled_poll_is_flagged(self):
        self.assertFalse(load.order_targets(self.orders(terminalStates={"SUCCESS": 2, "UNSETTLED": 1}))["ordersTerminal"])

    def test_pending_terminal_state_is_flagged(self):
        self.assertFalse(load.order_targets(self.orders(terminalStates={"SUCCESS": 2, "PENDING": 1}))["ordersTerminal"])

    def test_terminal_count_must_match_accepted(self):
        self.assertFalse(load.order_targets(self.orders(terminalStates={"SUCCESS": 2}))["ordersTerminal"])

    def test_unknown_accepted_count_is_flagged(self):
        self.assertFalse(load.order_targets(self.orders(uniqueAcceptedRequests=None))["ordersTerminal"])

    def test_null_terminal_state_key_is_flagged(self):
        self.assertFalse(load.order_targets(self.orders(terminalStates={"SUCCESS": 2, None: 1}))["ordersTerminal"])

    def test_unknown_terminal_state_is_flagged(self):
        self.assertFalse(load.order_targets(self.orders(terminalStates={"SUCCESS": 2, "WHATEVER": 1}))["ordersTerminal"])

    def test_whitelisted_terminal_states_settle(self):
        self.assertEqual({"ordersTerminal": True}, load.order_targets(self.orders(terminalStates={"SUCCESS": 2, "FAILED": 1})))

    def test_non_dict_terminal_states_are_flagged(self):
        for value in (None, [], "SUCCESS", 3):
            with self.subTest(terminalStates=value):
                self.assertFalse(load.order_targets(self.orders(terminalStates=value))["ordersTerminal"])


class ParserTest(unittest.TestCase):
    def test_targets_are_required_by_default(self):
        self.assertTrue(load.build_parser().parse_args([]).require_targets)

    def test_report_only_opts_out(self):
        self.assertFalse(load.build_parser().parse_args(["--report-only"]).require_targets)

    def test_rerun_with_experiment_id_updates_existing_experiment_without_unpack_error(self):
        calls = []

        class FakeApi:
            def __init__(self, session, base):
                self.product = None

            async def login(self, name, password):
                return "admin-token"

            async def user(self, name):
                return f"token-{name}"

            async def activity(self, admin, version, stock, name=None):
                return {"id": 99}, {"id": 199}

            async def path(self, token, aid, iid):
                return "p-1"

            async def settle(self, token, value, timeout=90):
                return {"status": "SUCCESS", "requestId": value.get("requestId")}

            async def call(self, method, path, body=None, token=None, key=None, allowed=(200, 201)):
                calls.append((method, path, body))
                if path == "/api/admin/products":
                    return 200, {"items": [{"id": 1}]}
                if path.startswith("/api/seckill/"):
                    return 200, {"status": "PENDING", "requestId": "99.199." + ("a" * 32)}
                if path == "/api/admin/metrics/summary":
                    return 200, {
                        "outboxPending": 0,
                        "v4StreamEvents": 0,
                        "v4StreamPending": 0,
                        "inventory": [{
                            "activityId": 99,
                            "totalStock": 1,
                            "availableStock": 0,
                            "occupiedQuantity": 1,
                            "redisAvailableStock": 0,
                            "pendingReservations": 0,
                        }],
                    }
                return 200, {}

        class FakeSession:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

        with tempfile.TemporaryDirectory() as tmp:
            args = load.build_parser().parse_args([
                "--versions", "V4", "--users", "1", "--rps", "1", "--seconds", "1",
                "--stock", "1", "--experiment-id", "42", "--report-only", "--output-dir", tmp,
            ])
            with mock.patch.object(load, "Api", FakeApi), mock.patch.object(load.aiohttp, "ClientSession", FakeSession):
                unmet = asyncio.run(load.run(args))
            self.assertEqual(["V4"], unmet)  # virtualUsers2000 is false when users=1
            post_paths = [p for m, p, _ in calls if m == "POST"]
            self.assertNotIn("/api/admin/experiments", post_paths)
            self.assertIn("/api/admin/experiments/42/results", post_paths)
            self.assertIn("/api/admin/activities/99/offline", post_paths)

    def test_temporary_activity_is_offlined_even_when_run_fails_midway(self):
        calls = []

        class FailingApi:
            def __init__(self, session, base):
                self.product = None

            async def login(self, name, password):
                return "admin-token"

            async def user(self, name):
                return f"token-{name}"

            async def activity(self, admin, version, stock, name=None):
                return {"id": 88}, {"id": 188}

            async def path(self, token, aid, iid):
                raise RuntimeError("boom during path prep")

            async def call(self, method, path, body=None, token=None, key=None, allowed=(200, 201)):
                calls.append((method, path))
                if path == "/api/admin/products":
                    return 200, {"items": [{"id": 1}]}
                return 200, {}

        class FakeSession:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

        args = load.build_parser().parse_args([
            "--versions", "V4", "--users", "1", "--rps", "1", "--seconds", "1",
            "--stock", "1", "--experiment-id", "42", "--report-only",
        ])
        with mock.patch.object(load, "Api", FailingApi), mock.patch.object(load.aiohttp, "ClientSession", FakeSession):
            with self.assertRaisesRegex(RuntimeError, "boom during path prep"):
                asyncio.run(load.run(args))
        self.assertIn(("POST", "/api/admin/activities/88/offline"), calls)


if __name__ == "__main__":
    unittest.main()
