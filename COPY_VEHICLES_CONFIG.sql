-- 🔧 完全复制 vehicles 表的权限配置到 driver_vehicle_assignments
-- 因为 vehicles 表是正常工作的，我们直接复制它的配置

-- ========== 第一步：删除旧策略 ==========
DROP POLICY IF EXISTS "open_all" ON public.driver_vehicle_assignments;
DROP POLICY IF EXISTS "Enable all for anon" ON public.driver_vehicle_assignments;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.driver_vehicle_assignments;
DROP POLICY IF EXISTS "Enable all for service_role" ON public.driver_vehicle_assignments;

-- ========== 第二步：确保 RLS 已启用 ==========
ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;

-- ========== 第三步：创建与 vehicles 完全相同的策略 ==========
-- 使用与 vehicles 表完全相同的策略格式
CREATE POLICY "open_all" ON public.driver_vehicle_assignments 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- ========== 第四步：确保表权限正确 ==========
-- 授予与 vehicles 表相同的权限
GRANT ALL ON public.driver_vehicle_assignments TO postgres;
GRANT ALL ON public.driver_vehicle_assignments TO anon;
GRANT ALL ON public.driver_vehicle_assignments TO authenticated;
GRANT ALL ON public.driver_vehicle_assignments TO service_role;

-- ========== 第五步：验证配置 ==========
-- 对比两个表的配置
SELECT 
  'vehicles' as table_name,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'vehicles'
UNION ALL
SELECT 
  'driver_vehicle_assignments' as table_name,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'driver_vehicle_assignments';

-- 两个表的配置应该完全一样

-- ========== 第六步：测试查询 ==========
-- 如果这个查询成功，说明问题解决了
SELECT COUNT(*) FROM public.driver_vehicle_assignments;
