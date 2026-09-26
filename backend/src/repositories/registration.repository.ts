import pool from '../config/db.ts';
import type {
  FormField,
  Registration,
  RegistrationMember,
  RegistrationStatus,
  TeamJoinRequest,
  Tournament,
} from '../types/index.ts';

export interface RegistrationFilters {
  tournament_id?: string;
  status?: string;
}

export interface RegistrationWithTournament extends Registration {
  tournament_name?: string;
  game_name?: string;
  form_schema?: unknown;
  captain_name?: string;
  captain_student_id?: string;
  members?: RegistrationMember[];
}

export interface RecruitingTeamInfo extends Registration {
  captain_name: string;
  captain_student_id?: string;
  current_member_count: number;
  min_team_size: number;
  max_team_size: number;
  members: RegistrationMember[];
}

/**
 * [TASK_BE_202, SRS 3.1 SV-04..07, SRS 3.2 AD-03, SRS 4.3]
 * Data Access Layer — Quản lý Đăng ký, Ingame ID, Tuyển quân & Chợ đồng đội.
 * Bắt buộc dùng Parameterized Queries ($1, $2...) và PostgreSQL Transaction cho thao tác nhiều bảng.
 */
export const registrationRepository = {
  /**
   * [TASK_BE_202, SRS 3.1 SV-05] Tạo đăng ký mới (Cá nhân hoặc Đội) kèm Ingame ID và hỗ trợ tuyển quân.
   */
  async createRegistration(data: {
    tournament_id: string;
    captain_id: string;
    ingame_id: string;
    team_name?: string | null;
    team_avatar_url?: string | null;
    role_in_team?: string | null;
    submitted_data?: unknown;
    members?: Array<{
      participant_id: string;
      ingame_id: string;
      role_in_team?: string | null;
    }>;
    is_recruiting?: boolean;
    recruitment_notes?: string | null;
  }): Promise<Registration & { members: RegistrationMember[] }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Kiểm tra giải đấu & thời gian đăng ký
      const tournamentResult = await client.query<
        Pick<
          Tournament,
          'id' | 'participation_type' | 'min_team_size' | 'max_team_size' | 'registration_open_at' | 'registration_close_at' | 'status'
        >
      >(
        `SELECT id, participation_type, min_team_size, max_team_size, registration_open_at, registration_close_at, status 
         FROM tournaments WHERE id = $1 FOR SHARE`,
        [data.tournament_id],
      );
      const tournament = tournamentResult.rows[0];
      if (!tournament) {
        throw new Error('Không tìm thấy giải đấu');
      }

      const now = new Date();
      if (new Date(tournament.registration_close_at) < now) {
        throw new Error('Giải đấu đã kết thúc thời gian đăng ký');
      }

      // 2. Kiểm tra đội trưởng đã tham gia đội nào trong giải chưa
      const existingCheck = await client.query<{ id: string }>(
        `SELECT r.id FROM registrations r
         JOIN registration_members rm ON r.id = rm.registration_id
         WHERE r.tournament_id = $1 AND rm.participant_id = $2 AND r.status != 'cancelled'`,
        [data.tournament_id, data.captain_id],
      );
      if (existingCheck.rows.length > 0) {
        throw new Error('Bạn đã đăng ký hoặc đã là thành viên của một đội trong giải đấu này');
      }

      const isTeam = tournament.participation_type === 'team';
      const minSize = tournament.min_team_size ?? (isTeam ? 5 : 1);
      const maxSize = tournament.max_team_size ?? (isTeam ? 7 : 1);

      // 3. Chuẩn bị danh sách thành viên
      const additionalMembers = data.members ?? [];

      // Kiểm tra trùng lặp participant_id trong request
      const allMemberIds = [data.captain_id, ...additionalMembers.map((m) => m.participant_id)];
      const uniqueMemberIds = new Set(allMemberIds);
      if (uniqueMemberIds.size !== allMemberIds.length) {
        throw new Error('Danh sách thành viên bị trùng lặp MSSV/tài khoản');
      }

      // Kiểm tra các thành viên khác đã tham gia giải chưa
      for (const m of additionalMembers) {
        if (!m.ingame_id || !m.ingame_id.trim()) {
          throw new Error(`Thành viên ${m.participant_id} bị thiếu Ingame ID`);
        }

        const memCheck = await client.query<{ id: string; full_name: string }>(
          `SELECT r.id, p.full_name FROM registrations r
           JOIN registration_members rm ON r.id = rm.registration_id
           JOIN participants p ON rm.participant_id = p.id
           WHERE r.tournament_id = $1 AND rm.participant_id = $2 AND r.status != 'cancelled'`,
          [data.tournament_id, m.participant_id],
        );
        if (memCheck.rows.length > 0) {
          throw new Error(`Thành viên ${memCheck.rows[0].full_name || m.participant_id} đã tham gia một đội khác trong giải này`);
        }

        // Kiểm tra thành viên đã duyệt KYC chưa
        const kycCheck = await client.query<{ status: string; full_name: string }>(
          'SELECT status, full_name FROM participants WHERE id = $1',
          [m.participant_id],
        );
        if (!kycCheck.rows[0] || kycCheck.rows[0].status !== 'approved') {
          throw new Error(`Thành viên ${kycCheck.rows[0]?.full_name || m.participant_id} chưa được duyệt tài khoản KYC`);
        }
      }

      const totalMembers = 1 + additionalMembers.length;

      if (!isTeam) {
        if (additionalMembers.length > 0) {
          throw new Error('Giải đấu cá nhân chỉ cho phép 1 người đăng ký');
        }
      } else {
        if (!data.team_name || !data.team_name.trim()) {
          throw new Error('Vui lòng nhập tên đội thi đấu');
        }
        if (data.is_recruiting) {
          if (totalMembers >= maxSize) {
            throw new Error(`Đội đã có đủ ${totalMembers}/${maxSize} người, không cần bật tuyển quân`);
          }
        } else {
          if (totalMembers < minSize || totalMembers > maxSize) {
            throw new Error(
              `Số lượng thành viên hiện tại (${totalMembers}) phải từ ${minSize} đến ${maxSize} người (hoặc bật cờ Tuyển quân nếu thiếu người)`,
            );
          }
        }
      }

      // 4. INSERT vào bảng registrations
      const registrationResult = await client.query<Registration>(
        `INSERT INTO registrations (
            tournament_id,
            captain_id,
            team_name,
            team_avatar_url,
            ingame_id,
            is_recruiting,
            recruitment_notes,
            submitted_data,
            status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
         RETURNING *`,
        [
          data.tournament_id,
          data.captain_id,
          isTeam ? data.team_name?.trim() || null : null,
          isTeam ? data.team_avatar_url?.trim() || null : null,
          data.ingame_id.trim(),
          isTeam ? (data.is_recruiting ?? false) : false,
          isTeam ? data.recruitment_notes?.trim() || null : null,
          JSON.stringify(data.submitted_data ?? {}),
        ],
      );
      const registration = registrationResult.rows[0];

      // 5. INSERT vào registration_members
      const members: RegistrationMember[] = [];

      // Captain member
      const captainMemResult = await client.query<RegistrationMember>(
        `INSERT INTO registration_members (
            registration_id,
            participant_id,
            is_captain,
            ingame_id,
            role_in_team
         ) VALUES ($1, $2, true, $3, $4)
         RETURNING *`,
        [registration.id, data.captain_id, data.ingame_id.trim(), data.role_in_team?.trim() || 'Captain'],
      );
      members.push(captainMemResult.rows[0]);

      // Additional members
      for (const m of additionalMembers) {
        const memResult = await client.query<RegistrationMember>(
          `INSERT INTO registration_members (
              registration_id,
              participant_id,
              is_captain,
              ingame_id,
              role_in_team
           ) VALUES ($1, $2, false, $3, $4)
           RETURNING *`,
          [registration.id, m.participant_id, m.ingame_id.trim(), m.role_in_team?.trim() || null],
        );
        members.push(memResult.rows[0]);
      }

      await client.query('COMMIT');
      return { ...registration, members };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-07] Hủy đơn đăng ký trước khi giải đóng đăng ký.
   */
  async cancelRegistration(id: string, participantId: string): Promise<Registration> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checkResult = await client.query<Registration & { registration_close_at: string }>(
        `SELECT r.*, t.registration_close_at
         FROM registrations r
         JOIN tournaments t ON r.tournament_id = t.id
         WHERE r.id = $1 FOR UPDATE`,
        [id],
      );
      const reg = checkResult.rows[0];
      if (!reg) {
        throw new Error('Không tìm thấy đơn đăng ký');
      }

      if (reg.captain_id !== participantId) {
        throw new Error('Chỉ người đăng ký / đội trưởng mới có quyền hủy đơn');
      }

      if (reg.status === 'cancelled') {
        throw new Error('Đơn đăng ký này đã được hủy trước đó');
      }

      if (new Date(reg.registration_close_at) < new Date()) {
        throw new Error('Giải đấu đã đóng đăng ký, không thể hủy đơn');
      }

      const updateResult = await client.query<Registration>(
        `UPDATE registrations 
         SET status = 'cancelled', is_recruiting = false, updated_at = NOW() 
         WHERE id = $1 RETURNING *`,
        [id],
      );

      await client.query(
        `UPDATE team_join_requests 
         SET status = 'cancelled', updated_at = NOW() 
         WHERE registration_id = $1 AND status = 'pending'`,
        [id],
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-06, SRS 4.3] Danh sách các đội đang thiếu người và bật tuyển quân (Chợ Tuyển Quân).
   */
  async listRecruitingTeams(tournamentId: string): Promise<RecruitingTeamInfo[]> {
    const query = `
      SELECT 
        r.*,
        p.full_name AS captain_name,
        p.student_id AS captain_student_id,
        t.min_team_size,
        t.max_team_size,
        COUNT(rm.participant_id)::int AS current_member_count
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      JOIN participants p ON r.captain_id = p.id
      LEFT JOIN registration_members rm ON r.id = rm.registration_id
      WHERE r.tournament_id = $1 
        AND r.is_recruiting = true 
        AND r.status IN ('pending', 'approved')
      GROUP BY r.id, p.full_name, p.student_id, t.min_team_size, t.max_team_size
      HAVING COUNT(rm.participant_id) < t.max_team_size
      ORDER BY r.registered_at DESC
    `;
    const result = await pool.query<RecruitingTeamInfo>(query, [tournamentId]);

    for (const team of result.rows) {
      const membersQuery = `
        SELECT 
          rm.*,
          p.full_name,
          p.student_id,
          p.username,
          p.email,
          p.phone_number AS phone,
          p.phone_number,
          p.university_name,
          p.faculty_name,
          p.class_name,
          p.account_type,
          p.status AS participant_status,
          p.student_card_url,
          p.selfie_with_student_card_url
        FROM registration_members rm
        JOIN participants p ON rm.participant_id = p.id
        WHERE rm.registration_id = $1
        ORDER BY rm.is_captain DESC, COALESCE(rm.joined_at, rm.created_at) ASC
      `;
      const memRes = await pool.query<RegistrationMember>(membersQuery, [team.id]);
      team.members = memRes.rows;
    }

    return result.rows;
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-06] Nộp yêu cầu xin vào đội đang tuyển quân.
   */
  async createJoinRequest(data: {
    registration_id: string;
    participant_id: string;
    ingame_id: string;
    message?: string | null;
  }): Promise<TeamJoinRequest> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const regResult = await client.query<
        Registration & { max_team_size: number; registration_close_at: string; tournament_status: string }
      >(
        `SELECT r.*, t.max_team_size, t.registration_close_at, t.status AS tournament_status
         FROM registrations r
         JOIN tournaments t ON r.tournament_id = t.id
         WHERE r.id = $1 FOR SHARE`,
        [data.registration_id],
      );
      const reg = regResult.rows[0];
      if (!reg) {
        throw new Error('Không tìm thấy đội đăng ký');
      }

      if (!reg.is_recruiting || !['pending', 'approved'].includes(reg.status)) {
        throw new Error('Đội này hiện không mở tuyển quân');
      }

      if (new Date(reg.registration_close_at) < new Date()) {
        throw new Error('Giải đấu đã đóng đăng ký');
      }

      const partResult = await client.query<{ status: string; full_name: string }>(
        'SELECT status, full_name FROM participants WHERE id = $1',
        [data.participant_id],
      );
      const part = partResult.rows[0];
      if (!part || part.status !== 'approved') {
        throw new Error('Chỉ tài khoản sinh viên đã được duyệt KYC mới có thể xin vào đội');
      }

      const inTeamCheck = await client.query<{ id: string }>(
        `SELECT r.id FROM registrations r
         JOIN registration_members rm ON r.id = rm.registration_id
         WHERE r.tournament_id = $1 AND rm.participant_id = $2 AND r.status != 'cancelled'`,
        [reg.tournament_id, data.participant_id],
      );
      if (inTeamCheck.rows.length > 0) {
        throw new Error('Bạn đã là thành viên của một đội trong giải đấu này');
      }

      const existingReq = await client.query<{ id: string }>(
        `SELECT id FROM team_join_requests 
         WHERE registration_id = $1 AND participant_id = $2 AND status = 'pending'`,
        [data.registration_id, data.participant_id],
      );
      if (existingReq.rows.length > 0) {
        throw new Error('Bạn đã gửi yêu cầu gia nhập đội này rồi, vui lòng chờ đội trưởng phản hồi');
      }

      const countRes = await client.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM registration_members WHERE registration_id = $1',
        [data.registration_id],
      );
      if (parseInt(countRes.rows[0]?.count ?? '0', 10) >= reg.max_team_size) {
        throw new Error('Đội này đã đủ số lượng thành viên tối đa');
      }

      const insertResult = await client.query<TeamJoinRequest>(
        `INSERT INTO team_join_requests (
            registration_id,
            participant_id,
            ingame_id,
            message,
            status
         ) VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [data.registration_id, data.participant_id, data.ingame_id.trim(), data.message?.trim() || null],
      );

      await client.query('COMMIT');
      return insertResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-06] Danh sách các yêu cầu xin vào đội (cho đội trưởng xem).
   */
  async listJoinRequests(registrationId: string): Promise<TeamJoinRequest[]> {
    const query = `
      SELECT 
        tjr.*,
        p.full_name AS participant_name,
        p.student_id,
        p.email,
        p.faculty_name,
        p.class_name,
        r.team_name
      FROM team_join_requests tjr
      JOIN participants p ON tjr.participant_id = p.id
      JOIN registrations r ON tjr.registration_id = r.id
      WHERE tjr.registration_id = $1
      ORDER BY tjr.created_at DESC
    `;
    const result = await pool.query<TeamJoinRequest>(query, [registrationId]);
    return result.rows;
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-06] Danh sách các yêu cầu xin vào đội mà cá nhân sinh viên đã gửi.
   */
  async listMyJoinRequests(participantId: string): Promise<TeamJoinRequest[]> {
    const query = `
      SELECT 
        tjr.*,
        r.team_name,
        t.name AS tournament_name
      FROM team_join_requests tjr
      JOIN registrations r ON tjr.registration_id = r.id
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE tjr.participant_id = $1
      ORDER BY tjr.created_at DESC
    `;
    const result = await pool.query<TeamJoinRequest>(query, [participantId]);
    return result.rows;
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-06, SRS 4.3] Đội trưởng Duyệt (Accept) hoặc Từ chối (Reject) yêu cầu xin vào đội.
   */
  async processJoinRequest(
    requestId: string,
    action: 'accepted' | 'rejected',
    captainId: string,
    reason?: string,
  ): Promise<TeamJoinRequest> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const reqQuery = `
        SELECT 
          tjr.*,
          r.captain_id,
          r.tournament_id,
          r.team_name,
          r.is_recruiting,
          t.max_team_size
        FROM team_join_requests tjr
        JOIN registrations r ON tjr.registration_id = r.id
        JOIN tournaments t ON r.tournament_id = t.id
        WHERE tjr.id = $1 FOR UPDATE
      `;
      const reqRes = await client.query<
        TeamJoinRequest & {
          captain_id: string;
          tournament_id: string;
          team_name: string;
          is_recruiting: boolean;
          max_team_size: number;
        }
      >(reqQuery, [requestId]);

      const joinReq = reqRes.rows[0];
      if (!joinReq) {
        throw new Error('Không tìm thấy yêu cầu gia nhập');
      }

      if (joinReq.captain_id !== captainId) {
        throw new Error('Chỉ đội trưởng mới có quyền xử lý yêu cầu gia nhập này');
      }

      if (joinReq.status !== 'pending') {
        throw new Error(`Yêu cầu này đã được xử lý trước đó (trạng thái: ${joinReq.status})`);
      }

      if (action === 'accepted') {
        const countRes = await client.query<{ count: string }>(
          'SELECT COUNT(*) as count FROM registration_members WHERE registration_id = $1 FOR UPDATE',
          [joinReq.registration_id],
        );
        const currentCount = parseInt(countRes.rows[0]?.count ?? '0', 10);

        if (currentCount >= joinReq.max_team_size) {
          throw new Error(`Đội đã đạt số lượng tối đa (${joinReq.max_team_size} thành viên)`);
        }

        const memCheck = await client.query<{ participant_id: string }>(
          'SELECT participant_id FROM registration_members WHERE registration_id = $1 AND participant_id = $2',
          [joinReq.registration_id, joinReq.participant_id],
        );
        if (memCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO registration_members (
                registration_id,
                participant_id,
                is_captain,
                ingame_id,
                role_in_team
             ) VALUES ($1, $2, false, $3, $4)`,
            [joinReq.registration_id, joinReq.participant_id, joinReq.ingame_id, 'Member'],
          );
        }

        const updateReq = await client.query<TeamJoinRequest>(
          `UPDATE team_join_requests 
           SET status = 'accepted', processed_by = $1, processed_at = NOW(), updated_at = NOW() 
           WHERE id = $2 RETURNING *`,
          [captainId, requestId],
        );

        const newCount = currentCount + 1;
        if (newCount >= joinReq.max_team_size) {
          await client.query(
            `UPDATE registrations 
             SET is_recruiting = false, updated_at = NOW() 
             WHERE id = $1`,
            [joinReq.registration_id],
          );

          await client.query(
            `UPDATE team_join_requests 
             SET status = 'rejected', rejection_reason = 'Đội đã đủ số lượng thành viên tối đa', processed_by = $1, processed_at = NOW(), updated_at = NOW()
             WHERE registration_id = $2 AND status = 'pending'`,
            [captainId, joinReq.registration_id],
          );
        }

        await client.query('COMMIT');
        return updateReq.rows[0];
      } else {
        const updateReq = await client.query<TeamJoinRequest>(
          `UPDATE team_join_requests 
           SET status = 'rejected', rejection_reason = $1, processed_by = $2, processed_at = NOW(), updated_at = NOW() 
           WHERE id = $3 RETURNING *`,
          [reason?.trim() || 'Đội trưởng không chấp thuận', captainId, requestId],
        );

        await client.query('COMMIT');
        return updateReq.rows[0];
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_203, SRS 3.1 SV-06] Sinh viên tự rút / hủy yêu cầu gia nhập đội đang ở trạng thái pending.
   */
  async cancelJoinRequest(requestId: string, participantId: string): Promise<TeamJoinRequest> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checkRes = await client.query<TeamJoinRequest>(
        `SELECT * FROM team_join_requests WHERE id = $1 FOR UPDATE`,
        [requestId],
      );
      const req = checkRes.rows[0];
      if (!req) {
        throw new Error('Không tìm thấy yêu cầu gia nhập');
      }

      if (req.participant_id !== participantId) {
        throw new Error('Bạn không có quyền hủy yêu cầu gia nhập này');
      }

      if (req.status !== 'pending') {
        throw new Error(`Chỉ có thể hủy yêu cầu đang ở trạng thái chờ duyệt (hiện tại: ${req.status})`);
      }

      const updateRes = await client.query<TeamJoinRequest>(
        `UPDATE team_join_requests 
         SET status = 'cancelled', updated_at = NOW() 
         WHERE id = $1 RETURNING *`,
        [requestId],
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_202] Bật/tắt trạng thái tuyển quân và cập nhật ghi chú.
   */
  async updateRecruitingStatus(
    registrationId: string,
    captainId: string,
    is_recruiting: boolean,
    recruitment_notes?: string | null,
  ): Promise<Registration> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checkRes = await client.query<Registration & { max_team_size: number }>(
        `SELECT r.*, t.max_team_size
         FROM registrations r
         JOIN tournaments t ON r.tournament_id = t.id
         WHERE r.id = $1 FOR UPDATE`,
        [registrationId],
      );
      const reg = checkRes.rows[0];
      if (!reg) {
        throw new Error('Không tìm thấy đội');
      }

      if (reg.captain_id !== captainId) {
        throw new Error('Chỉ đội trưởng mới có quyền thay đổi trạng thái tuyển quân');
      }

      if (is_recruiting) {
        const countRes = await client.query<{ count: string }>(
          'SELECT COUNT(*) as count FROM registration_members WHERE registration_id = $1',
          [registrationId],
        );
        const currentCount = parseInt(countRes.rows[0]?.count ?? '0', 10);
        if (currentCount >= reg.max_team_size) {
          throw new Error(`Đội đã đủ ${currentCount}/${reg.max_team_size} thành viên, không thể mở tuyển quân`);
        }
      }

      const updateRes = await client.query<Registration>(
        `UPDATE registrations 
         SET is_recruiting = $1, recruitment_notes = $2, updated_at = NOW() 
         WHERE id = $3 RETURNING *`,
        [is_recruiting, recruitment_notes?.trim() || null, registrationId],
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_202] Tìm đơn đăng ký của sinh viên trong một giải đấu.
   */
  async findParticipantRegistrationInTournament(
    tournamentId: string,
    participantId: string,
  ): Promise<(Registration & { members: RegistrationMember[]; is_captain: boolean }) | null> {
    const query = `
      SELECT r.*, (r.captain_id = $2) AS is_captain
      FROM registrations r
      JOIN registration_members rm ON r.id = rm.registration_id
      WHERE r.tournament_id = $1 AND rm.participant_id = $2 AND r.status != 'cancelled'
      LIMIT 1
    `;
    const result = await pool.query<Registration & { is_captain: boolean }>(query, [tournamentId, participantId]);
    const reg = result.rows[0];
    if (!reg) return null;

    const memQuery = `
      SELECT 
        rm.*,
        p.full_name,
        p.student_id,
        p.username,
        p.email,
        p.phone_number AS phone,
        p.phone_number,
        p.university_name,
        p.faculty_name,
        p.class_name,
        p.account_type,
        p.status AS participant_status,
        p.student_card_url,
        p.selfie_with_student_card_url
      FROM registration_members rm
      JOIN participants p ON rm.participant_id = p.id
      WHERE rm.registration_id = $1
      ORDER BY rm.is_captain DESC, COALESCE(rm.joined_at, rm.created_at) ASC
    `;
    const memRes = await pool.query<RegistrationMember>(memQuery, [reg.id]);
    return { ...reg, members: memRes.rows };
  },

  /** Tất cả đăng ký — admin, lọc theo giải + trạng thái. */
  async listAll(filters: RegistrationFilters): Promise<RegistrationWithTournament[]> {
    let query = `
      SELECT 
        r.*, 
        t.name as tournament_name,
        p.full_name as captain_name,
        p.student_id as captain_student_id,
        p.username as captain_username,
        p.university_name as captain_university_name,
        p.class_name as captain_class_name,
        p.faculty_name as captain_faculty_name,
        p.email as captain_email,
        p.phone_number as captain_phone,
        p.account_type as captain_account_type,
        p.student_card_url as captain_student_card_url,
        p.selfie_with_student_card_url as captain_selfie_with_student_card_url
      FROM registrations r 
      LEFT JOIN tournaments t ON r.tournament_id = t.id 
      LEFT JOIN participants p ON r.captain_id = p.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (filters.tournament_id) {
      params.push(filters.tournament_id);
      query += ` AND r.tournament_id = $${params.length}`;
    }
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      query += ` AND r.status = $${params.length}`;
    }
    query += ' ORDER BY r.registered_at DESC';

    const result = await pool.query<RegistrationWithTournament>(query, params);

    for (const reg of result.rows) {
      const memRes = await pool.query<RegistrationMember>(
        `SELECT rm.*, p.full_name, p.student_id, p.username, p.email, p.phone_number AS phone, p.phone_number, p.university_name, p.faculty_name, p.class_name, p.account_type, p.status AS participant_status, p.student_card_url, p.selfie_with_student_card_url
         FROM registration_members rm
         JOIN participants p ON rm.participant_id = p.id
         WHERE rm.registration_id = $1
         ORDER BY rm.is_captain DESC, COALESCE(rm.joined_at, rm.created_at) ASC`,
        [reg.id],
      );
      reg.members = memRes.rows;
    }

    return result.rows;
  },

  /** Đăng ký của một giải cụ thể. */
  async listByTournament(tournamentId: string): Promise<RegistrationWithTournament[]> {
    const query = `
      SELECT 
        r.*,
        p.full_name as captain_name,
        p.student_id as captain_student_id,
        p.username as captain_username,
        p.university_name as captain_university_name,
        p.class_name as captain_class_name,
        p.faculty_name as captain_faculty_name,
        p.email as captain_email,
        p.phone_number as captain_phone,
        p.account_type as captain_account_type,
        p.student_card_url as captain_student_card_url,
        p.selfie_with_student_card_url as captain_selfie_with_student_card_url
      FROM registrations r
      LEFT JOIN participants p ON r.captain_id = p.id
      WHERE r.tournament_id = $1
      ORDER BY r.registered_at DESC
    `;
    const result = await pool.query<RegistrationWithTournament>(query, [tournamentId]);

    for (const reg of result.rows) {
      const memRes = await pool.query<RegistrationMember>(
        `SELECT rm.*, p.full_name, p.student_id, p.username, p.email, p.phone_number AS phone, p.phone_number, p.university_name, p.faculty_name, p.class_name, p.account_type, p.status AS participant_status, p.student_card_url, p.selfie_with_student_card_url
         FROM registration_members rm
         JOIN participants p ON rm.participant_id = p.id
         WHERE rm.registration_id = $1
         ORDER BY rm.is_captain DESC, COALESCE(rm.joined_at, rm.created_at) ASC`,
        [reg.id],
      );
      reg.members = memRes.rows;
    }

    return result.rows;
  },

  /** Đăng ký thuộc các giải do user tạo (admin: tất cả). */
  async listMine(userId: string, isAdmin: boolean, filters: RegistrationFilters): Promise<RegistrationWithTournament[]> {
    let query = `
      SELECT r.*, t.name as tournament_name, t.game_name, t.form_schema,
             p.full_name as captain_name, p.student_id as captain_student_id,
             p.username as captain_username, p.university_name as captain_university_name,
             p.class_name as captain_class_name, p.faculty_name as captain_faculty_name,
             p.email as captain_email, p.phone_number as captain_phone,
             p.account_type as captain_account_type,
             p.student_card_url as captain_student_card_url,
             p.selfie_with_student_card_url as captain_selfie_with_student_card_url
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      LEFT JOIN participants p ON r.captain_id = p.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (!isAdmin) {
      params.push(userId);
      query += ` AND (t.created_by = $${params.length} OR EXISTS (SELECT 1 FROM tournament_organizers to_org WHERE to_org.tournament_id = t.id AND to_org.user_id = $${params.length}))`;
    }
    if (filters.tournament_id) {
      params.push(filters.tournament_id);
      query += ` AND r.tournament_id = $${params.length}`;
    }
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      query += ` AND r.status = $${params.length}`;
    }
    query += ' ORDER BY r.registered_at DESC';

    const result = await pool.query<RegistrationWithTournament>(query, params);

    for (const reg of result.rows) {
      const memRes = await pool.query<RegistrationMember>(
        `SELECT rm.*, p.full_name, p.student_id, p.username, p.email, p.phone_number AS phone, p.phone_number, p.university_name, p.faculty_name, p.class_name, p.account_type, p.status AS participant_status, p.student_card_url, p.selfie_with_student_card_url
         FROM registration_members rm
         JOIN participants p ON rm.participant_id = p.id
         WHERE rm.registration_id = $1
         ORDER BY rm.is_captain DESC, COALESCE(rm.joined_at, rm.created_at) ASC`,
        [reg.id],
      );
      reg.members = memRes.rows;
    }

    return result.rows;
  },

  /**
   * [TASK_BE_202, SRS 3.2 AD-13] Cập nhật trạng thái đăng ký.
   */
  async updateStatus(
    id: string,
    status: RegistrationStatus,
    actorId: string,
    reason?: string,
    ipAddress?: string,
  ): Promise<Registration | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query<Registration>(
        'SELECT * FROM registrations WHERE id = $1 FOR UPDATE',
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return null;
      }

      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending: ['approved', 'rejected'],
        rejected: ['pending'],
        approved: ['rejected', 'cancelled'],
        cancelled: [],
      };
      const allowed = VALID_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(status)) {
        await client.query('ROLLBACK');
        throw new Error(
          `Không thể chuyển trạng thái đăng ký từ "${current.status}" sang "${status}". ` +
          `Chỉ cho phép: ${allowed.join(', ') || 'không có'}.`,
        );
      }

      const result = await client.query<Registration>(
        `UPDATE registrations SET
            status = $1,
            reviewed_by = $2,
            rejection_reason = $3,
            reviewed_at = NOW(),
            updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, actorId, reason ?? null, id],
      );

      try {
        await client.query(
          `INSERT INTO audit_logs (
             actor_id, actor_role, action, target_table, target_id, payload, ip_address
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            actorId,
            'admin',
            `REGISTRATION_${status.toUpperCase()}`,
            'registrations',
            id,
            JSON.stringify({
              previous_status: current.status,
              new_status: status,
              reason: reason ?? null,
              tournament_id: current.tournament_id,
            }),
            ipAddress ?? null,
          ],
        );
      } catch {
        // Non-blocking fallback if audit_logs table unpopulated
      }

      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /** Tìm đăng ký kèm thông tin chủ giải. */
  async findWithOwner(id: string): Promise<(Registration & { tournament_owner: string }) | null> {
    const result = await pool.query<Registration & { tournament_owner: string }>(
      `SELECT r.*, t.created_by as tournament_owner
       FROM registrations r
       JOIN tournaments t ON r.tournament_id = t.id
       WHERE r.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  /** Xóa đăng ký. */
  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM registrations WHERE id = $1', [id]);
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-04, SV-05] Lấy toàn bộ danh sách các giải đấu sinh viên đang đăng ký.
   */
  async listMyParticipations(participantId: string): Promise<Array<Registration & {
    tournament_name: string;
    game_name: string;
    banner_url: string;
    participation_type: string;
    registration_open_at: string;
    registration_close_at: string;
    start_at: string;
    end_at: string;
    checkin_open_at?: string | null;
    checkin_close_at?: string | null;
    location?: string | null;
    tournament_status?: string;
    is_captain: boolean;
    checkin_id?: string | null;
    checkin_status?: 'approved' | 'pending_review' | 'rejected' | null;
    checked_in_at?: string | null;
    members?: RegistrationMember[];
  }>> {
    const query = `
      SELECT 
        r.*,
        t.name AS tournament_name,
        t.game_name,
        t.banner_url,
        t.participation_type,
        t.registration_open_at,
        t.registration_close_at,
        t.start_at,
        t.end_at,
        t.checkin_open_at,
        t.checkin_close_at,
        t.location,
        t.status AS tournament_status,
        (r.captain_id = $1) AS is_captain,
        ci.id AS checkin_id,
        ci.status AS checkin_status,
        ci.checked_in_at
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      LEFT JOIN check_ins ci ON ci.tournament_id = r.tournament_id AND ci.participant_id = $1
      WHERE (
        r.captain_id = $1 
        OR r.id IN (SELECT registration_id FROM registration_members WHERE participant_id = $1)
      )
      AND r.status != 'cancelled'
      ORDER BY r.registered_at DESC
    `;
    const res = await pool.query(query, [participantId]);
    const registrations = res.rows as any[];

    for (const reg of registrations) {
      const memRes = await pool.query<RegistrationMember>(
        `SELECT rm.*, p.full_name, p.student_id, p.faculty_name
         FROM registration_members rm
         JOIN participants p ON rm.participant_id = p.id
         WHERE rm.registration_id = $1
         ORDER BY rm.is_captain DESC, rm.created_at ASC`,
        [reg.id],
      );
      reg.members = memRes.rows;
    }

    return registrations;
  },

  /**
   * [TASK_BE_202, SRS 3.1 SV-04] Cập nhật thông tin đăng ký.
   */
  async updateRegistrationInfo(
    id: string,
    participantId: string,
    data: {
      ingame_id?: string;
      team_name?: string | null;
      team_avatar_url?: string | null;
      submitted_data?: Record<string, unknown>;
    },
  ): Promise<Registration> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checkRes = await client.query<Registration & {
        registration_close_at: string;
        checkin_open_at?: string;
        start_at: string;
        tournament_status: string;
      }>(
        `SELECT r.*, t.registration_close_at, t.checkin_open_at, t.start_at, t.status AS tournament_status
         FROM registrations r
         JOIN tournaments t ON r.tournament_id = t.id
         WHERE r.id = $1 FOR UPDATE`,
        [id],
      );
      const reg = checkRes.rows[0];
      if (!reg) {
        throw new Error('Không tìm thấy đơn đăng ký');
      }

      if (reg.captain_id !== participantId) {
        throw new Error('Chỉ người đăng ký / đội trưởng mới có quyền cập nhật thông tin');
      }

      if (reg.status === 'cancelled') {
        throw new Error('Đơn đăng ký đã bị hủy, không thể chỉnh sửa');
      }

      const now = new Date();
      const checkinTime = reg.checkin_open_at ? new Date(reg.checkin_open_at) : new Date(reg.start_at);
      if (now >= checkinTime || reg.tournament_status === 'active' || reg.tournament_status === 'completed') {
        throw new Error('Giải đấu đã bước vào giai đoạn Check-in / Thi đấu. Thông tin đăng ký đã được khóa!');
      }

      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [id];

      if (data.ingame_id && data.ingame_id.trim()) {
        params.push(data.ingame_id.trim());
        updates.push(`ingame_id = $${params.length}`);

        await client.query(
          `UPDATE registration_members 
           SET ingame_id = $1 
           WHERE registration_id = $2 AND participant_id = $3`,
          [data.ingame_id.trim(), id, participantId],
        );
      }

      if (data.team_name !== undefined) {
        params.push(data.team_name?.trim() || null);
        updates.push(`team_name = $${params.length}`);
      }

      if (data.team_avatar_url !== undefined) {
        params.push(data.team_avatar_url?.trim() || null);
        updates.push(`team_avatar_url = $${params.length}`);
      }

      if (data.submitted_data !== undefined) {
        params.push(JSON.stringify(data.submitted_data));
        updates.push(`submitted_data = $${params.length}`);
      }

      const updateQuery = `UPDATE registrations SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
      const updateRes = await client.query<Registration>(updateQuery, params);

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * [TASK_BE_901] Lấy danh sách đầy đủ các Đội & Thành viên (hoặc Thí sinh cá nhân) kèm trạng thái điểm danh ngày thi đấu.
   */
  async getTournamentParticipantsWithCheckin(tournamentId: string) {
    const tourRes = await pool.query<Tournament>(
      `SELECT id, name, code, game_name, participation_type, status FROM tournaments WHERE id = $1`,
      [tournamentId],
    );
    const tournament = tourRes.rows[0];
    if (!tournament) {
      throw new Error('Không tìm thấy giải đấu');
    }

    const isTeam = tournament.participation_type === 'team';

    const query = `
      SELECT 
        r.id AS registration_id,
        r.team_name,
        r.team_avatar_url,
        r.captain_id,
        r.ingame_id AS captain_ingame_id,
        r.status AS reg_status,
        r.registered_at,
        p_cap.full_name AS captain_name,
        p_cap.student_id AS captain_student_id,
        rm.participant_id,
        rm.is_captain,
        rm.ingame_id AS member_ingame_id,
        rm.role_in_team,
        p.full_name,
        p.student_id,
        p.email,
        p.phone_number,
        p.university_name,
        p.faculty_name,
        p.class_name,
        p.account_type,
        ci.status AS checkin_status,
        ci.checkin_method,
        ci.checked_in_at
      FROM registrations r
      JOIN participants p_cap ON r.captain_id = p_cap.id
      JOIN registration_members rm ON r.id = rm.registration_id
      JOIN participants p ON rm.participant_id = p.id
      LEFT JOIN check_ins ci ON ci.tournament_id = r.tournament_id AND ci.participant_id = p.id
      WHERE r.tournament_id = $1 AND r.status = 'approved'
      ORDER BY r.registered_at ASC, rm.is_captain DESC, p.full_name ASC
    `;

    const result = await pool.query(query, [tournamentId]);

    if (isTeam) {
      const teamsMap = new Map<string, any>();

      for (const row of result.rows) {
        if (!teamsMap.has(row.registration_id)) {
          teamsMap.set(row.registration_id, {
            registrationId: row.registration_id,
            teamName: row.team_name || 'Đội chưa đặt tên',
            teamAvatarUrl: row.team_avatar_url || null,
            captainId: row.captain_id,
            captainName: row.captain_name,
            captainStudentId: row.captain_student_id || null,
            status: row.reg_status,
            registeredAt: row.registered_at,
            members: [],
            totalMembers: 0,
            checkedInCount: 0,
          });
        }

        const team = teamsMap.get(row.registration_id);
        const checkinSt = row.checkin_status || 'not_checked_in';
        if (checkinSt === 'approved') {
          team.checkedInCount += 1;
        }

        team.members.push({
          participantId: row.participant_id,
          fullName: row.full_name,
          studentId: row.student_id || null,
          email: row.email || null,
          phoneNumber: row.phone_number || null,
          universityName: row.university_name || 'ĐH Bách Khoa',
          facultyName: row.faculty_name || null,
          className: row.class_name || null,
          accountType: row.account_type || 'internal',
          ingameId: row.member_ingame_id || row.captain_ingame_id || null,
          roleInTeam: row.role_in_team || null,
          isCaptain: Boolean(row.is_captain),
          checkinStatus: checkinSt,
          checkinMethod: row.checkin_method || null,
          checkedInAt: row.checked_in_at || null,
        });

        team.totalMembers = team.members.length;
      }

      return {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentCode: tournament.code,
        participationType: 'team' as const,
        gameName: tournament.game_name,
        status: tournament.status,
        teams: Array.from(teamsMap.values()),
      };
    } else {
      const individualParticipants = result.rows.map((row) => ({
        registrationId: row.registration_id,
        participantId: row.participant_id,
        fullName: row.full_name,
        studentId: row.student_id || null,
        email: row.email || null,
        phoneNumber: row.phone_number || null,
        universityName: row.university_name || 'ĐH Bách Khoa',
        facultyName: row.faculty_name || null,
        className: row.class_name || null,
        accountType: row.account_type || 'internal',
        ingameId: row.member_ingame_id || row.captain_ingame_id || null,
        roleInTeam: row.role_in_team || null,
        isCaptain: Boolean(row.is_captain),
        checkinStatus: row.checkin_status || 'not_checked_in',
        checkinMethod: row.checkin_method || null,
        checkedInAt: row.checked_in_at || null,
      }));

      return {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentCode: tournament.code,
        participationType: 'individual' as const,
        gameName: tournament.game_name,
        status: tournament.status,
        individualParticipants,
      };
    }
  },

  /**
   * [TASK_BE_901] Xác nhận hoặc Hủy xác nhận tham gia (Điểm danh tay ngày đánh giải) cho 1 thành viên.
   */
  async confirmMemberCheckin(data: {
    tournamentId: string;
    registrationId: string;
    participantId: string;
    action: 'confirm' | 'cancel';
    reviewerId?: string | null;
    notes?: string | null;
  }) {
    if (data.action === 'confirm') {
      const query = `
        INSERT INTO public.check_ins (
          tournament_id,
          registration_id,
          participant_id,
          checkin_method,
          status,
          reviewed_by,
          reviewed_at,
          notes,
          checked_in_at
        ) VALUES (
          $1, $2, $3, 'manual_admin', 'approved', $4, NOW(), $5, NOW()
        )
        ON CONFLICT (tournament_id, participant_id) 
        DO UPDATE SET
          checkin_method = 'manual_admin',
          status = 'approved',
          reviewed_by = EXCLUDED.reviewed_by,
          reviewed_at = NOW(),
          notes = COALESCE(EXCLUDED.notes, check_ins.notes),
          checked_in_at = NOW()
        RETURNING *
      `;
      const res = await pool.query(query, [
        data.tournamentId,
        data.registrationId,
        data.participantId,
        data.reviewerId || null,
        data.notes || 'BTC xác nhận trực tiếp ngày thi đấu',
      ]);
      return res.rows[0];
    } else {
      const query = `
        DELETE FROM public.check_ins 
        WHERE tournament_id = $1 AND participant_id = $2
        RETURNING *
      `;
      const res = await pool.query(query, [data.tournamentId, data.participantId]);
      return res.rows[0] || null;
    }
  },
};

/** Parse form_schema của giải — trả mảng field để validate. */
export function parseTournamentSchema(raw: unknown): FormField[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as FormField[];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as FormField[];
    } catch {
      return [];
    }
  }
  return [];
}

/** Lấy form_schema của giải theo id. */
export async function getTournamentFormSchema(tournamentId: string): Promise<FormField[]> {
  const result = await pool.query<Tournament>('SELECT form_schema FROM tournaments WHERE id = $1', [tournamentId]);
  if (!result.rows[0]) return [];
  return parseTournamentSchema(result.rows[0].form_schema);
}
