-- 添加手动步骤系统支持

-- 创建常用地点表
CREATE TABLE IF NOT EXISTS public.common_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  type TEXT, -- 'depot', 'material_yard', 'other'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 插入常用地点
INSERT INTO public.common_locations (name, address, type) VALUES
  ('Kennedy Depot', '3445 Kennedy Rd, Toronto, ON', 'depot'),
  ('Sheppard Yard', '12441 Sheppard Ave, Toronto, ON', 'depot')
ON CONFLICT DO NOTHING;

-- 创建动作类型枚举（如果不存在）
DO $$ BEGIN
  CREATE TYPE public.step_action AS ENUM (
    'pickup_bin',      -- 取桶
    'drop_bin',        -- 放桶
    'dump_waste',      -- 倒垃圾
    'load_material',   -- 装料
    'unload_material'  -- 卸料
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 调整 job_steps 表结构，支持两种节点
-- 1. 添加 driver_id 和 scheduled_date（必填）
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- 2. 将 assignment_id 改为可选
ALTER TABLE public.job_steps 
ALTER COLUMN assignment_id DROP NOT NULL;

-- 3. 添加 order_id（可选，订单节点才有）
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- 4. 修改 action 字段类型（如果需要）
-- 先检查是否已经是 TEXT 类型
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_steps' 
    AND column_name = 'action' 
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.job_steps ALTER COLUMN action TYPE TEXT;
  END IF;
END $$;

-- 5. 添加节点类型标识（可选，用于区分）
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS node_type TEXT CHECK (node_type IN ('order', 'step')) DEFAULT 'step';

-- 6. 添加备注字段
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 7. 确保 step_number 存在
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS step_number INT;

-- 8. 添加 bin_number_reported 字段（司机报告的桶号）
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS bin_number_reported TEXT;

-- 9. 添加称重单和重量字段
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS weigh_ticket_url TEXT,
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL;

-- 10. 添加要求字段
ALTER TABLE public.job_steps 
ADD COLUMN IF NOT EXISTS requires_photo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_bin_number BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_weigh_ticket BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_weight BOOLEAN DEFAULT false;

-- 更新现有数据：为已有的 job_steps 填充 driver_id 和 scheduled_date
UPDATE public.job_steps js
SET 
  driver_id = da.driver_id,
  scheduled_date = da.scheduled_date,
  order_id = da.order_id,
  node_type = 'order'
FROM public.dispatch_assignments da
WHERE js.assignment_id = da.id
  AND js.driver_id IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_job_steps_driver_date ON public.job_steps(driver_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_job_steps_order ON public.job_steps(order_id);
CREATE INDEX IF NOT EXISTS idx_job_steps_sequence ON public.job_steps(driver_id, scheduled_date, step_number);

-- 添加注释
COMMENT ON TABLE public.job_steps IS '统一的任务步骤表，包含订单节点和手动步骤节点';
COMMENT ON COLUMN public.job_steps.driver_id IS '必填，属于哪个司机';
COMMENT ON COLUMN public.job_steps.scheduled_date IS '必填，哪天执行';
COMMENT ON COLUMN public.job_steps.step_number IS '必填，执行顺序';
COMMENT ON COLUMN public.job_steps.order_id IS '可选，订单节点才有';
COMMENT ON COLUMN public.job_steps.assignment_id IS '可选，订单节点才有';
COMMENT ON COLUMN public.job_steps.node_type IS '节点类型：order(订单节点) 或 step(手动步骤)';
COMMENT ON COLUMN public.job_steps.action IS '动作类型：pickup_bin, drop_bin, dump_waste, load_material, unload_material';
COMMENT ON COLUMN public.job_steps.bin_number_reported IS '司机报告的桶号';
COMMENT ON COLUMN public.job_steps.weigh_ticket_url IS '称重单照片URL';
COMMENT ON COLUMN public.job_steps.weight_kg IS '重量（公斤）';

-- 常用地点表的 RLS
ALTER TABLE public.common_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all users" ON public.common_locations
  FOR SELECT USING (true);

CREATE POLICY "Enable all for authenticated users" ON public.common_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

