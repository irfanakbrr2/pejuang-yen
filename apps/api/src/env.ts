interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  MAIL_DB?: D1Database;
  R2: R2Bucket;
  R2_PRIVATE: R2Bucket;
  KV: KVNamespace;
  AI: Ai;
  NOTIFICATIONS_QUEUE: Queue;
  EMAIL_SEQUENCE_QUEUE: Queue;
  AUTOMATION_QUEUE: Queue;

  // Workers Rate Limiting (0 KV cost)
  RL_5_PER_MIN?: RateLimiter;
  RL_3_PER_HOUR?: RateLimiter;
  RL_10_PER_HOUR?: RateLimiter;
  RL_60_PER_MIN?: RateLimiter;

  // Pakasir (embedded checkout)
  PAKASIR_PROJECT_SLUG?: string;
  PAKASIR_API_KEY?: string;
  PAKASIR_WEBHOOK_SECRET?: string;
  PAKASIR_MODE?: string; // 'sandbox' | 'production' — gate endpoint simulate

  // Auth
  JWT_SECRET: string;
  COOKIE_DOMAIN: string;
  TURNSTILE_SECRET_KEY?: string;

  // Content Automation — kunci enkripsi credential vault (AES-GCM).
  // Fallback ke JWT_SECRET bila tidak diset.
  AUTOMATION_ENCRYPTION_KEY?: string;

  // App
  APP_ENV: string;
  // "true" → lewati verifikasi email OTP: register auto-verified + auto-login,
  // login tidak menuntut email terverifikasi. Sementara sampai Mailketing dipasang.
  DISABLE_EMAIL_VERIFICATION?: string;
  APP_URL: string;
  API_URL: string;
  LANDING_URL?: string;
  LANDING_DEPLOY_HOOK_URL?: string;
  CORS_ORIGIN: string;
  SUMOPOD_BASE_URL?: string;
  SUMOPOD_MODEL?: string;
  SUMOPOD_CONTEXT_LENGTH?: string;
  SUMOPOD_MAX_COMPLETION_TOKENS?: string;
  SUMOPOD_DEEP_MODEL?: string;
  SUMOPOD_DEEP_CONTEXT_LENGTH?: string;
  SUMOPOD_DEEP_MAX_COMPLETION_TOKENS?: string;
  SUMOPOD_FALLBACK_MODEL?: string;
  SUMOPOD_FALLBACK_CONTEXT_LENGTH?: string;
  SUMOPOD_FALLBACK_MAX_COMPLETION_TOKENS?: string;
  SUMOPOD_API_KEY?: string;

  // Mail Hub terpusat (email.sahabatcuan.id) — jalur KIRIM email
  MAIL_HUB_API_KEY: string;

  // Mailketing — list/subscriber/credits + webhook masuk (kirim via Mail Hub)
  MAILKETING_API_TOKEN: string;
  MAILKETING_WEBHOOK_SECRET: string;

  // WhatsApp notifications — optional provider bridge
  WHATSAPP_API_URL?: string;
  WHATSAPP_API_TOKEN?: string;
  WHATSAPP_API_AUTH_SCHEME?: 'bearer' | 'token';

  // Web Push (VAPID) — RFC 8292. base64url raw P-256 keys.
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;

}
