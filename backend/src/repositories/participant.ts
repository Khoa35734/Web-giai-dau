import { randomUUID } from 'node:crypto';
import pool from '../config/db.ts';
import type { ParticipantAccountType, ParticipantStatus, Participant, SafeParticipant, PaginationResult } from '../types/index.ts';

const PARTICIPANT_COLUMNS =
  'id, account_type, username, full_name, student_id, email, phone_number, university_name, faculty_name, class_name, student_card_url, selfie_with_student_card_url, status, approved_by, approved_at, rejection_reason, created_at, updated_at';
const SAFE_PARTICIPANT_COLUMNS = PARTICIPANT_COLUMNS;

export interface ParticipantFilters {
  search?: string;
  account_type?: string;
  status?: string;
}

export const participantRepository = {
  /** Tìm kiếm thí sinh theo Username */
  async findByUsername(username: string): Promise<Participant | null> {
    const result = await pool.query<Participant>(
      `SELECT * FROM participants WHERE LOWER(username) = LOWER($1)`,
      [username.trim()],
    );
    return result.rows[0] ?? null;
  },

  /** Tìm kiếm thí sinh theo Email */
  async findByEmail(email: string): Promise<Participant | null> {
    const result = await pool.query<Participant>(
      `SELECT * FROM participants WHERE LOWER(email) = LOWER($1)`,
      [email.trim()],
    );
    return result.rows[0] ?? null;
  },

  /** Tìm kiếm thí sinh theo MSSV (Student ID) */
  async findByStudentId(studentId: string): Promise<Participant | null> {
    const result = await pool.query<Participant>(
      `SELECT * FROM participants WHERE UPPER(student_id) = UPPER($1)`,
      [studentId.trim()],
    );
    return result.rows[0] ?? null;
  },

  /**
   * Đăng nhập đa năng (SV-02):
   * Tìm kiếm theo Username HOẶC Email HOẶC Student ID
   */
  async findByLoginIdentifier(identifier: string): Promise<Participant | null> {
    const cleanId = identifier.trim();
    const result = await pool.query<Participant>(
      `SELECT * FROM participants 
       WHERE LOWER(username) = LOWER($1) 
          OR LOWER(email) = LOWER($1) 
          OR UPPER(student_id) = UPPER($1)
       LIMIT 1`,
      [cleanId],
    );
    return result.rows[0] ?? null;
  },

  /** Tìm kiếm theo ID khóa chính */
  async findById(id: string): Promise<Participant | null> {
    const result = await pool.query<Participant>('SELECT * FROM participants WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  },

  /** Lấy thông tin an toàn theo ID (loại bỏ password_hash) */
  async findSafeById(id: string): Promise<SafeParticipant | null> {
    const result = await pool.query<SafeParticipant>(
      `SELECT ${SAFE_PARTICIPANT_COLUMNS} FROM participants WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  /** Kiểm tra trùng lặp thông tin định danh */
  async checkDuplicate(params: {
    username?: string;
    email?: string;
    student_id?: string;
    excludeId?: string;
  }): Promise<{ duplicate: boolean; field?: 'username' | 'email' | 'student_id'; message?: string }> {
    const { username, email, student_id, excludeId } = params;

    if (username) {
      const q = excludeId
        ? await pool.query('SELECT id FROM participants WHERE LOWER(username) = LOWER($1) AND id != $2', [username.trim(), excludeId])
        : await pool.query('SELECT id FROM participants WHERE LOWER(username) = LOWER($1)', [username.trim()]);
      if (q.rows.length > 0) {
        return { duplicate: true, field: 'username', message: 'Tên đăng nhập đã được sử dụng' };
      }
    }

    if (email) {
      const q = excludeId
        ? await pool.query('SELECT id FROM participants WHERE LOWER(email) = LOWER($1) AND id != $2', [email.trim(), excludeId])
        : await pool.query('SELECT id FROM participants WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (q.rows.length > 0) {
        return { duplicate: true, field: 'email', message: 'Địa chỉ Email đã được sử dụng' };
      }
    }

    if (student_id) {
      const q = excludeId
        ? await pool.query('SELECT id FROM participants WHERE UPPER(student_id) = UPPER($1) AND id != $2', [student_id.trim(), excludeId])
        : await pool.query('SELECT id FROM participants WHERE UPPER(student_id) = UPPER($1)', [student_id.trim()]);
      if (q.rows.length > 0) {
        return { duplicate: true, field: 'student_id', message: 'Mã số sinh viên (MSSV) đã được sử dụng' };
      }
    }

    return { duplicate: false };
  },

  /** Kiểm tra nhanh username tồn tại */
  async usernameExists(username: string, excludeId?: string): Promise<boolean> {
    const res = await this.checkDuplicate({ username, excludeId });
    return res.duplicate;
  },

  /**
   * Tạo tài khoản sinh viên mới (SV-01 KYC)
   * Trạng thái khởi tạo bắt buộc là 'pending'
   */
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
    faculty_name?: string | null;
    class_name?: string | null;
    student_card_url?: string | null;
    selfie_with_student_card_url?: string | null;
    status?: ParticipantStatus;
  }): Promise<SafeParticipant> {
    const participantId = data.id ?? (data.student_id ? data.student_id.trim().toUpperCase() : randomUUID());
    const initialStatus = data.status ?? 'pending';

    const result = await pool.query<SafeParticipant>(
      `INSERT INTO participants (
         id, account_type, username, password_hash, full_name, student_id, email, 
         phone_number, university_name, faculty_name, class_name, 
         student_card_url, selfie_with_student_card_url, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        participantId,
        data.account_type,
        data.username ? data.username.trim() : null,
        data.password_hash,
        data.full_name.trim(),
        data.student_id ? data.student_id.trim().toUpperCase() : null,
        data.email ? data.email.trim().toLowerCase() : null,
        data.phone_number ? data.phone_number.trim() : null,
        data.university_name ? data.university_name.trim() : null,
        data.faculty_name ? data.faculty_name.trim() : null,
        data.class_name ? data.class_name.trim() : null,
        data.student_card_url ?? null,
        data.selfie_with_student_card_url ?? null,
        initialStatus,
      ],
    );
    return result.rows[0];
  },

  /**
   * Cập nhật thông tin cá nhân (SV-03 Profile Management)
   */
  async updateProfile(
    id: string,
    data: {
      phone_number?: string | null;
      class_name?: string | null;
      faculty_name?: string | null;
      full_name?: string;
      password_hash?: string;
    },
  ): Promise<SafeParticipant | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          phone_number = COALESCE($1, phone_number),
          class_name = COALESCE($2, class_name),
          faculty_name = COALESCE($3, faculty_name),
          full_name = COALESCE($4, full_name),
          password_hash = COALESCE($5, password_hash),
          updated_at = NOW()
       WHERE id = $6
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        data.phone_number !== undefined ? (data.phone_number ? data.phone_number.trim() : null) : null,
        data.class_name !== undefined ? (data.class_name ? data.class_name.trim() : null) : null,
        data.faculty_name !== undefined ? (data.faculty_name ? data.faculty_name.trim() : null) : null,
        data.full_name ? data.full_name.trim() : null,
        data.password_hash ?? null,
        id,
      ],
    );

    return result.rows[0] ?? null;
  },

  /**
   * Gửi duyệt lại hồ sơ khi bị từ chối (SV-04 Resubmit)
   * Chuyển trạng thái về 'pending' và xóa rejection_reason
   */
  async resubmit(
    id: string,
    data: {
      full_name?: string;
      phone_number?: string | null;
      university_name?: string | null;
      faculty_name?: string | null;
      class_name?: string | null;
      student_card_url?: string | null;
      selfie_with_student_card_url?: string | null;
      password_hash?: string;
    },
  ): Promise<SafeParticipant | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          full_name = COALESCE($1, full_name),
          phone_number = COALESCE($2, phone_number),
          university_name = COALESCE($3, university_name),
          faculty_name = COALESCE($4, faculty_name),
          class_name = COALESCE($5, class_name),
          student_card_url = COALESCE($6, student_card_url),
          selfie_with_student_card_url = COALESCE($7, selfie_with_student_card_url),
          password_hash = COALESCE($8, password_hash),
          status = 'pending',
          rejection_reason = NULL,
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
       WHERE id = $9
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        data.full_name ? data.full_name.trim() : null,
        data.phone_number !== undefined ? (data.phone_number ? data.phone_number.trim() : null) : null,
        data.university_name !== undefined ? (data.university_name ? data.university_name.trim() : null) : null,
        data.faculty_name !== undefined ? (data.faculty_name ? data.faculty_name.trim() : null) : null,
        data.class_name !== undefined ? (data.class_name ? data.class_name.trim() : null) : null,
        data.student_card_url ?? null,
        data.selfie_with_student_card_url ?? null,
        data.password_hash ?? null,
        id,
      ],
    );

    return result.rows[0] ?? null;
  },

  /**
   * Admin / CTV Phê duyệt hoặc Từ chối hồ sơ KYC (AD-02)
   */
  async review(
    id: string,
    data: {
      status: 'approved' | 'rejected';
      rejection_reason?: string | null;
      approved_by: string;
    },
  ): Promise<SafeParticipant | null> {
    const result = await pool.query<SafeParticipant>(
      `UPDATE participants SET
          status = $1,
          rejection_reason = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
       WHERE id = $4
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        data.status,
        data.status === 'rejected' ? (data.rejection_reason || 'Thông tin thẻ sinh viên không hợp lệ') : null,
        data.approved_by,
        id,
      ],
    );

    return result.rows[0] ?? null;
  },

  /**
   * Danh sách thí sinh cho Admin quản lý
   */
  async list(filters: ParticipantFilters, page: number, limit: number): Promise<{ rows: SafeParticipant[]; pagination: PaginationResult }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR student_id ILIKE $${params.length} OR email ILIKE $${params.length} OR university_name ILIKE $${params.length} OR class_name ILIKE $${params.length} OR faculty_name ILIKE $${params.length})`,
      );
    }

    if (filters.account_type && filters.account_type !== 'all') {
      params.push(filters.account_type);
      conditions.push(`account_type = $${params.length}`);
    }

    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
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

  /**
   * Cập nhật thông tin thí sinh (Admin CRUD)
   */
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
      status?: ParticipantStatus;
      student_card_url?: string | null;
      selfie_with_student_card_url?: string | null;
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
          student_id = COALESCE($5, student_id),
          email = COALESCE($6, email),
          phone_number = COALESCE($7, phone_number),
          university_name = COALESCE($8, university_name),
          class_name = COALESCE($9, class_name),
          faculty_name = COALESCE($10, faculty_name),
          status = COALESCE($11, status),
          student_card_url = COALESCE($12, student_card_url),
          selfie_with_student_card_url = COALESCE($13, selfie_with_student_card_url),
          updated_at = NOW()
       WHERE id = $14
       RETURNING ${SAFE_PARTICIPANT_COLUMNS}`,
      [
        data.account_type ?? null,
        data.username !== undefined ? (data.username ? data.username.trim() : null) : null,
        data.password_hash ?? null,
        data.full_name ? data.full_name.trim() : null,
        data.student_id !== undefined ? (data.student_id ? data.student_id.trim().toUpperCase() : null) : null,
        data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : null,
        data.phone_number !== undefined ? (data.phone_number ? data.phone_number.trim() : null) : null,
        data.university_name !== undefined ? (data.university_name ? data.university_name.trim() : null) : null,
        data.class_name !== undefined ? (data.class_name ? data.class_name.trim() : null) : null,
        data.faculty_name !== undefined ? (data.faculty_name ? data.faculty_name.trim() : null) : null,
        data.status ?? null,
        data.student_card_url ?? null,
        data.selfie_with_student_card_url ?? null,
        id,
      ],
    );

    return result.rows[0] ?? null;
  },

  /** Xóa vĩnh viễn thí sinh */
  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM participants WHERE id = $1', [id]);
  },
};