import { Pool } from 'pg';
import { env } from './env.ts';

/**
 * Connection pool PostgreSQL — tái sử dụng kết nối hiệu quả.
 */
const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Kiểm tra kết nối khi khởi động
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Kết nối PostgreSQL thất bại:', err.message);
  } else {
    console.log('✅ Kết nối PostgreSQL thành công!');
    release();
  }
});

// Xử lý lỗi bất ngờ từ pool
pool.on('error', (err) => {
  console.error('❌ Lỗi PostgreSQL pool:', err.message);
});

export default pool;
