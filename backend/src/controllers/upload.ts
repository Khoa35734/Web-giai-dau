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
