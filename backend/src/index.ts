import { app } from './app.ts';
import { env } from './config/env.ts';

app.listen(env.port, () => {
  console.log(`✅ Server đang chạy tại cổng ${env.port}`);
});
