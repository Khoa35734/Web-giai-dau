import { Pool } from 'pg';
import { env } from './env.ts';

if (!env.supabaseDatabaseUrl) {
  throw new Error('Missing SUPABASE_DATABASE_URL environment variable');
}

/**
 * Connection pool PostgreSQL của Supabase — tái sử dụng kết nối hiệu quả.
 */
const pool = new Pool({
  connectionString: env.supabaseDatabaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Kiểm tra kết nối khi khởi động
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Kết nối Supabase PostgreSQL thất bại:', err.message);
  } else {
    console.log('✅ Kết nối Supabase PostgreSQL thành công!');
    release();
  }
});

// Xử lý lỗi bất ngờ từ pool
pool.on('error', (err) => {
  console.error('❌ Lỗi Supabase PostgreSQL pool:', err.message);
});

export default pool;
