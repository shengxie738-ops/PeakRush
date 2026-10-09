"""Idempotent local catalog setup through the existing administrator APIs.

Usage: python scripts/seed_catalog.py --base http://127.0.0.1:8080
Environment: PEAKRUSH_API_BASE, PEAKRUSH_ADMIN_USERNAME,
PEAKRUSH_ADMIN_PASSWORD. Credentials default to the documented local demo.
No existing inventory is reset and no historical activity is taken offline.
"""
import argparse
import asyncio
import contextlib
import datetime as dt
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

import aiohttp
from verification_api import Api, ROOT

CATALOG_PATH = Path(__file__).with_name("catalog.json")
DEFAULT_OUTPUT = ROOT / "artifacts" / "catalog-seed-20261009.json"
CATEGORIES = ("数码影音", "居家生活", "运动户外", "旅行出行")
PRODUCT_IMAGES = {
    **{key: f"/assets/product-{key}.png" for key in ("earbuds", "camera", "watch")},
    **{key: f"/assets/products/{key}.png" for key in (
        "coffee-machine", "portable-speaker", "mechanical-keyboard", "desk-lamp", "trail-shoes", "carry-on",
    )},
}
ROLES = ("current", "next")
REUSABLE_STATUSES = ("DRAFT", "PREHEATED", "RUNNING", "SOLD_OUT")


class CatalogConflictError(RuntimeError):
    """A marked existing activity cannot safely be changed by the initializer."""


def parse_time(value):
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("活动时间必须包含时区")
    return parsed.astimezone(dt.timezone.utc)


def normalize_base(value):
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError("--base 必须是 HTTP 或 HTTPS 服务地址")
    if parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("服务地址不能包含口令、查询参数或片段")
    return value.rstrip("/")


