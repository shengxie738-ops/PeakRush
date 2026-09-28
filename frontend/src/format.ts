export const money = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
export const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "—";
export const timeOnly = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
export const orderLabel: Record<string, string> = {
  CREATED: "待付款",
  PAID: "已支付",
  CANCELLED: "已取消",
  CLOSED: "已关闭",
};
export const activityLabel: Record<string, string> = {
  DRAFT: "草稿",
  PREHEATED: "已预热",
  RUNNING: "正在进行",
  SOLD_OUT: "暂时售罄",
  ENDED: "已结束",
  OFFLINE: "已下线",
};
export function productImage(url?: string) {
  return url || "/assets/product-earbuds.png";
}
