"""Offline catalog checks. FakeApi never opens a network connection."""
import copy
import datetime as dt
import importlib
import pathlib
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SCRIPTS = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
try:
    seed = importlib.import_module("seed_catalog")
except ModuleNotFoundError as error:
    if error.name != "seed_catalog":
        raise
    seed = None
NOW = dt.datetime(2026, 10, 9, 0, 0, tzinfo=dt.timezone.utc)


class FakeApi:
    def __init__(self):
        self.products = []
        self.activities = []
        self.calls = []
        self.lose_product_response = False
        self.lose_activity_response = False
        self.fail_warmup_once = False
        self.edit_on_second_product_read = False
        self.product_reads = 0

    async def login(self, name, password):
        return "private-test-token"

    async def call(self, method, path, body=None, token=None, **kwargs):
        self.calls.append((method, path, copy.deepcopy(body)))
        if path == "/api/admin/products":
            if method == "GET":
                self.product_reads += 1
                if self.edit_on_second_product_read and self.product_reads == 2:
                    self.products[0].update(name="最新管理员改名", description="最新描述", originalPrice=250)
                return 200, {"items": copy.deepcopy(self.products)}
            product = {"id": len(self.products) + 1, **copy.deepcopy(body)}
            self.products.append(product)
            if self.lose_product_response:
                self.lose_product_response = False
                raise OSError("Product committed but response was lost")
            return 200, copy.deepcopy(product)
        if path.startswith("/api/admin/products/"):
            product = next(p for p in self.products if p["id"] == int(path.rsplit("/", 1)[1]))
            product.update(copy.deepcopy(body))
            return 200, copy.deepcopy(product)
        if path == "/api/admin/activities":
            if method == "GET":
                return 200, {"items": copy.deepcopy(self.activities)}
            activity = {"id": len(self.activities) + 1, "status": "DRAFT", **copy.deepcopy(body)}
            activity["items"] = [{"id": 100 * activity["id"] + index, "availableStock": i["totalStock"], **i} for index, i in enumerate(activity["items"], 1)]
            self.activities.append(activity)
            if self.lose_activity_response:
                self.lose_activity_response = False
                raise OSError("Activity committed but response was lost")
            return 200, copy.deepcopy(activity)
        activity_id, action = path.split("/")[-2:]
        activity = next(a for a in self.activities if a["id"] == int(activity_id))
        if action == "warmup":
            assert activity["status"] in ("DRAFT", "PREHEATED"), "running inventory must never be preheated"
            activity["status"] = "PREHEATED"
            if self.fail_warmup_once:
                self.fail_warmup_once = False
                raise OSError("Partial warmup failure")
        elif action == "activate":
            assert activity["status"] in ("PREHEATED", "RUNNING")
            activity["status"] = "RUNNING"
        else:
            raise AssertionError(f"Unexpected mutation: {method} {path}")
        return 200, copy.deepcopy(activity)


class CatalogTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.assertIsNotNone(seed, "seed_catalog.py must implement the catalog initializer")
        self.catalog = seed.load_catalog()
        self.api = FakeApi()

    async def initialize(self, now=NOW):
        report = {"products": [], "activities": []}
        await seed.seed_catalog(self.api, "offline-token", self.catalog, now, report)
        return report

    async def test_catalog_has_nine_distinct_images_and_required_categories(self):
        products = self.catalog["products"]
        self.assertEqual(len(products), 9)
        self.assertEqual(len({p["imageUrl"] for p in products}), 9)
        self.assertEqual({c: sum(p["category"] == c for p in products) for c in seed.CATEGORIES}, {
            "数码影音": 5, "居家生活": 2, "运动户外": 1, "旅行出行": 1,
        })

    async def test_creates_real_catalog_and_two_nine_item_v3_sessions(self):
        report = await self.initialize()
        self.assertEqual(len(self.api.products), 9)
        self.assertEqual(len(self.api.activities), 2)
        current, future = self.api.activities
        self.assertEqual(seed.parse_time(current["startTime"]), NOW - dt.timedelta(minutes=5))
        self.assertEqual(seed.parse_time(current["endTime"]), NOW + dt.timedelta(hours=24))
        self.assertEqual(seed.parse_time(future["startTime"]), NOW + dt.timedelta(hours=2))
        self.assertEqual(seed.parse_time(future["endTime"]), NOW + dt.timedelta(hours=26))
        self.assertTrue(all(a["architectureVersion"] == "V3" and a["status"] == "RUNNING" and len(a["items"]) == 9 for a in self.api.activities))
        self.assertEqual(len(report["activities"]), 2)
        self.assertNotIn("offline-token", str(report))

    async def test_repeat_run_reuses_active_objects_and_preserves_consumed_inventory(self):
        await self.initialize()
        self.api.activities[0]["items"][0]["availableStock"] -= 7
        old = copy.deepcopy(self.api.activities)
        self.api.calls.clear()
        await self.initialize(NOW + dt.timedelta(hours=3))
        self.assertEqual(len(self.api.products), 9)
        self.assertEqual(len(self.api.activities), 2)
        self.assertEqual(self.api.activities, old)
        self.assertFalse(any(method == "POST" and path in ("/api/admin/products", "/api/admin/activities") for method, path, _ in self.api.calls))
        self.assertFalse(any(path.endswith("/warmup") for _, path, _ in self.api.calls))
        self.assertEqual(sum(path.endswith("/activate") for _, path, _ in self.api.calls), 2, "activation may repair a partially applied enabled flag")

    async def test_category_backfill_preserves_admin_edited_product_fields(self):
        spec = self.catalog["products"][0]
        self.api.products = [{"id": 1, "name": "管理员改名", "description": "管理员描述", "imageUrl": spec["imageUrl"], "originalPrice": 300, "category": "其他好物"}]
        await self.initialize()
        saved = self.api.products[0]
        self.assertEqual(saved["name"], "管理员改名")
        self.assertEqual(saved["description"], "管理员描述")
        self.assertEqual(saved["originalPrice"], 300)
        self.assertEqual(saved["category"], spec["category"])
        self.assertEqual(len(self.api.products), 9)

    async def test_lost_creation_responses_are_discovered_without_repeating_posts(self):
        self.api.lose_product_response = True
        self.api.lose_activity_response = True
        await self.initialize()
        self.assertEqual(len(self.api.products), 9)
        self.assertEqual(len(self.api.activities), 2)
        self.assertEqual(sum(method == "POST" and path == "/api/admin/products" for method, path, _ in self.api.calls), 9)
        self.assertEqual(sum(method == "POST" and path == "/api/admin/activities" for method, path, _ in self.api.calls), 2)

    async def test_category_update_uses_fresh_fields_instead_of_initial_list_snapshot(self):
        spec = self.catalog["products"][0]
        self.api.products = [{"id": 1, "name": "旧管理员改名", "description": "旧描述", "imageUrl": spec["imageUrl"], "originalPrice": 300, "category": "其他好物"}]
        self.api.edit_on_second_product_read = True
        await self.initialize()
        self.assertEqual(self.api.products[0]["name"], "最新管理员改名")
        self.assertEqual(self.api.products[0]["description"], "最新描述")
        self.assertEqual(self.api.products[0]["originalPrice"], 250)

    async def test_partial_warmup_resumes_same_preheated_activity(self):
        self.api.fail_warmup_once = True
        report = {"products": [], "activities": []}
        with self.assertRaises(OSError):
            await seed.seed_catalog(self.api, "offline-token", self.catalog, NOW, report)
        self.assertEqual(len(self.api.activities), 1)
        self.assertEqual(self.api.activities[0]["status"], "PREHEATED")
        self.assertEqual(report["activities"][0]["status"], "PREHEATED", "failed mutation should refetch the actual observed state")
        await self.initialize()
        self.assertEqual(len(self.api.activities), 2)
        self.assertTrue(all(a["status"] == "RUNNING" for a in self.api.activities))

    async def test_draft_resume_and_expired_generations_do_not_mutate_old_inventory(self):
        await self.initialize()
        self.api.activities[0]["status"] = "DRAFT"
        self.api.activities[1]["status"] = "PREHEATED"
        await self.initialize()
        self.assertTrue(all(a["status"] == "RUNNING" for a in self.api.activities))
        old = copy.deepcopy(self.api.activities)
        await self.initialize(NOW + dt.timedelta(hours=27))
        self.assertEqual(len(self.api.activities), 4)
        self.assertEqual(self.api.activities[:2], old)

    async def test_marker_must_be_a_complete_line_and_active_catalog_is_not_rewritten(self):
        await self.initialize()
        self.api.activities[0]["description"] += " suffix"
        await self.initialize()
        self.assertEqual(len(self.api.activities), 3)
        target = self.api.activities[-1]
        target["items"].pop()
        with self.assertRaises(seed.CatalogConflictError):
            await self.initialize()
        self.assertEqual(len(self.api.activities), 3)
        self.assertEqual(len(target["items"]), 8)

    async def test_validate_all_configuration_before_any_api_mutation(self):
        broken = copy.deepcopy(self.catalog)
        broken["products"][-1]["totalStock"] = 0
        with self.assertRaises(ValueError):
            await seed.seed_catalog(self.api, "offline-token", broken, NOW, {"products": [], "activities": []})
        self.assertEqual(self.api.calls, [])

    async def test_a_single_activity_cannot_claim_both_catalog_roles(self):
        await self.initialize()
        self.api.activities[0]["description"] += "\n" + seed.marker("next")
        with self.assertRaises(seed.CatalogConflictError):
            await self.initialize()
        self.assertEqual(len(self.api.activities), 2)

    async def test_exclusive_lock_rejects_second_handle_and_releases_on_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "catalog.lock"
            with seed.exclusive_lock(path):
                with self.assertRaises(RuntimeError):
                    with seed.exclusive_lock(path):
                        self.fail("a concurrent process must not enter the seed critical section")
            with seed.exclusive_lock(path):
                pass

    async def test_base_url_cannot_embed_credentials_or_secret_query_parameters(self):
        self.assertEqual(seed.normalize_base("http://127.0.0.1:8080/"), "http://127.0.0.1:8080")
        for value in ["http://user:password@example.com", "http://example.com?token=secret", "file:///tmp/catalog"]:
            with self.assertRaises(ValueError):
                seed.normalize_base(value)

    async def test_saved_failure_report_has_no_token_password_or_raw_response(self):
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(base="http://127.0.0.1:8080", catalog=seed.CATALOG_PATH, output=pathlib.Path(directory) / "report.json")
            secret = "private-password-sentinel"
            self.api.fail_warmup_once = True
            with patch.object(seed, "ROOT", pathlib.Path(directory)), patch.object(seed, "Api", lambda session, base: self.api), patch.dict(seed.os.environ, {"PEAKRUSH_ADMIN_PASSWORD": secret}):
                report = await seed.run(args)
            self.assertFalse(report["passed"])
            saved = args.output.read_text(encoding="utf-8")
            self.assertNotIn(secret, saved)
            self.assertNotIn("private-test-token", saved)
            self.assertNotIn("Partial warmup failure", saved)
            self.assertEqual(report["error"]["phase"], "activity:current:warmup")


if __name__ == "__main__":
    unittest.main()
