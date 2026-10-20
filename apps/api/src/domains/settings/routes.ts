import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { writeAuditLog } from '../../lib/audit';
import { FREE_AFFILIATE_MAX_COMMISSION_RATE } from '../../lib/settings';

const settingsRoutes = new Hono<{ Bindings: Env }>();
settingsRoutes.use('*', authMiddleware());
settingsRoutes.use('*', requireRole('admin', 'super_admin'));

const SECRET_SETTING_KEYS = new Set([
  'mailketing_api_token',
  'mailketing_webhook_secret',
  'sumopod_api_key',
  'whatsapp_api_token',
]);

function parseSettingValue(valueJson: unknown): unknown {
  if (typeof valueJson !== 'string') return valueJson;
  try {
    return JSON.parse(valueJson);
  } catch {
    return valueJson;
  }
}

function hasConfiguredSecret(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function redactSetting(key: string, value: unknown): unknown {
  if (!SECRET_SETTING_KEYS.has(key)) return value;
  return '';
}

function secretConfiguredKey(key: string): string {
  return `${key}_configured`;
}

// GET /api/admin/settings
settingsRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value_json, updated_at FROM app_settings ORDER BY key ASC').all();
  const settings: Record<string, unknown> = {};
  for (const row of rows.results) {
    const key = row.key as string;
    const value = parseSettingValue(row.value_json);
    settings[key] = redactSetting(key, value);
    if (SECRET_SETTING_KEYS.has(key)) {
      settings[secretConfiguredKey(key)] = hasConfiguredSecret(value);
    }
  }
  return success(c, settings);
});

// GET /api/admin/settings/:key
settingsRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');
  const row = await c.env.DB.prepare('SELECT key, value_json, updated_at FROM app_settings WHERE key = ?').bind(key).first();
  if (!row) return error(c, 'Setting not found', 404);

  const value = parseSettingValue(row.value_json);
  return success(c, {
    key: row.key,
    value: redactSetting(key, value),
    configured: SECRET_SETTING_KEYS.has(key) ? hasConfiguredSecret(value) : undefined,
    updated_at: row.updated_at,
  });
});

// PUT /api/admin/settings/:key — super_admin only for critical settings
settingsRoutes.put('/:key', requireRole('super_admin'), async (c) => {
  const key = c.req.param('key') || '';
  const body = await c.req.json() as { value: unknown };
  const user = c.get('user');

  if (body.value === undefined) return error(c, 'value is required', 400);
  if (SECRET_SETTING_KEYS.has(key) && typeof body.value === 'string' && body.value.trim() === '') {
    return success(c, { message: 'Secret unchanged', key, unchanged: true });
  }
  if (key === 'default_commission_rate') {
    const rate = Number(body.value);
    if (!Number.isFinite(rate) || rate < 0 || rate > FREE_AFFILIATE_MAX_COMMISSION_RATE) {
      return error(c, `Default commission rate must be between 0 and ${FREE_AFFILIATE_MAX_COMMISSION_RATE}`, 400);
    }
  }

  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT value_json FROM app_settings WHERE key = ?').bind(key).first();
  const beforeValue = before ? parseSettingValue(before.value_json as string) : null;

  await c.env.DB.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
  ).bind(key, JSON.stringify(body.value), now, user.id).run();

  await writeAuditLog(c.env, {
    actorUserId: user.id,
    action: 'update_setting',
    entityType: 'app_settings',
    entityId: key,
    before: SECRET_SETTING_KEYS.has(key) ? { configured: hasConfiguredSecret(beforeValue) } : beforeValue,
    after: SECRET_SETTING_KEYS.has(key) ? { configured: hasConfiguredSecret(body.value) } : body.value,
  });

  return success(c, { message: 'Setting updated', key });
});

export default settingsRoutes;
