import { createFileRoute } from "@tanstack/react-router";
import { BinsPage } from "@/pages/BinsPage";

export const Route = createFileRoute("/_staff/bins")({
  head: () => ({ meta: [{ title: "桶库存 — Kennedy Depot" }] }),
  component: BinsPage,
});
