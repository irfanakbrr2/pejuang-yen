import { z } from 'zod';
import { CITY_BY_CODE } from './cities';
import { MENU_MILESTONES } from './constants';

const DISPOSABLE_DOMAINS = [
  'yopmail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.com',
  'test.com', 'example.com', 'sample.com', 'throwaway.email', 'dispostable.com',
  'trashmail.com', 'sharklasers.com', 'maildrop.cc', '10minutemail.com',
  'burnermail.io', 'inboxkitten.com', 'temp-mail.org', 'mailsac.com',
  'nada.email', 'spam4.me', 'tempalias.com', 'tempemail.com',
  'temporaryinbox.com', 'vmail.me', 'zomg.info'
];

const SPAM_KEYWORDS = ['test', 'attack', 'hack', 'spam', 'flood', 'admin', 'pentest', 'bot'];

// ─── Auth Schemas ────────────────────────────────
const attributionTouchSchema = z.object({
  source: z.string().max(500).optional(),
  medium: z.string().max(500).optional(),
  campaign: z.string().max(500).optional(),
  landing_page: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  affiliate_code: z.string().max(500).optional(),
  referral_code: z.string().max(500).optional(),
  webinar_id: z.string().max(500).optional(),
  ts: z.string().max(500).optional(),
});

export const registerSchema = z.object({
  email: z.string()
    .email('Email tidak valid')
    .max(100, 'Email terlalu panjang')
    .refine((val) => {
      const domain = val.split('@')[1]?.toLowerCase();
      if (domain && DISPOSABLE_DOMAINS.includes(domain)) return false;
      if (domain === 'pejuangyen.com') return false;
      return true;
    }, 'Domain email tidak diizinkan untuk pendaftaran')
    .refine((val) => {
      const local = val.split('@')[0]?.toLowerCase();
      if (local && SPAM_KEYWORDS.some(kw => local.includes(kw))) return false;
      return true;
    }, 'Alamat email mengandung kata yang dilarang')
    .refine((val) => {
      if (/(.)\1{5,}/.test(val)) return false;
      return true;
    }, 'Format email terindikasi spam')
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  name: z.string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100)
    .regex(/^[^<>]*$/, 'Nama tidak boleh mengandung simbol < atau > untuk keamanan'),
  phone: z.string().min(8, 'Nomor WhatsApp minimal 8 karakter'),
  referral_source: z.string().max(100).optional(),
  affiliate_code: z.string().max(60).optional(),
  attribution: z.object({
    // nullish (not optional): getAttribution() sends null — not undefined — for
    // first/last when no attribution is stored (direct/organic visits, or when
    // localStorage is blocked e.g. Safari private/ITP). .optional() rejects null
    // and broke registration for those users with a generic "Validation error".
    first: attributionTouchSchema.nullish(),
    last: attributionTouchSchema.nullish(),
  }).nullish(),
  cfTurnstileResponse: z.string().optional(),
  _hp_website: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid').transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password harus diisi'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email tidak valid').transform((val) => val.trim().toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Email tidak valid').transform((val) => val.trim().toLowerCase()),
  otp: z.string().length(6, 'Kode OTP harus 6 digit'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Email tidak valid').transform((val) => val.trim().toLowerCase()),
});

export const updateProfileSchema = z.object({
  name: z.string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter')
    .regex(/^[^<>]*$/, 'Nama tidak boleh mengandung simbol < atau >'),
  phone: z.string().max(30, 'Nomor terlalu panjang').optional().nullable(),
  avatar_url: z.string().url('URL avatar tidak valid').max(500).optional().nullable(),
  bio: z.string()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .regex(/^[^<>]*$/, 'Deskripsi tidak boleh mengandung simbol < atau >')
    .optional().nullable(),
  city_code: z.string().max(60)
    .refine((v) => v in CITY_BY_CODE, 'Kota tidak valid')
    .optional().nullable(),
  map_visibility: z.enum(['hidden', 'anonymous', 'name', 'full']).optional(),
});

export const recordMilestoneSchema = z.object({
  milestone: z.enum(MENU_MILESTONES),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Password saat ini harus diisi'),
  new_password: z.string().min(8, 'Password baru minimal 8 karakter'),
});

// ─── Course Schemas ──────────────────────────────
export const createCourseSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan dash'),
  subtitle: z.string().max(300).optional(),
  description: z.string().optional(),
  short_description: z.string().max(500).optional(),
  thumbnail_url: z.string().url().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  category: z.string().max(100).optional(),
  primary_category_id: z.string().max(50).nullable().optional(),
  secondary_category_ids: z.array(z.string().max(50)).max(2, 'Maksimal 2 secondary category').optional(),
  learning_outcome: z.string().max(1000).nullable().optional(),
  recommended_for: z.string().max(500).nullable().optional(),
  duration_minutes: z.number().int().min(0).nullable().optional(),
  instructor_name: z.string().max(100).optional(),
  access_type: z.enum(['free', 'paid', 'membership_only']).default('paid'),
  price: z.number().int().min(0).default(0),
  compare_at_price: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  sort_order: z.number().int().default(0),
});

