import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/pages/FleetPage";

export const Route = createFileRoute("/_staff/fleet")({
  head: () => ({ meta: [{ title: "司机与车辆 — Kennedy Depot" }] }),
  component: FleetPage,
});
