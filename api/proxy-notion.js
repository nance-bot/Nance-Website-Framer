export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const notionUrl = 'https://nance-help-support-doc.notion.site/ebd/321076d0ee9380c282ebc7c97e4303a2';
  const notionBaseUrl = 'https://nance-help-support-doc.notion.site';
  
  try {
    const requestUrl = new URL(req.url);
    const url = new URL(req.url);
    
    // If this is a request for a specific resource (not the main page), proxy it directly
    const pathname = url.pathname;
    
    // Check if this is a resource request (anything under /help that's not exactly /help)
    if (pathname.startsWith('/help/') || (pathname.startsWith('/api/proxy-notion') && pathname !== '/api/proxy-notion')) {
      // This is a resource request - extract the path
      let resourcePath = pathname.replace('/help', '').replace('/api/proxy-notion', '');
      if (!resourcePath.startsWith('/')) {
        resourcePath = '/' + resourcePath;
      }
      
      // Try multiple possible Notion URLs for the resource
      const possibleUrls = [
        `${notionBaseUrl}${resourcePath}`,
        `${notionUrl}${resourcePath}`,
        `${notionBaseUrl}/ebd${resourcePath}`,
      ];
      
      for (const notionResourceUrl of possibleUrls) {
        try {
          const resourceResponse = await fetch(notionResourceUrl, {
            headers: {
              'User-Agent': req.headers.get('user-agent') || 'Mozilla/5.0',
              'Accept': req.headers.get('accept') || '*/*',
              'Referer': notionUrl,
            },
          });
          
          if (resourceResponse.ok) {
            const contentType = resourceResponse.headers.get('content-type') || 'application/octet-stream';
            const body = await resourceResponse.arrayBuffer();
            
            return new Response(body, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600',
              },
            });
          }
        } catch (e) {
          // Try next URL
          continue;
        }
      }
      // If all resource URLs failed, fall through to main page handler
    }
    
    // Main page request
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
    
    // Remove Content Security Policy meta tags that might block resources
    html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*content=["'][^"']*Content-Security-Policy[^"']*["'][^>]*>/gi, '');
    
    // Remove CSP from style attributes
    html = html.replace(/style=["'][^"']*Content-Security-Policy[^"']*["']/gi, '');
    
    // Get the current domain for rewriting URLs
    const protocol = url.protocol || 'https:';
    const host = url.host || req.headers.get('host') || '';
    const proxyBase = `${protocol}//${host}`;
    
    // Keep base tag pointing to original Notion URL so relative URLs work
    // Don't rewrite URLs - let them load from Notion directly
    // This is simpler and more reliable
    const baseTag = `<base href="${notionUrl}">`;
    if (!html.includes('<base')) {
      html = html.replace(/<head[^>]*>/i, `$&${baseTag}`);
    } else {
      // Update existing base tag
      html = html.replace(/<base[^>]*>/i, baseTag);
    }

    // Set appropriate headers - remove X-Frame-Options to allow iframe embedding
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
        // Don't set X-Frame-Options - let it embed
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

