-- 检查一个正常工作的表（vehicles）的完整配置
-- 这样我们可以完全复制它的配置

-- 1. 查看 vehicles 表的策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'vehicles';

-- 2. 查看 vehicles 表的权限
SELECT 
  grantee, 
  privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'vehicles'
ORDER BY grantee, privilege_type;

-- 3. 查看 vehicles 表的 RLS 状态
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'vehicles';

-- 请把这三个查询的结果都发给我
-- 特别是第一个查询中的 roles 字段
