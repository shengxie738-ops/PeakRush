export interface User {
  id: number;
  username: string;
  role: string;
}
export interface Product {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  originalPrice: number;
}
export interface Item {
  id: number;
  productId: number;
  name: string;
  description: string;
  imageUrl: string;
  originalPrice: number;
  seckillPrice: number;
  totalStock: number;
  availableStock: number | null;
  limitPerUser: number;
}
export interface Activity {
  id: number;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  status: string;
  architectureVersion: string;
  items: Item[];
}
export interface PurchaseResult {
  requestId: string;
  status:
    | "PENDING"
    | "SUCCESS"
    | "SOLD_OUT"
    | "FAILED"
    | "CLOSED"
    | "CANCELLED";
  orderId?: number;
  message?: string;
  orderStatus?: string;
}
export interface Order {
  id: number;
  requestId: string;
  activityId: number;
  itemId: number;
  productName: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  expireTime: string;
  paidAt?: string;
}
export interface ListResponse<T> {
  items: T[];
  total: number;
}
export interface DeadLetter {
  id: number;
  requestId: string;
  reason: string;
  status: string;
  attempts: number;
  createdAt: string;
}
export interface Experiment {
  id: number;
  name: string;
  architectureVersion: string;
  concurrency: number;
  durationSeconds: number;
  stock: number;
  notes?: string;
  createdAt?: string;
  results?: unknown;
}
export interface Metrics {
  requests: number | null;
  successes: number | null;
  failures: number | null;
  pending: number | null;
  orders: number | null;
  paidOrders: number | null;
  dbAvailableStock: number | null;
  redisAvailableStock: number | null;
  outboxPending: number | null;
  deadLetters: number | null;
  latencyP95Ms: number | null;
  kafkaLag: number | null;
  versions: Record<string, unknown>[];
}
