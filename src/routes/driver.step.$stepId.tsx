import { createFileRoute } from "@tanstack/react-router";
import { DriverStepPage } from "@/pages/driver/DriverStepPage";

export const Route = createFileRoute("/driver/step/$stepId")({
  head: () => ({ meta: [{ title: "执行步骤 — 司机端" }] }),
  component: DriverStepPage,
});
