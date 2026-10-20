import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { AutomationService } from './service';
import type { AutomationConfig, AutomationStatus } from './types';

const automationsRoutes = new Hono<{ Bindings: Env }>();
automationsRoutes.use('*', authMiddleware());

// ─── Templates ───────────────────────────────────────────────────
automationsRoutes.get('/templates', (c) => {
  const svc = new AutomationService(c.env);
  return success(c, svc.listTemplates());
});

// ─── Credentials (vault) ─────────────────────────────────────────
automationsRoutes.get('/credentials', async (c) => {
  const svc = new AutomationService(c.env);
  return success(c, await svc.listCredentials(c.get('user').id));
});

automationsRoutes.post('/credentials', async (c) => {
  const user = c.get('user');
  let body: { type?: string; label?: string; fields?: Record<string, string> };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  const svc = new AutomationService(c.env);
  const r = await svc.createCredential(user.id, {
    type: body.type || '', label: body.label || '', fields: body.fields || {},
  });
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data, r.status || 201);
});

automationsRoutes.delete('/credentials/:id', async (c) => {
  const svc = new AutomationService(c.env);
  const r = await svc.deleteCredential(c.req.param('id'), c.get('user').id);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

// ─── Automations ─────────────────────────────────────────────────
automationsRoutes.get('/', async (c) => {
  const svc = new AutomationService(c.env);
  return success(c, await svc.list(c.get('user').id));
});

automationsRoutes.post('/', async (c) => {
  const user = c.get('user');
  let body: { templateKey?: string; name?: string; config?: AutomationConfig; topics?: string[] };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  const svc = new AutomationService(c.env);
  const r = await svc.create(user.id, {
    templateKey: body.templateKey || '',
    name: body.name || '',
    config: body.config as AutomationConfig,
    topics: body.topics,
  });
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data, r.status || 201);
});

automationsRoutes.get('/:id', async (c) => {
  const svc = new AutomationService(c.env);
  const r = await svc.get(c.req.param('id'), c.get('user').id);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

automationsRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  let body: { name?: string; config?: AutomationConfig };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  const svc = new AutomationService(c.env);
  const r = await svc.update(c.req.param('id'), user.id, body);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

automationsRoutes.post('/:id/status', async (c) => {
  const user = c.get('user');
  let body: { status?: AutomationStatus };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  if (body.status !== 'active' && body.status !== 'paused' && body.status !== 'draft') {
    return error(c, 'Status tidak valid', 400);
  }
  const svc = new AutomationService(c.env);
  const r = await svc.setStatus(c.req.param('id'), user.id, body.status);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

automationsRoutes.delete('/:id', async (c) => {
  const svc = new AutomationService(c.env);
  const r = await svc.remove(c.req.param('id'), c.get('user').id);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

automationsRoutes.post('/:id/run', async (c) => {
  const svc = new AutomationService(c.env);
  const r = await svc.runNow(c.req.param('id'), c.get('user').id);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data, r.status || 202);
});

// ─── Topics ──────────────────────────────────────────────────────
automationsRoutes.post('/:id/topics', async (c) => {
  const user = c.get('user');
  let body: { topics?: string[] };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  const svc = new AutomationService(c.env);
  const r = await svc.addTopics(c.req.param('id'), user.id, body.topics || []);
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

automationsRoutes.delete('/:id/topics/:topicId', async (c) => {
  const svc = new AutomationService(c.env);
  const r = await svc.deleteTopic(c.req.param('id'), c.get('user').id, c.req.param('topicId'));
  if (r.error) return error(c, r.error, r.status || 400);
  return success(c, r.data);
});

export default automationsRoutes;
