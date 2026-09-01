import fs from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { validateMagicBytes } from '../middleware/upload.ts';

/**
 * [SRS 5.2] Kiểm tra magic bytes sau khi multer đã lưu file.
 * Nếu file giả mạo → xóa ngay và trả 400.
 */
function rejectSpoofedFile(filePath: string, res: Response): boolean {
  const check = validateMagicBytes(filePath);
  if (!check.valid) {
    // Xóa file giả mạo ngay lập tức
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    res.status(400).json({ success: false, message: check.error || 'File không hợp lệ' });
    return true;
  }
  return false;
}

/** Upload banner giải đấu — file đã được multer xử lý trong middleware. */
export const uploadBanner = asyncHandler(async (req, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
  }
  const filePath = path.resolve(req.file.path);
  if (rejectSpoofedFile(filePath, res)) return;
  const url = `${req.protocol}://${req.get('host')}/api/banners/${req.file.filename}`;
  return res.json({ success: true, url });
});

/** Upload tài liệu / ảnh thẻ sinh viên xác thực KYC (SV-01, SV-04). */
export const uploadDocument = asyncHandler(async (req, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
  }
  const filePath = path.resolve(req.file.path);
  if (rejectSpoofedFile(filePath, res)) return;
  const url = `${req.protocol}://${req.get('host')}/api/documents/${req.file.filename}`;
  return res.json({ success: true, url });
});

/** Upload hình ảnh thông dụng. */
export const uploadImage = asyncHandler(async (req, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
  }
  const filePath = path.resolve(req.file.path);
  if (rejectSpoofedFile(filePath, res)) return;
  const url = `${req.protocol}://${req.get('host')}/api/images/${req.file.filename}`;
  return res.json({ success: true, url });
});

