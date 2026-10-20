import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const storageRoutes = new Hono<{ Bindings: Env }>();
storageRoutes.use('*', authMiddleware());
storageRoutes.use('*', requireRole('admin', 'super_admin'));
// R2 belum aktif di akun (Free plan) → kembalikan pesan rapi, bukan 500.
storageRoutes.use('*', async (c, next) => {
  if (!c.env.R2) return error(c, 'Penyimpanan file (R2) belum aktif. Aktifkan R2 di Cloudflare untuk fitur upload/hapus file.', 503);
  return next();
});

// POST /api/admin/storage/upload — upload file to R2
storageRoutes.post('/upload', async (c) => {
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return error(c, 'multipart/form-data required', 400);

  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'uploads';

  if (!file) return error(c, 'file is required', 400);

  const maxSizeMb = 50;
  if (file.size > maxSizeMb * 1024 * 1024) {
    return error(c, `File size exceeds ${maxSizeMb}MB limit`, 413);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return success(c, { key, original_name: file.name, size: file.size, content_type: file.type }, 201);
});

// DELETE /api/admin/storage/:key — delete file from R2
storageRoutes.delete('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  await c.env.R2.delete(key);
  return success(c, { message: 'File deleted', key });
});

// GET /api/admin/storage/signed-url — get temporary access URL for a private R2 object
storageRoutes.get('/signed-url', async (c) => {
  const key = c.req.query('key');
  if (!key) return error(c, 'key is required', 400);

  const object = await c.env.R2.head(key);
  if (!object) return error(c, 'File not found', 404);

  // R2 does not natively support presigned URLs from Workers without a custom domain.
  // Return the R2 public URL if public access is configured.
  const fileUrl = `https://file.pejuangyen.com/${key}`;

  return success(c, { url: fileUrl, key, size: object.size, content_type: object.httpMetadata?.contentType });
});

export default storageRoutes;
