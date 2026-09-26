import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDigitMatchRate,
  parseCandidatesFromOcrText,
} from '../../src/utils/ocrStudentCard.ts';

describe('TASK_BE_103: OCR Student Card Utility Tests', () => {
  it('should calculate exact digit match rate correctly', () => {
    const match1 = calculateDigitMatchRate('102210234', '102210234');
    assert.equal(match1, 1.0);

    // 8 out of 9 digits match -> 8/9 = 88.88%
    const match2 = calculateDigitMatchRate('102210234', '102210235');
    assert.ok(match2 >= 0.88 && match2 < 0.90);

    // 9 out of 9 digits match with slight formatting
    const match3 = calculateDigitMatchRate('102210234', '10221-0234');
    assert.equal(match3, 1.0);
  });

  it('should correctly parse 9-digit DUT student ID from OCR text output', () => {
    const rawOcrText = `
      TRƯỜNG ĐẠI HỌC BÁCH KHOA - ĐHĐN
      THẺ SINH VIÊN / STUDENT CARD
      Họ và tên: NGUYỄN VĂN A
      MSSV: 102210234
      Lớp: 21T_DT1
      Khoa: Công Nghệ Thông Tin
    `;

    const parsed = parseCandidatesFromOcrText(rawOcrText);

    assert.equal(parsed.primaryId, '102210234');
    assert.equal(parsed.isValidDutFormat, true);
    assert.equal(parsed.facultyName, 'Khoa Công Nghệ Thông Tin');
    assert.ok(parsed.candidates.includes('102210234'));
  });

  it('should evaluate digit match rate >= 90% when target student ID matches', () => {
    const expectedSid = '102210234';
    const extractedSid = '102210234';

    const matchRate = calculateDigitMatchRate(extractedSid, expectedSid);
    assert.ok(matchRate >= 0.90, `Digit match rate ${matchRate} should be >= 0.90 (90%)`);
  });
});
