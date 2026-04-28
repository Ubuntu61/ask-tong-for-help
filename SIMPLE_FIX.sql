-- 🔧 最简单的修复：给所有角色完全权限
-- 直接在 Supabase SQL Editor 中运行

-- 删除旧策略
DROP POLICY IF EXISTS "open_all" ON public.driver_vehicle_assignments;

-- 禁用 RLS（最简单的方式，给所有人完全访问权限）
ALTER TABLE public.driver_vehicle_assignments DISABLE ROW LEVEL SECURITY;

-- 或者，如果你想保留 RLS，但给所有角色权限：
-- ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "open_all" ON public.driver_vehicle_assignments FOR ALL USING (true) WITH CHECK (true);

-- 授予所有权限给所有角色
GRANT ALL ON public.driver_vehicle_assignments TO postgres;
GRANT ALL ON public.driver_vehicle_assignments TO anon;
GRANT ALL ON public.driver_vehicle_assignments TO authenticated;
GRANT ALL ON public.driver_vehicle_assignments TO service_role;
GRANT ALL ON public.driver_vehicle_assignments TO supabase_admin;

-- 测试
SELECT COUNT(*) FROM public.driver_vehicle_assignments;

-- 如果成功，应该返回 0（因为表是空的）
