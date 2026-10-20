/**
 * Cloudflare Pages Function — API Proxy
 *
 * Proxies all /api/* requests to the API Worker.
 * This keeps cookies same-origin (app.pejuangyen.com) and avoids CORS issues.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onRequest(context: any) {
  const { request, env } = context;
  const apiOrigin = (env.API_ORIGIN as string) || 'https://api.pejuangyen.com';

  const url = new URL(request.url);
  let cleanPathname = url.pathname;
  if (cleanPathname.endsWith("/") && cleanPathname.length > 1) {
    cleanPathname = cleanPathname.slice(0, -1);
  }
  const targetUrl = `${apiOrigin}${cleanPathname}${url.search}`;

  const forwardedHeaders = new Headers();
  for (const header of ['accept', 'authorization', 'content-type', 'cookie', 'user-agent', 'cf-connecting-ip', 'cf-ipcountry']) {
    const value = request.headers.get(header);
    if (value) forwardedHeaders.set(header, value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : null;

  const apiRequest = new Request(targetUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body,
    redirect: 'manual',
  });

  return fetch(apiRequest);
};
