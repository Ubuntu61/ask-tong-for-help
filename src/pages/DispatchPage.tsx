import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, AlertTriangle, Trash2 } from "lucide-react";
import { todayISO, typeMeta, vehicleCanCarry, ORDER_STATUS_LABEL } from "@/lib/business";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";

type Order = {
  id: string;
  order_number: string;
  type: string;
  bin_size: string | null;
  service_date: string;
  time_window: string;
  time_window_custom: string | null;
  address: string;
  customer_name: string;
  customer_notes: string | null;
  status: string;
};

type Profile = { id: string; name: string };
type Vehicle = { id: string; name: string; type: "HINO" | "MACK"; max_bin_size: string | null };
type Bin = { id: string; bin_number: string; size: string; status: string };
type Assignment = {
  id: string;
  order_id: string;
  driver_id: string;
  vehicle_id: string;
  bin_id: string | null;
  scheduled_date: string;
  sequence: number;
  orders: Order;
  vehicles: Vehicle;
  bins: Bin | null;
};

export function DispatchPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [assigningOrder, setAssigningOrder] = useState<{ order: Order; driverId: string } | null>(null);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").eq("role", "driver").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Vehicle[];
    },
  });
  const { data: bins = [] } = useQuery({
    queryKey: ["bins-depot"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bins").select("*").eq("status", "depot").eq("is_active", true).order("bin_number");
      if (error) throw error;
      return data as Bin[];
    },
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["dispatch-orders", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("service_date", date)
        .neq("status", "cancelled")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["dispatch-assignments", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_assignments")
        .select("*, orders(*), vehicles(*), bins(*)")
        .eq("scheduled_date", date)
        .order("sequence");
      if (error) throw error;
      return (data ?? []) as unknown as Assignment[];
    },
  });

  const assignedOrderIds = useMemo(() => new Set(assignments.map((a) => a.order_id)), [assignments]);
  const unassigned = useMemo(() => orders.filter((o) => !assignedOrderIds.has(o.id)), [orders, assignedOrderIds]);

  const driverAssignments = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    drivers.forEach((d) => map.set(d.id, []));
    assignments.forEach((a) => {
      const arr = map.get(a.driver_id) ?? [];
      arr.push(a);
      map.set(a.driver_id, arr);
    });
    return map;
  }, [assignments, drivers]);

  // 默认每个司机的车辆(本地状态,assign 时使用)
  const [driverVehicle, setDriverVehicle] = useState<Record<string, string>>({});
  const getDriverVehicle = (driverId: string) =>
    driverVehicle[driverId] ?? vehicles[0]?.id ?? "";

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dispatch_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("已取消分配");
      // 重置订单状态
      qc.invalidateQueries({ queryKey: ["dispatch-assignments", date] });
      qc.invalidateQueries({ queryKey: ["dispatch-orders", date] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const orderId = e.active.id as string;
    const driverId = e.over?.id as string | undefined;
    if (!driverId) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    setAssigningOrder({ order, driverId });
  };

  return (
    <div className="p-4 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">排班看板</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1);
            setDate(d.toISOString().slice(0, 10));
          }}><ChevronLeft className="h-4 w-4" /></Button>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border bg-background text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => setDate(todayISO())}>今天</Button>
          <Button variant="outline" size="icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1);
            setDate(d.toISOString().slice(0, 10));
          }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex-1 grid grid-cols-[280px_1fr] gap-4 overflow-hidden">
          {/* 左侧 待分配 */}
          <div className="bg-card border rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">待排班</span>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {unassigned.map((o) => <DraggableOrderCard key={o.id} order={o} />)}
              {unassigned.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">全部已排班 🎉</div>
              )}
            </div>
          </div>

          {/* 右侧 司机泳道 */}
          <div className="bg-card border rounded-lg overflow-y-auto">
            {drivers.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">尚无司机,请到车队页添加。</div>
            )}
            <div className="divide-y">
              {drivers.map((d) => {
                const list = driverAssignments.get(d.id) ?? [];
                return (
                  <DriverLane
                    key={d.id}
                    driver={d}
                    vehicles={vehicles}
                    selectedVehicleId={getDriverVehicle(d.id)}
                    onChangeVehicle={(v) => setDriverVehicle((prev) => ({ ...prev, [d.id]: v }))}
                    assignments={list}
                    onRemove={(id) => removeAssignment.mutate(id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>

      {assigningOrder && (
        <AssignDialog
          order={assigningOrder.order}
          driverId={assigningOrder.driverId}
          drivers={drivers}
          vehicles={vehicles}
          bins={bins}
          date={date}
          defaultVehicleId={getDriverVehicle(assigningOrder.driverId)}
          existingCountByDriver={(id) => (driverAssignments.get(id) ?? []).length}
          onClose={() => setAssigningOrder(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["dispatch-assignments", date] });
            qc.invalidateQueries({ queryKey: ["dispatch-orders", date] });
            qc.invalidateQueries({ queryKey: ["bins-depot"] });
            qc.invalidateQueries({ queryKey: ["orders"] });
            setAssigningOrder(null);
          }}
        />
      )}
    </div>
  );
}

function DraggableOrderCard({ order }: { order: Order }) {
  const tm = typeMeta(order.type);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      className={cn(
        "rounded-md border bg-background p-3 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn("w-1 self-stretch rounded-full", `bg-type-${order.type}`)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-xs">
            <Badge className={cn("text-[10px]", tm.className)}>{tm.label}</Badge>
            {order.bin_size && <span className="text-muted-foreground">{order.bin_size}yd</span>}
          </div>
          <div className="text-xs mt-1 truncate font-medium">{order.address}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{order.time_window === "custom" ? order.time_window_custom : order.time_window} · {order.customer_name}</div>
          {order.customer_notes && <div className="text-[11px] mt-1 text-status-progress truncate">📝 {order.customer_notes}</div>}
        </div>
      </div>
    </div>
  );
}

function DriverLane({
  driver, vehicles, selectedVehicleId, onChangeVehicle, assignments, onRemove,
}: {
  driver: Profile; vehicles: Vehicle[]; selectedVehicleId: string;
  onChangeVehicle: (id: string) => void;
  assignments: Assignment[]; onRemove: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: driver.id });
  return (
    <div ref={setNodeRef} className={cn("flex items-stretch min-h-[110px] transition-colors", isOver && "bg-primary/5")}>
      <div className="w-44 shrink-0 p-3 border-r bg-muted/30">
        <div className="font-semibold text-sm">{driver.name}</div>
        <Select value={selectedVehicleId} onValueChange={onChangeVehicle}>
          <SelectTrigger className="h-8 mt-2 text-xs"><SelectValue placeholder="选车辆" /></SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name} ({v.type})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-[10px] text-muted-foreground mt-2">{assignments.length} 单</div>
      </div>
      <div className="flex-1 p-2 flex flex-wrap gap-2 items-start">
        {assignments.map((a) => {
          const tm = typeMeta(a.orders.type);
          const conflict = !vehicleCanCarry(a.vehicles.type, a.orders.bin_size);
          return (
            <div key={a.id}
              className={cn("rounded-md px-3 py-2 text-xs min-w-[160px] max-w-[220px] shadow-sm group relative",
                tm.className,
                conflict && "ring-2 ring-destructive")}
              title={`${a.orders.order_number} ${a.orders.address}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{tm.emoji} {a.orders.bin_size && `${a.orders.bin_size}yd`}</span>
                <span className="text-[10px] opacity-80">{a.orders.time_window === "custom" ? a.orders.time_window_custom : a.orders.time_window}</span>
              </div>
              <div className="truncate font-medium mt-0.5">{a.orders.address}</div>
              <div className="truncate text-[10px] opacity-90">{a.orders.customer_name}</div>
              {a.bins?.bin_number && <div className="text-[10px] opacity-90 mt-0.5">桶: {a.bins.bin_number}</div>}
              {conflict && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  <AlertTriangle className="h-3 w-3" /> {a.vehicles.type} 不支持 {a.orders.bin_size}yd
                </div>
              )}
              <button
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-background/80 text-foreground rounded p-0.5"
                onClick={() => { if (confirm(`取消分配 ${a.orders.order_number}?`)) onRemove(a.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <div className="text-[10px] mt-1 opacity-80">{ORDER_STATUS_LABEL[a.orders.status]}</div>
            </div>
          );
        })}
        {assignments.length === 0 && (
          <div className="text-xs text-muted-foreground self-center mx-auto">拖订单到这里</div>
        )}
      </div>
    </div>
  );
}

function AssignDialog({
  order, driverId, drivers, vehicles, bins, date, defaultVehicleId, existingCountByDriver, onClose, onDone,
}: {
  order: Order; driverId: string; drivers: Profile[]; vehicles: Vehicle[]; bins: Bin[];
  date: string; defaultVehicleId: string;
  existingCountByDriver: (id: string) => number;
  onClose: () => void; onDone: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || vehicles[0]?.id || "");
  const [binId, setBinId] = useState<string>("");
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const conflict = vehicle && !vehicleCanCarry(vehicle.type, order.bin_size);
  const driver = drivers.find((d) => d.id === driverId);

  const needsBin = order.type === "delivery" || order.type === "swap";
  const matchingBins = bins.filter((b) => b.size === order.bin_size);

  const save = useMutation({
    mutationFn: async () => {
      const seq = existingCountByDriver(driverId) + 1;
      const { error } = await supabase.from("dispatch_assignments").insert({
        order_id: order.id,
        driver_id: driverId,
        vehicle_id: vehicleId,
        bin_id: binId || null,
        scheduled_date: date,
        sequence: seq,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已分配,步骤自动生成"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>分配订单 {order.order_number}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md bg-muted p-3 space-y-1">
            <div><b>司机:</b> {driver?.name}</div>
            <div><b>类型:</b> {typeMeta(order.type).label} {order.bin_size && `· ${order.bin_size}yd`}</div>
            <div><b>地址:</b> {order.address}</div>
          </div>
          <div>
            <Label>车辆</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name} ({v.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {conflict && (
              <div className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" /> {vehicle!.type} 不支持 {order.bin_size}yd 桶
              </div>
            )}
          </div>
          {needsBin && (
            <div>
              <Label>指定桶 (可选,司机也可临时选)</Label>
              <Select value={binId || "none"} onValueChange={(v) => setBinId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="不指定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {matchingBins.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.bin_number} ({b.size}yd, {b.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>确认分配</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
