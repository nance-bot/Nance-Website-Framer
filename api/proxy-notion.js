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
    
    // Get the current domain for rewriting URLs
    const protocol = url.protocol || 'https:';
    const host = url.host || req.headers.get('host') || '';
    const proxyBase = `${protocol}//${host}`;
    
    // Inject script to rewrite URLs dynamically loaded by JavaScript
    const urlRewriteScript = `
    <script>
    (function() {
      // Override fetch to proxy requests
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (typeof url === 'string' && url.includes('notion.site')) {
          url = url.replace(/https?:\\/\\/nance-help-support-doc\\.notion\\.site/g, '${proxyBase}/help');
        }
        return originalFetch.call(this, url, options);
      };
      
      // Override XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && url.includes('notion.site')) {
          url = url.replace(/https?:\\/\\/nance-help-support-doc\\.notion\\.site/g, '${proxyBase}/help');
        }
        return originalOpen.call(this, method, url, ...args);
      };
      
      // Fix dynamically created link and script tags
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              // Fix link tags
              if (node.tagName === 'LINK' && node.href) {
                if (node.href.includes('notion.site')) {
                  node.href = node.href.replace(/https?:\\/\\/nance-help-support-doc\\.notion\\.site/g, '${proxyBase}/help');
                }
              }
              // Fix script tags
              if (node.tagName === 'SCRIPT' && node.src) {
                if (node.src.includes('notion.site')) {
                  node.src = node.src.replace(/https?:\\/\\/nance-help-support-doc\\.notion\\.site/g, '${proxyBase}/help');
                }
              }
              // Fix img tags
              if (node.tagName === 'IMG' && node.src) {
                if (node.src.includes('notion.site')) {
                  node.src = node.src.replace(/https?:\\/\\/nance-help-support-doc\\.notion\\.site/g, '${proxyBase}/help');
                }
              }
            }
          });
        });
      });
      observer.observe(document, { childList: true, subtree: true });
    })();
    </script>
    `;
    
    // Rewrite all Notion URLs in the HTML
    html = html.replace(
      /https?:\/\/nance-help-support-doc\.notion\.site([^"'\s<>]*)/gi,
      (match, path) => {
        return `${proxyBase}/help${path}`;
      }
    );
    
    // Replace protocol-relative URLs
    html = html.replace(
      /\/\/nance-help-support-doc\.notion\.site([^"'\s<>]*)/gi,
      (match, path) => {
        return `${proxyBase}/help${path}`;
      }
    );
    
    // Add base tag pointing to Notion (for any remaining relative URLs)
    const baseTag = `<base href="${notionUrl}">`;
    if (!html.includes('<base')) {
      html = html.replace(/<head[^>]*>/i, `$&${baseTag}`);
    }
    
    // Inject URL rewriting script right after head tag
    html = html.replace(/<\/head>/i, `${urlRewriteScript}</head>`);

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

