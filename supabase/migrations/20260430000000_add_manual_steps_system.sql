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
  ('Sheppard Yard', '12441 Sheppard Ave, Toronto, ON', 'depot');

-- 创建动作类型枚举
CREATE TYPE public.step_action AS ENUM ('pickup_bin', 'drop_bin', 'dump_waste', 'load_material', 'unload_material');

-- 修改 dispatch_assignments 表，添加 sequence 字段（如果还没有）
ALTER TABLE public.dispatch_assignments 
ADD COLUMN IF NOT EXISTS sequence INT NOT NULL DEFAULT 1;

-- 创建统一的任务节点表（包含订单节点和步骤节点）
CREATE TABLE IF NOT EXISTS public.task_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.dispatch_assignments(id) ON DELETE CASCADE NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('order', 'step')), -- 'order' 或 'step'
  sequence INT NOT NULL, -- 在司机任务中的顺序
  
  -- 订单节点字段（node_type = 'order'）
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- 步骤节点字段（node_type = 'step'）
  location TEXT, -- 地点名称或地址
  action public.step_action, -- 动作类型
  bin_number TEXT, -- 桶号（可选）
  notes TEXT, -- 备注
  
  -- 执行状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'skipped')),
  photo_url TEXT,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_nodes_assignment ON public.task_nodes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_task_nodes_sequence ON public.task_nodes(assignment_id, sequence);

-- 添加注释
COMMENT ON TABLE public.task_nodes IS '统一的任务节点表，包含订单节点和手动步骤节点';
COMMENT ON COLUMN public.task_nodes.node_type IS '节点类型：order(订单节点) 或 step(步骤节点)';
COMMENT ON COLUMN public.task_nodes.sequence IS '在司机任务列表中的执行顺序';

-- RLS 策略
ALTER TABLE public.task_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON public.task_nodes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for anon users" ON public.task_nodes
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 常用地点表的 RLS
ALTER TABLE public.common_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all users" ON public.common_locations
  FOR SELECT USING (true);

CREATE POLICY "Enable all for authenticated users" ON public.common_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
