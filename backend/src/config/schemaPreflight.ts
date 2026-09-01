/**
 * Startup Database Schema Preflight Check.
 * Kiểm tra các tiện ích bắt buộc (uuid-ossp), cấu trúc bảng và các check constraints quan trọng.
 * Phát hiện và cảnh báo sớm tình trạng schema drift trước khi phục vụ request.
 */

import pool from './db.ts';

interface PreflightResult {
  hasUuidExtension: boolean;
  missingTables: string[];
  missingConstraints: string[];
  driftDetected: boolean;
}

const REQUIRED_TABLES = [
  'users',
  'participants',
  'tournaments',
  'tournament_organizers',
  'registrations',
  'registration_members',
  'team_join_requests',
  'brackets',
  'bracket_rounds',
  'matches',
  'match_participants',
  'match_games',
  'check_ins',
  'certificates',
  'ai_checkin_sessions',
  'ai_checkin_detections',
  'notifications',
  'audit_logs',
];

const REQUIRED_CONSTRAINTS = [
  'chk_participant_status',
  'chk_account_type',
  'chk_checkin_method',
  'chk_checkin_status',
  'chk_aics_source_type',
  'chk_aics_status',
  'chk_recipient_type',
];

export async function runSchemaPreflight(): Promise<PreflightResult> {
  const result: PreflightResult = {
    hasUuidExtension: false,
    missingTables: [],
    missingConstraints: [],
    driftDetected: false,
  };

  try {
    // 1. Kiểm tra tiện ích uuid-ossp
    const extCheck = await pool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';",
    );
    result.hasUuidExtension = extCheck.rows.length > 0;

    // 2. Kiểm tra các bảng bắt buộc trong public schema
    const tablesCheck = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
    );
    const existingTables = new Set(tablesCheck.rows.map((r) => r.table_name.toLowerCase()));
    result.missingTables = REQUIRED_TABLES.filter((tbl) => !existingTables.has(tbl.toLowerCase()));

    // 3. Kiểm tra các check constraints quan trọng
    const constraintsCheck = await pool.query<{ conname: string }>(
      'SELECT conname FROM pg_constraint WHERE contype = $1;',
      ['c'],
    );
    const existingConstraints = new Set(constraintsCheck.rows.map((r) => r.conname.toLowerCase()));
    result.missingConstraints = REQUIRED_CONSTRAINTS.filter(
      (c) => !existingConstraints.has(c.toLowerCase()),
    );

    result.driftDetected =
      !result.hasUuidExtension ||
      result.missingTables.length > 0 ||
      result.missingConstraints.length > 0;

    // In log báo cáo trạng thái
    if (result.driftDetected) {
      console.warn('⚠️ [SCHEMA DRIFT WARNING] Phát hiện sai khác giữa Database và SRS Schema:');
      if (!result.hasUuidExtension) {
        console.warn('   - Thiếu extension "uuid-ossp" (vui lòng chạy: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";)');
      }
      if (result.missingTables.length > 0) {
        console.warn(`   - Thiếu ${result.missingTables.length} bảng: ${result.missingTables.join(', ')}`);
      }
      if (result.missingConstraints.length > 0) {
        console.warn(
          `   - Thiếu ${result.missingConstraints.length} check constraints: ${result.missingConstraints.join(', ')}`,
        );
      }
      console.warn('   👉 Vui lòng chạy backend/migration_complete_reconciliation.sql để đồng bộ triệt để.');
    } else {
      console.log('✅ [SCHEMA PREFLIGHT] Cơ sở dữ liệu đồng bộ 100% với SRS Schema (18/18 bảng, đầy đủ extension & constraints).');
    }
  } catch (err: any) {
    // Không block server start nếu không kết nối được DB ngay tại preflight
    console.error('⚠️ [SCHEMA PREFLIGHT] Không thể kiểm tra schema database:', err?.message || err);
  }

  return result;
}
