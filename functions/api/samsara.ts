// Cloudflare Pages Function
export async function onRequest(context: any) {
  const SAMSARA_TOKEN = context.env.VITE_SAMSARA_TOKEN || 'samsara_api_xuwBoWcChtpqYPlGqEhhpmXncEhIke';
  
  try {
    const response = await fetch('https://api.samsara.com/fleet/vehicles/locations', {
      headers: {
        'Authorization': `Bearer ${SAMSARA_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        success: false,
        error: `Samsara API Error: ${response.status} - ${errorText}`,
        data: []
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      data: data.data || [],
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Samsara API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      data: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
