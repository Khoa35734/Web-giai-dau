import { randomUUID } from 'node:crypto';
import pool from '../config/db.ts';
import type { ParticipantAccountType, Participant, SafeParticipant, PaginationResult, ParticipantStatus } from '../types/index.ts';

const PARTICIPANT_SAFE_COLUMNS = `
  id, username, full_name, student_id, email, phone_number,
  university_name, faculty_name, class_name, account_type,
  student_card_url, selfie_with_student_card_url,
  status, approved_by, approved_at, rejection_reason, rejected_at,
  created_at, updated_at
`;

export interface ParticipantFilters {
  search?: string;
  account_type?: string;
  status?: string;
  faculty_name?: string;
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

  async findByIdentifier(identifier: string): Promise<Participant | null> {
    const cleanId = identifier.trim();
    const result = await pool.query<Participant>(
      `SELECT * FROM participants
       WHERE username ILIKE $1 OR email ILIKE $1 OR student_id ILIKE $1 OR id = $1
       LIMIT 1`,
      [cleanId],
    );
    return result.rows[0] ?? null;
  },

  async findSafeById(id: string): Promise<SafeParticipant | null> {
    const result = await pool.query<SafeParticipant>(
      `SELECT ${PARTICIPANT_SAFE_COLUMNS} FROM participants WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  async usernameExists(username: string, excludeId?: string): Promise<boolean> {
    const result = excludeId
      ? await pool.query('SELECT id FROM participants WHERE username ILIKE $1 AND id != $2', [username, excludeId])
      : await pool.query('SELECT id FROM participants WHERE username ILIKE $1', [username]);
    return result.rows.length > 0;
  },

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const result = excludeId
      ? await pool.query('SELECT id FROM participants WHERE email ILIKE $1 AND id != $2', [email, excludeId])
      : await pool.query('SELECT id FROM participants WHERE email ILIKE $1', [email]);
    return result.rows.length > 0;
  },

  async studentIdExists(studentId: string, excludeId?: string): Promise<boolean> {
    const result = excludeId
      ? await pool.query('SELECT id FROM participants WHERE student_id ILIKE $1 AND id != $2', [studentId, excludeId])
      : await pool.query('SELECT id FROM participants WHERE student_id ILIKE $1', [studentId]);
    return result.rows.length > 0;
  },

  async create(data: {
    id?: string;
    account_type: ParticipantAccountType;
    username?: string | null;
    password_hash: string;
    full_name: string;
    student_id?: string | null;
    email?: string | null;
    phone_number?: string | null;
    university_name?: string | null;
    class_name?: string | null;
    faculty_name?: string | null;
    student_card_url?: string | null;
    selfie_with_student_card_url?: string | null;
    status?: ParticipantStatus;
  }): Promise<SafeParticipant> {
    const participantId = data.id ?? (data.student_id || randomUUID());
    const finalStatus = data.status || 'pending';
    const finalAccountType = ['dut', 'internal', 'dut_student'].includes(data.account_type) ? 'internal' : 'external';

    const result = await pool.query<SafeParticipant>(
      `INSERT INTO participants (
         id, username, password_hash, full_name, student_id, email, phone_number,
         university_name, faculty_name, class_name, account_type,
         student_card_url, selfie_with_student_card_url, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
      [
        participantId,
        data.username || data.student_id || data.email || participantId,
        data.password_hash,
        data.full_name,
        data.student_id ?? null,
        data.email ?? null,
        data.phone_number ?? null,
        data.university_name ?? 'Trường Đại học Bách khoa - ĐHĐN (DUT)',
        data.faculty_name ?? null,
        data.class_name ?? null,
        finalAccountType,
        data.student_card_url ?? null,
        data.selfie_with_student_card_url ?? null,
        finalStatus,
      ],
    );
    return result.rows[0];
  },

  async list(
    filters: ParticipantFilters,
    page: number,
    limit: number,
  ): Promise<{ rows: SafeParticipant[]; pagination: PaginationResult }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(username ILIKE $${idx} OR full_name ILIKE $${idx} OR student_id ILIKE $${idx} OR email ILIKE $${idx} OR phone_number ILIKE $${idx} OR university_name ILIKE $${idx} OR class_name ILIKE $${idx} OR faculty_name ILIKE $${idx})`,
      );
    }

    if (filters.account_type && filters.account_type !== 'all') {
      const type = ['dut', 'internal', 'dut_student'].includes(filters.account_type) ? 'internal' : 'external';
      params.push(type);
      conditions.push(`account_type = $${params.length}`);
    }

    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.faculty_name && filters.faculty_name !== 'all') {
      params.push(filters.faculty_name);
      conditions.push(`faculty_name = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM participants ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [...params, limit, (page - 1) * limit];
    const result = await pool.query<SafeParticipant>(
      `SELECT ${PARTICIPANT_SAFE_COLUMNS} FROM participants ${whereClause}
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
      username?: string | null;
      password_hash?: string;
      full_name?: string;
      student_id?: string | null;
      email?: string | null;
      phone_number?: string | null;
      university_name?: string | null;
      class_name?: string | null;
      faculty_name?: string | null;
      student_card_url?: string | null;
      selfie_with_student_card_url?: string | null;
      status?: ParticipantStatus;
    },
  ): Promise<SafeParticipant | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const normalizedAccountType = data.account_type
      ? ['dut', 'internal', 'dut_student'].includes(data.account_type)
        ? 'internal'
        : 'external'
      : undefined;

    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          account_type = COALESCE($1, account_type),
          username = COALESCE($2, username),
          password_hash = COALESCE($3, password_hash),
          full_name = COALESCE($4, full_name),
          student_id = COALESCE($5, student_id),
          email = COALESCE($6, email),
          phone_number = COALESCE($7, phone_number),
          university_name = COALESCE($8, university_name),
          class_name = COALESCE($9, class_name),
          faculty_name = COALESCE($10, faculty_name),
          student_card_url = COALESCE($11, student_card_url),
          selfie_with_student_card_url = COALESCE($12, selfie_with_student_card_url),
          status = COALESCE($13, status),
          updated_at = NOW()
       WHERE id = $14
       RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
      [
        normalizedAccountType ?? null,
        data.username ?? null,
        data.password_hash ?? null,
        data.full_name ?? null,
        data.student_id ?? null,
        data.email ?? null,
        data.phone_number ?? null,
        data.university_name ?? null,
        data.class_name ?? null,
        data.faculty_name ?? null,
        data.student_card_url ?? null,
        data.selfie_with_student_card_url ?? null,
        data.status ?? null,
        id,
      ],
    );

    return result.rows[0] ?? null;
  },

  async resubmit(
    id: string,
    data: {
      full_name?: string;
      phone_number?: string | null;
      university_name?: string | null;
      student_id?: string | null;
      class_name?: string | null;
      faculty_name?: string | null;
      student_card_url?: string | null;
      selfie_with_student_card_url?: string | null;
      password_hash?: string;
    },
  ): Promise<SafeParticipant | null> {
    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          full_name = COALESCE($1, full_name),
          phone_number = COALESCE($2, phone_number),
          university_name = COALESCE($3, university_name),
          student_id = COALESCE($4, student_id),
          class_name = COALESCE($5, class_name),
          faculty_name = COALESCE($6, faculty_name),
          student_card_url = COALESCE($7, student_card_url),
          selfie_with_student_card_url = COALESCE($8, selfie_with_student_card_url),
          password_hash = COALESCE($9, password_hash),
          status = 'pending',
          rejection_reason = NULL,
          rejected_at = NULL,
          updated_at = NOW()
       WHERE id = $10
       RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
      [
        data.full_name ?? null,
        data.phone_number ?? null,
        data.university_name ?? null,
        data.student_id ?? null,
        data.class_name ?? null,
        data.faculty_name ?? null,
        data.student_card_url ?? null,
        data.selfie_with_student_card_url ?? null,
        data.password_hash ?? null,
        id,
      ],
    );
    return result.rows[0] ?? null;
  },

  async approve(id: string, adminId: string, ipAddress?: string): Promise<SafeParticipant | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<SafeParticipant>(
        `UPDATE participants SET
            status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            rejection_reason = NULL,
            rejected_at = NULL,
            updated_at = NOW()
         WHERE id = $2
         RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
        [adminId, id],
      );

      const participant = result.rows[0];
      if (!participant) {
        await client.query('ROLLBACK');
        return null;
      }

      // 1. Tạo Notification cho sinh viên
      await client.query(
        `INSERT INTO notifications (
           recipient_type, recipient_id, title, message, type, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'participant',
          id,
          'Hồ sơ KYC đã được phê duyệt',
          'Chúc mừng! Hồ sơ xác thực sinh viên của bạn đã được Ban tổ chức phê duyệt thành công.',
          'kyc_status',
          JSON.stringify({ participant_id: id, status: 'approved' }),
        ],
      );

      // 2. Ghi Audit Log
      await client.query(
        `INSERT INTO audit_logs (
           actor_id, actor_role, action, target_table, target_id, payload, ip_address
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          adminId,
          'admin',
          'APPROVE_STUDENT',
          'participants',
          id,
          JSON.stringify({ status: 'approved', approved_by: adminId }),
          ipAddress ?? null,
        ],
      );

      await client.query('COMMIT');
      return participant;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async reject(id: string, adminId: string, rejectionReason: string, ipAddress?: string): Promise<SafeParticipant | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<SafeParticipant>(
        `UPDATE participants SET
            status = 'rejected',
            rejection_reason = $1,
            rejected_at = NOW(),
            updated_at = NOW()
         WHERE id = $2
         RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
        [rejectionReason, id],
      );

      const participant = result.rows[0];
      if (!participant) {
        await client.query('ROLLBACK');
        return null;
      }

      // 1. Tạo Notification cho sinh viên
      await client.query(
        `INSERT INTO notifications (
           recipient_type, recipient_id, title, message, type, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'participant',
          id,
          'Hồ sơ KYC bị từ chối',
          `Hồ sơ xác thực sinh viên của bạn chưa được duyệt. Lý do: ${rejectionReason}`,
          'kyc_status',
          JSON.stringify({ participant_id: id, status: 'rejected', rejection_reason: rejectionReason }),
        ],
      );

      // 2. Ghi Audit Log
      await client.query(
        `INSERT INTO audit_logs (
           actor_id, actor_role, action, target_table, target_id, payload, ip_address
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          adminId,
          'admin',
          'REJECT_STUDENT',
          'participants',
          id,
          JSON.stringify({ status: 'rejected', rejection_reason: rejectionReason }),
          ipAddress ?? null,
        ],
      );

      await client.query('COMMIT');
      return participant;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateStatus(
    id: string,
    adminId: string,
    status: ParticipantStatus,
    reason?: string,
    ipAddress?: string,
  ): Promise<SafeParticipant | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<SafeParticipant>(
        `UPDATE participants SET
            status = $1,
            rejection_reason = $2,
            updated_at = NOW()
         WHERE id = $3
         RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
        [status, reason ?? null, id],
      );

      const participant = result.rows[0];
      if (!participant) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `INSERT INTO audit_logs (
           actor_id, actor_role, action, target_table, target_id, payload, ip_address
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          adminId,
          'admin',
          'UPDATE_STUDENT_STATUS',
          'participants',
          id,
          JSON.stringify({ status, reason }),
          ipAddress ?? null,
        ],
      );

      await client.query('COMMIT');
      return participant;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateProfile(
    id: string,
    data: {
      full_name?: string;
      phone_number?: string | null;
      class_name?: string | null;
      faculty_name?: string | null;
      password_hash?: string;
    },
  ): Promise<SafeParticipant | null> {
    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          full_name = COALESCE($1, full_name),
          phone_number = COALESCE($2, phone_number),
          class_name = COALESCE($3, class_name),
          faculty_name = COALESCE($4, faculty_name),
          password_hash = COALESCE($5, password_hash),
          updated_at = NOW()
       WHERE id = $6
       RETURNING ${PARTICIPANT_SAFE_COLUMNS}`,
      [
        data.full_name ?? null,
        data.phone_number ?? null,
        data.class_name ?? null,
        data.faculty_name ?? null,
        data.password_hash ?? null,
        id,
      ],
    );
    return result.rows[0] ?? null;
  },

  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM participants WHERE id = $1', [id]);
  },
};
