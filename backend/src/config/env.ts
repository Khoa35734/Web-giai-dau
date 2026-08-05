import dotenv from 'dotenv';

dotenv.config();

/**
 * Tập trung toàn bộ biến môi trường tại một nơi.
 * Mọi nơi khác trong app chỉ import từ đây — không truy cập process.env trực tiếp.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET ?? 'your-secret-key-change-in-production',
  jwtExpire: process.env.JWT_EXPIRE ?? '24h',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'web_giai_dau',
  },
} as const;
