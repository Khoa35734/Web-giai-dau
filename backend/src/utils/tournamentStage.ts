import type { Tournament } from '../types/index.ts';

export type TournamentStage = 'GD0' | 'GD1' | 'GD2' | 'GD3' | 'GD4';

export interface TournamentStageInfo {
  stage: TournamentStage;
  label: string;
  badgeText: string;
  badgeColor: string;
  description: string;
  canRegister: boolean;
  canCancel: boolean;
  canUpdateInfo: boolean;
  canCheckin: boolean;
  canViewBrackets: boolean;
  canExportCert: boolean;
}

/**
 * [SRS 4.1, SV-04, SV-07, SV-11]
 * Xác định chính xác 5 giai đoạn của giải đấu:
 * - GD0: Chưa mở đăng ký (Chờ duyệt hoặc chưa đến ngày mở) -> Chưa hiển thị trên trang chủ
 * - GD1: Đang mở đăng ký -> Hiển thị công khai, mở đăng ký & cho phép hủy
 * - GD2: Đã đóng đăng ký -> Khóa đăng ký mới, thí sinh đã đăng ký có thể cập nhật thông tin
 * - GD3: Check-in & Thi đấu -> Khóa cập nhật thông tin, mở xem nhánh đấu / phòng đấu TFT
 * - GD4: Đã kết thúc -> Mở xuất giấy chứng nhận điện tử (E-Certificate)
 */
export function getTournamentStage(
  tournament: Pick<
    Tournament,
    'status' | 'registration_open_at' | 'registration_close_at' | 'start_at' | 'end_at' | 'checkin_open_at'
  >,
  now: Date = new Date(),
): TournamentStageInfo {
  const regOpen = new Date(tournament.registration_open_at);
  const regClose = new Date(tournament.registration_close_at);
  const checkinOpen = tournament.checkin_open_at ? new Date(tournament.checkin_open_at) : new Date(tournament.start_at);
  const endAt = new Date(tournament.end_at);

  // Đã hủy giải đấu
  if (tournament.status === 'cancelled') {
    return {
      stage: 'GD4',
      label: 'Đã hủy',
      badgeText: '❌ ĐÃ HỦY',
      badgeColor: '#ef4444',
      description: 'Giải đấu này đã bị hủy bỏ.',
      canRegister: false,
      canCancel: false,
      canUpdateInfo: false,
      canCheckin: false,
      canViewBrackets: false,
      canExportCert: false,
    };
  }

  // GD4: Giải đấu đã kết thúc
  if (tournament.status === 'completed' || now >= endAt) {
    return {
      stage: 'GD4',
      label: 'Đã kết thúc',
      badgeText: '🏁 ĐÃ KẾT THÚC',
      badgeColor: '#64748b',
      description: 'Giải đấu đã hoàn thành. Thí sinh đủ điều kiện có thể tải Giấy chứng nhận điện tử.',
      canRegister: false,
      canCancel: false,
      canUpdateInfo: false,
      canCheckin: false,
      canViewBrackets: true,
      canExportCert: true,
    };
  }

  // GD0: Chưa mở đăng ký
  if (
    tournament.status === 'pending' ||
    tournament.status === 'rejected' ||
    tournament.status === ('draft' as any) ||
    now < regOpen
  ) {
    return {
      stage: 'GD0',
      label: 'Chưa mở đăng ký',
      badgeText: '⏳ CHƯA MỞ ĐĂNG KÝ',
      badgeColor: '#f59e0b',
      description: 'Giải đấu đang chuẩn bị hoặc chờ duyệt. Chưa mở đăng ký công khai.',
      canRegister: false,
      canCancel: false,
      canUpdateInfo: false,
      canCheckin: false,
      canViewBrackets: false,
      canExportCert: false,
    };
  }

  // GD1: Đang mở đăng ký
  if (now >= regOpen && now < regClose) {
    return {
      stage: 'GD1',
      label: 'Đang mở đăng ký',
      badgeText: '🟢 ĐANG MỞ ĐĂNG KÝ',
      badgeColor: '#10b981',
      description: 'Giải đấu đang nhận đơn đăng ký thi đấu. Thí sinh có thể đăng ký và hủy đơn nếu cần.',
      canRegister: true,
      canCancel: true,
      canUpdateInfo: true,
      canCheckin: false,
      canViewBrackets: false,
      canExportCert: false,
    };
  }

  // GD3: Check-in & Thi đấu
  if (now >= checkinOpen && now < endAt) {
    return {
      stage: 'GD3',
      label: 'Check-in & Thi đấu',
      badgeText: '⚡ CHECK-IN & THI ĐẤU',
      badgeColor: '#ef4444',
      description: 'Giải đấu đang diễn ra điểm danh và thi đấu. Thông tin đăng ký đã được khóa.',
      canRegister: false,
      canCancel: false,
      canUpdateInfo: false,
      canCheckin: true,
      canViewBrackets: true,
      canExportCert: false,
    };
  }

  // GD2: Đã đóng đăng ký (từ regClose đến checkinOpen)
  return {
    stage: 'GD2',
    label: 'Đã đóng đăng ký',
    badgeText: '🔒 ĐÃ ĐÓNG ĐĂNG KÝ',
    badgeColor: '#3b82f6',
    description: 'Đã hết hạn đăng ký mới. Thí sinh đã đăng ký có thể cập nhật thông tin trước giờ thi đấu.',
    canRegister: false,
    canCancel: false,
    canUpdateInfo: true,
    canCheckin: false,
    canViewBrackets: false,
    canExportCert: false,
  };
}