export const updateCourseSchema = createCourseSchema.partial();

// ─── Module Schemas ──────────────────────────────
export const createModuleSchema = z.object({
  course_id: z.string().min(1),
  title: z.string().min(1, 'Judul modul harus diisi').max(200),
  description: z.string().optional(),
  sort_order: z.number().int().default(0),
});

export const updateModuleSchema = createModuleSchema.partial().omit({ course_id: true });

// ─── Lesson Schemas ──────────────────────────────
export const createLessonSchema = z.object({
  course_id: z.string().min(1),
  module_id: z.string().min(1),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  lesson_type: z.enum(['video', 'text', 'quiz', 'resource']).default('video'),
  video_provider: z.string().optional(),
  video_url: z.string().optional(),
  content_markdown: z.string().optional(),
  content_html: z.string().optional(),
  content_format: z.enum(['html']).default('html'),
  description: z.string().optional(),
  resources_json: z.string().optional(),
  is_preview: z.number().int().min(0).max(1).default(0),
  sort_order: z.number().int().default(0),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export const updateLessonSchema = createLessonSchema.partial().omit({ course_id: true, module_id: true });

export const reorderLessonsSchema = z.object({
  lessons: z.array(z.object({
    id: z.string().min(1),
    module_id: z.string().min(1),
    sort_order: z.number().int().min(0),
  })).min(1, 'Minimal 1 lesson untuk reorder').max(500),
});

// ─── Checkout Schemas ────────────────────────────
export const createOrderSchema = z.object({
  order_type: z.enum(['course', 'membership', 'bonus', 'bundle', 'webinar_registration']),
  product_id: z.string().min(1),
  affiliate_code: z.string().optional(),
  mobile: z.string().optional(),
  addons: z.array(z.object({
    type: z.enum(['private_1on1_consultation']),
  })).optional(),
});

// ─── Membership Schemas ──────────────────────────
export const createMembershipPlanSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  duration_type: z.enum(['monthly', 'yearly', 'lifetime', 'custom']),
  duration_days: z.number().int().min(1).optional(),
  price: z.number().int().min(0),
  compare_at_price: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  sort_order: z.number().int().default(0),
});

// ─── Bonus Schemas ───────────────────────────────
export const createBonusSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  bonus_type: z.enum(['ebook', 'template', 'prompt_pack', 'workflow', 'tool', 'file', 'link']),
  thumbnail_url: z.string().url().optional(),
  external_url: z.string().url().optional(),
  access_type: z.enum(['free', 'paid', 'membership_only']).default('membership_only'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  sort_order: z.number().int().default(0),
});

// ─── Webinar Schemas ─────────────────────────────
export const createWebinarSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan dash'),
  subtitle: z.string().max(300).optional(),
  body_html: z.string().optional(),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
  host_name: z.string().max(120).optional(),
  starts_at: z.string().min(1, 'Tanggal mulai wajib diisi'),
  ends_at: z.string().optional().or(z.literal('')),
  timezone: z.string().max(80).default('Asia/Jakarta'),
  capacity: z.number().int().min(1).optional().nullable(),
  join_url: z.string().url().optional().or(z.literal('')),
  calendar_url: z.string().url().optional().or(z.literal('')),
  recording_url: z.string().url().optional().or(z.literal('')),
  recording_embed_url: z.string().url().optional().or(z.literal('')),
  replay_body_html: z.string().optional(),
  replay_status: z.enum(['hidden', 'public']).default('hidden'),
  form_template_key: z.string().max(80).default('webinar_free_default'),
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(170).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  sort_order: z.number().int().default(0),
  free_registration_enabled: z.number().int().min(0).max(1).default(1),
  paid_registration_enabled: z.number().int().min(0).max(1).default(1),
  paid_registration_price: z.number().int().min(0).default(99000),
  share_required_count: z.number().int().min(1).default(2),
  share_message_template: z.string().optional().nullable(),
  short_link_enabled: z.number().int().min(0).max(1).default(1),
});

export const updateWebinarSchema = createWebinarSchema.partial();

// ─── Settings Schemas ────────────────────────────
export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value_json: z.string().min(1),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;
export type CreateBonusInput = z.infer<typeof createBonusSchema>;
export type CreateWebinarInput = z.infer<typeof createWebinarSchema>;
export type UpdateWebinarInput = z.infer<typeof updateWebinarSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RecordMilestoneInput = z.infer<typeof recordMilestoneSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;
