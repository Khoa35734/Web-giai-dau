import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

export const BANNERS_DIR = path.join(process.cwd(), 'uploads', 'banners');
export const DOCUMENTS_DIR = path.join(process.cwd(), 'uploads', 'documents');

if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `banner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCUMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
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

/** Middleware upload tài liệu/thẻ sinh viên KYC (SV-01, SV-04) — giới hạn 10MB, chỉ nhận ảnh. */
export const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG, WebP)'));
  },
});
