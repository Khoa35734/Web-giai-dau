import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

export const BANNERS_DIR = path.join(process.cwd(), 'uploads', 'banners');

if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `banner_${Date.now()}${ext}`);
  },
});

/** Middleware upload banner — giới hạn 10MB, chỉ nhận ảnh. */
export const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
});
