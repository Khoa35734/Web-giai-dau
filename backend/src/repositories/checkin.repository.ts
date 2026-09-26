import pool from '../config/db.ts';

export interface CheckinInput {
  tournament_id: string;
  registration_id: string;
  participant_id: string;
  checkin_method?: 'qr_scan' | 'proof_submission' | 'ai_ocr' | 'manual_admin';
  proof_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  ip_address?: string | null;
  device_info?: string | null;
  notes?: string | null;
}

export interface CheckinRecord {
  id: string;
  tournament_id: string;
  registration_id: string;
  participant_id: string;
  checkin_method: string;
  status: 'approved' | 'pending_review' | 'rejected';
  proof_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  ip_address: string | null;
  device_info: string | null;
  checked_in_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  // Các trường bổ sung khi JOIN với participants & registrations
  full_name?: string;
  student_id?: string;
  faculty_name?: string;
  email?: string;
  phone_number?: string;
  ingame_id?: string;
  team_name?: string;
}

/**
 * [SRS 3.1 SV-10, 4.5, Table 13]
 * Repository quản lý điểm danh ngày thi đấu (Check-in).
 */
export const checkinRepository = {
  /**
   * Tạo hoặc cập nhật bản ghi Check-in ngày thi đấu cho thí sinh.
   */
  async recordCheckin(input: CheckinInput): Promise<CheckinRecord> {
    const query = `
      INSERT INTO public.check_ins (
        tournament_id,
        registration_id,
        participant_id,
        checkin_method,
        status,
        proof_url,
        latitude,
        longitude,
        location_accuracy,
        ip_address,
        device_info,
        notes,
        checked_in_at
      ) VALUES (
        $1, $2, $3, $4, 'approved', $5, $6, $7, $8, $9, $10, $11, NOW()
      )
      ON CONFLICT (tournament_id, participant_id) 
      DO UPDATE SET
        checkin_method = EXCLUDED.checkin_method,
        status = 'approved',
        proof_url = COALESCE(EXCLUDED.proof_url, check_ins.proof_url),
        latitude = COALESCE(EXCLUDED.latitude, check_ins.latitude),
        longitude = COALESCE(EXCLUDED.longitude, check_ins.longitude),
        location_accuracy = COALESCE(EXCLUDED.location_accuracy, check_ins.location_accuracy),
        ip_address = COALESCE(EXCLUDED.ip_address, check_ins.ip_address),
        device_info = COALESCE(EXCLUDED.device_info, check_ins.device_info),
        notes = COALESCE(EXCLUDED.notes, check_ins.notes),
        checked_in_at = NOW()
      RETURNING *
    `;

    const params = [
      input.tournament_id,
      input.registration_id,
      input.participant_id,
      input.checkin_method || 'qr_scan',
      input.proof_url || null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.location_accuracy ?? null,
      input.ip_address || null,
      input.device_info || null,
      input.notes || null,
    ];

    const result = await pool.query<CheckinRecord>(query, params);
    return result.rows[0];
  },

  /**
   * Tìm bản ghi Check-in theo tournament_id và participant_id.
   */
  async findByTournamentAndParticipant(
    tournamentId: string,
    participantId: string,
  ): Promise<CheckinRecord | null> {
    const query = `
      SELECT * FROM public.check_ins
      WHERE tournament_id = $1 AND participant_id = $2
    `;
    const result = await pool.query<CheckinRecord>(query, [tournamentId, participantId]);
    return result.rows[0] ?? null;
  },

  /**
   * Danh sách check-in của một giải đấu (dành cho Admin / Trọng tài).
   */
  async listByTournament(tournamentId: string): Promise<CheckinRecord[]> {
    const query = `
      SELECT ci.*, 
             p.full_name, p.student_id, p.faculty_name, p.email, p.phone_number,
             r.ingame_id, r.team_name
      FROM public.check_ins ci
      JOIN public.participants p ON ci.participant_id = p.id
      LEFT JOIN public.registrations r ON ci.registration_id = r.id
      WHERE ci.tournament_id = $1
      ORDER BY ci.checked_in_at DESC
    `;
    const result = await pool.query<CheckinRecord>(query, [tournamentId]);
    return result.rows;
  },
};
