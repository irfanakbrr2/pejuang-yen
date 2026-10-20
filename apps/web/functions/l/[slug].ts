import { safeParam } from "../_affiliate-redirect";

const SHORTLINK_HOSTS = new Set(["pejuangyen.link", "www.pejuangyen.link"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onRequest(context: any) {
  const { request, env } = context;
  const hostname = new URL(request.url).hostname.toLowerCase();

  // Only intercept on pejuangyen.link — pass through on app.pejuangyen.com
  if (!SHORTLINK_HOSTS.has(hostname)) {
    return context.next();
  }

  const slug = safeParam(context.params.slug);
  if (!slug) {
    return new Response("Shortlink not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const apiOrigin = (env.API_ORIGIN as string) || "https://api.pejuangyen.com";
  const resolveUrl = `${apiOrigin}/api/public/shortlinks/resolve/${encodeURIComponent(slug)}`;

  const response = await fetch(resolveUrl, {
    headers: {
      "Accept": "application/json",
      "cf-connecting-ip": request.headers.get("cf-connecting-ip") || "",
      "user-agent": request.headers.get("user-agent") || "",
      "referer": request.headers.get("referer") || "",
    },
  });

  if (!response.ok) {
    return new Response("Shortlink not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const body = await response.json() as { success?: boolean; data?: { destination_url?: string } };
  if (!body.success || !body.data?.destination_url) {
    return new Response("Shortlink not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  return Response.redirect(body.data.destination_url, 302);
}
