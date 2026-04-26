import { createFileRoute } from "@tanstack/react-router";
import { CreateOrderPage } from "@/pages/CreateOrderPage";

export const Route = createFileRoute("/_staff/")({
  head: () => ({ meta: [{ title: "下单 — Kennedy Depot" }] }),
  component: CreateOrderPage,
});
