import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TournamentCard from './TournamentCard';
import { tournamentAPI } from '../utils/api';
import '../styles/HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const result = await tournamentAPI.getAll('', 'approved');
      if (result.success) {
        // Transform data for card display
        const formatted = result.data.map(t => ({
          id: t.id,
          name: t.name,
          category: 'CLB DUT ESPORTS',
          dates: `${new Date(t.start_at).toLocaleDateString('vi-VN')} - ${new Date(t.end_at).toLocaleDateString('vi-VN')}`,
          prizePool: t.prize_pool && t.prize_pool > 0
            ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(t.prize_pool)
            : 'TBD',
          game: t.game_name,
          gameLogo: t.game_logo_url || null,
          image: t.banner_url || 'https://via.placeholder.com/300x200/FF6B00/FFFFFF?text=Tournament'
        }));
        setTournaments(formatted);
        setError('');
      } else {
        setError(result.message || 'Không thể tải danh sách giải đấu');
        // Show mock data if API fails
        setTournaments(getMockTournaments());
      }
    } catch (err) {
      setError('Lỗi kết nối');
      // Show mock data if error
      setTournaments(getMockTournaments());
    } finally {
      setLoading(false);
    }
  };

  const getMockTournaments = () => [
    {
      id: '1',
      name: 'Giải Đấu Valorant HX ARENA Gaming Spring Cup 2026',
      category: '43 e-Sports',
      dates: '27/03/2026 - 05/04/2026',
      prizePool: '7.000.000 VND',
      game: 'Valorant',
      gameLogo: '🎮',
      image: 'https://via.placeholder.com/300x200/FF6B00/FFFFFF?text=HX+ARENA'
    },
    {
      id: '2',
      name: 'IFT CYBER MEOW SPRING CUP 2026',
      category: '43 e-Sports',
      dates: '24/03/2026 - 29/03/2026',
      prizePool: '3.000.000 VND',
      game: 'IFT',
      gameLogo: '🎮',
      image: 'https://via.placeholder.com/300x200/9D00FF/FFFFFF?text=CYBER+MEOW'
    },
    {
      id: '3',
      name: 'Valorant Robot City Gaming New Year Cup 2026',
      category: '43 e-Sports',
      dates: '10/03/2026 - 22/03/2026',
      prizePool: '5.000.000 VND',
      game: 'Valorant',
      gameLogo: '🎮',
      image: 'https://via.placeholder.com/300x200/FF1744/FFFFFF?text=Robot+City'
    }
  ];

  return (
    <div className="homepage">
      <section className="tournaments-section">
        <h1 className="section-title">GIẢI ĐẤU</h1>

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <p>⏳ Đang tải giải đấu...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="empty-state">
            <p>📭 Hiện tại chưa có giải đấu nào</p>
          </div>
        ) : (
          <div className="tournaments-grid">
            {tournaments.map(tournament => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}

        {tournaments.length > 0 && (
          <div className="view-more">
            <button className="view-more-link" onClick={() => { }}>
              Xem tất cả →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
