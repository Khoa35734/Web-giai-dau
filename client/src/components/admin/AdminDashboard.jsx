import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import CTVDashboard from './CTVDashboard';
import UserManagement from './UserManagement';
import TournamentManager from './TournamentManager';
import AdminOverview from './AdminOverview';
import { authAPI, getAuthToken, removeAuthToken } from '../../utils/api';
import '../../styles/admin/AdminDashboard.css';

const menuItems = [
  { id: 'overview', label: 'Tổng Quan', icon: '📊' },
  { id: 'users', label: 'Quản Lý Người Dùng', icon: '👤' },
  { id: 'tournaments', label: 'Quản Lý Giải Đấu', icon: '🏆' },
];

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const result = await authAPI.getCurrentUser();
          if (result.success) {
            setUser(result.data);
            setIsLoggedIn(true);
          } else {
            removeAuthToken();
            setIsLoggedIn(false);
          }
        } catch (err) {
          console.error('Auth check failed:', err);
          removeAuthToken();
          setIsLoggedIn(false);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    setUser(null);
    setActiveSection('overview');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>⏳ Đang tải...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // Route to CTV Dashboard if user is CTV
  if (user?.role === 'ctv') {
    return <CTVDashboard />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return <AdminOverview />;
      case 'users': return <UserManagement />;
      case 'tournaments': return <TournamentManager userRole={user?.role} />;
      default: return <AdminOverview />;
    }
  };

  const userInitial = user?.full_name?.charAt(0).toUpperCase() || 'A';

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">⚡</span>
            {sidebarOpen && <span className="sidebar-logo-text">Admin Panel</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
              title={!sidebarOpen ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
              {activeSection === item.id && <span className="nav-active-bar" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">{userInitial}</div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.full_name || 'Admin'}</span>
                <span className="sidebar-user-role">Quản trị viên</span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="sidebar-exit-btn"
            title="Đăng xuất"
          >
            <span>🚪</span>
            {sidebarOpen && <span>Đăng Xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-topbar">
          <div className="topbar-left">
            <h2 className="topbar-title">
              {menuItems.find(m => m.id === activeSection)?.icon}{' '}
              {menuItems.find(m => m.id === activeSection)?.label}
            </h2>
          </div>
          <div className="topbar-right">
            <div className="topbar-date">
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </div>
            <div className="topbar-badge">
              <span className="badge-dot" />
              Online
            </div>
          </div>
        </div>

        <div className="admin-content">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
