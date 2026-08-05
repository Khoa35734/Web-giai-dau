import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

/** 404 cho các route không tồn tại. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, message: `Không tìm thấy: ${req.method} ${req.originalUrl}` });
}

/** Error handler tập trung — đảm bảo luôn trả JSON thay vì HTML mặc định. */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Lỗi từ multer (upload file)
  if (err instanceof multer.MulterError || err.message === 'Chỉ chấp nhận file ảnh') {
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ success: false, message: err.message || 'Lỗi máy chủ nội bộ' });
}
