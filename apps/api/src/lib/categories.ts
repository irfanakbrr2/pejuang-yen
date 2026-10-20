// Taxonomy kategori utama (9 seed di migration 0052).
// Category = topik. Content Type = bentuk. Asset Type (bonus) = jenis aset.

// 12 jenis aset bonus — bentuk file/resource, BUKAN kategori topik.
export const VALID_ASSET_TYPES = new Set([
  'ebook', 'template', 'checklist', 'prompt_pack', 'sop', 'worksheet',
  'swipe_file', 'source_code', 'asset_pack', 'spreadsheet', 'notion_template', 'pdf_resource',
]);

export type TaxonomyContentType = 'course' | 'bonus' | 'recording' | 'tool';

export interface CategoryAssignment {
  primaryCategoryId: string | null;
  secondaryCategoryIds: string[];
}

/**
 * Validasi & tulis mapping kategori untuk satu konten.
 * Aturan: tepat 1 primary, maksimal 2 secondary, secondary != primary.
 * Return pesan error (string) jika tidak valid, null jika sukses.
 */
export async function setContentCategories(
  db: D1Database,
  contentType: TaxonomyContentType,
  refId: string,
  assignment: CategoryAssignment
): Promise<string | null> {
  const { primaryCategoryId } = assignment;
  const secondaryIds = [...new Set(assignment.secondaryCategoryIds || [])]
    .filter((id) => id && id !== primaryCategoryId)
    .slice(0, 2);

  const allIds = [primaryCategoryId, ...secondaryIds].filter((id): id is string => !!id);
  if (allIds.length > 0) {
    const placeholders = allIds.map(() => '?').join(',');
    const found = await db.prepare(
      `SELECT COUNT(*) as n FROM categories WHERE is_active = 1 AND id IN (${placeholders})`
    ).bind(...allIds).first();
    if (((found?.n as number) || 0) !== allIds.length) {
      return 'Kategori tidak valid';
    }
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM content_categories WHERE content_type = ? AND ref_id = ?').bind(contentType, refId),
  ];
  if (primaryCategoryId) {
    statements.push(db.prepare(
      'INSERT INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES (?, ?, ?, 1, ?)'
    ).bind(contentType, refId, primaryCategoryId, now));
  }
  for (const categoryId of secondaryIds) {
    statements.push(db.prepare(
      'INSERT INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES (?, ?, ?, 0, ?)'
    ).bind(contentType, refId, categoryId, now));
  }
  await db.batch(statements);
  return null;
}

/** SQL fragment: filter konten by category slug (primary ATAU secondary). */
export function categoryFilterSql(contentTypeColumn: string, refIdColumn: string): string {
  return `EXISTS (
    SELECT 1 FROM content_categories cc
    JOIN categories cat ON cat.id = cc.category_id
    WHERE cc.content_type = ${contentTypeColumn} AND cc.ref_id = ${refIdColumn} AND cat.slug = ?
  )`;
}
