// 监控源管理(读写 DB source 表)——"加数据源"从改代码变成填一行记录。
import { query } from '../storage/db';
import type { SourceConfig } from './types';

export async function listEnabledSources(type: string): Promise<SourceConfig[]> {
  const rows = await query<any[]>(
    'SELECT source_type, source_id, name, sync_cursor, config FROM source WHERE source_type=? AND enabled=1',
    [type],
  );
  return rows.map((r) => ({
    source_type: r.source_type,
    source_id: r.source_id,
    name: r.name,
    sync_cursor: r.sync_cursor,
    config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
  }));
}

export async function getSource(source_id: string): Promise<SourceConfig | null> {
  const rows = await query<any[]>(
    'SELECT source_type, source_id, name, sync_cursor, config FROM source WHERE source_id=? LIMIT 1',
    [source_id],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    source_type: r.source_type,
    source_id: r.source_id,
    name: r.name,
    sync_cursor: r.sync_cursor,
    config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
  };
}

export async function upsertSource(s: {
  source_type: string;
  source_id: string;
  name: string;
  config?: any;
  enabled?: number;
}): Promise<void> {
  await query(
    `INSERT INTO source (source_type, source_id, name, enabled, config)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), enabled=VALUES(enabled), config=VALUES(config)`,
    [s.source_type, s.source_id, s.name, s.enabled ?? 1, s.config ? JSON.stringify(s.config) : null],
  );
}
