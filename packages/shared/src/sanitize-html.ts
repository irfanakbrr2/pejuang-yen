const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'u', 's',
  'blockquote', 'pre', 'code', 'hr', 'br', 'a', 'img', 'figure',
  'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const ALLOWED_CLASSES = new Set([
  'text-center', 'text-left', 'text-right', 'image-center', 'image-wide',
  'callout', 'callout-warning', 'grid-two',
]);

const GLOBAL_ATTRS = new Set(['class', 'style']);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  th: new Set(['colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('#')) return true;
  return false;
}

function sanitizeStyle(value: string): string | null {
  if (!value.trim()) return null;
  // Block CSS-based XSS vectors while preserving valid inline styles
  if (/javascript\s*:/i.test(value)) return null;
  if (/expression\s*\(/i.test(value)) return null;
  if (/behavior\s*:/i.test(value)) return null;
  if (/-moz-binding/i.test(value)) return null;
  return value.trim();
}

function sanitizeClass(value: string): string | null {
  const classes = value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => ALLOWED_CLASSES.has(item));
  return classes.length > 0 ? classes.join(' ') : null;
}

function isAllowedAttr(tag: string, attr: string): boolean {
  if (GLOBAL_ATTRS.has(attr)) return true;
  return TAG_ATTRS[tag]?.has(attr) ?? false;
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const attrs: string[] = [];
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(rawAttrs)) !== null) {
    const attr = match[1].toLowerCase();
    if (attr.startsWith('on') || !isAllowedAttr(tag, attr)) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (attr === 'style') {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) attrs.push(`style="${escapeAttr(safeStyle)}"`);
      continue;
    }

    if (attr === 'class') {
      const safeClass = sanitizeClass(value);
      if (safeClass) attrs.push(`class="${escapeAttr(safeClass)}"`);
      continue;
    }

    if ((attr === 'href' || attr === 'src') && !isSafeUrl(value)) continue;

    if ((attr === 'width' || attr === 'height' || attr === 'colspan' || attr === 'rowspan') && !/^\d{1,4}$/.test(value)) {
      continue;
    }

    if (attr === 'target' && value !== '_blank') continue;
    if (attr === 'loading' && value !== 'lazy') continue;

    attrs.push(`${attr}="${escapeAttr(value)}"`);
  }

  if (tag === 'a' && attrs.some((attr) => attr.startsWith('target="_blank"')) && !attrs.some((attr) => attr.startsWith('rel='))) {
    attrs.push('rel="noopener noreferrer"');
  }

  if (tag === 'img' && !attrs.some((attr) => attr.startsWith('loading='))) {
    attrs.push('loading="lazy"');
  }

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

export function sanitizeLessonHtml(input?: string | null): string {
  if (!input) return '';

  const withoutDangerousBlocks = input.replace(
    /<\s*(script|style|iframe|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ''
  );

  return withoutDangerousBlocks.replace(/<\/?[^>]+>/g, (rawTag) => {
    const tagMatch = rawTag.match(/^<\s*(\/?)\s*([a-zA-Z0-9-]+)([\s\S]*?)\/?\s*>$/);
    if (!tagMatch) return '';

    const isClosing = tagMatch[1] === '/';
    const tag = tagMatch[2].toLowerCase();
    const rawAttrs = tagMatch[3] || '';

    if (!ALLOWED_TAGS.has(tag)) return '';
    if (isClosing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`;

    const attrs = sanitizeAttributes(tag, rawAttrs);
    return VOID_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>`;
  }).trim();
}

const COMMUNITY_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote',
]);

const COMMUNITY_VOID_TAGS = new Set(['br']);

export function sanitizeCommunityHtml(input?: string | null): string {
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
