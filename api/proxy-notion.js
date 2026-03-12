export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const notionUrl = 'https://nance-help-support-doc.notion.site/ebd/321076d0ee9380c282ebc7c97e4303a2';
  
  try {
    const url = new URL(req.url);
    const response = await fetch(notionUrl, {
      headers: {
        'User-Agent': req.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': req.headers.get('accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.headers.get('accept-language') || 'en-US,en;q=0.9',
        'Referer': notionUrl,
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch Notion page', { 
        status: response.status 
      });
    }

    let html = await response.text();
    
    // Get the protocol and host from the request
    const protocol = url.protocol || 'https:';
    const host = url.host || req.headers.get('host') || '';
    const baseUrl = `${protocol}//${host}`;
    
    // Replace Notion URLs with your domain for better embedding
    html = html.replace(
      /https:\/\/nance-help-support-doc\.notion\.site/g,
      `${baseUrl}/help`
    );

    // Set appropriate headers
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

