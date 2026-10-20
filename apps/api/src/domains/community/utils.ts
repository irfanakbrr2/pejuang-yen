import type { Env } from '../../env';
import type { UserPublic } from '@growwithai/shared';
import { enqueueEmail, enqueueEmailBatch } from '../../lib/email-queue';
import type { EmailQueueMessage } from '../../lib/email-queue';

export const COMMUNITY_TITLE_MAX = 120;
export const COMMUNITY_BODY_TEXT_MAX = 8000;
export const COMMUNITY_COMMENT_TEXT_MAX = 2000;
export const COMMUNITY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const IMAGE_TYPES: Record<string, { ext: string; validate: (bytes: Uint8Array) => boolean }> = {
  'image/jpeg': {
    ext: 'jpg',
    validate: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  'image/png': {
    ext: 'png',
    validate: (bytes) =>
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  },
  'image/webp': {
    ext: 'webp',
    validate: (bytes) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
  'image/gif': {
    ext: 'gif',
    validate: (bytes) =>
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38,
  },
};

export type CommunityImageUpload = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

export function isAdminUser(user: UserPublic): boolean {
  return user.role === 'admin' || user.role === 'super_admin';
}

export async function hasCommunityAccess(env: Env, user: UserPublic): Promise<boolean> {
  if (isAdminUser(user)) return true;
  const now = new Date().toISOString();
  const membership = await env.DB.prepare(
    `SELECT id FROM memberships
     WHERE user_id = ? AND status = 'active'
       AND starts_at <= ?
       AND (expires_at IS NULL OR expires_at > ?)
     LIMIT 1`
  ).bind(user.id, now, now).first();
  return Boolean(membership);
}

export function normalizeCommunityContent(titleInput: unknown, htmlInput: unknown) {
  const title = String(titleInput || '').trim().replace(/\s+/g, ' ');
  const bodyHtml = sanitizeCommunityHtml(String(htmlInput || ''));
  const bodyText = htmlToText(bodyHtml);

  return { title, bodyHtml, bodyText };
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export function normalizeCommentText(input: unknown): string {
  return String(input || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const COMMENT_BLOCK_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  {
    reason: 'kata_kasar',
    pattern: /\b(anjing|anjg|anjir|anjay|bangsat|bajingan|brengsek|kontol|kntl|memek|mmk|ngentot|ngntot|goblok|gblk|tolol|idiot|bego|kampret|tai|taik|sialan|jancok|jancuk|cuk|cuki|asu|bacot)\b/i,
  },
  {
    reason: 'tuduhan_penipuan',
    pattern: /\b(penipuan|penipu|nip(u|u?in)|ditipu|tipu\s*tipu|scam|scammer|fraud|palsu|abal\s*abal|bodong)\b/i,
  },
  {
    reason: 'ancaman_atau_berbahaya',
    pattern: /\b(bunuh|membunuh|dibunuh|matiin|hajar|gebukin|bantai|ancam|mengancam|doxing|sebar\s+data|bocorin\s+data)\b/i,
  },
  {
    reason: 'ujaran_kebencian',
    pattern: /\b(kafir|cina|pribumi|rasis|komunis|pki)\b.*\b(bangsat|goblok|tolol|usir|bantai|bunuh)\b/i,
  },
];

export function moderateCommunityComment(bodyText: string): { status: 'approved' | 'blocked'; reason: string | null } {
  const normalized = bodyText
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const item of COMMENT_BLOCK_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return { status: 'blocked', reason: item.reason };
    }
  }

  return { status: 'approved', reason: null };
}

export function slugifyCommunityTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug || 'postingan-komunitas';
}

export async function createUniqueCommunitySlug(db: D1Database, title: string): Promise<string> {
  const base = slugifyCommunityTitle(title);
  let candidate = base;
  let suffix = 2;

  while (suffix < 1000) {
    const existing = await db.prepare(
      `SELECT id FROM community_posts WHERE slug = ? LIMIT 1`
    ).bind(candidate).first();
    if (!existing) return candidate;

    const suffixText = `-${suffix}`;
    candidate = `${base.slice(0, 80 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
    suffix++;
  }

  return `${base.slice(0, 75).replace(/-+$/g, '')}-${suffix}`;
}

export async function uploadCommunityImage(
  env: Env,
  userId: string,
  file: File | null
): Promise<CommunityImageUpload | null> {
  if (!file || file.size === 0) return null;
  if (file.size > COMMUNITY_IMAGE_MAX_BYTES) {
    throw new CommunityValidationError('Ukuran gambar maksimal 2MB', 413);
  }

  const imageType = IMAGE_TYPES[file.type];
  if (!imageType) {
    throw new CommunityValidationError('Format gambar harus JPEG, PNG, WebP, atau GIF', 400);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!imageType.validate(bytes)) {
    throw new CommunityValidationError('File gambar tidak valid', 400);
  }

  const key = `community/${userId}/${crypto.randomUUID()}.${imageType.ext}`;
  await env.R2.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });

  return {
    key,
    url: `https://file.pejuangyen.com/${key}`,
    contentType: file.type,
    size: file.size,
  };
}

export async function deleteCommunityImage(env: Env, key?: string | null): Promise<void> {
  if (!key) return;
  await env.R2.delete(key).catch((err) => console.error('[community] failed deleting image:', err));
}

export async function broadcastCommunityPost(env: Env, post: {
  id: string;
  slug?: string | null;
  title: string;
  body_html: string;
  image_url?: string | null;
  author_user_id: string;
}, options: { skipNotifications?: boolean } = {}): Promise<number> {
  const now = new Date().toISOString();
  const recipients = await env.DB.prepare(
    `SELECT DISTINCT id, email, name
     FROM users
     WHERE status = 'active'
       AND role = 'user'
       AND id != ?`
  ).bind(post.author_user_id).all();

  const postPath = `/community/${post.slug || post.id}`;
  const link = `${env.APP_URL || 'https://app.pejuangyen.com'}${postPath}`;
  let queued = 0;

  const recipientsList = recipients.results as Array<{ id: string; email: string; name: string }>;
  
  // Process in chunks of 50 to avoid D1 batch limits and queue limits
  const CHUNK_SIZE = 50;
  for (let i = 0; i < recipientsList.length; i += CHUNK_SIZE) {
    const chunk = recipientsList.slice(i, i + CHUNK_SIZE);
    
    // Insert in-app notifications (skipped on re-broadcast to avoid duplicates).
    if (!options.skipNotifications) {
      const dbStatements = chunk.map(recipient => {
        const notificationId = crypto.randomUUID();
        return env.DB.prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
           VALUES (?, ?, 'community_post', ?, ?, ?, 'sent', ?, ?)`
        ).bind(
          notificationId,
          recipient.id,
          post.title,
          htmlToText(post.body_html).slice(0, 180),
          JSON.stringify({ url: postPath, post_id: post.id, slug: post.slug || null }),
          now,
          now
        );
      });

      if (dbStatements.length > 0) {
        await env.DB.batch(dbStatements).catch(err =>
          console.error('[community] notification batch insert failed:', err)
        );
      }
    }

    // Prepare email messages
    const emailMessages: EmailQueueMessage[] = chunk.map(recipient => ({
      type: 'send_email',
      recipient: recipient.email,
      subject: `[Komunitas] ${post.title}`,
      content: renderCommunityEmail({
        firstName: (recipient.name || '').split(' ')[0] || 'Member',
        title: post.title,
        bodyHtml: post.body_html,
        imageUrl: post.image_url || null,
        link,
      }),
      emailType: 'notification',
    }));

    // Enqueue emails
    if (emailMessages.length > 0) {
      await enqueueEmailBatch(env, emailMessages);
      queued += emailMessages.length;
    }
  }

  return queued;
}

export async function triggerLandingBlogDeploy(env: Env, postSlug: string): Promise<void> {
  if (!env.LANDING_DEPLOY_HOOK_URL) return;

  const res = await fetch(env.LANDING_DEPLOY_HOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'growwithai-community',
      post_slug: postSlug,
      triggered_at: new Date().toISOString(),
    }),
  }).catch((err) => {
    console.error('[community] landing deploy hook failed:', err);
    return null;
  });

  if (res && !res.ok) {
    console.error('[community] landing deploy hook returned non-2xx:', res.status);
  }
}

export class CommunityValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function renderCommunityEmail(params: {
  firstName: string;
  title: string;
  bodyHtml: string;
  imageUrl?: string | null;
  link: string;
}) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
      <p>Halo ${escapeHtml(params.firstName)},</p>
      <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px">${escapeHtml(params.title)}</h1>
      ${params.imageUrl ? `<img src="${escapeHtml(params.imageUrl)}" alt="" style="max-width:100%;border-radius:12px;margin:0 0 16px" />` : ''}
      <div>${params.bodyHtml}</div>
      <p style="margin-top:24px">
        <a href="${escapeHtml(params.link)}" style="display:inline-block;background:#0F6E56;color:#fff;text-decoration:none;border-radius:10px;padding:10px 16px;font-weight:700">Buka postingan</a>
      </p>
      <div style="margin-top:32px;border-top:1px solid #E5E7EB;padding-top:20px;font-family:Arial,Helvetica,sans-serif">
        <p style="margin:0 0 14px;font-size:12px;line-height:1.7;color:#9CA3AF">
          <strong style="color:#6B7280">PejuangYen</strong> — Lembaga Pelatihan Bahasa Jepang & Persiapan Kerja ke Jepang.<br>
          Kamu menerima email ini karena terdaftar sebagai member di pejuangyen.com.
        </p>
        <a href="{{unsubscribe_url}}" style="display:inline-block;font-size:12px;color:#6B7280;text-decoration:none;border:1px solid #E5E7EB;border-radius:8px;padding:8px 14px;font-family:Arial,Helvetica,sans-serif">Berhenti berlangganan</a>
      </div>
    </div>
  `.trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COMMUNITY_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote',
]);

const COMMUNITY_VOID_TAGS = new Set(['br']);

function sanitizeCommunityHtml(input?: string | null): string {
  if (!input) return '';

  const normalized = input
    .replace(/<\s*\/?\s*div\b[^>]*>/gi, (tag) => tag.includes('/') ? '</p>' : '<p>')
    .replace(/<\s*b\b[^>]*>/gi, '<strong>')
    .replace(/<\s*\/\s*b\s*>/gi, '</strong>')
    .replace(/<\s*i\b[^>]*>/gi, '<em>')
    .replace(/<\s*\/\s*i\s*>/gi, '</em>')
    .replace(/<\s*strike\b[^>]*>/gi, '<s>')
    .replace(/<\s*\/\s*strike\s*>/gi, '</s>');

  const withoutDangerousBlocks = normalized.replace(
    /<\s*(script|style|iframe|form|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ''
  );

  return withoutDangerousBlocks.replace(/<\/?[^>]+>/g, (rawTag) => {
    const tagMatch = rawTag.match(/^<\s*(\/?)\s*([a-zA-Z0-9-]+)([\s\S]*?)\/?\s*>$/);
    if (!tagMatch) return '';

    const isClosing = tagMatch[1] === '/';
    const tag = tagMatch[2].toLowerCase();

    if (!COMMUNITY_ALLOWED_TAGS.has(tag)) return '';
    if (isClosing) return COMMUNITY_VOID_TAGS.has(tag) ? '' : `</${tag}>`;
    return COMMUNITY_VOID_TAGS.has(tag) ? `<${tag}>` : `<${tag}>`;
  }).trim();
}
