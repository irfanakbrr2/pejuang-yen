import { isEmailSuppressed } from './email-suppression';

export type EmailType = 'transactional' | 'marketing' | 'lifecycle' | 'notification';

export interface SendGuardResult {
  allowed: boolean;
  reason?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function canSendEmail(
  email: string,
  emailType: EmailType,
  db: D1Database
): Promise<SendGuardResult> {
  if (!email || !EMAIL_REGEX.test(email)) {
    return { allowed: false, reason: 'invalid_email' };
  }

  const suppressed = await isEmailSuppressed(email, db);
  if (suppressed) {
    return { allowed: false, reason: 'suppressed' };
  }

  // Transactional and notifications bypass consent check
  if (emailType === 'transactional' || emailType === 'notification') {
    return { allowed: true };
  }

  const profile = await db.prepare(
    'SELECT email_status, marketing_consent FROM email_marketing_profiles WHERE user_id = (SELECT id FROM users WHERE email = ?)'
  ).bind(email.toLowerCase()).first() as { email_status: string; marketing_consent: number } | null;

  if (!profile) {
    // No profile = unknown, allow marketing if not suppressed
    return { allowed: true };
  }

  if (profile.email_status === 'bounced') {
    return { allowed: false, reason: 'bounced' };
  }

  if (profile.email_status === 'unsubscribed') {
    return { allowed: false, reason: 'unsubscribed' };
  }

  if (profile.email_status === 'blacklisted' || profile.email_status === 'invalid') {
    return { allowed: false, reason: profile.email_status };
  }

  if ((emailType === 'marketing' || emailType === 'lifecycle') && !profile.marketing_consent) {
    return { allowed: false, reason: 'no_marketing_consent' };
  }

  return { allowed: true };
}
