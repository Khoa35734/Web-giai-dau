import pool from '../config/db.ts';

export interface AdminStats {
  total_tournaments: number;
  pending_tournaments: number;
  total_registrations: number;
  approved_registrations: number;
  pending_registrations: number;
}

/** Data access — thống kê cho admin dashboard. */
export const statsRepository = {
  async get(): Promise<AdminStats> {
    const [tournamentsCount, pendingTournaments, registrationsCount, activeCount, pendingCount] =
      await Promise.all([
        pool.query<{ count: string }>("SELECT COUNT(*) FROM tournaments WHERE status = 'approved'"),
        pool.query<{ count: string }>("SELECT COUNT(*) FROM tournaments WHERE status = 'pending'"),
        pool.query<{ count: string }>('SELECT COUNT(*) FROM registrations'),
        pool.query<{ count: string }>("SELECT COUNT(*) FROM registrations WHERE status = 'approved'"),
        pool.query<{ count: string }>("SELECT COUNT(*) FROM registrations WHERE status = 'pending'"),
      ]);

    return {
      total_tournaments: parseInt(tournamentsCount.rows[0]?.count ?? '0', 10),
      pending_tournaments: parseInt(pendingTournaments.rows[0]?.count ?? '0', 10),
      total_registrations: parseInt(registrationsCount.rows[0]?.count ?? '0', 10),
      approved_registrations: parseInt(activeCount.rows[0]?.count ?? '0', 10),
      pending_registrations: parseInt(pendingCount.rows[0]?.count ?? '0', 10),
    };
  },
};
