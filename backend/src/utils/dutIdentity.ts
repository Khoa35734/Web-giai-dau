export const DUT_FACULTY_MAP: Record<string, string> = {
  '101': 'Khoa Cơ Khí',
  '102': 'Khoa Công Nghệ Thông Tin',
  '103': 'Khoa Cơ Khí Giao Thông',
  '104': 'Khoa Công Nghệ Nhiệt - Điện Lạnh',
  '105': 'Khoa Điện',
  '106': 'Khoa Điện Tử - Viễn Thông',
  '107': 'Khoa Hóa',
  '109': 'Khoa Xây Dựng Cầu Đường',
  '110': 'Khoa Xây Dựng Dân Dụng & Công Nghiệp',
  '111': 'Khoa Xây Dựng Công Trình Thủy',
  '117': 'Khoa Môi Trường',
  '118': 'Khoa Quản Lý Dự Án',
  '121': 'Khoa Kiến Trúc',
  '123': 'Khoa Khoa Học Công Nghệ Tiên Tiến',
};

/**
 * Lấy tên Khoa theo 3 số đầu của MSSV. Trả về null nếu không khớp khoa nào.
 */
export function getFacultyByDutPrefix(prefix: string): string | null {
  return DUT_FACULTY_MAP[prefix] ?? null;
}

/**
 * Kiểm tra mã sinh viên DUT (MSSV) hợp lệ: đúng 9 chữ số và 3 số đầu thuộc danh sách Khoa.
 */
export function validateDutStudentId(studentId: string): { isValid: boolean; faculty_name: string | null; error?: string } {
  const sid = studentId.trim();
  if (!/^\d{9}$/.test(sid)) {
    return { isValid: false, faculty_name: null, error: 'MSSV không hợp lệ (phải bao gồm đúng 9 chữ số)' };
  }

  const prefix = sid.slice(0, 3);
  const faculty_name = DUT_FACULTY_MAP[prefix];
  if (!faculty_name) {
    return { isValid: false, faculty_name: null, error: `3 số đầu của MSSV (${prefix}) không thuộc Khoa nào trong hệ thống DUT` };
  }

  return { isValid: true, faculty_name };
}

export function generateFreeParticipantId(): string {
  const year = new Date().getFullYear().toString(); 
  const random5 = Math.floor(Math.random() * 100000).toString().padStart(5, '0'); 
  return year + random5; 
}

export function resolveDutIdentity(studentId: string): { class_name: string | null; faculty_name: string | null } {
  const { isValid, faculty_name } = validateDutStudentId(studentId);
  if (!isValid || !faculty_name) {
    return { class_name: null, faculty_name: null };
  }

  const prefix = studentId.trim().slice(0, 3);
  return {
    class_name: `DUT-${prefix}`,
    faculty_name,
  };
}
