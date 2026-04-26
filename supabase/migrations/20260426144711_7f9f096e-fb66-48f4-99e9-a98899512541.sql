-- 枚举类型
CREATE TYPE public.user_role AS ENUM ('staff', 'driver');
CREATE TYPE public.order_type AS ENUM ('delivery', 'pickup', 'swap', 'material');
CREATE TYPE public.bin_size AS ENUM ('14', '20', '40');
CREATE TYPE public.time_window AS ENUM ('AM', 'PM', '7-9', 'custom');
CREATE TYPE public.order_status AS ENUM ('pending', 'assigned', 'in_progress', 'done', 'cancelled');
CREATE TYPE public.bin_status AS ENUM ('depot', 'in_transit', 'on_site', 'full');
CREATE TYPE public.vehicle_type AS ENUM ('HINO', 'MACK');
CREATE TYPE public.bin_event AS ENUM ('delivered', 'picked_up', 'swapped_out', 'swapped_in');
CREATE TYPE public.step_type AS ENUM ('depot_pickup', 'customer_delivery', 'customer_pickup', 'dump_site');
CREATE TYPE public.step_status AS ENUM ('locked', 'pending', 'in_progress', 'done');

-- 用户档案
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'driver',
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 车辆
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.vehicle_type NOT NULL,
  plate TEXT UNIQUE NOT NULL,
  samsara_id TEXT,
  max_bin_size public.bin_size,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 桶
CREATE TABLE public.bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_number TEXT UNIQUE NOT NULL,
  size public.bin_size NOT NULL,
  status public.bin_status DEFAULT 'depot',
  current_order_id UUID,
  current_address TEXT,
  last_moved_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 订单
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  type public.order_type NOT NULL,
  bin_size public.bin_size,
  service_date DATE NOT NULL,
  time_window public.time_window NOT NULL,
  time_window_custom TEXT,
  address TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_notes TEXT,
  status public.order_status DEFAULT 'pending',
  netsuite_order_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 排班
CREATE TABLE public.dispatch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.profiles(id) NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) NOT NULL,
  bin_id UUID REFERENCES public.bins(id),
  scheduled_date DATE NOT NULL,
  sequence INT NOT NULL DEFAULT 1,
  dispatch_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 任务步骤
CREATE TABLE public.job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.dispatch_assignments(id) ON DELETE CASCADE NOT NULL,
  step_number INT NOT NULL,
  step_type public.step_type NOT NULL,
  location TEXT NOT NULL,
  status public.step_status DEFAULT 'locked',
  requires_photo BOOLEAN DEFAULT true,
  requires_bin_number BOOLEAN DEFAULT false,
  requires_weigh_ticket BOOLEAN DEFAULT false,
  requires_weight BOOLEAN DEFAULT false,
  photo_url TEXT,
  bin_number_reported TEXT,
  old_bin_number_reported TEXT,
  weigh_ticket_url TEXT,
  weight_kg NUMERIC,
  dump_site TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 桶历史
