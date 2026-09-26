import { Router } from 'express';
import pool from '../config/db.ts';
import * as registrationController from '../controllers/registration.ts';
import { verifyToken } from '../middleware/auth.ts';

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

/** Danh sách Khoa thuộc Trường ĐH Bách Khoa - ĐHĐN [SV-01] */
router.get('/dut/faculties', (_req, res) => {
  const faculties = [
    'Khoa Công nghệ Thông tin',
    'Khoa Điện tử - Viễn thông',
    'Khoa Điện',
    'Khoa Cơ khí',
    'Khoa Cơ khí Giao thông',
    'Khoa Xây dựng Cầu - Đường',
    'Khoa Xây dựng Dân dụng và Công nghiệp',
    'Khoa Xây dựng Thủy lợi - Thủy điện',
    'Khoa Hóa',
    'Khoa Môi trường',
    'Khoa Quản lý Dự án',
    'Khoa Kiến trúc',
    'Khoa Khoa học Công nghệ Tiên tiến (FAST)',
  ];
  res.json({ success: true, data: faculties });
});

/** [AD-03] Đăng ký của các giải do user phụ trách (Admin / CTV) */
router.get('/my-registrations', verifyToken, registrationController.myRegistrations);
router.get('/my-tournaments', verifyToken, registrationController.myTournaments);

export default router;
