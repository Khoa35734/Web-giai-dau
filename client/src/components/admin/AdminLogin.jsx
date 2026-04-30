import React, { useState } from 'react';
import { authAPI } from '../../utils/api';
import '../../styles/admin/AdminLogin.css';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.login(email, password);
      if (result.success) {
        setEmail('');
        setPassword('');
        onLoginSuccess(result.user);
      } else {
        setError(result.message || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">⚡</div>
            <h1>Đăng Nhập</h1>
            <p>Admin & Cộng Tác Viên</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">📧 Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email"
                required
                disabled={loading}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">🔐 Mật Khẩu</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                  disabled={loading}
                  className="form-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-button"
            >
              {loading ? '⏳ Đang đăng nhập...' : '🚀 Đăng Nhập'}
            </button>
          </form>

          <div className="login-footer">
            <p className="login-info">
              Admin & CTV đều có thể truy cập hệ thống này
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
