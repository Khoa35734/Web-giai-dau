import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tournamentAPI } from '../utils/api';
import '../styles/TournamentDetail.css';

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationData, setRegistrationData] = useState({});
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    fetchTournament();
  }, [id]);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const result = await tournamentAPI.getById(id);
      if (result.success) {
        setTournament(result.data);
        setError('');
      } else {
        setError(result.message || 'Không thể tải thông tin giải đấu');
      }
    } catch (err) {
      setError('Lỗi kết nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tournament-detail">
        <div className="loading">⏳ Đang tải thông tin giải đấu...</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="tournament-detail">
        <div className="error-state">
          <div className="error-message">
            <h2>❌ Lỗi</h2>
            <p>{error || 'Không tìm thấy giải đấu'}</p>
            <button onClick={() => navigate('/')} className="btn-back">
              ← Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(num);
  };

  // Parse form_schema: có thể là JSON string hoặc array
  const getFormSchema = () => {
    const raw = tournament?.form_schema;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  };

  const handleRegisterClick = () => {
    const schema = getFormSchema();
    const initialData = {};
    schema.forEach(field => { initialData[field.id] = ''; });
    setRegistrationData(initialData);
    setFormSubmitted(false);
    setShowRegistrationForm(true);
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    
    const formSchema = getFormSchema();
    const requiredFields = formSchema.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !registrationData[f.id] || String(registrationData[f.id]).trim() === '');
    
    if (missingFields.length > 0) {
      alert(`Vui lòng điền các trường bắt buộc: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmittingForm(true);
    try {
      const response = await fetch('http://localhost:5000/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: id,
          form_data: registrationData
        })
      });

      const result = await response.json();
      if (result.success) {
        setFormSubmitted(true);
      } else {
        alert('❌ Lỗi: ' + (result.message || 'Không thể submit form'));
      }
    } catch (err) {
      alert('❌ Lỗi kết nối: ' + err.message);
    } finally {
      setSubmittingForm(false);
    }
  };

  const isRegistrationOpen = new Date() < new Date(tournament.registration_close_at);
  const isStarted = new Date() >= new Date(tournament.start_at);
  const isEnded = new Date() > new Date(tournament.end_at);

  let statusClass = 'status-pending';
  let statusText = '⏳ Chờ diễn ra';
  
  if (isEnded) {
    statusClass = 'status-ended';
    statusText = '✅ Đã kết thúc';
  } else if (isStarted) {
    statusClass = 'status-ongoing';
    statusText = '🔴 Đang diễn ra';
  } else if (isRegistrationOpen) {
    statusClass = 'status-open';
    statusText = '🟢 Đang mở đăng ký';
  }

  return (
    <div className="tournament-detail">
      {/* Banner */}
      <div className="banner-section">
        <img src={tournament.banner_url} alt={tournament.name} className="banner-image" />
        <div className="banner-overlay">
          <div className="banner-content">
            <div className="tournament-header-info">
              <div className="left-info">
                <h1>{tournament.name}</h1>
                <div className="game-info">
                  {tournament.game_logo_url && (
                    <img src={tournament.game_logo_url} alt={tournament.game_name} className="game-logo" />
                  )}
                  <span className="game-name">{tournament.game_name}</span>
                </div>
                <div className={`status-badge ${statusClass}`}>{statusText}</div>
              </div>
              <button onClick={() => navigate('/')} className="btn-close-detail">✕</button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="detail-container">
        {/* Info Cards Grid */}
        <div className="info-cards">
          {tournament.prize_pool > 0 && (
            <div className="info-card">
              <div className="info-icon">💰</div>
              <div className="info-content">
                <div className="info-label">Tổng Tiền Thưởng</div>
                <div className="info-value">{formatCurrency(tournament.prize_pool)}</div>
              </div>
            </div>
          )}

          <div className="info-card">
            <div className="info-icon">👥</div>
            <div className="info-content">
              <div className="info-label">Số Đội/Người</div>
              <div className="info-value">{tournament.max_participants}</div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">📋</div>
            <div className="info-content">
              <div className="info-label">Loại Tham Gia</div>
              <div className="info-value">
                {tournament.participation_type === 'team' ? '👥 Đội' : '👤 Cá nhân'}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="timeline-section">
          <h2>📅 Lịch Trình</h2>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-icon">🔓</div>
              <div className="timeline-content">
                <div className="timeline-label">Mở Đăng Ký</div>
                <div className="timeline-date">{formatDate(tournament.registration_open_at)}</div>
              </div>
            </div>

            <div className="timeline-connector"></div>

            <div className="timeline-item">
              <div className="timeline-icon">🔒</div>
              <div className="timeline-content">
                <div className="timeline-label">Đóng Đăng Ký</div>
                <div className="timeline-date">{formatDate(tournament.registration_close_at)}</div>
              </div>
            </div>

            <div className="timeline-connector"></div>

            <div className="timeline-item">
              <div className="timeline-icon">🎮</div>
              <div className="timeline-content">
                <div className="timeline-label">Bắt Đầu</div>
                <div className="timeline-date">{formatDate(tournament.start_at)}</div>
              </div>
            </div>

            <div className="timeline-connector"></div>

            <div className="timeline-item">
              <div className="timeline-icon">🏁</div>
              <div className="timeline-content">
                <div className="timeline-label">Kết Thúc</div>
                <div className="timeline-date">{formatDate(tournament.end_at)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📝 Tổng Quan
            </button>
            <button
              className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              ⚖️ Điều Lệ
            </button>
            <button
              className={`tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              ❓ FAQ
            </button>
          </div>

          <div className="tabs-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="tab-pane">
                <h3>Thông Tin Chi Tiết</h3>
                {tournament.description && (
                  <div className="description">
                    <p>{tournament.description}</p>
                  </div>
                )}

                {tournament.participation_type === 'team' && (
                  <div className="team-info">
                    <h4>🏆 Thông Tin Đội</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="label">Số Thành Viên Tối Thiểu:</span>
                        <span className="value">{tournament.min_team_size}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Số Thành Viên Tối Đa:</span>
                        <span className="value">{tournament.max_team_size}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="registration-info">
                  <h4>📋 Đăng Ký</h4>
                  {isRegistrationOpen ? (
                    <>
                      <button className="btn-register" onClick={handleRegisterClick}>
                        ✅ Đăng Ký Tham Gia
                      </button>
                      
                      {/* Registration Form - Modal Backdrop */}
                      {showRegistrationForm && (
                        <div className="reg-modal-backdrop" onClick={() => { setShowRegistrationForm(false); setFormSubmitted(false); }}>
                          <div className="reg-modal-dialog" onClick={e => e.stopPropagation()}>
                            <div className="reg-modal-header">
                              <div className="reg-modal-title-block">
                                <span className="reg-modal-icon">📝</span>
                                <div>
                                  <h3>Đăng Ký Tham Gia</h3>
                                  <p>{tournament.name}</p>
                                </div>
                              </div>
                              <button className="reg-modal-close" onClick={() => { setShowRegistrationForm(false); setFormSubmitted(false); }}>✕</button>
                            </div>

                            <div className="reg-modal-body">
                              {formSubmitted ? (
                                <div className="reg-success">
                                  <div className="reg-success-icon">🎉</div>
                                  <h3>Đăng ký thành công!</h3>
                                  <p>Cảm ơn bạn đã đăng ký tham gia <strong>{tournament.name}</strong>.<br/>Ban tổ chức sẽ liên hệ với bạn sớm nhất.</p>
                                  <button className="reg-done-btn" onClick={() => { setShowRegistrationForm(false); setFormSubmitted(false); }}>Đóng</button>
                                </div>
                              ) : (
                                <form onSubmit={handleSubmitRegistration} className="reg-form">
                                  {getFormSchema().length > 0 ? getFormSchema().map(field => (
                                    <div key={field.id} className="reg-field-group">
                                      <label className="reg-label">
                                        {field.label}
                                        {field.required && <span className="reg-required">*</span>}
                                      </label>
                                      {field.description && <p className="reg-field-hint">{field.description}</p>}
                                      {field.type === 'textarea' ? (
                                        <textarea className="reg-input" value={registrationData[field.id] || ''} onChange={e => setRegistrationData({...registrationData, [field.id]: e.target.value})} required={field.required} placeholder="Nhập câu trả lời..." rows="3" />
                                      ) : field.type === 'select' && field.options ? (
                                        <select className="reg-input" value={registrationData[field.id] || ''} onChange={e => setRegistrationData({...registrationData, [field.id]: e.target.value})} required={field.required}>
                                          <option value="">-- Chọn --</option>
                                          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : field.type === 'file' ? (
                                        <input className="reg-input reg-file" type="file" onChange={e => setRegistrationData({...registrationData, [field.id]: e.target.files[0]?.name || ''})} required={field.required} />
                                      ) : (
                                        <input className="reg-input" type={field.type || 'text'} value={registrationData[field.id] || ''} onChange={e => setRegistrationData({...registrationData, [field.id]: e.target.value})} required={field.required} placeholder={field.type === 'email' ? 'example@email.com' : 'Nhập câu trả lời...'} />
                                      )}
                                    </div>
                                  )) : (
                                    <div className="reg-empty"><p>ℹ️ Form đăng ký chưa được thiết lập. Vui lòng liên hệ ban tổ chức.</p></div>
                                  )}
                                  <div className="reg-modal-footer">
                                    <button type="button" className="reg-btn-cancel" onClick={() => { setShowRegistrationForm(false); setFormSubmitted(false); }}>Hủy</button>
                                    <button type="submit" className="reg-btn-submit" disabled={submittingForm}>
                                      {submittingForm ? <><span className="reg-spinner"></span> Đang gửi...</> : '✅ Gửi Đăng Ký'}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="registration-closed">
                      ❌ Đăng ký đã đóng
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <div className="tab-pane">
                <h3>Điều Lệ Giải Đấu</h3>
                <div className="rules-content">
                  <ol>
                    <li>
                      <strong>Điều Kiện Tham Gia:</strong>
                      <ul>
                        <li>Người chơi phải từ {tournament.participation_type === 'team' ? '13' : '18'} tuổi trở lên</li>
                        <li>Phải có tài khoản game hợp lệ</li>
                        <li>Tuân thủ các quy định của Riot Games / nhà phát triển game</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Quy Tắc Chung:</strong>
                      <ul>
                        <li>Tất cả người chơi phải sử dụng tài khoản chính thức</li>
                        <li>Cấm sử dụng phần mềm hack hoặc mod không authorized</li>
                        <li>Cấm hành vi quấy rối hoặc xúc phạm khác</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Về Kết Quả:</strong>
                      <ul>
                        <li>Kết quả trận đấu được xác định bởi hệ thống chính thức</li>
                        <li>Ban tổ chức có quyền xử lý tranh cãi</li>
                        <li>Quyết định của ban tổ chức là quyết định cuối cùng</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
              <div className="tab-pane">
                <h3>Câu Hỏi Thường Gặp</h3>
                <div className="faq-list">
                  <div className="faq-item">
                    <div className="faq-question">❓ Làm sao để đăng ký giải đấu?</div>
                    <div className="faq-answer">
                      Bạn có thể đăng ký trực tiếp trên website này hoặc liên hệ Ban Tổ Chức để được hỗ trợ.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-question">❓ Có phí đăng ký không?</div>
                    <div className="faq-answer">
                      Thông tin phí đăng ký sẽ được cập nhật bởi Ban Tổ Chức.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-question">❓ Nếu tôi bị loại thì sao?</div>
                    <div className="faq-answer">
                      Liên hệ Ban Tổ Chức để được giải thích chi tiết về lý do loại.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-question">❓ Làm sao lấy thưởng?</div>
                    <div className="faq-answer">
                      Người chiến thắng sẽ được liên hệ để nhận thưởng trong vòng 30 ngày sau khi giải đấu kết thúc.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={() => navigate('/')} className="btn-back-home">
            ← Quay lại Trang Chủ
          </button>
          {isRegistrationOpen && (
            <button className="btn-register-primary">
              🎮 Đăng Ký Ngay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
