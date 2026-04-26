// 业务常量与展示工具

export const ORDER_TYPES = [
  { value: "delivery", label: "送桶", emoji: "🟢", className: "bg-type-delivery text-type-delivery-foreground" },
  { value: "pickup", label: "收桶", emoji: "🔴", className: "bg-type-pickup text-type-pickup-foreground" },
  { value: "swap", label: "换桶", emoji: "🔵", className: "bg-type-swap text-type-swap-foreground" },
  { value: "material", label: "砂石料", emoji: "🟡", className: "bg-type-material text-type-material-foreground" },
] as const;

export const BIN_SIZES = ["14", "20", "40"] as const;

export const TIME_WINDOWS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
  { value: "7-9", label: "7-9" },
  { value: "custom", label: "自定义" },
] as const;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待排班",
  assigned: "已排班",
  in_progress: "进行中",
  done: "已完成",
  cancelled: "已取消",
};

export const ORDER_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  assigned: "bg-status-assigned/15 text-status-assigned border border-status-assigned/30",
  in_progress: "bg-status-progress/15 text-status-progress border border-status-progress/30",
  done: "bg-status-done/15 text-status-done border border-status-done/30",
  cancelled: "bg-status-cancelled/15 text-status-cancelled border border-status-cancelled/30",
};

export const STEP_TYPE_LABEL: Record<string, string> = {
  depot_pickup: "去 Depot 取桶",
  customer_delivery: "送到客户",
  customer_pickup: "去客户取桶",
  dump_site: "去垃圾场倒垃圾",
};

export const STEP_TYPE_EMOJI: Record<string, string> = {
  depot_pickup: "🏭",
  customer_delivery: "📦",
  customer_pickup: "📥",
  dump_site: "♻️",
};

export function typeMeta(type: string) {
  return ORDER_TYPES.find((t) => t.value === type) ?? ORDER_TYPES[0];
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// HINO 不能拉 40yd
export function vehicleCanCarry(vehicleType: "HINO" | "MACK", binSize: string | null | undefined): boolean {
  if (!binSize) return true;
  if (vehicleType === "HINO" && binSize === "40") return false;
  return true;
}
