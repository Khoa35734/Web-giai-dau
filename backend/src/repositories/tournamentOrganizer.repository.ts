import pool from '../config/db.ts';
import type {
  OrganizerRole,
  OrganizerType,
  SafeParticipant,
  SafeUser,
  TournamentOrganizer,
} from '../types/index.ts';

export interface AddOrganizerInput {
  tournament_id: string;
  organizer_type: OrganizerType;
  user_id?: string | null;
  participant_id?: string | null;
  role: OrganizerRole;
  custom_title?: string | null;
  assigned_by?: string | null;
}

export interface UserOrganizerRoleInfo {
  isAuthorized: boolean;
  isLeadOrAdmin: boolean;
  role?: OrganizerRole | 'admin' | 'creator';
}

/**
 * [SRS 4.2, AD-05, SV-13] Data Access Layer — Ban Tổ Chức Giải (tournament_organizers).
 * Tuân thủ 100% database_schema.sql và ràng buộc CHECK constraint chk_organizer_target:
 * (organizer_type = 'permanent' AND user_id IS NOT NULL AND participant_id IS NULL)
 * OR
 * (organizer_type = 'seasonal' AND participant_id IS NOT NULL AND user_id IS NULL)
 */
export const tournamentOrganizerRepository = {
  /**
   * [SRS 4.2, AD-05] Lấy danh sách BTC kèm thông tin join từ `users` hoặc `participants`.
   */
  async getOrganizersByTournament(tournamentId: string): Promise<TournamentOrganizer[]> {
    const query = `
      SELECT 
        to_org.id,
        to_org.tournament_id,
        to_org.organizer_type,
        to_org.user_id,
        to_org.participant_id,
        to_org.role,
        to_org.custom_title,
        to_org.assigned_by,
        to_org.assigned_at,
        u.full_name AS user_name,
        u.email AS user_email,
        p.full_name AS participant_name,
        p.email AS participant_email,
        p.student_id,
        p.faculty_name,
        assigner.full_name AS assigned_by_name
      FROM tournament_organizers to_org
      LEFT JOIN users u ON to_org.user_id = u.id
      LEFT JOIN participants p ON to_org.participant_id = p.id
      LEFT JOIN users assigner ON to_org.assigned_by = assigner.id
      WHERE to_org.tournament_id = $1
      ORDER BY 
        CASE 
          WHEN to_org.role = 'lead_organizer' THEN 1
          WHEN to_org.role = 'co_organizer' THEN 2
          WHEN to_org.role = 'referee' THEN 3
          WHEN to_org.role = 'seasonal_staff' THEN 4
          ELSE 5
        END,
        to_org.assigned_at ASC
    `;
    const result = await pool.query<TournamentOrganizer>(query, [tournamentId]);
    return result.rows;
  },

  /** Tìm một thành viên BTC theo ID. */
  async findById(id: string): Promise<TournamentOrganizer | null> {
    const query = `
      SELECT 
        to_org.*,
        u.full_name AS user_name,
        u.email AS user_email,
        p.full_name AS participant_name,
        p.email AS participant_email,
        p.student_id,
        p.faculty_name,
        assigner.full_name AS assigned_by_name
      FROM tournament_organizers to_org
      LEFT JOIN users u ON to_org.user_id = u.id
      LEFT JOIN participants p ON to_org.participant_id = p.id
      LEFT JOIN users assigner ON to_org.assigned_by = assigner.id
      WHERE to_org.id = $1
    `;
    const result = await pool.query<TournamentOrganizer>(query, [id]);
    return result.rows[0] ?? null;
  },

  /**
   * [SRS 4.2, AD-05, SV-13] Gán CTV thường trực (`organizer_type = 'permanent'`, `user_id`)
   * hoặc Sinh viên (`organizer_type = 'seasonal'`, `participant_id`).
   * Kiểm tra chặt chẽ ràng buộc chk_organizer_target và KYC approved.
   */
  async addOrganizer(data: AddOrganizerInput): Promise<TournamentOrganizer> {
    let finalUserId: string | null = null;
    let finalParticipantId: string | null = null;

    if (data.organizer_type === 'permanent') {
      if (!data.user_id) {
        throw new Error('CTV Thường trực bắt buộc phải có user_id và không được có participant_id');
      }
      finalUserId = data.user_id;
      finalParticipantId = null;

      // Kiểm tra user có tồn tại và đang active không
      const userCheck = await pool.query<{ id: string; role: string; is_active: boolean }>(
        'SELECT id, role, is_active FROM users WHERE id = $1',
        [finalUserId],
      );
      if (!userCheck.rows[0]) {
        throw new Error('Không tìm thấy tài khoản người dùng');
      }
      if (!userCheck.rows[0].is_active) {
        throw new Error('Tài khoản người dùng này đã bị khóa');
      }
    } else if (data.organizer_type === 'seasonal') {
      if (!data.participant_id) {
        throw new Error('CTV Thời vụ bắt buộc phải có participant_id (MSSV) và không được có user_id');
      }
      finalParticipantId = data.participant_id;
      finalUserId = null;

      // [SRS 4.2] Kiểm tra sinh viên có KYC approved không
      const partCheck = await pool.query<{ status: string; is_active: boolean }>(
        'SELECT status, is_active FROM participants WHERE id = $1',
        [finalParticipantId],
      );
      if (!partCheck.rows[0]) {
        throw new Error('Không tìm thấy tài khoản sinh viên');
      }
      if (!partCheck.rows[0].is_active) {
        throw new Error('Tài khoản sinh viên này đã bị khóa');
      }
      if (partCheck.rows[0].status !== 'approved') {
        throw new Error('Chỉ sinh viên đã được phê duyệt KYC (approved) mới có thể làm CTV Thời vụ');
      }
    } else {
      throw new Error('organizer_type không hợp lệ (chỉ chấp nhận "permanent" hoặc "seasonal")');
    }

    // Kiểm tra xem thành viên này đã có trong ban tổ chức giải chưa
    const existCheck = await pool.query<{ id: string }>(
      `SELECT id FROM tournament_organizers 
       WHERE tournament_id = $1 
         AND (
           ($2::uuid IS NOT NULL AND user_id = $2)
           OR
           ($3::uuid IS NOT NULL AND participant_id = $3)
         )`,
      [data.tournament_id, finalUserId, finalParticipantId],
    );
    if (existCheck.rows.length > 0) {
      throw new Error('Thành viên này đã có trong Ban Tổ Chức của giải đấu');
    }

    const query = `
      INSERT INTO tournament_organizers (
        tournament_id,
        organizer_type,
        user_id,
        participant_id,
        role,
        custom_title,
        assigned_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query<TournamentOrganizer>(query, [
      data.tournament_id,
      data.organizer_type,
      finalUserId,
      finalParticipantId,
      data.role,
      data.custom_title?.trim() || null,
      data.assigned_by ?? null,
    ]);

    const created = await this.findById(result.rows[0].id);
    return created!;
  },

  /** Cập nhật vai trò / chức danh thành viên BTC. */
  async updateOrganizer(
    id: string,
    patch: { role?: OrganizerRole; custom_title?: string | null },
  ): Promise<TournamentOrganizer | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const newRole = patch.role ?? current.role;
    const newTitle = patch.custom_title !== undefined ? (patch.custom_title?.trim() || null) : current.custom_title;

    const query = `
      UPDATE tournament_organizers
      SET role = $1, custom_title = $2
      WHERE id = $3
      RETURNING *
    `;
    await pool.query(query, [newRole, newTitle, id]);
    return this.findById(id);
  },

  /**
   * [SRS 4.2] Xóa quyền BTC.
   */
  async removeOrganizer(id: string, tournamentId?: string): Promise<void> {
    if (tournamentId) {
      await pool.query('DELETE FROM tournament_organizers WHERE id = $1 AND tournament_id = $2', [
        id,
        tournamentId,
      ]);
    } else {
      await pool.query('DELETE FROM tournament_organizers WHERE id = $1', [id]);
    }
  },

  /**
   * [SRS 4.2] Kiểm tra quyền điều hành của user với giải đấu.
   * Trả về thông tin: có quyền không, vai trò gì, và có phải Lead Organizer / Creator không.
   */
  async checkUserOrganizerRole(tournamentId: string, userId: string): Promise<UserOrganizerRoleInfo> {
    // 1. Kiểm tra nếu user là creator của giải
    const tourRes = await pool.query<{ created_by: string }>(
      'SELECT created_by FROM tournaments WHERE id = $1',
      [tournamentId],
    );
    if (tourRes.rows[0]?.created_by === userId) {
      return {
        isAuthorized: true,
        isLeadOrAdmin: true,
        role: 'creator',
      };
    }

    // 2. Kiểm tra nếu user có tên trong tournament_organizers
    const orgRes = await pool.query<{ role: OrganizerRole }>(
      'SELECT role FROM tournament_organizers WHERE tournament_id = $1 AND user_id = $2',
      [tournamentId, userId],
    );

    if (orgRes.rows[0]) {
      const role = orgRes.rows[0].role;
      const isLead = role === 'lead_organizer' || role === 'co_organizer';
      return {
        isAuthorized: true,
        isLeadOrAdmin: isLead,
        role,
      };
    }

    return {
      isAuthorized: false,
      isLeadOrAdmin: false,
    };
  },

  /** Tìm danh sách CTV thường trực từ users để chọn gán vào giải. */
  async searchUserCandidates(search?: string): Promise<SafeUser[]> {
    let query = `
      SELECT id, username, email, full_name, role, is_active
      FROM users
      WHERE is_active = true AND role = 'ctv'
    `;
    const params: string[] = [];
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (full_name ILIKE $${params.length} OR COALESCE(email, '') ILIKE $${params.length} OR username ILIKE $${params.length})`;
    }
    query += ' ORDER BY full_name ASC LIMIT 20';
    const res = await pool.query<SafeUser>(query, params);
    return res.rows;
  },

  /** Tìm danh sách Sinh viên đã KYC approved từ participants để chọn gán làm CTV thời vụ. */
  async searchParticipantCandidates(search?: string): Promise<SafeParticipant[]> {
    let query = `
      SELECT id, username, full_name, student_id, email, phone_number, university_name, faculty_name, class_name, account_type, status, created_at
      FROM participants
      WHERE status = 'approved'
    `;
    const params: string[] = [];
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (full_name ILIKE $${params.length} OR student_id ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    query += ' ORDER BY full_name ASC LIMIT 20';
    const res = await pool.query<SafeParticipant>(query, params);
    return res.rows;
  },
};

// Aliases for compatibility
export const organizerRepository = {
  ...tournamentOrganizerRepository,
  listByTournament: tournamentOrganizerRepository.getOrganizersByTournament.bind(tournamentOrganizerRepository),
  isUserAuthorizedForTournament: async (tournamentId: string, userId: string) => {
    const res = await tournamentOrganizerRepository.checkUserOrganizerRole(tournamentId, userId);
    return res.isAuthorized;
  },
};
