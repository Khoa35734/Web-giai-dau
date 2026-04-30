import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../utils/api';
import '../../styles/admin/AdminOverview.css';

export default function AdminOverview() {
  const [stats, setStats] = useState({
    total_tournaments: 0,
    total_registrations: 0,
    approved_registrations: 0,
    pending_registrations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setError('');
      const result = await adminAPI.getStats();
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.message || 'Không thể tải dữ liệu');
      }
    } catch (err) {
      setError('Lỗi kết nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon, label, value, color }) => (
    <div className="stat-card" style={{ '--accent-color': color }}>
      <div className="stat-card-inner">
        <div className="stat-icon">{icon}</div>
        <div className="stat-info">
          <span className="stat-value">{value}</span>
          <span className="stat-label">{label}</span>
        </div>
      </div>
      <div className="stat-glow" />
    </div>
  );

  if (error) {
    return (
      <div className="admin-overview">
        <div style={{ padding: '30px', textAlign: 'center', color: '#c33' }}>
          <p>⚠️ {error}</p>
          <button onClick={fetchStats} className="refresh-button" style={{ marginTop: '15px' }}>
            🔄 Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overview">
      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon="🏆"
          label="Tổng Giải Đấu"
          value={loading ? '...' : stats.total_tournaments}
          color="#FF6B00"
        />
        <StatCard
          icon="📝"
          label="Tổng Đăng Ký"
          value={loading ? '...' : stats.total_registrations}
          color="#00C6FF"
        />
        <StatCard
          icon="✅"
          label="Đã Duyệt"
          value={loading ? '...' : stats.approved_registrations}
          color="#10B981"
        />
        <StatCard
          icon="⏳"
          label="Chờ Duyệt"
          value={loading ? '...' : stats.pending_registrations}
          color="#A855F7"
        />
      </div>

      <div className="overview-bottom">
        {/* Summary Info */}
        <div className="overview-card activity-card">
          <div className="card-header">
            <h3>📊 Tóm Tắt Hệ Thống</h3>
            <button onClick={fetchStats} className="refresh-btn" title="Làm mới dữ liệu">
              🔄
            </button>
          </div>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              ⏳ Đang tải dữ liệu...
            </div>
          ) : (
            <div className="summary-content">
              <div className="summary-item">
                <span className="summary-label">Tỷ Lệ Duyệt:</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: stats.total_registrations > 0
                        ? `${(stats.approved_registrations / stats.total_registrations) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
                <span className="summary-value">
                  {stats.total_registrations > 0
                    ? `${Math.round((stats.approved_registrations / stats.total_registrations) * 100)}%`
                    : '0%'}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Trạng Thái:</span>
                <div className="status-indicator">
                  <span className="status-dot online" />
                  <span className="status-text">Online</span>
                </div>
              </div>

              <div className="summary-item">
                <span className="summary-label">Cập Nhật Lúc:</span>
                <span className="summary-time">
                  {new Date().toLocaleTimeString('vi-VN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="overview-card upcoming-card">
          <div className="card-header">
            <h3>📈 Thống Kê Nhanh</h3>
          </div>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              ⏳ Đang tải...
            </div>
          ) : (
            <div className="quick-stats">
              <div className="quick-stat-item">
                <span className="quick-stat-icon">🏆</span>
                <div className="quick-stat-detail">
                  <span className="quick-stat-label">Giải Đấu Hoạt Động</span>
                  <span className="quick-stat-value">{stats.total_tournaments}</span>
                </div>
              </div>

              <div className="quick-stat-item">
                <span className="quick-stat-icon">⏳</span>
                <div className="quick-stat-detail">
                  <span className="quick-stat-label">Đơn Chờ Duyệt</span>
                  <span className="quick-stat-value">{stats.pending_registrations}</span>
                </div>
              </div>

              <div className="quick-stat-item">
                <span className="quick-stat-icon">✅</span>
                <div className="quick-stat-detail">
                  <span className="quick-stat-label">Đơn Đã Duyệt</span>
                  <span className="quick-stat-value">{stats.approved_registrations}</span>
                </div>
              </div>

              <div className="quick-stat-item">
                <span className="quick-stat-icon">📊</span>
                <div className="quick-stat-detail">
                  <span className="quick-stat-label">Tổng Đơn</span>
                  <span className="quick-stat-value">{stats.total_registrations}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
