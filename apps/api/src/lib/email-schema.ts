export interface EmailSchemaColumnStatus {
  table: string;
  column: string;
  exists: boolean;
}

export interface EmailSchemaStatus {
  ok: boolean;
  requiredColumns: EmailSchemaColumnStatus[];
  missingColumns: EmailSchemaColumnStatus[];
}

const REQUIRED_EMAIL_COLUMNS: Record<string, string[]> = {
  email_events: ['sequence_step_id'],
  user_email_sequence_state: ['failure_count', 'last_error'],
  email_sequence_steps: ['preview_text'],
};

async function listColumns(db: D1Database, table: string): Promise<Set<string>> {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return new Set((result.results || []).map((row) => row.name));
}

export async function assertEmailSchema(db: D1Database): Promise<EmailSchemaStatus> {
  const requiredColumns: EmailSchemaColumnStatus[] = [];

  for (const [table, columns] of Object.entries(REQUIRED_EMAIL_COLUMNS)) {
    const available = await listColumns(db, table);
    for (const column of columns) {
      requiredColumns.push({ table, column, exists: available.has(column) });
    }
  }

  const missingColumns = requiredColumns.filter((item) => !item.exists);
  return {
    ok: missingColumns.length === 0,
    requiredColumns,
    missingColumns,
  };
}
