import { tournamentRepository } from '../repositories/tournament.ts';

const GAME_CODE_MAP: Record<string, string> = {
  'Liên Quân Mobile': 'AOV',
  'League of Legend': 'LOL',
  Valorant: 'VAL',
  TFT: 'TFT',
};

/**
 * Sinh mã giải đấu tự động.
 * Format: <GameCode><MMYY><sequence>
 * Ví dụ: AOV052026001 (Liên Quân), LOL052026001 (League of Legend)
 */
export async function generateTournamentCode(gameName: string, startDate: string): Promise<string> {
  const gameCode = GAME_CODE_MAP[gameName] ?? gameName.substring(0, 3).toUpperCase();
  const date = new Date(startDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2); // 2 chữ số cuối của năm
  const monthYearCode = `${month}${year}`;

  const count = await tournamentRepository.countByGameAndCodePrefix(gameName, `${gameCode}${monthYearCode}`);
  const sequence = (count + 1).toString().padStart(3, '0');
  return `${gameCode}${monthYearCode}${sequence}`;
}
