import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { validateDutStudentId, DUT_FACULTY_MAP } from './dutIdentity.ts';

export interface StudentCardOcrResult {
  success: boolean;
  extractedStudentId: string | null;
  confidence: number;
  rawText: string;
  facultyName: string | null;
  digitMatchRate?: number;
  details: {
    detectedCandidates: string[];
    isValidDutFormat: boolean;
    preprocessed: boolean;
  };
}

/**
 * Tiền xử lý ảnh thẻ Sinh viên bằng Sharp để tối ưu tỷ lệ nhận diện chữ và số (OCR):
 * 1. Chuyển sang Grayscale (ảnh xám)
 * 2. Tăng độ tương phản (Contrast Stretching)
 * 3. Khử nhiễu & Làm sắc nét (Sharpen)
 * 4. Giới hạn kích thước tối đa 1600px để giữ tốc độ xử lý cao dưới 2 giây.
 */
export async function preprocessStudentCardImage(input: Buffer | string): Promise<Buffer> {
  try {
    const pipeline = sharp(input)
      .rotate() // Tự động xoay đúng chiều theo EXIF metadata
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .grayscale() // Chuyển thành ảnh xám
      .linear(1.5, -25) // Tăng độ tương phản chữ in
      .sharpen(); // Làm sắc nét nét chữ/số

    return await pipeline.toBuffer();
  } catch (error) {
    console.warn('[OCR Preprocess Warning] Sharp preprocessing fallback to original buffer:', error);
    if (Buffer.isBuffer(input)) {
      return input;
    }
    return Buffer.from(input);
  }
}

/**
 * Thuật toán tính tỷ lệ tương đồng ký tự số (Digit Match Rate) giữa 2 chuỗi MSSV.
 * Trả về giá trị từ 0.0 (0%) đến 1.0 (100%).
 */
export function calculateDigitMatchRate(str1: string, str2: string): number {
  const digits1 = str1.replace(/\D/g, '');
  const digits2 = str2.replace(/\D/g, '');

  if (!digits1 || !digits2) return 0;
  if (digits1 === digits2) return 1.0;

  const maxLength = Math.max(digits1.length, digits2.length);
  let matches = 0;

  const minLength = Math.min(digits1.length, digits2.length);
  for (let i = 0; i < minLength; i++) {
    if (digits1[i] === digits2[i]) {
      matches++;
    }
  }

  return matches / maxLength;
}

/**
 * Bóc tách và tìm kiếm ứng viên Mã Sinh Viên (MSSV) từ văn bản thô bóc bóc bởi OCR.
 * Ưu tiên các chuỗi 9 chữ số khớp định danh DUT (được kiểm tra qua validateDutStudentId).
 */
export function parseCandidatesFromOcrText(text: string): {
  primaryId: string | null;
  candidates: string[];
  facultyName: string | null;
  isValidDutFormat: boolean;
} {
  const cleanedText = text.replace(/[\r\n]+/g, ' ');

  // 1. Tìm tất cả chuỗi 9 chữ số liền kề (chuẩn MSSV Bách Khoa ĐN)
  const nineDigitMatches = cleanedText.match(/\b\d{9}\b/g) || [];
  const candidates: string[] = Array.from(new Set(nineDigitMatches));

  // 2. Tìm thêm các chuỗi số 8-10 chữ số phòng trường hợp nhận diện sót/thừa 1 ký tự
  const allDigitMatches = cleanedText.match(/\b\d{8,10}\b/g) || [];
  allDigitMatches.forEach((d) => {
    if (!candidates.includes(d)) {
      candidates.push(d);
    }
  });

  // 3. Đánh giá ứng viên tốt nhất (khớp mã Khoa DUT)
  let bestCandidate: string | null = null;
  let bestFaculty: string | null = null;
  let isValidDutFormat = false;

  for (const cand of candidates) {
    if (cand.length === 9) {
      const dutValidation = validateDutStudentId(cand);
      if (dutValidation.isValid && dutValidation.faculty_name) {
        bestCandidate = cand;
        bestFaculty = dutValidation.faculty_name;
        isValidDutFormat = true;
        break;
      }
    }
  }

  // Fallback: Nếu không tìm thấy MSSV 9 số đúng khoa DUT, lấy ứng viên 9 số đầu tiên
  if (!bestCandidate && candidates.length > 0) {
    bestCandidate = candidates[0];
  }

  return {
    primaryId: bestCandidate,
    candidates,
    facultyName: bestFaculty,
    isValidDutFormat,
  };
}

/**
 * [TASK_BE_103] Service OCR Thẻ Sinh Viên - Quét & Bóc tách thông tin MSSV từ ảnh Thẻ SV
 * @param imageInput Buffer hoặc Đường dẫn tệp ảnh thẻ sinh viên
 * @param expectedStudentId (Tùy chọn) MSSV kỳ vọng từ form đăng ký để đối soát tỷ lệ khớp (>= 90%)
 */
export async function extractStudentIdFromCard(
  imageInput: Buffer | string,
  expectedStudentId?: string,
): Promise<StudentCardOcrResult> {
  let preprocessedBuffer: Buffer;
  let isPreprocessed = true;

  try {
    preprocessedBuffer = await preprocessStudentCardImage(imageInput);
  } catch {
    preprocessedBuffer = Buffer.isBuffer(imageInput) ? imageInput : Buffer.from(imageInput);
    isPreprocessed = false;
  }

  // Khởi tạo Tesseract OCR Worker
  const worker = await createWorker('eng');

  try {
    // Cấu hình Tesseract chỉ tập trung nhận diện số và ký tự in hoa/thường để tăng tốc
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:-./ ',
    });

    const {
      data: { text, confidence },
    } = await worker.recognize(preprocessedBuffer);

    const parsed = parseCandidatesFromOcrText(text);

    let digitMatchRate: number | undefined;
    if (expectedStudentId && parsed.primaryId) {
      digitMatchRate = calculateDigitMatchRate(parsed.primaryId, expectedStudentId);
    }

    return {
      success: Boolean(parsed.primaryId),
      extractedStudentId: parsed.primaryId,
      confidence: Math.round(confidence),
      rawText: text.trim(),
      facultyName: parsed.facultyName,
      digitMatchRate,
      details: {
        detectedCandidates: parsed.candidates,
        isValidDutFormat: parsed.isValidDutFormat,
        preprocessed: isPreprocessed,
      },
    };
  } catch (error) {
    throw new Error(`[OCR Service Error] Không thể quét thông tin từ ảnh thẻ sinh viên: ${(error as Error).message}`);
  } finally {
    await worker.terminate();
  }
}
