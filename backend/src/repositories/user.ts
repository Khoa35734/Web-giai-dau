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

function toSafeUser(user: User): SafeUser {
  const { password_hash, ...rest } = user;
  return rest as SafeUser;
}

async function getUserIdentifierColumn(): Promise<'username' | 'email'> {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`,
  );

  const columns = new Set(result.rows.map((row) => row.column_name.toLowerCase()));
  if (columns.has('username')) {
    return 'username';
  }
  if (columns.has('email')) {
    return 'email';
  }
  return 'username';
}

async function findUserByIdentifier(identifier: string): Promise<User | null> {
  const identifierColumn = await getUserIdentifierColumn();
  const result = await pool.query<User>(`SELECT * FROM users WHERE ${identifierColumn} = $1`, [identifier]);
  return result.rows[0] ?? null;
}

async function identifierExists(identifier: string, excludeId?: string): Promise<boolean> {
  const identifierColumn = await getUserIdentifierColumn();
  const result = excludeId
    ? await pool.query(`SELECT id FROM users WHERE ${identifierColumn} = $1 AND id != $2`, [identifier, excludeId])
    : await pool.query(`SELECT id FROM users WHERE ${identifierColumn} = $1`, [identifier]);
  return result.rows.length > 0;
}

/** Xây dựng điều kiện WHERE chung cho user (search + status + role). */
function buildWhere(filters: UserFilters, identifierColumn: 'username' | 'email'): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(full_name ILIKE $${params.length} OR ${identifierColumn} ILIKE $${params.length})`,
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

  return { sql: conditions.length ? ` AND ${conditions.join(' AND ')}` : '', params };
}

/**
 * Data access — bảng users.
 * Toàn bộ SQL tập trung tại đây, controller chỉ gọi hàm.
 */
export const userRepository = {
  /** Tìm user theo username (đầy đủ, gồm password_hash). */
  async findByUsername(username: string): Promise<User | null> {
    return findUserByIdentifier(username);
  },

  /** Tìm user theo email (đầy đủ, gồm password_hash). */
  async findByEmail(email: string): Promise<User | null> {
    return findUserByIdentifier(email);
  },

  /** Kiểm tra username đã tồn tại chưa (có thể loại trừ 1 id). */
  async usernameExists(username: string, excludeId?: string): Promise<boolean> {
    return identifierExists(username, excludeId);
  },

  /** Kiểm tra email đã tồn tại chưa (có thể loại trừ 1 id). */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    return identifierExists(email, excludeId);
  },

  /** Tìm user theo id (đầy đủ, gồm password_hash). */
  async findById(id: string): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  },

  /** Tìm user an toàn (không kèm password_hash). */
  async findSafeById(id: string): Promise<SafeUser | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? toSafeUser(result.rows[0]) : null;
  },

  /** Tạo user mới — trả user an toàn. */
  async create(data: {
    username?: string | null;
    email?: string | null;
    password_hash: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
  }): Promise<SafeUser> {
    const identifierColumn = await getUserIdentifierColumn();
    const identifierValue = data.username ?? data.email ?? null;

    const result = await pool.query<User>(
      `INSERT INTO users (${identifierColumn}, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [identifierValue, data.password_hash, data.full_name, data.role, data.is_active],
    );
    return toSafeUser(result.rows[0]);
  },

  /** Cập nhật user — trả user an toàn. */
  async update(
    id: string,
    data: {
      username?: string | null;
      email?: string | null;
      full_name?: string;
      password_hash?: string;
      role?: UserRole;
      is_active?: boolean;
    },
  ): Promise<SafeUser | null> {
    const identifierColumn = await getUserIdentifierColumn();
    const identifierValue = data.username ?? data.email ?? null;

    const result = await pool.query<User>(
      `UPDATE users SET
          ${identifierColumn} = $1,
          full_name = COALESCE($2, full_name),
          password_hash = COALESCE($3, password_hash),
          role = COALESCE($4, role),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [identifierValue, data.full_name ?? null, data.password_hash ?? null, data.role ?? null, data.is_active ?? null, id],
    );
    return result.rows[0] ? toSafeUser(result.rows[0]) : null;
  },

  /** Bật/tắt trạng thái user — trả user an toàn. */
  async updateStatus(id: string, is_active: boolean): Promise<SafeUser | null> {
    const result = await pool.query<User>(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2
       RETURNING *`,
      [is_active, id],
    );
    return result.rows[0] ? toSafeUser(result.rows[0]) : null;
  },

  /** Xóa user. */
  async remove(id: string): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  /** Danh sách user với filter + phân trang. */
  async list(filters: UserFilters, page: number, limit: number): Promise<PaginatedResult<SafeUser>> {
    const identifierColumn = await getUserIdentifierColumn();
    const { sql, params } = buildWhere(filters, identifierColumn);
    const baseWhere = `1=1${sql}`;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE ${baseWhere}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [...params, limit, (page - 1) * limit];
    const result = await pool.query<User>(
      `SELECT * FROM users WHERE ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      rows: result.rows.map(toSafeUser),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  /** Danh sách CTV (role='ctv') với filter + phân trang. */
  async listCtvs(filters: UserFilters, page: number, limit: number): Promise<PaginatedResult<SafeUser>> {
    const identifierColumn = await getUserIdentifierColumn();
    const { sql, params } = buildWhere(filters, identifierColumn);
    const baseWhere = `role = 'ctv'${sql}`;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE ${baseWhere}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [...params, limit, (page - 1) * limit];
    const result = await pool.query<User>(
      `SELECT * FROM users WHERE ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      rows: result.rows.map(toSafeUser),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  /** Tìm CTV theo id (chỉ role='ctv'). */
  async findCtvById(id: string): Promise<SafeUser | null> {
    const result = await pool.query<User>(`SELECT * FROM users WHERE id = $1 AND role = 'ctv'`, [id]);
    return result.rows[0] ? toSafeUser(result.rows[0]) : null;
  },
};
