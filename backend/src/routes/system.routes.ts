import { Router } from 'express';
import pool from '../config/db.ts';

const router = Router();

/** Test route — kiểm tra server hoạt động. */
router.get('/message', (_req, res) => {
  res.json({ message: 'Xin chào từ Node.js Server!' });
});

/** Test route — kiểm tra kết nối database. */
router.get('/db-test', async (_req, res) => {
  try {
    const result = await pool.query<{ current_time: string }>('SELECT NOW() AS current_time');
    res.json({
      success: true,
      message: 'Kết nối database thành công!',
      server_time: result.rows[0]?.current_time,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Kết nối database thất bại!',
      error: (err as Error).message,
    });
  }
});

export default router;
