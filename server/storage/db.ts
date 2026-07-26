// DataHive 存储层 · RDS(MySQL) 连接池
// 凭据一律从环境变量读取(见 .env.example)，绝不硬编码。
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      throw new Error('[storage/db] 缺少 DB_* 环境变量，请参考 .env.example 配置');
    }
    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT) || 3306,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+08:00',
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T;
}

// 连通性自检：SELECT 1
export async function ping(): Promise<boolean> {
  const rows = await query<any[]>('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}

export async function closePool(): Promise<void> {
  if (pool) { await pool.end(); pool = null; }
}