def valid_money(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0 or amount > 999999999 or amount != amount.quantize(Decimal("0.01")):
            raise ValueError
        return amount
    except (InvalidOperation, ValueError):
        raise ValueError("金额必须为有效正数，且最多两位小数") from None


def validate_catalog(catalog):
    products = catalog.get("products", [])
    if catalog.get("version") != 1 or len(products) != len(PRODUCT_IMAGES):
        raise ValueError("目录必须包含版本 1 的九种商品")
    keys, images = set(), set()
    for product in products:
        key, image = product.get("key"), product.get("imageUrl")
        if key not in PRODUCT_IMAGES or key in keys or image in images or image != PRODUCT_IMAGES[key]:
            raise ValueError("商品 key 和图片地址必须唯一且符合目录约定")
        keys.add(key)
        images.add(image)
        if product.get("category") not in CATEGORIES:
            raise ValueError("目录商品必须使用约定的中文分类")
        if not isinstance(product.get("name"), str) or not product["name"].strip() or len(product["name"]) > 160:
            raise ValueError("商品名称无效")
        if not isinstance(product.get("description"), str):
            raise ValueError("商品描述无效")
        original, sale = valid_money(product.get("originalPrice")), valid_money(product.get("seckillPrice"))
        if sale > original:
            raise ValueError("目录抢购价不能高于原价")
        for field, maximum in (("totalStock", 1000000), ("limitPerUser", 10000)):
            quantity = product.get(field)
            if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= maximum:
                raise ValueError(f"{field} 必须为范围内的正整数")
        if product["limitPerUser"] > product["totalStock"]:
            raise ValueError("限购数量不能高于总库存")
    return catalog


def load_catalog(path=CATALOG_PATH):
    return validate_catalog(json.loads(Path(path).read_text(encoding="utf-8-sig")))


def marker(role):
    return f"[PEAKRUSH_CATALOG_V1:{role}]"


def marked(activity, role):
    return marker(role) in str(activity.get("description", "")).splitlines()


def role_candidates(activities, role, now):
    candidates = [activity for activity in activities
                  if marked(activity, role) and activity.get("status") in REUSABLE_STATUSES
                  and parse_time(activity["endTime"]) > now]
    if any(marked(activity, other) for activity in candidates for other in ROLES if other != role):
        raise CatalogConflictError("目录活动同时标记两个角色；请保留库存并在管理台检查")
    # Prefer an already running generation, then resume the latest draft generation.
    return sorted(candidates, key=lambda activity: (activity["status"] in ("RUNNING", "SOLD_OUT"), activity["id"]), reverse=True)


@contextlib.contextmanager
def exclusive_lock(path):
    """Keep the lock file; OS ownership ends when this handle closes."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("a+b")
    try:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise RuntimeError("另一个目录初始化进程正在运行，请稍后重试") from None
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    finally:
        handle.close()


async def read_items(api, path, admin):
    _, response = await api.call("GET", path, token=admin)
    return response["items"]


def product_matches(products, image):
    return sorted((product for product in products if product.get("imageUrl") == image), key=lambda product: product["id"])


async def seed_catalog(api, admin, catalog, now=None, report=None):
    validate_catalog(catalog)  # Validate every entry before the first API mutation.
    now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc)
    report = report if report is not None else {"products": [], "activities": []}
    report.setdefault("products", [])
    report.setdefault("activities", [])
    report["phase"] = "discover-products"
    existing = await read_items(api, "/api/admin/products", admin)
    products_by_key = {}
    for spec in catalog["products"]:
        report["phase"] = "product:" + spec["key"]
        matches = product_matches(existing, spec["imageUrl"])
        outcome = "reused"
        if matches:
            product = matches[0]
        else:
            body = {field: spec[field] for field in ("name", "description", "category", "imageUrl", "originalPrice")}
            try:
                _, product = await api.call("POST", "/api/admin/products", body, admin)
                outcome = "created"
            except Exception:
                # A timeout is not proof that INSERT failed. Discover before doing anything else.
                existing = await read_items(api, "/api/admin/products", admin)
                matches = product_matches(existing, spec["imageUrl"])
                if not matches:
                    raise
                product, outcome = matches[0], "rediscovered-after-uncertain-response"
            if not product_matches(existing, spec["imageUrl"]):
                existing.append(product)
        if product.get("category") != spec["category"]:
            # Fetch again immediately before the full-body update; the initial list
            # may already be stale after a human edited the administration screen.
            fresh_products = await read_items(api, "/api/admin/products", admin)
            fresh_product = next((fresh for fresh in fresh_products if fresh["id"] == product["id"]), None)
            if fresh_product is None or fresh_product.get("imageUrl") != spec["imageUrl"]:
                raise CatalogConflictError("商品已被管理员删除或更换图片，停止补分类以避免覆盖编辑")
            product = fresh_product
        if product.get("category") != spec["category"]:
            # The update API accepts a full product body, so preserve administrator edits.
            body = {field: product[field] for field in ("name", "description", "imageUrl", "originalPrice")}
            body["category"] = spec["category"]
            _, product = await api.call("PUT", f"/api/admin/products/{product['id']}", body, admin)
            outcome = "category-updated" if outcome == "reused" else outcome
        if product.get("category") != spec["category"]:
            raise CatalogConflictError("服务未保存目录分类；请先部署支持 category 的后端")
        products_by_key[spec["key"]] = product
        report["products"].append({"key": spec["key"], "id": product["id"], "name": product["name"], "category": product["category"], "imageUrl": product["imageUrl"], "originalPrice": product["originalPrice"], "outcome": outcome,
                                   "otherImageMatchIds": [match["id"] for match in matches[1:]]})

    report["phase"] = "discover-activities"
    activities = await read_items(api, "/api/admin/activities", admin)
    expected_ids = {product["id"] for product in products_by_key.values()}
    for role in ROLES:
        report["phase"] = "activity:" + role
        candidates = role_candidates(activities, role, now)
        outcome = "reused"
        if candidates:
            activity = candidates[0]
        else:
            name = "今日精选 · 九款好物" if role == "current" else "下一场精选 · 九款好物"
            starts = now - dt.timedelta(minutes=5) if role == "current" else now + dt.timedelta(hours=2)
            ends = now + dt.timedelta(hours=24 if role == "current" else 26)
            body = {"name": name, "description": "九款限时精选，让日常与热爱准点相遇。\n" + marker(role),
                    "startTime": starts.isoformat(), "endTime": ends.isoformat(), "architectureVersion": "V3",
                    "items": [{"productId": products_by_key[spec["key"]]["id"],
                               "seckillPrice": float(min(valid_money(spec["seckillPrice"]), valid_money(products_by_key[spec["key"]]["originalPrice"]))),
                               "totalStock": spec["totalStock"], "limitPerUser": spec["limitPerUser"]} for spec in catalog["products"]]}
            try:
                _, activity = await api.call("POST", "/api/admin/activities", body, admin)
                outcome = "created"
            except Exception:
                activities = await read_items(api, "/api/admin/activities", admin)
                candidates = role_candidates(activities, role, now)
                if not candidates:
                    raise
                activity, outcome = candidates[0], "rediscovered-after-uncertain-response"
            if not any(existing_activity["id"] == activity["id"] for existing_activity in activities):
                activities.append(activity)
        record = {"role": role, "id": activity["id"], "name": activity["name"], "marker": marker(role), "outcome": outcome,
                  "otherActiveRoleIds": [candidate["id"] for candidate in candidates[1:]]}
        report["activities"].append(record)
        update_activity_record(record, activity)
        if activity.get("architectureVersion") != "V3" or len(activity.get("items", [])) != len(expected_ids) or {item["productId"] for item in activity.get("items", [])} != expected_ids:
            raise CatalogConflictError("已标记的目录活动与九商品/V3约定不符；保留原库存，请在管理台检查")
        activity = await enable_activity(api, admin, activity, role, report, record)
        if activity["status"] not in ("RUNNING", "SOLD_OUT"):
            raise CatalogConflictError("目录活动未达到可展示的运行状态")
    report["phase"] = "complete"
    return report


def update_activity_record(record, activity):
    record.update({"status": activity["status"], "startTime": activity["startTime"], "endTime": activity["endTime"], "architectureVersion": activity["architectureVersion"],
                   "items": [{field: item.get(field) for field in ("id", "productId", "seckillPrice", "totalStock", "availableStock", "limitPerUser")} for item in activity["items"]]})


async def enable_activity(api, admin, activity, role, report, record):
    try:
        if activity["status"] in ("DRAFT", "PREHEATED"):
            report["phase"] = "activity:" + role + ":warmup"
            # PREHEATED can mean an earlier warmup stopped between items. The backend
            # treats a complete matching Redis workset as a no-op and refuses unsafe resets.
            _, activity = await api.call("POST", f"/api/admin/activities/{activity['id']}/warmup", {}, admin)
            update_activity_record(record, activity)
        if activity["status"] in ("PREHEATED", "RUNNING"):
            report["phase"] = "activity:" + role + ":activate"
            # Re-activation repairs enabled flags after an ambiguous partial response.
            _, activity = await api.call("POST", f"/api/admin/activities/{activity['id']}/activate", {}, admin)
            update_activity_record(record, activity)
        return activity
    except Exception:
        # A failing lifecycle call can already have changed the database status.
        record["observation"] = "last-successful-response; current-state-unconfirmed"
        try:
            fresh = await read_items(api, "/api/admin/activities", admin)
            latest = next((candidate for candidate in fresh if candidate["id"] == record["id"]), None)
            if latest is not None:
                update_activity_record(record, latest)
                record["observation"] = "refetched-after-lifecycle-error"
        except Exception:
            pass
        raise


def write_report(path, report):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f".tmp-{os.getpid()}")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


async def run(args):
    base = normalize_base(args.base)
    catalog = load_catalog(args.catalog)
    report = {"startedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "base": base, "catalogVersion": catalog["version"], "products": [], "activities": [], "passed": False, "phase": "login"}
    with exclusive_lock(ROOT / ".runtime" / "catalog-seed.lock"):
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as session:
                api = Api(session, base)
                admin = await api.login(os.environ.get("PEAKRUSH_ADMIN_USERNAME", "admin"), os.environ.get("PEAKRUSH_ADMIN_PASSWORD", "admin12345"))
                await seed_catalog(api, admin, catalog, report=report)
                report["passed"] = True
        except Exception as error:
            # Api.call errors include server responses. Do not persist or print those,
            # because an unexpected response could contain authentication material.
            report["error"] = {"type": type(error).__name__, "phase": report["phase"], "message": "目录初始化未完成；修复服务状态后重复执行，以服务端记录恢复。"}
        finally:
            report["completedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
            write_report(args.output, report)
    return report


def main():
    parser = argparse.ArgumentParser(description="创建或恢复 PeakRush 九商品目录活动，保留旧库存和历史活动")
    parser.add_argument("--base", default=os.environ.get("PEAKRUSH_API_BASE", "http://127.0.0.1:8080"))
    parser.add_argument("--catalog", type=Path, default=CATALOG_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        report = asyncio.run(run(args))
    except (ValueError, RuntimeError) as error:
        print(str(error))  # Only local validation/lock errors reach this path.
        return 1
    print(json.dumps({"passed": report["passed"], "phase": report["phase"], "productIds": [product["id"] for product in report["products"]], "activityIds": [activity["id"] for activity in report["activities"]], "report": str(args.output)}, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
