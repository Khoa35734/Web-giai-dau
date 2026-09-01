import { app } from './app.ts';
import { env } from './config/env.ts';
import { runSchemaPreflight } from './config/schemaPreflight.ts';

app.listen(env.port, () => {
  console.log(`✅ Server đang chạy tại cổng ${env.port}`);
  // Chạy kiểm tra schema drift nền khi khởi động
  runSchemaPreflight().catch((err) => {
    console.error('⚠️ [SCHEMA PREFLIGHT] Lỗi preflight check:', err);
  });
});

