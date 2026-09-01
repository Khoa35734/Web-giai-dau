import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImageFile,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_SIZE,
} from '../src/middleware/upload.ts';

describe('Upload Middleware & Security Validation', () => {
  describe('validateImageFile - Extension & MIME Whitelist', () => {
    it('should allow valid JPEG files (.jpg, .jpeg with image/jpeg)', () => {
      const jpgResult = validateImageFile({ originalname: 'student_card.jpg', mimetype: 'image/jpeg' });
      assert.equal(jpgResult.valid, true);
      assert.equal(jpgResult.safeExt, '.jpg');

      const jpegResult = validateImageFile({ originalname: 'selfie.jpeg', mimetype: 'image/jpeg' });
      assert.equal(jpegResult.valid, true);
      assert.equal(jpegResult.safeExt, '.jpeg');
    });

    it('should allow valid PNG files (.png with image/png)', () => {
      const result = validateImageFile({ originalname: 'avatar.png', mimetype: 'image/png' });
      assert.equal(result.valid, true);
      assert.equal(result.safeExt, '.png');
    });

    it('should allow valid WebP files (.webp with image/webp)', () => {
      const result = validateImageFile({ originalname: 'banner.webp', mimetype: 'image/webp' });
      assert.equal(result.valid, true);
      assert.equal(result.safeExt, '.webp');
    });

    it('should reject files with disallowed extensions (e.g. .exe, .php, .pdf, .sh, .html)', () => {
      const phpResult = validateImageFile({ originalname: 'webshell.php', mimetype: 'image/jpeg' });
      assert.equal(phpResult.valid, false);
      assert.match(phpResult.error || '', /phần mở rộng/i);

      const exeResult = validateImageFile({ originalname: 'malware.exe', mimetype: 'image/png' });
      assert.equal(exeResult.valid, false);

      const pdfResult = validateImageFile({ originalname: 'document.pdf', mimetype: 'application/pdf' });
      assert.equal(pdfResult.valid, false);
    });

    it('should reject files with disallowed MIME types (e.g. text/plain, application/octet-stream, image/svg+xml)', () => {
      const svgResult = validateImageFile({ originalname: 'icon.svg', mimetype: 'image/svg+xml' });
      assert.equal(svgResult.valid, false);

      const textResult = validateImageFile({ originalname: 'test.jpg', mimetype: 'text/plain' });
      assert.equal(textResult.valid, false);
    });

    it('should reject spoofed extension/MIME combinations (e.g. .jpg extension with image/png MIME)', () => {
      const mismatchedResult = validateImageFile({ originalname: 'fake.jpg', mimetype: 'image/png' });
      assert.equal(mismatchedResult.valid, false);
      assert.match(mismatchedResult.error || '', /không khớp/i);
    });

    it('should reject files with missing originalname or mimetype', () => {
      const emptyResult = validateImageFile({});
      assert.equal(emptyResult.valid, false);
    });
  });

  describe('Upload Constraints & Security Constants', () => {
    it('should contain strictly expected image extensions and MIME types', () => {
      assert.deepEqual(Array.from(ALLOWED_EXTENSIONS), ['.jpg', '.jpeg', '.png', '.webp']);
      assert.ok(ALLOWED_MIME_TYPES.includes('image/jpeg'));
      assert.ok(ALLOWED_MIME_TYPES.includes('image/png'));
      assert.ok(ALLOWED_MIME_TYPES.includes('image/webp'));
    });

    it('should enforce 5MB maximum upload limit', () => {
      assert.equal(MAX_UPLOAD_SIZE, 5 * 1024 * 1024);
    });
  });
});
