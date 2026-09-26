import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validateImageFile,
  validateMagicBytes,
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

  describe('validateMagicBytes - Image File Signature Validation [SRS 5.2]', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dut-upload-test-'));

    it('should recognize valid JPEG file by magic bytes (FF D8 FF)', () => {
      const jpgPath = path.join(tempDir, 'valid.jpg');
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      fs.writeFileSync(jpgPath, buf);

      const result = validateMagicBytes(jpgPath);
      assert.equal(result.valid, true);
      assert.equal(result.detectedType, 'image/jpeg');
    });

    it('should recognize valid PNG file by magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
      const pngPath = path.join(tempDir, 'valid.png');
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      fs.writeFileSync(pngPath, buf);

      const result = validateMagicBytes(pngPath);
      assert.equal(result.valid, true);
      assert.equal(result.detectedType, 'image/png');
    });

    it('should recognize valid WebP file by magic bytes (RIFF....WEBP)', () => {
      const webpPath = path.join(tempDir, 'valid.webp');
      const buf = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // 'RIFF'
        0x24, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // 'WEBP'
      ]);
      fs.writeFileSync(webpPath, buf);

      const result = validateMagicBytes(webpPath);
      assert.equal(result.valid, true);
      assert.equal(result.detectedType, 'image/webp');
    });

    it('should reject spoofed files (e.g. text/HTML/SVG saved with .jpg extension)', () => {
      const spoofedPath = path.join(tempDir, 'fake.jpg');
      fs.writeFileSync(spoofedPath, '<html><script>alert("xss")</script></html>');

      const result = validateMagicBytes(spoofedPath);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /không khớp với định dạng ảnh/i);
    });

    it('should reject non-existent or unreadable file paths', () => {
      const invalidPath = path.join(tempDir, 'does-not-exist.jpg');
      const result = validateMagicBytes(invalidPath);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /không thể đọc file/i);
    });
  });
});

