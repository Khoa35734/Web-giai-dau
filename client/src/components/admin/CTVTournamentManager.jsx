import React, { useState, useEffect } from 'react';
import { tournamentAPI } from '../../utils/api';
import '../../styles/admin/CTVTournamentManager.css';

const GAME_CODE_MAP = {
  'Liên Quân Mobile': 'LQ.png',
  'League of Legend': 'LOL.png',
  'Valorant': 'Valorant.png',
  'TFT': 'TFT.jpg'
};

const GAME_LIST = Object.keys(GAME_CODE_MAP);

export default function CTVTournamentManager() {
  const [tournaments, setTournaments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [form, setForm] = useState({
    name: '',
    game_name: '',
    participation_type: 'individual',
    max_participants: 50,
    min_team_size: 2,
    max_team_size: 5,
    prize_pool: 0,
    banner_url: '',
    registration_open_at: '',
    registration_close_at: '',
    start_at: '',
    end_at: '',
    description: '',
    use_external_link: false,
    external_registration_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    loadTournaments();
  }, [search, filterStatus, page]);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get CTV's own tournaments (all status)
      const result = await tournamentAPI.getMine();

      if (result.success) {
        // Filter by status
        let filtered = result.data || [];
        if (filterStatus !== 'all') {
          filtered = filtered.filter(t => t.status === filterStatus);
        }
        if (search) {
          filtered = filtered.filter(t =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.game_name.toLowerCase().includes(search.toLowerCase())
          );
        }
        setTournaments(filtered);
        setPagination({ total: filtered.length, pages: Math.ceil(filtered.length / 10) });
      } else {
        setError(result.message || 'Lỗi khi tải dữ liệu');
      }
    } catch (err) {
      console.error('Load tournaments error:', err);
      setError('Lỗi kế nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.game_name || !form.banner_url) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setIsSaving(true);
    try {
      let result;
      if (editingTournament) {
        result = await tournamentAPI.update(editingTournament.id, form);
      } else {
        result = await tournamentAPI.create(form);
      }

      if (result.success) {
        setSuccessMessage(editingTournament ? 'Giải đấu đã được cập nhật' : 'Giải đấu được gửi để duyệt');
        setTimeout(() => {
          setShowModal(false);
          setForm({
            name: '',
            game_name: '',
            participation_type: 'individual',
            max_participants: 50,
            min_team_size: 2,
            max_team_size: 5,
            prize_pool: 0,
            banner_url: '',
            registration_open_at: '',
            registration_close_at: '',
            start_at: '',
            end_at: '',
            description: '',
            use_external_link: false,
            external_registration_url: ''
          });
          loadTournaments();
          setSuccessMessage(null);
        }, 1500);
      } else {
        setError(result.message || 'Lỗi khi lưu');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa giải đấu này?')) return;

    try {
      const result = await tournamentAPI.delete(id);

      if (result.success) {
        setSuccessMessage('Giải đấu đã được xóa');
        setTimeout(() => {
          loadTournaments();
          setSuccessMessage(null);
        }, 1500);
      } else {
        setError(result.message || 'Lỗi khi xóa');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Lỗi: ' + err.message);
    }
  };

  const openAdd = () => {
    setEditingTournament(null);
    setForm({
      name: '',
      game_name: '',
      participation_type: 'individual',
      max_participants: 50,
      min_team_size: 2,
      max_team_size: 5,
      prize_pool: 0,
      banner_url: '',
      registration_open_at: '',
      registration_close_at: '',
      start_at: '',
      end_at: '',
      description: '',
      use_external_link: false,
      external_registration_url: ''
    });
    setShowModal(true);
    setError(null);
  };

  const openEdit = async (tournament) => {
    try {
      setError(null);
      // Fetch full tournament data
      const result = await tournamentAPI.getById(tournament.id);
      if (result.success) {
        setEditingTournament(result.data);
        setForm(result.data);
        setShowModal(true);
      } else {
        setError('Lỗi khi tải thông tin giải đấu');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: '⏳ Chờ duyệt',
      approved: '✅ Đã duyệt',
      rejected: '❌ Từ chối'
    };
    return labels[status] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className="ctv-tournament-manager">
      <div className="manager-header">
        <h2>🎮 Giải Đấu Của Tôi</h2>
        <button className="btn-add-tournament" onClick={openAdd}>
          ➕ Tạo Giải Đấu
        </button>
      </div>

      {/* Search and Filter */}
      <div className="manager-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm giải đấu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          {[
            { value: 'all', label: '📋 Tất Cả' },
            { value: 'pending', label: '⏳ Chờ Duyệt' },
            { value: 'approved', label: '✅ Đã Duyệt' }
          ].map(btn => (
            <button
              key={btn.value}
              className={`filter-btn ${filterStatus === btn.value ? 'active' : ''}`}
              onClick={() => setFilterStatus(btn.value)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Tournaments List */}
      {loading ? (
        <div className="loading">⏳ Đang tải...</div>
      ) : tournaments.length === 0 ? (
        <div className="empty-state">
          <p>📭 Chưa có giải đấu nào</p>
        </div>
      ) : (
        <div className="tournaments-grid">
          {tournaments.map(tournament => (
            <div key={tournament.id} className="tournament-card">
              <div className="card-header">
                <img
                  src={`/api/logos/${GAME_CODE_MAP[tournament.game_name] || 'default.png'}`}
                  alt={tournament.game_name}
                  className="game-logo"
                  onError={(e) => e.target.style.display = 'none'}
                />
                <div className="card-title">
                  <h3>{tournament.name}</h3>
                  <p className="game-name">{tournament.game_name}</p>
                </div>
              </div>

              <div className="card-body">
                <div className="info-row">
                  <span className="label">Trạng thái:</span>
                  <span className="status-badge" style={{
                    backgroundColor: tournament.status === 'pending' ? '#FFA500' :
                                    tournament.status === 'approved' ? '#28a745' : '#dc3545'
                  }}>
                    {getStatusLabel(tournament.status)}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Số người:</span>
                  <span>{tournament.max_participants}</span>
                </div>
                <div className="info-row">
                  <span className="label">Ngày bắt đầu:</span>
                  <span>{formatDate(tournament.start_at)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Ngày kết thúc:</span>
                  <span>{formatDate(tournament.end_at)}</span>
                </div>
              </div>

              <div className="card-actions">
                {tournament.status === 'pending' && (
                  <>
                    <button
                      className="btn-action btn-edit"
                      onClick={() => openEdit(tournament)}
                    >
                      ✏️ Chỉnh Sửa
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(tournament.id)}
                    >
                      🗑️ Xóa
                    </button>
                  </>
                )}
                {tournament.status === 'approved' && (
                  <span className="approved-info">
                    ✅ Giải đấu này đã được hiển thị trên trang chủ
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTournament ? '✏️ Chỉnh Sửa Giải Đấu' : '➕ Tạo Giải Đấu Mới'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-col">
                  <label>Tên Giải Đấu *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Giải Đấu Liên Quân"
                    required
                  />
                </div>
                <div className="form-col">
                  <label>Trò Chơi *</label>
                  <select
                    value={form.game_name}
                    onChange={(e) => setForm({ ...form, game_name: e.target.value })}
                    required
                  >
                    <option value="">Chọn trò chơi</option>
                    {GAME_LIST.map(game => (
                      <option key={game} value={game}>{game}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Loại Tham Gia *</label>
                  <select
                    value={form.participation_type}
                    onChange={(e) => setForm({ ...form, participation_type: e.target.value })}
                  >
                    <option value="individual">Cá Nhân</option>
                    <option value="team">Đội Tuyển</option>
                  </select>
                </div>
                <div className="form-col">
                  <label>Số Người Tối Đa *</label>
                  <input
                    type="number"
                    value={form.max_participants}
                    onChange={(e) => setForm({ ...form, max_participants: parseInt(e.target.value) })}
                    min="1"
                    required
                  />
                </div>
              </div>

              {form.participation_type === 'team' && (
                <div className="form-row">
                  <div className="form-col">
                    <label>Kích Thước Đội Tối Thiểu</label>
                    <input
                      type="number"
                      value={form.min_team_size}
                      onChange={(e) => setForm({ ...form, min_team_size: parseInt(e.target.value) })}
                      min="1"
                    />
                  </div>
                  <div className="form-col">
                    <label>Kích Thước Đội Tối Đa</label>
                    <input
                      type="number"
                      value={form.max_team_size}
                      onChange={(e) => setForm({ ...form, max_team_size: parseInt(e.target.value) })}
                      min="1"
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-col">
                  <label>Banner *</label>
                  <input
                    type="url"
                    value={form.banner_url}
                    onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div className="form-col">
                  <label>Giải Thưởng (đồng)</label>
                  <input
                    type="number"
                    value={form.prize_pool}
                    onChange={(e) => setForm({ ...form, prize_pool: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Ngày Đăng Ký Mở</label>
                  <input
                    type="datetime-local"
                    value={form.registration_open_at}
                    onChange={(e) => setForm({ ...form, registration_open_at: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label>Ngày Đăng Ký Đóng</label>
                  <input
                    type="datetime-local"
                    value={form.registration_close_at}
                    onChange={(e) => setForm({ ...form, registration_close_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Ngày Bắt Đầu</label>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label>Ngày Kết Thúc</label>
                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col full">
                  <label>Mô Tả</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Mô tả chi tiết về giải đấu..."
                    rows="4"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col full">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.use_external_link}
                      onChange={(e) => setForm({ ...form, use_external_link: e.target.checked })}
                    />
                    Sử dụng liên kết đăng ký bên ngoài
                  </label>
                  {form.use_external_link && (
                    <input
                      type="url"
                      value={form.external_registration_url}
                      onChange={(e) => setForm({ ...form, external_registration_url: e.target.value })}
                      placeholder="https://..."
                      className="external-url-input"
                    />
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit" disabled={isSaving}>
                  {isSaving ? '⏳ Đang lưu...' : editingTournament ? '💾 Cập Nhật' : '✅ Tạo Giải'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
