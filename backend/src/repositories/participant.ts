import { randomUUID } from 'node:crypto';
import pool from '../config/db.ts';
import type { ParticipantAccountType, Participant, SafeParticipant, PaginationResult } from '../types/index.ts';

const PARTICIPANT_COLUMNS =
  'id, account_type, username, full_name, class_name, faculty_name, created_at, updated_at';
const SAFE_PARTICIPANT_COLUMNS = PARTICIPANT_COLUMNS;

export interface ParticipantFilters {
  search?: string;
  account_type?: string;
}

export const participantRepository = {
  async findByUsername(username: string): Promise<Participant | null> {
    const result = await pool.query<Participant>('SELECT * FROM participants WHERE username = $1', [username]);
    return result.rows[0] ?? null;
  },

  async findById(id: string): Promise<Participant | null> {
    const result = await pool.query<Participant>('SELECT * FROM participants WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  },

  async usernameExists(username: string, excludeId?: string): Promise<boolean> {
    const result = excludeId
      ? await pool.query('SELECT id FROM participants WHERE username = $1 AND id != $2', [username, excludeId])
      : await pool.query('SELECT id FROM participants WHERE username = $1', [username]);
    return result.rows.length > 0;
  },

  async create(data: {
    id?: string;
    account_type: ParticipantAccountType;
    username: string;
    password_hash: string;
    full_name: string;
    class_name?: string | null;
    faculty_name?: string | null;
  }): Promise<SafeParticipant> {
    const participantId = data.id ?? randomUUID();
    const result = await pool.query<SafeParticipant>(
      `INSERT INTO participants (
         id, account_type, username, password_hash, full_name, class_name, faculty_name
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        participantId,
        data.account_type,
        data.username,
        data.password_hash,
        data.full_name,
        data.class_name ?? null,
        data.faculty_name ?? null,
      ],
    );
    return result.rows[0];
  },

  async findSafeById(id: string): Promise<SafeParticipant | null> {
    const result = await pool.query<SafeParticipant>(
      `SELECT ${SAFE_PARTICIPANT_COLUMNS} FROM participants WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  async list(filters: ParticipantFilters, page: number, limit: number): Promise<{ rows: SafeParticipant[]; pagination: PaginationResult }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR class_name ILIKE $${params.length} OR faculty_name ILIKE $${params.length})`,
      );
    }

    if (filters.account_type && filters.account_type !== 'all') {
      params.push(filters.account_type);
      conditions.push(`account_type = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM participants ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [...params, limit, (page - 1) * limit];
    const result = await pool.query<SafeParticipant>(
      `SELECT ${SAFE_PARTICIPANT_COLUMNS} FROM participants ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      rows: result.rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  },

  async update(
    id: string,
    data: {
      account_type?: ParticipantAccountType;
      username?: string;
      password_hash?: string;
      full_name?: string;
      class_name?: string | null;
      faculty_name?: string | null;
    },
  ): Promise<SafeParticipant | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          account_type = COALESCE($1, account_type),
          username = COALESCE($2, username),
          password_hash = COALESCE($3, password_hash),
          full_name = COALESCE($4, full_name),
          class_name = COALESCE($5, class_name),
          faculty_name = COALESCE($6, faculty_name),
          updated_at = NOW()
       WHERE id = $7
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        data.account_type ?? null,
        data.username ?? null,
        data.password_hash ?? null,
        data.full_name ?? null,
        data.class_name ?? null,
        data.faculty_name ?? null,
        id,
      ],
    );

    return result.rows[0] ?? null;
  },

  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM participants WHERE id = $1', [id]);
  },
};
