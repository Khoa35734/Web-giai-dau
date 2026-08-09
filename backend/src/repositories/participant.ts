import { randomUUID } from 'node:crypto';
import pool from '../config/db.ts';
import type { ParticipantAccountType, Participant, SafeParticipant } from '../types/index.ts';

const PARTICIPANT_COLUMNS =
  'id, account_type, username, full_name, class_name, faculty_name, created_at, updated_at';
const SAFE_PARTICIPANT_COLUMNS = PARTICIPANT_COLUMNS;

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
};