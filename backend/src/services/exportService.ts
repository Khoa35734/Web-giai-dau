import ExcelJS from 'exceljs';

export interface ExportParticipantMember {
  participantId: string;
  fullName: string;
  studentId: string | null;
  email: string | null;
  phoneNumber: string | null;
  universityName: string | null;
  facultyName: string | null;
  className: string | null;
  accountType: 'internal' | 'external';
  ingameId: string | null;
  roleInTeam: string | null;
  isCaptain: boolean;
  checkinStatus: 'not_checked_in' | 'approved' | 'pending_review' | 'rejected';
  checkinMethod: string | null;
  checkedInAt: string | null;
}

export interface ExportTeamData {
  registrationId: string;
  teamName: string;
  teamAvatarUrl: string | null;
  captainId: string;
  captainName: string;
  captainStudentId: string | null;
  status: string;
  registeredAt: string;
  members: ExportParticipantMember[];
  totalMembers: number;
  checkedInCount: number;
}

export interface ExportTournamentData {
  tournamentId: string;
  tournamentName: string;
  tournamentCode: string;
  participationType: 'individual' | 'team';
  gameName: string;
  status: string;
  teams?: ExportTeamData[];
  individualParticipants?: ExportParticipantMember[];
}

/**
 * Service xuất file Excel (.xlsx) danh sách tham gia giải đấu và trạng thái điểm danh ngày đánh giải.
 */
export async function generateParticipantsExcel(data: ExportTournamentData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DUT Esports Tournament Platform';
  workbook.lastModifiedBy = 'DUT Esports Admin System';
  workbook.created = new Date();

  const sheetName = 'Danh Sách Tham Gia';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  const isTeam = data.participationType === 'team';

  // Title section
  worksheet.mergeCells('A1', isTeam ? 'K1' : 'J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `DANH SÁCH THÀNH VIÊN THAM GIA GIẢI ĐẤU — ${data.tournamentName.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1F497D' }, // Navy Cyber Header
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // Sub-info row
  worksheet.mergeCells('A2', isTeam ? 'K2' : 'J2');
  const subTitleCell = worksheet.getCell('A2');
  subTitleCell.value = `Mã Giải: ${data.tournamentCode} | Bộ môn: ${data.gameName} | Thể thức: ${isTeam ? 'Đồng Đội' : 'Cá Nhân'} | Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
  subTitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'D9D9D9' } };
  subTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2F5597' },
  };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 24;

  // Empty row separator
  worksheet.getRow(3).height = 10;

  // Headers
  const headerRowNumber = 4;
  const headers = isTeam
    ? [
        'STT',
        'Tên Đội',
        'Họ và Tên',
        'Vai Trò',
        'MSSV',
        'Lớp / Khoa',
        'Ingame ID',
        'Email',
        'Số Điện Thoại',
        'Điểm Danh Ngày Đánh Giải',
        'Thời Gian Điểm Danh',
      ]
    : [
        'STT',
        'Họ và Tên',
        'MSSV',
        'Lớp / Khoa',
        'Ingame ID',
        'Email',
        'Số Điện Thoại',
        'Trường Đào Tạo',
        'Điểm Danh Ngày Đánh Giải',
        'Thời Gian Điểm Danh',
      ];

  const headerRow = worksheet.getRow(headerRowNumber);
  headers.forEach((h, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F497D' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'medium', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    };
  });
  headerRow.height = 26;

  let currentRowIdx = 5;

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', { hour12: false });
    } catch {
      return isoStr;
    }
  };

  const getCheckinText = (status: string) => {
    if (status === 'approved') return '✅ ĐÃ XÁC NHẬN';
    if (status === 'pending_review') return '⏳ Đang chờ duyệt';
    return '❌ CHƯA XÁC NHẬN';
  };

  if (isTeam && data.teams) {
    let stt = 1;
    for (const team of data.teams) {
      for (let i = 0; i < team.members.length; i++) {
        const m = team.members[i];
        const row = worksheet.getRow(currentRowIdx);

        row.getCell(1).value = i === 0 ? stt : ''; // STT only on first member
        row.getCell(2).value = i === 0 ? team.teamName : ''; // Team name only on first member
        row.getCell(3).value = m.fullName;
        row.getCell(4).value = m.isCaptain ? '👑 Đội trưởng' : 'Thành viên';
        row.getCell(5).value = m.studentId || '-';
        row.getCell(6).value = `${m.className || '-'} • ${m.facultyName || '-'}`;
        row.getCell(7).value = m.ingameId || '-';
        row.getCell(8).value = m.email || '-';
        row.getCell(9).value = m.phoneNumber || '-';

        const checkinCell = row.getCell(10);
        checkinCell.value = getCheckinText(m.checkinStatus);
        if (m.checkinStatus === 'approved') {
          checkinCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };
          checkinCell.font = { color: { argb: '375623' }, bold: true };
        } else {
          checkinCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };
          checkinCell.font = { color: { argb: 'C65911' } };
        }

        row.getCell(11).value = formatDate(m.checkedInAt);

        for (let col = 1; col <= 11; col++) {
          const c = row.getCell(col);
          c.font = c.font || { name: 'Arial', size: 10 };
          c.border = {
            top: { style: 'thin', color: { argb: 'D9D9D9' } },
            left: { style: 'thin', color: { argb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
            right: { style: 'thin', color: { argb: 'D9D9D9' } },
          };
          if (col === 1 || col === 4 || col === 5 || col === 10 || col === 11) {
            c.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            c.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        }

        row.height = 22;
        currentRowIdx++;
      }
      stt++;
    }
  } else if (data.individualParticipants) {
    data.individualParticipants.forEach((m, idx) => {
      const row = worksheet.getRow(currentRowIdx);

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = m.fullName;
      row.getCell(3).value = m.studentId || '-';
      row.getCell(4).value = `${m.className || '-'} • ${m.facultyName || '-'}`;
      row.getCell(5).value = m.ingameId || '-';
      row.getCell(6).value = m.email || '-';
      row.getCell(7).value = m.phoneNumber || '-';
      row.getCell(8).value = m.universityName || 'ĐH Bách Khoa';

      const checkinCell = row.getCell(9);
      checkinCell.value = getCheckinText(m.checkinStatus);
      if (m.checkinStatus === 'approved') {
        checkinCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };
        checkinCell.font = { color: { argb: '375623' }, bold: true };
      } else {
        checkinCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };
        checkinCell.font = { color: { argb: 'C65911' } };
      }

      row.getCell(10).value = formatDate(m.checkedInAt);

      for (let col = 1; col <= 10; col++) {
        const c = row.getCell(col);
        c.font = c.font || { name: 'Arial', size: 10 };
        c.border = {
          top: { style: 'thin', color: { argb: 'D9D9D9' } },
          left: { style: 'thin', color: { argb: 'D9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
          right: { style: 'thin', color: { argb: 'D9D9D9' } },
        };
        if (col === 1 || col === 3 || col === 9 || col === 10) {
          c.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          c.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }

      row.height = 22;
      currentRowIdx++;
    });
  }

  // Auto-fit column widths
  worksheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen && len < 60) {
        maxLen = len;
      }
    });
    col.width = maxLen + 4;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
