import type { Context } from 'hono';

/**
 * Set session cookie
 */
export function setSessionCookie(c: Context, token: string, domain: string, maxAge: number = 7 * 24 * 3600) {
  const isProduction = domain !== 'localhost';
  // "host-only" / "" → cookie host-only (Secure, tanpa Domain) supaya menempel ke host
  // apa pun yang melayaninya (cocok untuk same-origin proxy: pages.dev / app.pejuangyen.com).
  const hostOnly = domain === 'host-only' || domain === '';
  const parts = [
    `session=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (isProduction) {
    parts.push(`Secure`);
    if (!hostOnly) parts.push(`Domain=${domain}`);
  }
  c.header('Set-Cookie', parts.join('; '));
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(c: Context, domain: string) {
  const isProduction = domain !== 'localhost';
  const hostOnly = domain === 'host-only' || domain === '';
  const parts = [
    `session=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];
  if (isProduction) {
    parts.push(`Secure`);
    if (!hostOnly) parts.push(`Domain=${domain}`);
  }
  c.header('Set-Cookie', parts.join('; '));
}
