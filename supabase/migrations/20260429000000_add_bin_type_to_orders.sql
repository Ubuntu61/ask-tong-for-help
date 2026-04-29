-- 添加桶类型字段到订单表
-- 创建桶类型枚举
CREATE TYPE public.bin_type AS ENUM ('garbage', 'brick', 'soil', 'cement', 'asphalt');

-- 添加 bin_type 字段到 orders 表
ALTER TABLE public.orders 
ADD COLUMN bin_type public.bin_type DEFAULT 'garbage';

-- 添加注释
COMMENT ON COLUMN public.orders.bin_type IS '桶类型：garbage(垃圾桶), brick(砖桶), soil(土桶), cement(水泥桶), asphalt(沥青桶)';
