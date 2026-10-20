import type {
  Role, UserStatus, CourseAccessType, CourseStatus,
  LessonType, BonusType, MembershipDuration, MembershipStatus,
  OrderType, OrderStatus, PaymentStatus, CommissionStatus,
  AccessSource, ProgressStatus, WebinarStatus, WebinarReplayStatus,
  MapVisibility, MenuMilestone,
} from './constants';

// ─── User ────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  password_hash?: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  city_code?: string;
  map_visibility?: MapVisibility;
  role: Role;
  status: UserStatus;
  email_verified_at?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  city_code?: string;
  map_visibility?: MapVisibility;
  role: Role;
  status: UserStatus;
  created_at: string;
}

// ─── Member Map ──────────────────────────────────
export interface MemberMapMember {
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
  tier: 'premium' | 'free';
}

export interface MemberMapCity {
  code: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
  count: number;
  members: MemberMapMember[];
}

export interface MemberMapResponse {
  cities: MemberMapCity[];
  total_members: number;
  me: { city_code: string | null; map_visibility: MapVisibility };
}

// Daftar member satu kota, dipaginasi server-side (untuk popup peta kota besar)
export interface MemberMapCityMembersResponse {
  city_code: string;
  page: number;
  limit: number;
  total: number; // jumlah member yang bisa ditampilkan (visibility name/full)
  members: MemberMapMember[];
}

// ─── Onboarding Checklist ────────────────────────
export interface ChecklistResponse {
  profile: { done: boolean; missing: string[] };
  map: { done: boolean };
  first_lesson: { done: boolean };
  menus: { done: boolean; visited: Record<MenuMilestone, boolean> };
  completed: number;
  total: number;
}

// ─── Session ─────────────────────────────────────
export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at?: string;
}

// ─── Course ──────────────────────────────────────
export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  short_description?: string;
  thumbnail_url?: string;
  level?: string;
  category?: string;
  instructor_name?: string;
  access_type: CourseAccessType;
  price: number;
  compare_at_price?: number;
  status: CourseStatus;
  sort_order: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Module ──────────────────────────────────────
export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Lesson ──────────────────────────────────────
export interface Lesson {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  slug: string;
  lesson_type: LessonType;
  video_provider?: string;
  video_url?: string;
  content_markdown?: string;
  content_html?: string;
  content_format?: string;
  description?: string;
  resources_json?: string;
  attachment_r2_key?: string;
  is_preview: number;
  sort_order: number;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
}

// ─── Bonus ───────────────────────────────────────
export interface Bonus {
  id: string;
  slug: string;
  title: string;
  description?: string;
  bonus_type: BonusType;
  thumbnail_url?: string;
  r2_key?: string;
  external_url?: string;
  access_type: CourseAccessType;
  status: CourseStatus;
  sort_order: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Membership Plan ─────────────────────────────
export interface MembershipPlan {
  id: string;
  slug: string;
  name: string;
  description?: string;
  duration_type: MembershipDuration;
  duration_days?: number;
  price: number;
  compare_at_price?: number;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Membership ──────────────────────────────────
export interface Membership {
  id: string;
  user_id: string;
  plan_id: string;
  status: MembershipStatus;
  starts_at: string;
  expires_at?: string;
  source_order_id?: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
}

// ─── Order ───────────────────────────────────────
export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  order_type: OrderType;
  product_id: string;
  product_name: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  affiliate_code?: string;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
  paid_at?: string;
  expired_at?: string;
  cancelled_at?: string;
}

// ─── Payment ─────────────────────────────────────
export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  provider_transaction_id?: string;
  provider_payment_id?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  raw_payload_json?: string;
  created_at: string;
  updated_at: string;
  paid_at?: string;
}

// ─── User Access ─────────────────────────────────
export interface UserAccess {
  id: string;
  user_id: string;
  access_type: string;
  resource_type: string;
  resource_id: string;
  source_type: AccessSource;
  source_id?: string;
  status: string;
  starts_at: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  revoked_at?: string;
}

// ─── Enrollment ──────────────────────────────────
export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  source_access_id?: string;
  progress_percent: number;
  status: string;
  enrolled_at: string;
  completed_at?: string;
  updated_at: string;
}

// ─── Lesson Progress ─────────────────────────────
export interface LessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: ProgressStatus;
  completed_at?: string;
  updated_at: string;
}

// ─── Certificate ─────────────────────────────────
export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  enrollment_id: string;
  certificate_number: string;
  certificate_url?: string;
  r2_key?: string;
  issued_at: string;
  revoked_at?: string;
}

// ─── Affiliate ───────────────────────────────────
export interface AffiliateAccount {
  id: string;
  user_id: string;
  affiliate_code: string;
  public_ref_code?: string;
  status: string;
  default_commission_rate: number;
  payout_name?: string;
  payout_bank_name?: string;
  payout_bank_account?: string;
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommission {
  id: string;
  affiliate_code: string;
  affiliate_user_id: string;
  order_id: string;
  buyer_user_id: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  status: CommissionStatus;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  paid_at?: string;
  notes?: string;
}

// ─── Webinar ─────────────────────────────────────
export interface Webinar {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  body_html?: string;
  thumbnail_url?: string;
  host_name?: string;
  starts_at: string;
  ends_at?: string;
  timezone: string;
  capacity?: number;
  join_url?: string;
  calendar_url?: string;
  recording_url?: string;
  recording_embed_url?: string;
  replay_body_html?: string;
  replay_status: WebinarReplayStatus;
  form_template_key: string;
  seo_title?: string;
  seo_description?: string;
  status: WebinarStatus;
  sort_order: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WebinarRegistration {
  id: string;
  webinar_id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  coupon_code: string;
  affiliate_code?: string;
  status: string;
  registered_at: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
}

// ─── Webhook Event ───────────────────────────────
export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string;
  provider_event_id?: string;
  provider_transaction_id?: string;
  order_id?: string;
  raw_payload_json: string;
  processing_status: string;
  received_at: string;
  processed_at?: string;
  error_message?: string;
}

// ─── Audit Log ───────────────────────────────────
export interface AuditLog {
  id: string;
  actor_user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before_data_json?: string;
  after_data_json?: string;
  ip_hash?: string;
  created_at: string;
}

// ─── API Response ────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
