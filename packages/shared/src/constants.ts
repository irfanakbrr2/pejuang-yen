// Roles
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// User Status
export const USER_STATUS = {
  ACTIVE: 'active',
  BANNED: 'banned',
  SUSPENDED: 'suspended',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

// Course Access Type
export const COURSE_ACCESS_TYPE = {
  FREE: 'free',
  PAID: 'paid',
  MEMBERSHIP_ONLY: 'membership_only',
} as const;

export type CourseAccessType = (typeof COURSE_ACCESS_TYPE)[keyof typeof COURSE_ACCESS_TYPE];

// Course Status
export const COURSE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

// Lesson Type
export const LESSON_TYPE = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
  RESOURCE: 'resource',
} as const;

export type LessonType = (typeof LESSON_TYPE)[keyof typeof LESSON_TYPE];

// Bonus Type
export const BONUS_TYPE = {
  EBOOK: 'ebook',
  TEMPLATE: 'template',
  PROMPT_PACK: 'prompt_pack',
  WORKFLOW: 'workflow',
  TOOL: 'tool',
  FILE: 'file',
  LINK: 'link',
} as const;

export type BonusType = (typeof BONUS_TYPE)[keyof typeof BONUS_TYPE];

// Membership Duration Type
export const MEMBERSHIP_DURATION = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
  CUSTOM: 'custom',
} as const;

export type MembershipDuration = (typeof MEMBERSHIP_DURATION)[keyof typeof MEMBERSHIP_DURATION];

// Membership Status
export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REVOKED: 'revoked',
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

// Order Type
export const ORDER_TYPE = {
  COURSE: 'course',
  MEMBERSHIP: 'membership',
  BONUS: 'bonus',
  BUNDLE: 'bundle',
} as const;

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

// Order Status
export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// Commission Status
export const COMMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
} as const;

export type CommissionStatus = (typeof COMMISSION_STATUS)[keyof typeof COMMISSION_STATUS];

// Webhook Processing Status
export const WEBHOOK_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type WebhookStatus = (typeof WEBHOOK_STATUS)[keyof typeof WEBHOOK_STATUS];

// Access Source Type
export const ACCESS_SOURCE = {
  FREE_ENROLLMENT: 'free_enrollment',
  PURCHASE: 'purchase',
  MEMBERSHIP: 'membership',
  ADMIN_GRANT: 'admin_grant',
} as const;

export type AccessSource = (typeof ACCESS_SOURCE)[keyof typeof ACCESS_SOURCE];

// Lesson Progress Status
export const PROGRESS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export type ProgressStatus = (typeof PROGRESS_STATUS)[keyof typeof PROGRESS_STATUS];

// Webinar Status
export const WEBINAR_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type WebinarStatus = (typeof WEBINAR_STATUS)[keyof typeof WEBINAR_STATUS];

// Webinar Replay Status
export const WEBINAR_REPLAY_STATUS = {
  HIDDEN: 'hidden',
  PUBLIC: 'public',
} as const;

export type WebinarReplayStatus = (typeof WEBINAR_REPLAY_STATUS)[keyof typeof WEBINAR_REPLAY_STATUS];

// Member Map Visibility (opt-in; default hidden)
export const MAP_VISIBILITY = {
  HIDDEN: 'hidden',
  ANONYMOUS: 'anonymous',
  NAME: 'name',
  FULL: 'full',
} as const;

export type MapVisibility = (typeof MAP_VISIBILITY)[keyof typeof MAP_VISIBILITY];

// Menu-visit milestones (dashboard onboarding checklist)
// Pejuang Yen: hanya halaman yang TAMPIL di menu 4 pilar (community/tools/bonuses disembunyikan).
export const MENU_MILESTONES = [
  'visited_my_classes',
  'visited_affiliate',
  'visited_certificates',
] as const;

export type MenuMilestone = (typeof MENU_MILESTONES)[number];
