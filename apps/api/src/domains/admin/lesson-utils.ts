
import { sanitizeLessonHtml } from '@growwithai/shared';

type LessonResource = {
  title: string;
  url: string;
};

type LessonValidationInput = {
  lesson_type?: unknown;
  video_url?: unknown;
  content_html?: unknown;
  content_embed?: unknown;
  resources_json?: unknown;
  status?: unknown;
};

function isSafeResourceUrl(url: string): boolean {
  if (/[\u0000-\u001f\u007f\s]/.test(url)) return false;
  return /^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//'));
}

export function normalizeLessonResources(input: unknown): string | null {
  if (input === undefined || input === null || input === '') return null;

  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  const resources: LessonResource[] = parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const title = typeof raw.title === 'string' ? raw.title.trim() : '';
      const url = typeof raw.url === 'string' ? raw.url.trim() : '';
      if (!title || !url || !isSafeResourceUrl(url)) return null;
      return { title: title.slice(0, 160), url: url.slice(0, 500) };
    })
    .filter((item): item is LessonResource => Boolean(item));

  return resources.length > 0 ? JSON.stringify(resources) : null;
}

export function normalizeLessonPayload<T extends Record<string, unknown>>(body: T): T {
  const next: Record<string, unknown> = { ...body };

  if ('content_html' in body) {
    const content = typeof body.content_html === 'string' ? body.content_html : '';
    next.content_html = sanitizeLessonHtml(content) || null;
  }

  if ('content_embed' in body) {
    const embed = typeof body.content_embed === 'string' ? body.content_embed.trim() : '';
    next.content_embed = embed || null;
  }

  if ('resources_json' in body) {
    next.resources_json = normalizeLessonResources(body.resources_json);
  }

  if ('content_format' in body || next.content_html) {
    next.content_format = 'html';
  }

  return next as T;
}

export function validatePublishedLesson(input: LessonValidationInput): string | null {
  if (input.status !== 'published') return null;

  const lessonType = String(input.lesson_type || 'video');
  const videoUrl = typeof input.video_url === 'string' ? input.video_url.trim() : '';
  const contentHtml = typeof input.content_html === 'string' ? input.content_html.trim() : '';
  const contentEmbed = typeof input.content_embed === 'string' ? input.content_embed.trim() : '';
  const resources = normalizeLessonResources(input.resources_json);
  const hasResources = Boolean(resources);
  const hasVideo = /^https?:\/\//i.test(videoUrl);
  const hasContent = contentHtml.length > 0 || contentEmbed.length > 0;

  if (lessonType === 'video' && !hasVideo && !hasContent) {
    return 'Lesson video published membutuhkan URL video valid atau konten HTML.';
  }

  if (lessonType === 'text' && !hasContent && !hasResources) {
    return 'Lesson text published membutuhkan konten HTML atau resource link.';
  }

  if (lessonType === 'resource' && !hasResources) {
    return 'Lesson resource published membutuhkan minimal satu resource link valid.';
  }

  return null;
}
