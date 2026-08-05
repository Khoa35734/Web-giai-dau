import pool from '../config/db.ts';
import type { PaginationResult, SafeUser, User, UserRole } from '../types/index.ts';

export interface UserFilters {
  search?: string;
  status?: string;
  role?: string;
}

export interface PaginatedResult<T> {
  rows: T[];
  pagination: PaginationResult;
}

const USER_COLUMNS =
  'id, email, full_name, student_id, phone, faculty, class_name, course, role, is_active, created_at, updated_at';

const SAFE_USER_COLUMNS = 'id, email, full_name, student_id, phone, faculty, class_name, course, role, is_active';

/** Xây dựng điều kiện WHERE chung cho user (search + status + role). */
function buildWhere(filters: UserFilters): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR student_id ILIKE $${params.length})`,
    );
  }
  if (filters.status) {
    params.push(filters.status === 'active');
    conditions.push(`is_active = $${params.length}`);
  }
  if (filters.role && filters.role !== 'all') {
    params.push(filters.role);
    conditions.push(`role = $${params.length}`);
  }

  return { sql: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', params };
}

/**
 * Data access — bảng users.
 * Toàn bộ SQL tập trung tại đây, controller chỉ gọi hàm.
 */
export const userRepository = {
  /** Tìm user theo email (đầy đủ, gồm password_hash). */
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  },

  /** Kiểm tra email đã tồn tại chưa (có thể loại trừ 1 id). */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const result = excludeId
      ? await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, excludeId])
      : await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    return result.rows.length > 0;
  },

  /** Kiểm tra mã số sinh viên đã tồn tại chưa. */
  async studentIdExists(studentId: string, excludeId?: string): Promise<boolean> {
    const result = excludeId
      ? await pool.query('SELECT id FROM users WHERE student_id = $1 AND id != $2', [studentId, excludeId])
      : await pool.query('SELECT id FROM users WHERE student_id = $1', [studentId]);
    return result.rows.length > 0;
  },

  /** Tìm user theo mã số sinh viên (đầy đủ, gồm password_hash). */
  async findByStudentId(studentId: string): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE student_id = $1', [studentId]);
    return result.rows[0] ?? null;
  },

  /** Tìm user theo id (đầy đủ, gồm password_hash). */
  async findById(id: string): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  },

  /** Tìm user an toàn (không kèm password_hash). */
  async findSafeById(id: string): Promise<SafeUser | null> {
    const result = await pool.query<SafeUser>(
      `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  /** Tạo user mới — trả user an toàn (hỗ trợ thông tin sinh viên). */
  async create(data: {
    email?: string | null;
    password_hash: string;
    full_name: string;
    student_id?: string | null;
    phone?: string | null;
    faculty?: string | null;
    class_name?: string | null;
    course?: string | null;
    role: UserRole;
    is_active: boolean;
  }): Promise<SafeUser> {
    const result = await pool.query<SafeUser>(
      `INSERT INTO users (email, password_hash, full_name, student_id, phone, faculty, class_name, course, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${SAFE_USER_COLUMNS}`,
      [
        data.email ?? null,
        data.password_hash,
        data.full_name,
        data.student_id ?? null,
        data.phone ?? null,
        data.faculty ?? null,
        data.class_name ?? null,
        data.course ?? null,
        data.role,
        data.is_active,
      ],
    );
    return result.rows[0];
  },

  /** Cập nhật user — trả user an toàn (đầy đủ cột). */
  async update(
    id: string,
    data: {
      email: string;
      full_name: string;
      password_hash?: string;
      role?: UserRole;
      is_active?: boolean;
      student_id?: string | null;
      phone?: string | null;
      faculty?: string | null;
      class_name?: string | null;
      course?: string | null;
    },
  ): Promise<SafeUser | null> {
    const result = await pool.query<SafeUser>(
      `UPDATE users SET
          email = $1,
          full_name = $2,
          password_hash = COALESCE($3, password_hash),
          role = COALESCE($4, role),
          is_active = COALESCE($5, is_active),
          student_id = COALESCE($6, student_id),
          phone = COALESCE($7, phone),
          faculty = COALESCE($8, faculty),
          class_name = COALESCE($9, class_name),
          course = COALESCE($10, course),
          updated_at = NOW()
       WHERE id = $11
       RETURNING ${USER_COLUMNS}`,
      [
        data.email,
        data.full_name,
        data.password_hash ?? null,
        data.role ?? null,
        data.is_active ?? null,
        data.student_id ?? null,
        data.phone ?? null,
        data.faculty ?? null,
        data.class_name ?? null,
        data.course ?? null,
        id,
      ],
    );
    return result.rows[0] ?? null;
  },

  /** Bật/tắt trạng thái user — trả user an toàn. */
  async updateStatus(id: string, is_active: boolean): Promise<SafeUser | null> {
    const result = await pool.query<SafeUser>(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2
       RETURNING ${USER_COLUMNS}`,
      [is_active, id],
    );
    return result.rows[0] ?? null;
  },

  /** Xóa user. */
  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  /** Danh sách user với filter + phân trang. */
  async list(filters: UserFilters, page: number, limit: number): Promise<PaginatedResult<SafeUser>> {
    const { sql, params } = buildWhere(filters);
    const baseWhere = `1=1${sql}`;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE ${baseWhere}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [...params, limit, (page - 1) * limit];
    const result = await pool.query<SafeUser>(
      `SELECT ${USER_COLUMNS} FROM users WHERE ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      rows: result.rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  /** Danh sách CTV (role='ctv') với filter + phân trang. */
  async listCtvs(filters: UserFilters, page: number, limit: number): Promise<PaginatedResult<SafeUser>> {
    const { sql, params } = buildWhere(filters);
    const baseWhere = `role = 'ctv'${sql}`;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE ${baseWhere}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [...params, limit, (page - 1) * limit];
    const result = await pool.query<SafeUser>(
      `SELECT ${USER_COLUMNS} FROM users WHERE ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      rows: result.rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  /** Tìm CTV theo id (chỉ role='ctv'). */
  async findCtvById(id: string): Promise<SafeUser | null> {
    const result = await pool.query<SafeUser>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND role = 'ctv'`,
      [id],
    );
    return result.rows[0] ?? null;
  },
};
