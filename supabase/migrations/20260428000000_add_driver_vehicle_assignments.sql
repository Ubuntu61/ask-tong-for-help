-- 司机车辆分配表
CREATE TABLE public.driver_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  UNIQUE(driver_id, vehicle_id)
);

CREATE INDEX idx_driver_vehicle_driver ON public.driver_vehicle_assignments(driver_id);
CREATE INDEX idx_driver_vehicle_vehicle ON public.driver_vehicle_assignments(vehicle_id);

ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.driver_vehicle_assignments FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.driver_vehicle_assignments IS '司机车辆分配关系表';
