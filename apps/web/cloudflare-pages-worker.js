// Domain pendek khusus affiliate (HARUS domain terpisah dari app.pejuangyen.com,
// karena di host ini segmen path pertama diperlakukan sebagai kode referral).
// Opsional: beli mis. pejuangyen.link, tambahkan sebagai custom domain di Pages project.
// Tanpa domain ini, dashboard affiliate in-app tetap berfungsi — hanya short-link yang nonaktif.
const AFFILIATE_HOSTS = new Set(["pejuangyen.link", "www.pejuangyen.link"]);
const DEFAULT_API_ORIGIN = "https://api.pejuangyen.com";
const DEFAULT_PRODUCT_SLUG = "membership-yearly";

function apiOrigin(env) {
  return (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/+$/, "");
}

function isAffiliateHost(url) {
  return AFFILIATE_HOSTS.has(url.hostname.toLowerCase());
}

function jsonHeaders(request) {
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["cf-connecting-ip", "user-agent", "referer"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function proxyHeaders(request) {
  const headers = new Headers();
  for (const name of [
    "accept",
    "authorization",
    "content-type",
    "cookie",
    "user-agent",
    "cf-connecting-ip",
    "cf-ipcountry",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function notFound(message) {
  return new Response(message, {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}

async function resolveAffiliate(request, env, refCode, params) {
  if (!refCode) return notFound("Affiliate link not found");

  const resolveUrl = new URL(`${apiOrigin(env)}/api/affiliate/resolve/${encodeURIComponent(refCode)}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) resolveUrl.searchParams.set(key, value);
  }

  const response = await fetch(resolveUrl.toString(), { headers: jsonHeaders(request) });
  if (!response.ok) return notFound("Affiliate link not found");

  const body = await response.json();
  const targetUrl = body && body.success ? body.data && body.data.target_url : null;
  if (!targetUrl) return notFound("Affiliate link not found");

  // Merge query masuk (utm_*, fbclid, dll) ke Location keluar. pejuangyen.link
  // domain berbeda dari .id → cookie tak menyeberang; query string satu-satunya
  // pembawa lintas-domain. ref sudah ada di targetUrl (dari API) → JANGAN ditimpa;
  // ref & utm dimensi berbeda, keduanya lolos bersama.
  const dest = new URL(targetUrl);
  const incoming = new URL(request.url).searchParams;
  for (const [key, value] of incoming) {
    if (!dest.searchParams.has(key)) dest.searchParams.set(key, value);
  }

  return Response.redirect(dest.toString(), 302);
}

async function resolveShortlink(request, env, slug) {
  if (!slug) return notFound("Shortlink not found");

  const resolveUrl = `${apiOrigin(env)}/api/public/shortlinks/resolve/${encodeURIComponent(slug)}`;
  const response = await fetch(resolveUrl, { headers: jsonHeaders(request) });
  if (!response.ok) return notFound("Shortlink not found");

  const body = await response.json();
  const destinationUrl = body && body.success ? body.data && body.data.destination_url : null;
  if (!destinationUrl) return notFound("Shortlink not found");

  return Response.redirect(destinationUrl, 302);
}

async function proxyApi(request, env, url) {
  let cleanPathname = url.pathname;
  if (cleanPathname.endsWith("/") && cleanPathname.length > 1) {
    cleanPathname = cleanPathname.slice(0, -1);
  }
  const targetUrl = `${apiOrigin(env)}${cleanPathname}${url.search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : null;

  return fetch(
    new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders(request),
      body,
      redirect: "manual",
    })
  );
}

function splitPath(url) {
  return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

function staticRewritePath(segments) {
  const n = segments.length;
  if (n === 0) return null;
  const last = segments[n - 1];
  const isTxt = last.endsWith('.txt');
  
  const baseLen = isTxt ? n - 1 : n;

  if (baseLen === 2 && segments[0] === "course") return isTxt ? `/course/_/${last}` : "/course/_/";
  if (baseLen === 2 && segments[0] === "order") return isTxt ? `/order/_/${last}` : "/order/_/";
  if (baseLen === 2 && segments[0] === "checkout" && segments[1] !== "success") return isTxt ? `/checkout/_/${last}` : "/checkout/_/";
  if (baseLen === 2 && segments[0] === "products") return isTxt ? `/products/_/${last}` : "/products/_/";
  if (baseLen === 2 && segments[0] === "toko") return isTxt ? `/toko/_/${last}` : "/toko/_/";
  if (baseLen === 3 && segments[0] === "toko") return isTxt ? `/toko/_/_/${last}` : "/toko/_/_/";
  if (baseLen === 3 && segments[0] === "learn" && segments[2] === "start") return isTxt ? `/learn/_/start/${last}` : "/learn/_/start/";
  if (baseLen === 3 && segments[0] === "learn") return isTxt ? `/learn/_/_/${last}` : "/learn/_/_/";
  if (baseLen === 3 && segments[0] === "admin" && segments[1] === "courses" && segments[2] !== "new") return isTxt ? `/admin/courses/_/${last}` : "/admin/courses/_/";
  if (baseLen === 3 && segments[0] === "admin" && segments[1] === "orders") return isTxt ? `/admin/orders/_/${last}` : "/admin/orders/_/";
  if (baseLen === 3 && segments[0] === "admin" && segments[1] === "funnels") return isTxt ? `/admin/funnels/_/${last}` : "/admin/funnels/_/";
  if (baseLen === 4 && segments[0] === "admin" && segments[1] === "users" && segments[3] === "journey") return isTxt ? `/admin/users/_/journey/${last}` : "/admin/users/_/journey/";
  if (baseLen === 3 && segments[0] === "admin" && segments[1] === "users") return isTxt ? `/admin/users/_/${last}` : "/admin/users/_/";
  if (baseLen === 3 && segments[0] === "admin" && segments[1] === "invoices" && segments[2] !== "new") return isTxt ? `/admin/invoices/_/${last}` : "/admin/invoices/_/";
  if (baseLen === 4 && segments[0] === "admin" && segments[1] === "webinars" && segments[3] === "analytics") return isTxt ? `/admin/webinars/_/analytics/${last}` : "/admin/webinars/_/analytics/";
  if (baseLen === 2 && segments[0] === "community") return isTxt ? `/community/_/${last}` : "/community/_/";
  if (baseLen === 2 && segments[0] === "certificates") return isTxt ? `/certificates/_/${last}` : "/certificates/_/";
  if (baseLen === 2 && segments[0] === "verify") return isTxt ? `/verify/_/${last}` : "/verify/_/";
  if (baseLen === 2 && segments[0] === "webinar") return isTxt ? `/webinar/_/${last}` : "/webinar/_/";
  if (baseLen === 2 && segments[0] === "webinars") return isTxt ? `/webinars/_/${last}` : "/webinars/_/";
  if (baseLen === 2 && segments[0] === "rekaman-zoom") return isTxt ? `/rekaman-zoom/_/${last}` : "/rekaman-zoom/_/";
  if (baseLen === 2 && segments[0] === "bonuses") return isTxt ? `/bonuses/_/${last}` : "/bonuses/_/";
  if (baseLen === 2 && segments[0] === "skills") return isTxt ? `/skills/_/${last}` : "/skills/_/";
  if (baseLen === 2 && segments[0] === "paths") return isTxt ? `/paths/_/${last}` : "/paths/_/";
  if (baseLen === 2 && segments[0] === "ai-pulse") return isTxt ? `/ai-pulse/_/${last}` : "/ai-pulse/_/";
  if (baseLen === 3 && segments[0] === "admin" && segments[1] === "paths") return isTxt ? `/admin/paths/_/${last}` : "/admin/paths/_/";

  return null;
}

function assetRequest(request, url, pathname) {
  const rewritten = new URL(url.toString());
  rewritten.pathname = pathname;
  rewritten.search = "";
  return new Request(rewritten.toString(), request);
}

async function serveAssets(request, env, url) {
  const rewritePath = staticRewritePath(splitPath(url));
  if (rewritePath) {
    return env.ASSETS.fetch(assetRequest(request, url, rewritePath));
  }

  // Directory-index fallback. Untuk path statis tanpa ekstensi & tanpa trailing slash
  // (mis. /admin/courses/new), ASSETS di advanced mode tidak selalu resolve ke
  // <path>/index.html dan bisa salah menyajikan fallback route dinamis saudara ([id]).
  // Coba <path>/index.html dulu; kalau ada (200) sajikan, kalau tidak fallback normal.
  const p = url.pathname;
  const last = p.split("/").pop() || "";
  if (p !== "/" && !p.endsWith("/") && !last.includes(".")) {
    const dirRes = await env.ASSETS.fetch(assetRequest(request, url, `${p}/`));
    if (dirRes.status === 200) return dirRes;
  }

  return env.ASSETS.fetch(request);
}

async function handleAffiliateHost(request, env, url) {
  const segments = splitPath(url);

  if (segments.length === 1) {
    return resolveAffiliate(request, env, segments[0], { target: "landing" });
  }

  if (segments.length === 2 && segments[0] === "l") {
    return resolveShortlink(request, env, segments[1]);
  }

  if (segments.length === 3 && segments[0] === "p") {
    return resolveAffiliate(request, env, segments[2], {
      target: "order",
      product_slug: segments[1] || DEFAULT_PRODUCT_SLUG,
    });
  }

  if (segments.length === 3 && segments[0] === "w") {
    return resolveAffiliate(request, env, segments[2], {
      target: "webinar",
      webinar_slug: segments[1],
    });
  }

  return serveAssets(request, env, url);
}

// Resolusi affiliate berbasis PATH di domain utama (tanpa domain .link terpisah):
//   /r/<kode>  /r/p/<produk>/<kode>  /r/w/<webinar>/<kode>
async function handleAffiliatePath(request, env, segments) {
  if (segments.length === 1) {
    return resolveAffiliate(request, env, segments[0], { target: "landing" });
  }
  if (segments.length === 3 && segments[0] === "p") {
    return resolveAffiliate(request, env, segments[2], {
      target: "order",
      product_slug: segments[1] || DEFAULT_PRODUCT_SLUG,
    });
  }
  if (segments.length === 3 && segments[0] === "w") {
    return resolveAffiliate(request, env, segments[2], {
      target: "webinar",
      webinar_slug: segments[1],
    });
  }
  return notFound("Affiliate link not found");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return proxyApi(request, env, url);
    }

    if (isAffiliateHost(url)) {
      return handleAffiliateHost(request, env, url);
    }

    // Domain utama: link affiliate (/r/...) & shortlink (/l/<slug>)
    const seg = splitPath(url);
    if (seg[0] === "r" && seg.length >= 2) {
      return handleAffiliatePath(request, env, seg.slice(1));
    }
    if (seg[0] === "l" && seg.length === 2) {
      return resolveShortlink(request, env, seg[1]);
    }

    return serveAssets(request, env, url);
  },
};
