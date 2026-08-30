import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.ts';

/** Upload banner — file đã được multer xử lý trong middleware. */
export const uploadBanner = asyncHandler(async (req, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
  }
  const url = `${req.protocol}://${req.get('host')}/api/banners/${req.file.filename}`;
  return res.json({ success: true, url });
});

/** Upload tài liệu / ảnh thẻ sinh viên xác thực KYC (SV-01, SV-04). */
export const uploadDocument = asyncHandler(async (req, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
  }
  const url = `${req.protocol}://${req.get('host')}/api/documents/${req.file.filename}`;
  return res.json({ success: true, url });
});
