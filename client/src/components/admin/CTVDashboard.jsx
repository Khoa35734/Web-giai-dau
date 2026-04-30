import React, { useState, useEffect } from 'react';
import CTVTournamentManager from './CTVTournamentManager';
import { authAPI, getAuthToken, removeAuthToken } from '../../utils/api';
import '../../styles/admin/CTVDashboard.css';

const menuItems = [
  { id: 'tournaments', label: 'Giải Đấu Của Tôi', icon: '🏆' },
];

export default function CTVDashboard() {
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('tournaments');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const result = await authAPI.getCurrentUser();
          if (result.success && result.data.role === 'ctv') {
            setUser(result.data);
          } else {
            removeAuthToken();
          }
        } catch (err) {
          console.error('Auth check failed:', err);
          removeAuthToken();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>⏳ Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>🔴 Không có quyền truy cập</p>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'tournaments': return <CTVTournamentManager />;
      default: return <CTVTournamentManager />;
    }
  };

  return (
    <div className="ctv-dashboard">
      {/* Sidebar */}
      <div className={`ctv-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>CTV Panel</h2>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Ẩn menu' : 'Hiện menu'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user.full_name?.charAt(0).toUpperCase() || 'C'}</div>
            <div className="user-details">
              <p className="user-name">{user.full_name}</p>
              <p className="user-email">{user.email}</p>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Đăng Xuất
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ctv-main">
        <header className="ctv-header">
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1>🎮 Dashboard Cộng Tác Viên</h1>
          <div className="header-right">
            <span className="user-badge">{user.full_name}</span>
          </div>
        </header>

        <main className="ctv-content">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
