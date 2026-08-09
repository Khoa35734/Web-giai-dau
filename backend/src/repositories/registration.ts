import pool from '../config/db.ts';
import type {
  FormField,
  Registration,
  RegistrationMember,
  RegistrationStatus,
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
}

/**
 * Data access — bảng registrations.
 * Toàn bộ SQL tập trung tại đây, controller chỉ gọi hàm.
 */
export const registrationRepository = {
  /** Tạo đăng ký team mới và đồng thời ghi registration_members. */
  async createTeamRegistration(data: {
    tournament_id: string;
    captain_id: string;
    team_name?: string | null;
    submitted_data?: unknown;
    member_ids?: string[];
    is_auto_matched?: boolean;
  }): Promise<Registration & { members: RegistrationMember[] }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tournamentResult = await client.query<Pick<Tournament, 'id' | 'participation_type' | 'min_team_size' | 'max_team_size'>>(
        'SELECT id, participation_type, min_team_size, max_team_size FROM tournaments WHERE id = $1 FOR SHARE',
        [data.tournament_id],
      );
      const tournament = tournamentResult.rows[0];
      if (!tournament) {
        throw new Error('Không tìm thấy giải đấu');
      }
      const memberIds = Array.from(new Set([data.captain_id, ...(data.member_ids ?? [])]));
      if (tournament.participation_type === 'team') {
        const minSize = tournament.min_team_size ?? memberIds.length;
        const maxSize = tournament.max_team_size ?? memberIds.length;
        if (memberIds.length < minSize || memberIds.length > maxSize) {
          throw new Error(`Số lượng thành viên phải từ ${minSize} đến ${maxSize}`);
        }
      } else if (memberIds.length !== 1) {
        throw new Error('Giải đấu cá nhân chỉ cho phép 1 người đăng ký');
      }

      const registrationResult = await client.query<Registration>(
        `INSERT INTO registrations (tournament_id, captain_id, team_name, submitted_data, status, is_auto_matched)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING *`,
        [
          data.tournament_id,
          data.captain_id,
          data.team_name ?? null,
          JSON.stringify(data.submitted_data ?? {}),
          data.is_auto_matched ?? false,
        ],
      );
      const registration = registrationResult.rows[0];

      const members: RegistrationMember[] = [];
      for (const participantId of memberIds) {
        const memberResult = await client.query<RegistrationMember>(
          `INSERT INTO registration_members (registration_id, participant_id, is_captain)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [registration.id, participantId, participantId === data.captain_id],
        );
        members.push(memberResult.rows[0]);
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

  /** Tất cả đăng ký — admin, lọc theo giải + trạng thái. */
  async listAll(filters: RegistrationFilters): Promise<RegistrationWithTournament[]> {
    let query =
      'SELECT r.*, t.name as tournament_name FROM registrations r LEFT JOIN tournaments t ON r.tournament_id = t.id WHERE 1=1';
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

    const result = await pool.query(query, params);
    return result.rows;
  },

  /** Đăng ký của một giải cụ thể. */
  async listByTournament(tournamentId: string): Promise<Registration[]> {
    const result = await pool.query<Registration>(
      'SELECT * FROM registrations WHERE tournament_id = $1 ORDER BY registered_at DESC',
      [tournamentId],
    );
    return result.rows;
  },

  /** Đăng ký thuộc các giải do user tạo (admin: tất cả). */
  async listMine(userId: string, isAdmin: boolean, filters: RegistrationFilters): Promise<RegistrationWithTournament[]> {
    let query = `
      SELECT r.*, t.name as tournament_name, t.game_name, t.form_schema
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (!isAdmin) {
      params.push(userId);
      query += ` AND t.created_by = $${params.length}`;
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

    const result = await pool.query(query, params);
    return result.rows;
  },

  /** Cập nhật trạng thái đăng ký. */
  async updateStatus(id: string, status: RegistrationStatus): Promise<Registration | null> {
    const result = await pool.query<Registration>(
      `UPDATE registrations SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id],
    );
    return result.rows[0] ?? null;
  },

  /** Tìm đăng ký kèm thông tin chủ giải (để kiểm tra quyền xóa). */
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
