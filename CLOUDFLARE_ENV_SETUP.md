# Cloudflare Pages 环境变量配置指南

## 问题诊断
当前Samsara API返回403错误，可能原因：
1. Cloudflare Pages没有配置环境变量
2. API Token过期或无效

## 解决方案

### 方案1：在Cloudflare Pages配置环境变量

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入你的项目：**ask-tong-for-help**
3. 点击 **Settings** → **Environment variables**
4. 添加以下变量（Production 和 Preview 都要添加）：

```
VITE_SAMSARA_TOKEN=你的Samsara_API_Token
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAdYdNXwhNwmaTI64PzmvYDwxQm82W-b8s
VITE_SUPABASE_URL=https://gkirxxwlkimmpukvwvgb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_GWbZv_i_0zbtUuIt8VNi5g_V4ZW-8UJ
```

5. 点击 **Save**
6. 重新部署项目（Cloudflare会自动触发）

### 方案2：获取新的Samsara API Token

如果当前token已过期：

1. 访问 https://cloud.samsara.com
2. 登录账户
3. Settings → API Tokens
4. Create Token
5. 权限设置：
   - ✅ Fleet → Read
6. 复制新token
7. 更新Cloudflare Pages环境变量

### 方案3：临时解决 - 让地图在没有Samsara数据时也能工作

我已经修改了代码，现在即使Samsara API失败，地图也会：
- ✅ 正常显示订单位置
- ✅ 显示司机分配
- ✅ 显示基地位置
- ❌ 不显示车辆实时位置（需要Samsara API）

## 测试步骤

1. 推送代码更新
2. 等待Cloudflare自动部署
3. 访问地图页面
4. 检查浏览器控制台：
   - 如果看到 "✅ 获取到 X 辆 Samsara 车辆" → 成功
   - 如果看到 "⚠️ Samsara 获取失败" → 需要配置环境变量

## 当前Token信息

```
Token: samsara_api_xuwBoWcChtpqYPlGqEhhpmXncEhIke
状态: ❌ 403 Forbidden (已失效)
```

需要获取新token并更新配置。
