import type { Activity, Item } from "./types";

export const PRODUCT_CATEGORIES = [
  "数码影音",
  "居家生活",
  "运动户外",
  "旅行出行",
  "其他好物",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type ActivityPhase = "正在进行" | "即将开始" | "暂时售罄" | "已结束" | "已下线";
export interface CatalogRow { activity: Activity; item: Item }

export function activityPhase(activity: Activity, now: number): ActivityPhase {
  if (activity.status === "OFFLINE" || activity.status === "DRAFT") return "已下线";
  const start = Date.parse(activity.startTime), end = Date.parse(activity.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || now >= end || activity.status === "ENDED") return "已结束";
  if (now < start || activity.status === "PREHEATED") return "即将开始";
  if (activity.status === "SOLD_OUT") return "暂时售罄";
  return activity.status === "RUNNING" ? "正在进行" : "已下线";
}

export function isCurrentOrFuture(activity: Activity, now: number): boolean {
  return ["正在进行", "即将开始", "暂时售罄"].includes(activityPhase(activity, now));
}

export function sortActivities(activities: Activity[], now: number): Activity[] {
  const rank: Record<ActivityPhase, number> = { 正在进行: 0, 暂时售罄: 1, 即将开始: 2, 已结束: 3, 已下线: 4 };
  return [...activities].sort((a, b) => {
    const aPhase = activityPhase(a, now), bPhase = activityPhase(b, now);
    const difference = rank[aPhase] - rank[bPhase];
    if (difference) return difference;
    const timeDifference = Date.parse(a.startTime) - Date.parse(b.startTime);
    return (isCurrentOrFuture(a, now) ? timeDifference : -timeDifference) || b.id - a.id;
  });
}

export function chooseActivity(activities: Activity[], selectedId: number | null, now: number, preserveHistory = false): Activity | undefined {
  const previous = activities.find(activity => activity.id === selectedId);
  if (previous && (preserveHistory || isCurrentOrFuture(previous, now))) return previous;
  const sorted = sortActivities(activities, now);
  return sorted.find(activity => activityPhase(activity, now) === "正在进行")
    || sorted.find(activity => activityPhase(activity, now) === "即将开始")
    || sorted[0];
}

export function catalogRows(activities: Activity[], selectedId: number | null, browseAll: boolean, now: number): CatalogRow[] {
  const shown = browseAll
    ? sortActivities(activities, now).filter(activity => isCurrentOrFuture(activity, now))
    : activities.filter(activity => activity.id === selectedId);
  const rows = shown.flatMap(activity => (activity.items || []).map(item => ({ activity, item })));
  if (!browseAll) return rows;
  const offers = new Map<number, CatalogRow>();
  const priority = ({ activity, item }: CatalogRow) => {
    const phase = activityPhase(activity, now);
    if (phase === "正在进行" && item.availableStock !== 0) return 0;
    if (phase === "即将开始") return 1;
    return 2;
  };
  for (const row of rows) {
    const previous = offers.get(row.item.productId);
    if (!previous || priority(row) < priority(previous)) offers.set(row.item.productId, row);
  }
  return [...offers.values()];
}

export function productCategory(product: { category?: string | null }): ProductCategory {
  const category = product.category?.trim();
  return PRODUCT_CATEGORIES.find(value => value === category) || "其他好物";
}

export function catalogCategories(rows: CatalogRow[]): { name: string; count: number }[] {
  return [
    { name: "全部好物", count: rows.length },
    ...PRODUCT_CATEGORIES.map(name => ({ name, count: rows.filter(({ item }) => productCategory(item) === name).length })).filter(category => category.count > 0),
  ];
}

export function activityCountdown(activity: Activity, now: number): string[] | null {
  const phase = activityPhase(activity, now);
  if (!isCurrentOrFuture(activity, now)) return null;
  const target = Date.parse(phase === "即将开始" ? activity.startTime : activity.endTime);
  if (phase === "即将开始" && target <= now) return null;
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(number => String(number).padStart(2, "0"));
}

export function productKicker(product: { category?: string | null }): string {
  const category = productCategory(product);
  const copy: Record<ProductCategory, string> = {
    数码影音: "灵感随行 · 记录热爱",
    居家生活: "舒适日常 · 点亮生活",
    运动户外: "轻装出发 · 探索自在",
    旅行出行: "从容收纳 · 奔赴远方",
    其他好物: "限时精选 · 如期心动",
  };
  return category + " · " + copy[category];
}
