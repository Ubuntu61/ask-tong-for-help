// 测试 Samsara API Token
const SAMSARA_TOKEN = 'samsara_api_xuwBoWcChtpqYPlGqEhhpmXncEhIke';

async function testSamsaraAPI() {
  console.log('🔄 测试 Samsara API...');
  console.log('Token:', SAMSARA_TOKEN.substring(0, 20) + '...');
  
  try {
    const response = await fetch('https://api.samsara.com/fleet/vehicles/locations', {
      headers: {
        'Authorization': `Bearer ${SAMSARA_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    console.log('📊 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 错误响应:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ 成功! 获取到', data.data?.length || 0, '辆车');
    console.log('📦 数据示例:', JSON.stringify(data.data?.[0], null, 2));
    
  } catch (error) {
    console.error('❌ 请求异常:', error.message);
  }
}

testSamsaraAPI();
