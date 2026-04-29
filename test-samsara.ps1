# 测试 Samsara API Token
$SAMSARA_TOKEN = "samsara_api_xuwBoWcChtpqYPlGqEhhpmXncEhIke"

Write-Host "🔄 测试 Samsara API..." -ForegroundColor Cyan
Write-Host "Token: $($SAMSARA_TOKEN.Substring(0, 20))..." -ForegroundColor Gray

try {
    $headers = @{
        'Authorization' = "Bearer $SAMSARA_TOKEN"
        'Accept' = 'application/json'
    }
    
    $response = Invoke-WebRequest -Uri 'https://api.samsara.com/fleet/vehicles/locations' -Headers $headers -Method Get
    
    Write-Host "✅ 响应状态: $($response.StatusCode)" -ForegroundColor Green
    
    $data = $response.Content | ConvertFrom-Json
    $vehicleCount = $data.data.Count
    
    Write-Host "✅ 成功! 获取到 $vehicleCount 辆车" -ForegroundColor Green
    
    if ($vehicleCount -gt 0) {
        Write-Host "`n📦 第一辆车数据:" -ForegroundColor Yellow
        $data.data[0] | ConvertTo-Json -Depth 3
    }
    
} catch {
    Write-Host "❌ 错误: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "状态码: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
