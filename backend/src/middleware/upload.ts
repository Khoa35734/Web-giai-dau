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

/**
 * [SRS 5.2] Magic-byte validation — đọc header file để xác minh đúng định dạng ảnh.
 * Ngăn chặn tấn công content-type spoofing (upload file HTML/SVG giả mạo ảnh).
 * Gọi SAU khi multer đã lưu file lên disk.
 */
export function validateMagicBytes(filePath: string): { valid: boolean; detectedType?: string; error?: string } {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return { valid: true, detectedType: 'image/jpeg' };
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
      && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) {
      return { valid: true, detectedType: 'image/png' };
    }
    // WebP: RIFF....WEBP
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
      return { valid: true, detectedType: 'image/webp' };
    }

    return { valid: false, error: 'Nội dung file không khớp với định dạng ảnh hợp lệ (JPEG/PNG/WebP). File có thể bị giả mạo.' };
  } catch {
    return { valid: false, error: 'Không thể đọc file để xác minh định dạng' };
  }
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

/** Giới hạn dung lượng tối đa cho file upload: 5MB */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Middleware upload banner giải đấu — giới hạn 5MB, kiểm tra chặt chẽ JPG/PNG/WebP. */
export const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: imageFilter,
});

/** Middleware upload tài liệu/thẻ sinh viên KYC (SV-01, SV-04) — giới hạn 5MB, kiểm tra chặt chẽ JPG/PNG/WebP. */
export const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: imageFilter,
});

/** Middleware upload hình ảnh thông dụng — giới hạn 5MB, kiểm tra chặt chẽ JPG/PNG/WebP. */
export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: imageFilter,
});
