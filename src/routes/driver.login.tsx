import { createFileRoute } from "@tanstack/react-router";
import { DriverLoginPage } from "@/pages/driver/DriverLoginPage";

export const Route = createFileRoute("/driver/login")({
  head: () => ({
    meta: [{ title: "登录 — 司机端" }],
    links: [{ rel: "manifest", href: "/driver-manifest.json" }]
  }),
  component: DriverLoginPage,
});
