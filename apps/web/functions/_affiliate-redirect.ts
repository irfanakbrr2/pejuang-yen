const AFFILIATE_HOSTS = new Set(["pejuangyen.link", "www.pejuangyen.link"]);
const DEFAULT_PRODUCT_SLUG = "membership-yearly";

interface PagesFunctionContext {
  request: Request;
  env: {
    API_ORIGIN?: string;
  };
  next: () => Response | Promise<Response>;
}

function isAffiliateHost(request: Request) {
  return AFFILIATE_HOSTS.has(new URL(request.url).hostname.toLowerCase());
}

function safeParam(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function resolveAffiliateTarget(context: PagesFunctionContext, refCode: string, params: Record<string, string>) {
  const apiOrigin = context.env.API_ORIGIN || "https://api.pejuangyen.com";
  const resolveUrl = new URL(`${apiOrigin}/api/affiliate/resolve/${encodeURIComponent(refCode)}`);

  for (const [key, value] of Object.entries(params)) {
    if (value) resolveUrl.searchParams.set(key, value);
  }

  const response = await fetch(resolveUrl.toString(), {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) return null;

  const body = await response.json() as { success?: boolean; data?: { target_url?: string } };
  return body.success ? body.data?.target_url || null : null;
}

export async function redirectAffiliate(context: PagesFunctionContext, refCode: string, params: Record<string, string> = {}) {
  if (!isAffiliateHost(context.request)) {
    return context.next();
  }

  const targetUrl = await resolveAffiliateTarget(context, refCode, params);
  if (!targetUrl) {
    return new Response("Affiliate link not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  return Response.redirect(targetUrl, 302);
}

export function landingParams() {
  return { target: "landing" };
}

export function productParams(productSlug?: string) {
  return {
    target: "order",
    product_slug: productSlug || DEFAULT_PRODUCT_SLUG,
  };
}

export function webinarParams(webinarSlug: string) {
  return {
    target: "webinar",
    webinar_slug: webinarSlug,
  };
}

export { safeParam };
