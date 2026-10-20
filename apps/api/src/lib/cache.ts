import type { Env } from '../env';

export async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.KV.get(key, 'text');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSet(env: Env, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await env.KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
}

export async function kvDelete(env: Env, key: string): Promise<void> {
  await env.KV.delete(key);
}

export async function invalidateCourseListCache(env: Env): Promise<void> {
  const listed = await env.KV.list({ prefix: 'courses:list:' });
  await Promise.all(listed.keys.map(({ name }) => env.KV.delete(name)));
}

export async function invalidateCourseDetailCache(env: Env, slug: string): Promise<void> {
  await env.KV.delete(`courses:detail:${slug}`);
}

export async function kvGetOrSet<T>(
  env: Env,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await kvGet<T>(env, key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await kvSet(env, key, fresh, ttlSeconds);
  return fresh;
}
