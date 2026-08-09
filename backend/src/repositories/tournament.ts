import pool from '../config/db.ts';
import type { ParticipationType, Tournament, TournamentStatus } from '../types/index.ts';

export interface TournamentFilters {
  search?: string;
  status?: string;
}

export interface TournamentInput {
  name: string;
  game_name: string;
  game_logo_url?: string;
  banner_url: string;
  participation_type: ParticipationType;
  max_participants: number;
  min_team_size?: number | null;
  max_team_size?: number | null;
  registration_open_at?: string;
  registration_close_at?: string;
  start_at?: string;
  end_at?: string;
  description?: string;
  use_external_link?: boolean;
  external_registration_url?: string;
  form_schema?: unknown;
}

/**
 * Data access — bảng tournaments.
 * Toàn bộ SQL tập trung tại đây, controller chỉ gọi hàm.
 */
export const tournamentRepository = {
  /** Danh sách giải đấu — hỗ trợ tìm kiếm + lọc trạng thái. */
  async list(filters: TournamentFilters): Promise<Tournament[]> {
    let query = 'SELECT * FROM tournaments WHERE 1=1';
    const params: string[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (name ILIKE $${params.length} OR game_name ILIKE $${params.length})`;
    }
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query<Tournament>(query, params);
    return result.rows;
  },

  /** Tìm giải đấu theo id. */
  async findById(id: string): Promise<Tournament | null> {
    const result = await pool.query<Tournament>('SELECT * FROM tournaments WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  },

  /** Đếm số giải cùng game trong cùng tháng — phục vụ sinh mã tự động. */
  async countByGameAndCodePrefix(gameName: string, codePrefix: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM tournaments
       WHERE game_name = $1 AND code LIKE $2`,
      [gameName, `${codePrefix}%`],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  },

  /** Tạo giải đấu mới. */
  async create(data: TournamentInput & {
    code: string;
    created_by: string;
    approved_by: string | null;
    status: TournamentStatus;
    approved_at: Date | null;
  }): Promise<Tournament> {
    const result = await pool.query<Tournament>(
      `INSERT INTO tournaments (
          code, name, game_name, game_logo_url, banner_url, participation_type,
         max_participants, min_team_size, max_team_size,
          registration_open_at, registration_close_at,
          start_at, end_at, description, use_external_link, external_registration_url,
          form_schema, created_by, approved_by, status, approved_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [
        data.code,
        data.name,
        data.game_name,
        data.game_logo_url,
        data.banner_url,
        data.participation_type,
        data.max_participants,
        data.min_team_size ?? null,
        data.max_team_size ?? null,
        data.registration_open_at,
        data.registration_close_at,
        data.start_at,
        data.end_at,
        data.description,
        data.use_external_link,
        data.external_registration_url,
        JSON.stringify(data.form_schema ?? []),
        data.created_by,
        data.approved_by,
        data.status,
        data.approved_at,
      ],
    );
    return result.rows[0];
  },

  /** Cập nhật giải đấu — chỉ các field truyền vào. */
  async update(id: string, patch: Partial<Tournament>): Promise<Tournament | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const merged = { ...current, ...patch };
    const result = await pool.query<Tournament>(
      `UPDATE tournaments SET
          name=$1, game_name=$2, game_logo_url=$3, banner_url=$4, participation_type=$5,
         max_participants=$6, min_team_size=$7, max_team_size=$8,
         registration_open_at=$9, registration_close_at=$10,
         start_at=$11, end_at=$12, description=$13, use_external_link=$14,
         external_registration_url=$15, form_schema=$16, status=$17,
         approved_by=$18, approved_at=$19, updated_at=NOW()
       WHERE id=$20 RETURNING *`,
      [
        merged.name,
        merged.game_name,
        merged.game_logo_url,
        merged.banner_url,
        merged.participation_type,
        merged.max_participants,
        merged.min_team_size,
        merged.max_team_size,
        merged.registration_open_at,
        merged.registration_close_at,
        merged.start_at,
        merged.end_at,
        merged.description,
        merged.use_external_link,
        merged.external_registration_url,
        typeof merged.form_schema === 'string'
          ? merged.form_schema
          : JSON.stringify(merged.form_schema ?? []),
        merged.status,
        merged.approved_by,
        merged.approved_at,
        id,
      ],
    );
    return result.rows[0] ?? null;
  },

  /** Danh sách giải chờ duyệt (kèm tên người tạo) — admin. */
  async listPending(): Promise<(Tournament & { created_by_name: string })[]> {
    const result = await pool.query(
      `SELECT t.*, u.full_name as created_by_name FROM tournaments t
       JOIN users u ON t.created_by = u.id
       WHERE t.status = 'pending'
       ORDER BY t.created_at ASC`,
    );
    return result.rows;
  },

  /** Danh sách giải chờ duyệt của một user — CTV. */
  async listMyPending(userId: string): Promise<Tournament[]> {
    const result = await pool.query<Tournament>(
      `SELECT * FROM tournaments
       WHERE created_by = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  /** Danh sách giải của một user (admin: tất cả). */
  async listByUser(userId: string, isAdmin: boolean): Promise<Tournament[]> {
    const params: string[] = [];
    let query = 'SELECT * FROM tournaments';
    if (!isAdmin) {
      params.push(userId);
      query += ' WHERE created_by = $1';
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query<Tournament>(query, params);
    return result.rows;
  },

  /** Xóa giải đấu. */
  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM tournaments WHERE id = $1', [id]);
  },
};
