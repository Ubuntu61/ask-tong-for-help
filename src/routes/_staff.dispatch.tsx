import { createFileRoute } from "@tanstack/react-router";
import { DispatchPage } from "@/pages/DispatchPage";

export const Route = createFileRoute("/_staff/dispatch")({
  head: () => ({ meta: [{ title: "排班看板 — Kennedy Depot" }] }),
  component: DispatchPage,
});
