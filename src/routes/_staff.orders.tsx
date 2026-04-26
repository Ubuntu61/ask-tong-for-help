import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/pages/OrdersPage";

export const Route = createFileRoute("/_staff/orders")({
  head: () => ({ meta: [{ title: "订单管理 — Kennedy Depot" }] }),
  component: OrdersPage,
});
