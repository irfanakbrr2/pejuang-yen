// Event names the backend accepts from the client. Lifecycle events
// (signup_completed, payment_success, ...) are emitted server-side only.
export type ClientEventName =
  | "page_view"
  | "lesson_started"
  | "lesson_progress"
  | "checkout_intent"
  | "bonus_viewed"
  | "recording_viewed"
  | "webinar_viewed";

export interface AttributionTouch {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  landing_page?: string;
  referrer?: string;
  affiliate_code?: string;
  referral_code?: string;
  webinar_id?: string;
  ts?: string;
}

export interface Attribution {
  first: AttributionTouch | null;
  last: AttributionTouch | null;
}

export interface TrackingEventPayload {
  event_name: ClientEventName;
  event_category?: string;
  anonymous_id?: string;
  session_id?: string;
  page_url?: string;
  referrer_url?: string;
  landing_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  affiliate_code?: string;
  referral_code?: string;
  course_id?: string;
  lesson_id?: string;
  webinar_id?: string;
  bonus_id?: string;
  recording_id?: string;
  coupon_code?: string;
  metadata?: Record<string, unknown>;
}

export type TrackProps = Omit<TrackingEventPayload, "event_name" | "anonymous_id" | "session_id" | "page_url">;
