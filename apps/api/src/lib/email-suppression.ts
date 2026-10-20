export async function isEmailSuppressed(email: string, db: D1Database): Promise<boolean> {
  const row = await db.prepare(
    'SELECT id FROM email_suppression_list WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  return row !== null;
}

export async function suppressEmail(
  email: string,
  reason: string,
  source: string,
  db: D1Database,
  rawPayload?: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR IGNORE INTO email_suppression_list (id, email, reason, source, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), email.toLowerCase(), reason, source, rawPayload || null, now).run();
}

export async function cancelUserSequences(userId: string, db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE user_email_sequence_state SET status = 'cancelled', updated_at = ?
     WHERE user_id = ? AND status IN ('active', 'paused')`
  ).bind(now, userId).run();
}

export async function updateEmailMarketingProfile(
  userId: string,
  email: string,
  updates: Record<string, unknown>,
  db: D1Database
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.prepare(
    'SELECT id FROM email_marketing_profiles WHERE user_id = ?'
  ).bind(userId).first();

  if (existing) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), now, userId];
    await db.prepare(
      `UPDATE email_marketing_profiles SET ${setClauses}, updated_at = ? WHERE user_id = ?`
    ).bind(...values).run();
  } else {
    const id = crypto.randomUUID();
    const fields = ['id', 'user_id', 'updated_at', 'created_at', ...Object.keys(updates)];
    const placeholders = fields.map(() => '?').join(', ');
    const values = [id, userId, now, now, ...Object.values(updates)];
    await db.prepare(
      `INSERT INTO email_marketing_profiles (${fields.join(', ')}) VALUES (${placeholders})`
    ).bind(...values).run();
  }
}

export async function adjustEngagementScore(
  userId: string,
  email: string,
  delta: number,
  db: D1Database
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.prepare(
    'SELECT id FROM email_marketing_profiles WHERE user_id = ?'
  ).bind(userId).first();

  if (existing) {
    await db.prepare(
      `UPDATE email_marketing_profiles SET engagement_score = engagement_score + ?, updated_at = ? WHERE user_id = ?`
    ).bind(delta, now, userId).run();
  } else {
    await db.prepare(
      `INSERT INTO email_marketing_profiles (id, user_id, engagement_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), userId, Math.max(0, delta), now, now).run();
  }
}

export async function findOrCreateEmailProfile(
  email: string,
  db: D1Database,
  extraFields?: Record<string, unknown>
): Promise<{ userId: string; isNew: boolean }> {
  const now = new Date().toISOString();

  const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();

  if (!user) {
    const userId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO users (id, email, name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'user', 'active', ?, ?)`
    ).bind(userId, email.toLowerCase(), email.split('@')[0], now, now).run();

    await db.prepare(
      `INSERT INTO email_marketing_profiles (id, user_id, email_status, marketing_consent, engagement_score, created_at, updated_at)
       VALUES (?, ?, 'subscribed', 1, 5, ?, ?)`
    ).bind(crypto.randomUUID(), userId, now, now).run();

    return { userId, isNew: true };
  }

  const userId = user.id as string;
  const profile = await db.prepare(
    'SELECT id FROM email_marketing_profiles WHERE user_id = ?'
  ).bind(userId).first();

  if (!profile) {
    const profileFields: Record<string, unknown> = {
      email_status: 'subscribed',
      marketing_consent: 1,
      engagement_score: 5,
      ...extraFields,
    };
    const fields = ['id', 'user_id', 'created_at', 'updated_at', ...Object.keys(profileFields)];
    const placeholders = fields.map(() => '?').join(', ');
    const values = [crypto.randomUUID(), userId, now, now, ...Object.values(profileFields)];
    await db.prepare(
      `INSERT INTO email_marketing_profiles (${fields.join(', ')}) VALUES (${placeholders})`
    ).bind(...values).run();
  }

  return { userId, isNew: false };
}
