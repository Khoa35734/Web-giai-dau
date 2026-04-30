import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/TournamentCard.css';

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/tournament/${tournament.id}`);
  };

  const handleRegister = (e) => {
    e.stopPropagation();
    navigate(`/tournament/${tournament.id}`);
  };

  return (
    <div className="tournament-card" onClick={handleCardClick}>
      <div className="card-image-wrapper">
        <img src={tournament.image} alt={tournament.name} className="card-image" />
      </div>
      
      <div className="card-content">
        <h3 className="card-title">{tournament.name}</h3>
        
        <div className="card-meta">
          <div className="meta-item">
            <span className="meta-icon">🎮</span>
            <span className="meta-text">{tournament.category}</span>
          </div>
          
          <div className="meta-item">
            <span className="meta-icon">📅</span>
            <span className="meta-text">{tournament.dates}</span>
          </div>
          
          <div className="meta-item">
            <span className="meta-icon">💰</span>
            <span className="meta-text">{tournament.prizePool}</span>
          </div>
        </div>
        
        <div className="card-game-logo">
          {tournament.gameLogo && (tournament.gameLogo.startsWith('http') || tournament.gameLogo.startsWith('/')) ? (
            <img
              src={tournament.gameLogo}
              alt={tournament.game}
              className="game-logo"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }}
            />
          ) : null}
          <span className="game-logo-fallback" style={{ display: tournament.gameLogo && (tournament.gameLogo.startsWith('http') || tournament.gameLogo.startsWith('/')) ? 'none' : 'inline' }}>🎮</span>
          <span className="game-name">{tournament.game}</span>
        </div>
        
        <button className="register-btn" onClick={handleRegister}>ĐĂNG KÝ NGAY</button>
      </div>
    </div>
  );
}
