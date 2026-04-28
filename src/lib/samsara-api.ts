/**
 * Samsara API 辅助函数
 * 在开发环境直接调用 Samsara API（可能有 CORS 问题）
 * 在生产环境通过 /api/samsara 代理调用
 */

const SAMSARA_TOKEN = import.meta.env.VITE_SAMSARA_TOKEN || 'samsara_api_xuwBoWcChtpqYPlGqEhhpmXncEhIke';

export interface SamsaraVehicle {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
  };
  time?: string;
}

export interface SamsaraResponse {
  success: boolean;
  data: SamsaraVehicle[];
  error?: string;
  timestamp?: string;
}

/**
 * 获取 Samsara 车辆位置
 * 优先尝试使用 API 代理，如果失败则直接调用（开发环境）
 */
export async function fetchSamsaraVehicles(): Promise<SamsaraResponse> {
  // 首先尝试使用 API 代理
  try {
    const response = await fetch('/api/samsara');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('API 代理不可用，尝试直接调用 Samsara API...');
  }

  // 如果代理失败，尝试直接调用（开发环境）
  try {
    const response = await fetch('https://api.samsara.com/fleet/vehicles/locations', {
      headers: {
        'Authorization': `Bearer ${SAMSARA_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Samsara API Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data || [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Samsara API 调用失败:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
