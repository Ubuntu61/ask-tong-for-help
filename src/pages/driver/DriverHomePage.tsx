import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, CheckCircle2, ArrowRight, LogOut, Truck } from "lucide-react";
import { STEP_TYPE_EMOJI, STEP_TYPE_LABEL, todayISO, typeMeta } from "@/lib/business";
import { cn } from "@/lib/utils";

type StepRow = {
  id: string;
  step_number: number;
  step_type: string;
  location: string;
  status: string;
  assignment_id: string;
  dispatch_assignments: {
    sequence: number;
    driver_id: string;
    orders: { order_number: string; type: string; bin_size: string | null; customer_name: string; customer_notes: string | null };
    profiles: { id: string; name: string };
  };
};

export function DriverHomePage() {
  const nav = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [authReady, setAuthReady] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/driver/login" });
      else setAuthReady(true);
    });
  }, [nav]);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    enabled: authReady,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").eq("role", "driver").eq("is_active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (drivers.length > 0 && !selectedDriverId) {
      const stored = localStorage.getItem("driver_active_id");
      setSelectedDriverId(stored && drivers.find((d) => d.id === stored) ? stored : drivers[0].id);
    }
  }, [drivers, selectedDriverId]);

  useEffect(() => {
    if (selectedDriverId) localStorage.setItem("driver_active_id", selectedDriverId);
  }, [selectedDriverId]);

  const { data: steps = [], refetch } = useQuery({
    queryKey: ["driver-steps", selectedDriverId, date],
    enabled: !!selectedDriverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_steps")
        .select("*, dispatch_assignments!inner(sequence, driver_id, orders(*), profiles(id,name))")
        .eq("dispatch_assignments.driver_id", selectedDriverId)
        .eq("dispatch_assignments.scheduled_date", date)
        .order("step_number");
      if (error) throw error;
      // 按 assignment.sequence 然后 step_number 排序
      return ((data ?? []) as unknown as StepRow[]).sort((a, b) => {
        const sa = a.dispatch_assignments.sequence;
        const sb = b.dispatch_assignments.sequence;
        if (sa !== sb) return sa - sb;
        return a.step_number - b.step_number;
      });
    },
  });

  const doneCount = useMemo(() => steps.filter((s) => s.status === "done").length, [steps]);
  const total = steps.length;

  const handleLogout = async () => { await supabase.auth.signOut(); nav({ to: "/driver/login" }); };

  if (!authReady) return null;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center gap-3">
        <Truck className="h-5 w-5" />
        <div className="flex-1">
          <div className="text-sm font-bold">司机端</div>
          <div className="text-[11px] opacity-80">Kennedy Depot</div>
        </div>
        <Button size="icon" variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="px-4 pt-4 space-y-3">
        <div className="bg-card rounded-lg border p-3 flex gap-2 items-center">
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger className="flex-1 h-11"><SelectValue placeholder="选择司机" /></SelectTrigger>
            <SelectContent>
              {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="h-11 px-3 rounded-md border bg-background text-sm" />
        </div>

        <div className="bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">今日步骤进度</div>
            <div className="text-3xl font-bold mt-1">{doneCount} <span className="text-base opacity-80">/ {total}</span></div>
          </div>
          {total > 0 && doneCount === total && <CheckCircle2 className="h-10 w-10" />}
        </div>

        {total === 0 && (
          <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">
            今天没有分配的步骤
          </div>
        )}

        {steps.map((s) => {
          const tm = typeMeta(s.dispatch_assignments.orders.type);
          const isDone = s.status === "done";
          const isLocked = s.status === "locked";
          const isPending = s.status === "pending" || s.status === "in_progress";
          return (
            <div key={s.id}
              className={cn(
                "rounded-xl border bg-card overflow-hidden transition-all",
                isPending && "border-primary border-2 shadow-md",
                isDone && "opacity-70",
              )}
            >
              <div className="p-3 flex items-start gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full font-bold flex items-center justify-center shrink-0",
                  isDone ? "bg-status-done text-primary-foreground" :
                  isLocked ? "bg-muted text-muted-foreground" :
                  "bg-primary text-primary-foreground",
                )}>
                  {isLocked ? <Lock className="h-4 w-4" /> : isDone ? <CheckCircle2 className="h-5 w-5" /> : s.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-[10px]", tm.className)}>{tm.label}</Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">{s.dispatch_assignments.orders.order_number}</span>
                  </div>
                  <div className="text-sm font-semibold mt-1">{STEP_TYPE_EMOJI[s.step_type]} {STEP_TYPE_LABEL[s.step_type]}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{s.location}</div>
                  {s.dispatch_assignments.orders.customer_notes && isPending && (
                    <div className="mt-2 text-xs bg-status-progress/15 text-status-progress rounded px-2 py-1">
                      📝 {s.dispatch_assignments.orders.customer_notes}
                    </div>
                  )}
                </div>
              </div>
              {isPending && (
                <Link to="/driver/step/$stepId" params={{ stepId: s.id }}
                  className="block bg-primary text-primary-foreground text-center py-3 font-semibold text-sm">
                  开始 <ArrowRight className="inline h-4 w-4 ml-1" />
                </Link>
              )}
            </div>
          );
        })}

        <button className="text-xs text-muted-foreground w-full text-center pt-2" onClick={() => refetch()}>
          ↻ 刷新
        </button>
      </div>
    </div>
  );
}
