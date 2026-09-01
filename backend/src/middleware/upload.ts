import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

export const BANNERS_DIR = path.join(process.cwd(), 'uploads', 'banners');
export const DOCUMENTS_DIR = path.join(process.cwd(), 'uploads', 'documents');
export const IMAGES_DIR = path.join(process.cwd(), 'uploads', 'images');

for (const dir of [BANNERS_DIR, DOCUMENTS_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Danh sách đuôi file được phép (lowercase) */
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** Danh sách MIME types được phép (lowercase) */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

/**
 * Kiểm tra tính hợp lệ của file upload:
 * 1. Đuôi file (extension) phải thuộc whitelist.
 * 2. MIME type phải thuộc whitelist.
 * 3. Extension và MIME type phải khớp với nhau (ngăn chặn bypass bằng file extension giả mạo).
 */
export function validateImageFile(file: { originalname?: string; mimetype?: string }): {
  valid: boolean;
  error?: string;
  safeExt?: AllowedExtension;
} {
  const originalname = file.originalname || '';
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(originalname).toLowerCase() as AllowedExtension;

  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: 'Chỉ chấp nhận file ảnh có phần mở rộng .jpg, .jpeg, .png hoặc .webp',
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimetype as any)) {
    return {
      valid: false,
      error: 'Định dạng MIME của file không hợp lệ (chỉ chấp nhận image/jpeg, image/png, image/webp)',
    };
  }

  // Đối chiếu tính nhất quán giữa Extension và MIME
  const isJpg = (ext === '.jpg' || ext === '.jpeg') && (mimetype === 'image/jpeg' || mimetype === 'image/jpg');
  const isPng = ext === '.png' && mimetype === 'image/png';
  const isWebp = ext === '.webp' && mimetype === 'image/webp';

  if (!isJpg && !isPng && !isWebp) {
    return {
      valid: false,
      error: 'Phần mở rộng file không khớp với định dạng MIME thực tế của ảnh',
    };
  }

  return { valid: true, safeExt: ext };
}

const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BANNERS_DIR),
  filename: (_req, file, cb) => {
    const check = validateImageFile(file);
    const safeExt = check.safeExt || '.jpg';
    cb(null, `banner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCUMENTS_DIR),
  filename: (_req, file, cb) => {
    const check = validateImageFile(file);
    const safeExt = check.safeExt || '.jpg';
    cb(null, `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const check = validateImageFile(file);
    const safeExt = check.safeExt || '.jpg';
    cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const result = validateImageFile(file);
  if (result.valid) {
    cb(null, true);
  } else {
    cb(new Error(result.error || 'Chỉ chấp nhận file ảnh (JPG, PNG, WebP)'));
  }
};

/** Middleware upload banner giải đấu — giới hạn 10MB, kiểm tra chặt chẽ JPG/PNG/WebP. */
export const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

/** Middleware upload tài liệu/thẻ sinh viên KYC (SV-01, SV-04) — giới hạn 10MB, kiểm tra chặt chẽ JPG/PNG/WebP. */
export const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

/** Middleware upload hình ảnh thông dụng — giới hạn 10MB, kiểm tra chặt chẽ JPG/PNG/WebP. */
export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});
