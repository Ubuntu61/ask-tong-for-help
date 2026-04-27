import { createFileRoute } from "@tanstack/react-router";
import { DriverHomePage } from "@/pages/driver/DriverHomePage";

export const Route = createFileRoute("/driver/")({
  head: () => ({
    meta: [{ title: "司机端 — Kennedy Depot" }],
    links: [{ rel: "manifest", href: "/driver-manifest.json" }]
  }),
  component: DriverHomePage,
});