CREATE TABLE public.bin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id UUID REFERENCES public.bins(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event public.bin_event NOT NULL,
  from_location TEXT,
  to_location TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bin_history ENABLE ROW LEVEL SECURITY;

-- 首版策略:全部公开读写(staff 端无登录,driver 端共享账号)
-- 上线前需要收紧
CREATE POLICY "open_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.bins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.dispatch_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.job_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.bin_history FOR ALL USING (true) WITH CHECK (true);

-- 自动生成订单号 KD-YYYYMMDD-XXX
CREATE OR REPLACE FUNCTION public.generate_order_number(svc_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  date_str TEXT;
  next_seq INT;
  new_number TEXT;
BEGIN
  date_str := to_char(svc_date, 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(split_part(order_number, '-', 3) AS INT)), 0) + 1
    INTO next_seq
  FROM public.orders
  WHERE order_number LIKE 'KD-' || date_str || '-%';
  new_number := 'KD-' || date_str || '-' || lpad(next_seq::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- 触发器:订单插入时自动填订单号
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number(NEW.service_date);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- 触发器:dispatch_assignment 创建后自动生成 job_steps
CREATE OR REPLACE FUNCTION public.create_job_steps_for_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  depot_addr TEXT := 'Kennedy Depot, 3445 Kennedy Rd';
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;

  IF o.type = 'delivery' THEN
    INSERT INTO public.job_steps (assignment_id, step_number, step_type, location, status, requires_photo, requires_bin_number)
    VALUES
      (NEW.id, 1, 'depot_pickup', depot_addr, 'pending', true, true),
      (NEW.id, 2, 'customer_delivery', o.address, 'locked', true, true);

  ELSIF o.type = 'pickup' THEN
    INSERT INTO public.job_steps (assignment_id, step_number, step_type, location, status, requires_photo, requires_bin_number, requires_weigh_ticket, requires_weight)
    VALUES
      (NEW.id, 1, 'customer_pickup', o.address, 'pending', true, true, false, false),
      (NEW.id, 2, 'dump_site', '垃圾场(司机填写)', 'locked', true, false, true, true);

  ELSIF o.type = 'swap' THEN
    INSERT INTO public.job_steps (assignment_id, step_number, step_type, location, status, requires_photo, requires_bin_number, requires_weigh_ticket, requires_weight)
    VALUES
      (NEW.id, 1, 'depot_pickup', depot_addr, 'pending', true, true, false, false),
      (NEW.id, 2, 'customer_delivery', o.address, 'locked', true, true, false, false),
      (NEW.id, 3, 'dump_site', '垃圾场(司机填写)', 'locked', true, false, true, true);

  ELSIF o.type = 'material' THEN
    INSERT INTO public.job_steps (assignment_id, step_number, step_type, location, status, requires_photo)
    VALUES
      (NEW.id, 1, 'depot_pickup', depot_addr, 'pending', true),
      (NEW.id, 2, 'customer_delivery', o.address, 'locked', true);
  END IF;

  -- 同步订单状态
  UPDATE public.orders SET status = 'assigned', updated_at = now() WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_create_steps
AFTER INSERT ON public.dispatch_assignments
FOR EACH ROW EXECUTE FUNCTION public.create_job_steps_for_assignment();

-- 步骤完成时联动:解锁下一步、更新订单状态、更新桶状态、写历史
CREATE OR REPLACE FUNCTION public.on_step_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asg public.dispatch_assignments%ROWTYPE;
  o public.orders%ROWTYPE;
  next_step UUID;
  remaining INT;
  bn TEXT;
  old_bn TEXT;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
    SELECT * INTO asg FROM public.dispatch_assignments WHERE id = NEW.assignment_id;
    SELECT * INTO o FROM public.orders WHERE id = asg.order_id;

    -- 解锁下一步
    SELECT id INTO next_step
    FROM public.job_steps
    WHERE assignment_id = NEW.assignment_id AND step_number = NEW.step_number + 1;
    IF next_step IS NOT NULL THEN
      UPDATE public.job_steps SET status = 'pending' WHERE id = next_step;
    END IF;

    -- 桶状态联动
    bn := NEW.bin_number_reported;
    old_bn := NEW.old_bin_number_reported;

    IF NEW.step_type = 'depot_pickup' AND bn IS NOT NULL THEN
      UPDATE public.bins
        SET status = 'in_transit', current_order_id = asg.order_id, last_moved_at = now()
        WHERE bin_number = bn;
    ELSIF NEW.step_type = 'customer_delivery' AND bn IS NOT NULL THEN
      UPDATE public.bins
        SET status = 'on_site', current_order_id = asg.order_id, current_address = o.address, last_moved_at = now()
        WHERE bin_number = bn;
      INSERT INTO public.bin_history (bin_id, order_id, event, from_location, to_location)
      SELECT id, asg.order_id, 'delivered', 'Kennedy Depot', o.address FROM public.bins WHERE bin_number = bn;

      -- swap:同时取走旧桶
      IF o.type = 'swap' AND old_bn IS NOT NULL THEN
        UPDATE public.bins
          SET status = 'in_transit', current_address = NULL, last_moved_at = now()
          WHERE bin_number = old_bn;
        INSERT INTO public.bin_history (bin_id, order_id, event, from_location, to_location)
        SELECT id, asg.order_id, 'swapped_out', o.address, 'In transit' FROM public.bins WHERE bin_number = old_bn;
      END IF;

    ELSIF NEW.step_type = 'customer_pickup' AND bn IS NOT NULL THEN
      UPDATE public.bins
        SET status = 'in_transit', current_address = NULL, last_moved_at = now()
        WHERE bin_number = bn;
      INSERT INTO public.bin_history (bin_id, order_id, event, from_location, to_location)
      SELECT id, asg.order_id, 'picked_up', o.address, 'In transit' FROM public.bins WHERE bin_number = bn;

    ELSIF NEW.step_type = 'dump_site' THEN
      -- 把这个 assignment 当前在路上的桶都归库
      UPDATE public.bins b
        SET status = 'depot', current_order_id = NULL, current_address = NULL, last_moved_at = now()
        WHERE b.current_order_id = asg.order_id AND b.status = 'in_transit';
    END IF;

    -- 检查订单是否完成
    SELECT COUNT(*) INTO remaining
      FROM public.job_steps
      WHERE assignment_id = NEW.assignment_id AND status <> 'done' AND id <> NEW.id;
    IF remaining = 0 THEN
      UPDATE public.orders SET status = 'done', updated_at = now() WHERE id = asg.order_id;
    ELSE
      UPDATE public.orders SET status = 'in_progress', updated_at = now() WHERE id = asg.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER job_steps_on_completed
BEFORE UPDATE ON public.job_steps
FOR EACH ROW EXECUTE FUNCTION public.on_step_completed();

-- 创建 storage bucket 用于司机上传照片和磅单
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-uploads', 'driver-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "uploads_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'driver-uploads');
CREATE POLICY "uploads_anyone_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'driver-uploads');
CREATE POLICY "uploads_anyone_update" ON storage.objects FOR UPDATE USING (bucket_id = 'driver-uploads');