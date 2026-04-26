import { createFileRoute } from "@tanstack/react-router";
import { StaffLayout } from "@/components/StaffLayout";

export const Route = createFileRoute("/_staff")({
  component: StaffLayout,
});
