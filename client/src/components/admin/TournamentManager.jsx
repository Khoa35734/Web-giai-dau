import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { tournamentAPI, registrationAPI } from '../../utils/api';
import '../../styles/admin/TournamentManager.css';

const statusLabels = {
  pending: '⏳ Chờ duyệt',
  active: '🟢 Hoạt động',
  completed: '✅ Hoàn thành',
  approved: '✅ Được duyệt',
  rejected: '❌ Bị từ chối'
};

// Available games for tournament
const API_BASE = 'http://localhost:5000';
const AVAILABLE_GAMES = [
  { name: 'Liên Quân Mobile', code: 'AOV', logo: `${API_BASE}/api/logos/LQ.png` },
  { name: 'League of Legend', code: 'LOL', logo: `${API_BASE}/api/logos/LOL.png` },
  { name: 'Valorant', code: 'VAL', logo: `${API_BASE}/api/logos/Valorant.png` },
  { name: 'TFT', code: 'TFT', logo: `${API_BASE}/api/logos/TFT.jpg` }
];

const getLogoUrl = (gameName) => {
  const game = AVAILABLE_GAMES.find(g => g.name === gameName);
  return game ? game.logo : '';
};

const emptyForm = {
  name: '',
  game_name: '',
  game_logo_url: '',
  banner_url: '',
  prize_pool: 0,
  participation_type: 'individual',
  max_participants: 16,
  min_team_size: '',
  max_team_size: '',
  registration_open_at: '',
  registration_close_at: '',
  start_at: '',
  end_at: '',
  description: '',
  use_external_link: false,
  external_registration_url: '',
  form_schema: []
};

// Parse form_schema from DB (may be string or array)
const parseFormSchema = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  return [];
};

const FIELD_TYPES = [
  { value: 'text',     label: '🔤 Văn bản ngắn' },
  { value: 'textarea', label: '📝 Văn bản dài' },
  { value: 'email',    label: '✉️ Email' },
  { value: 'number',   label: '🔢 Số' },
  { value: 'file',     label: '📎 Upload ảnh/file' },
  { value: 'select',   label: '📋 Đa lựa chọn' },
];

export default function TournamentManager({ userRole }) {
  const [tournaments, setTournaments] = useState([]);
  const [pendingTournaments, setPendingTournaments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'pending', 'registrations'
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState(null);
  const [approveStatus, setApproveStatus] = useState('approved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);

  // Registrations modal state
  const [regModalTournament, setRegModalTournament] = useState(null); // tournament object
  const [selectedTournamentSchema, setSelectedTournamentSchema] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [regFilterStatus, setRegFilterStatus] = useState('all');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [viewingReg, setViewingReg] = useState(null);
  const [myTournaments, setMyTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');

  useEffect(() => {
    fetchTournaments();
    if (userRole === 'admin') {
      fetchPendingTournaments();
    }
    fetchMyTournaments();
  }, [search, filterStatus, userRole]);

  const fetchMyTournaments = async () => {
    try {
      const result = await registrationAPI.getMyTournaments();
      if (result.success) {
        setMyTournaments(result.data || []);
        if (result.data?.length > 0 && !selectedTournamentId) {
          // Don't auto-select, let user choose
        }
      }
    } catch (err) {
      console.error('Error fetching my tournaments:', err);
    }
  };

  const fetchRegistrations = async (tournamentId, statusFilter) => {
    if (!tournamentId) return;
    try {
      setRegLoading(true);
      setRegError('');
      const result = await registrationAPI.getMyRegistrations(tournamentId, statusFilter || 'all');
      if (result.success) {
        setRegistrations(result.data || []);
        // Extract schema from first tournament in result or from myTournaments
        const tour = myTournaments.find(t => t.id === tournamentId);
        if (tour) {
          setSelectedTournamentSchema(parseFormSchema(tour.form_schema));
        }
      } else {
        setRegError(result.message || 'Không thể tải danh sách đăng ký');
      }
    } catch (err) {
      setRegError('Lỗi kết nối: ' + err.message);
    } finally {
      setRegLoading(false);
    }
  };




  const handleBannerUpload = async (file) => {
    if (!file) return;
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('banner', file);
      const res = await fetch('http://localhost:5000/api/upload/banner', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        setForm(f => ({ ...f, banner_url: data.url }));
      } else {
        setError('Upload thất bại: ' + data.message);
      }
    } catch (err) {
      setError('Lỗi upload: ' + err.message);
    } finally {
      setBannerUploading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await tournamentAPI.getAll(search, filterStatus === 'all' ? '' : filterStatus);
      if (result.success) {
        const approved = result.data?.filter(t => t.status === 'approved') || [];
        setTournaments(approved);
      } else {
        setError(result.message || 'Không thể tải danh sách giải đấu');
      }
    } catch (err) {
      setError('Lỗi kết nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingTournaments = async () => {
    try {
      const result = await tournamentAPI.getPending();
      if (result.success) {
        setPendingTournaments(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching pending tournaments:', err);
    }
  };

  const filtered = tournaments.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.game_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (t) => {
    setForm({
      name: t.name,
      game_name: t.game_name,
      game_logo_url: t.game_logo_url || '',
      banner_url: t.banner_url || '',
      prize_pool: t.prize_pool || 0,
      participation_type: t.participation_type,
      max_participants: t.max_participants,
      min_team_size: t.min_team_size || '',
      max_team_size: t.max_team_size || '',
      registration_open_at: t.registration_open_at ? t.registration_open_at.slice(0, 16) : '',
      registration_close_at: t.registration_close_at ? t.registration_close_at.slice(0, 16) : '',
      start_at: t.start_at ? t.start_at.slice(0, 16) : '',
      end_at: t.end_at ? t.end_at.slice(0, 16) : '',
      description: t.description || '',
      use_external_link: t.use_external_link || false,
      external_registration_url: t.external_registration_url || '',
      form_schema: parseFormSchema(t.form_schema)
    });
    setEditingId(t.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');

      if (!form.game_name) { setError('Tên trò chơi là bắt buộc'); return; }
      if (!form.banner_url) { setError('Ảnh truyền thông (Banner) là bắt buộc'); return; }

      if (form.participation_type === 'team') {
        if (!form.min_team_size || !form.max_team_size) { setError('Kích thước tối thiểu và tối đa của đội là bắt buộc'); return; }
        if (Number(form.min_team_size) > Number(form.max_team_size)) { setError('Kích thước tối thiểu phải nhỏ hơn hoặc bằng kích thước tối đa'); return; }
      }

      // Use form_schema directly from builder
      const submitData = {
        ...form,
        form_schema: form.form_schema || [],
        min_team_size: form.participation_type === 'team' ? Number(form.min_team_size) : null,
        max_team_size: form.participation_type === 'team' ? Number(form.max_team_size) : null,
        max_participants: Number(form.max_participants)
      };

      let result;
      if (editingId) {
        result = await tournamentAPI.update(editingId, submitData);
      } else {
        result = await tournamentAPI.create(submitData);
      }

      if (result.success) {
        setSuccess(result.message || 'Lưu thành công!');
        setShowModal(false);
        fetchTournaments();
        if (userRole === 'admin') fetchPendingTournaments();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Lỗi khi lưu giải đấu');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    }
  };

  // Form Builder helpers
  const addField = () => {
    const newField = {
      id: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      options: ''
    };
    setForm({ ...form, form_schema: [...(form.form_schema || []), newField] });
  };

  const removeField = (idx) => {
    const updated = form.form_schema.filter((_, i) => i !== idx);
    setForm({ ...form, form_schema: updated });
  };

  const updateField = (idx, key, value) => {
    const updated = form.form_schema.map((f, i) => i === idx ? { ...f, [key]: value } : f);
    setForm({ ...form, form_schema: updated });
  };

  const moveField = (idx, dir) => {
    const arr = [...form.form_schema];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setForm({ ...form, form_schema: arr });
  };

  const handleDelete = async (id) => {
    try {
      setError('');
      const result = await tournamentAPI.delete(id);
      if (result.success) {
        setSuccess('Xóa thành công!');
        setDeleteConfirm(null);
        fetchTournaments();
        if (userRole === 'admin') {
          fetchPendingTournaments();
        }
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Lỗi khi xóa giải đấu');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    }
  };

  const handleApprove = async (id, status) => {
    try {
      setError('');
      const result = await tournamentAPI.approveTournament(id, status);
      if (result.success) {
        setSuccess(status === 'approved' ? 'Giải đấu được duyệt!' : 'Giải đấu bị từ chối');
        setApproveConfirm(null);
        fetchPendingTournaments();
        fetchTournaments();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Lỗi khi duyệt giải đấu');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    }
  };

  const openRegModal = async (tournament) => {
    setRegModalTournament(tournament);
    setRegFilterStatus('all');
    setRegistrations([]);
    setRegError('');
    setSelectedTournamentSchema(parseFormSchema(tournament.form_schema));
    try {
      setRegLoading(true);
      const result = await registrationAPI.getMyRegistrations(tournament.id, 'all');
      if (result.success) {
        setRegistrations(result.data || []);
      } else {
        setRegError(result.message || 'Không thể tải danh sách đăng ký');
      }
    } catch (err) {
      setRegError('Lỗi kết nối: ' + err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleRegStatusFilter = async (status) => {
    setRegFilterStatus(status);
    if (!regModalTournament) return;
    try {
      setRegLoading(true);
      const result = await registrationAPI.getMyRegistrations(regModalTournament.id, status);
      if (result.success) setRegistrations(result.data || []);
      else setRegError(result.message);
    } catch (err) {
      setRegError('Lỗi: ' + err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleUpdateRegStatus = async (regId, newStatus) => {
    try {
      const result = await registrationAPI.updateStatus(regId, newStatus);
      if (result.success) {
        setSuccess('Đã cập nhật trạng thái!');
        if (regModalTournament) {
          const r = await registrationAPI.getMyRegistrations(regModalTournament.id, regFilterStatus);
          if (r.success) setRegistrations(r.data || []);
        }
        setTimeout(() => setSuccess(''), 3000);
      } else setRegError(result.message);
    } catch (err) { setRegError('Lỗi: ' + err.message); }
  };

  const handleDeleteReg = async (regId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa đăng ký này?')) return;
    try {
      const result = await registrationAPI.delete(regId);
      if (result.success) {
        setSuccess('Đã xóa đăng ký!');
        if (regModalTournament) {
          const r = await registrationAPI.getMyRegistrations(regModalTournament.id, regFilterStatus);
          if (r.success) setRegistrations(r.data || []);
        }
        setTimeout(() => setSuccess(''), 3000);
      } else setRegError(result.message);
    } catch (err) { setRegError('Lỗi: ' + err.message); }
  };

  const exportToExcel = () => {
    if (registrations.length === 0) { setRegError('Không có dữ liệu để xuất!'); return; }
    const tourName = regModalTournament?.name || 'GiaiDau';
    const schemaFields = selectedTournamentSchema;
    const rows = registrations.map((reg, idx) => {
      const submittedData = typeof reg.submitted_data === 'string'
        ? JSON.parse(reg.submitted_data) : (reg.submitted_data || {});
      const row = {
        'STT': idx + 1,
        'Ngày Đăng Ký': reg.registered_at ? new Date(reg.registered_at).toLocaleString('vi-VN') : '-',
        'Trạng Thái': reg.status === 'approved' ? 'Đã duyệt' : reg.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt',
      };
      if (schemaFields.length > 0) {
        schemaFields.forEach(f => { row[f.label] = submittedData[f.id] ?? ''; });
      } else {
        Object.entries(submittedData).forEach(([k, v]) => { row[k] = v; });
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đăng Ký');
    const fileName = `DangKy_${tourName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setSuccess(`Đã xuất file ${fileName}`);
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="tournament-manager">
      {error && (
        <div className="alert alert-error">
          ⚠️ {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          ✅ {success}
        </div>
      )}

      {/* Tabs */}
      <div className="tournament-tabs">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 Danh Sách Giải Đấu
        </button>
        {userRole === 'admin' && (
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            ⏳ Chờ Duyệt ({pendingTournaments.length})
          </button>
        )}
      </div>

      {/* List Tab */}
      {activeTab === 'list' && (
        <>
          <div className="manager-controls">
            <div className="controls-left">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm giải đấu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">🟢 Hoạt động</option>
                <option value="completed">✅ Hoàn thành</option>
              </select>
            </div>
            <button onClick={openAdd} className="btn-add">
              ➕ Tạo Giải Đấu
            </button>
          </div>

      {loading ? (
        <div className="loading">⏳ Đang tải dữ liệu...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>📭 Không có giải đấu nào</p>
          <button onClick={openAdd} className="btn-add-secondary">
            ➕ Tạo giải đấu đầu tiên
          </button>
        </div>
      ) : (
        <div className="tournament-table">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên Giải Đấu</th>
                <th>Trò Chơi</th>
                <th>Loại</th>
                <th>Số Đội</th>
                <th>Ngày Bắt Đầu</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td><code className="code-badge">{t.code}</code></td>
                  <td className="name-cell">{t.name}</td>
                  <td>{t.game_name}</td>
                  <td>
                    {t.participation_type === 'team' 
                      ? `👥 Đội (${t.min_team_size}-${t.max_team_size})`
                      : '👤 Cá nhân'}
                  </td>
                  <td>{t.max_participants}</td>
                  <td>{t.start_at ? new Date(t.start_at).toLocaleString('vi-VN', {dateStyle:'short', timeStyle:'short'}) : '-'}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => openRegModal(t)}
                      className="btn-icon reg-list"
                      title="Danh sách đăng ký"
                    >👥</button>
                    <button
                      onClick={() => openEdit(t)}
                      className="btn-icon edit"
                      title="Chỉnh sửa"
                    >✏️</button>
                    <button
                      onClick={() => setDeleteConfirm(t.id)}
                      className="btn-icon delete"
                      title="Xóa"
                    >🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {/* Pending Tab (Admin only) */}
      {activeTab === 'pending' && userRole === 'admin' && (
        <div className="pending-section">
          <h3>⏳ Giải Đấu Chờ Duyệt</h3>
          {pendingTournaments.length === 0 ? (
            <div className="empty-state">
              <p>✅ Không có giải đấu nào chờ duyệt</p>
            </div>
          ) : (
            <div className="pending-list">
              {pendingTournaments.map(t => (
                <div key={t.id} className="pending-card">
                  <div className="pending-header">
                    <div>
                      <h4>{t.name}</h4>
                      <p className="game-info">🎮 {t.game_name} • Mã: {t.code}</p>
                      <p className="created-info">👤 {t.created_by_name} • {new Date(t.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div className="pending-badge">⏳ Chờ Duyệt</div>
                  </div>
                  
                  <div className="pending-details">
                    <div className="detail-item">
                      <span className="label">Loại:</span>
                      <span>
                        {t.participation_type === 'team' 
                          ? `👥 Đội (${t.min_team_size}-${t.max_team_size})`
                          : '👤 Cá nhân'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Số Người:</span>
                      <span>{t.max_participants}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Thời Gian:</span>
                      <span>{new Date(t.start_at).toLocaleDateString('vi-VN')} - {new Date(t.end_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  {t.description && (
                    <div className="pending-description">
                      <p>{t.description}</p>
                    </div>
                  )}

                  <div className="pending-actions">
                    <button
                      onClick={() => {
                        setApproveConfirm(t.id);
                        setApproveStatus('approved');
                      }}
                      className="btn-approve"
                    >
                      ✅ Duyệt
                    </button>
                    <button
                      onClick={() => {
                        setApproveConfirm(t.id);
                        setApproveStatus('rejected');
                      }}
                      className="btn-reject"
                    >
                      ❌ Từ Chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registrations Slide Modal */}
      {regModalTournament && (
        <div className="reg-modal-overlay" onClick={() => setRegModalTournament(null)}>
          <div className="reg-slide-panel" onClick={e => e.stopPropagation()}>
            <div className="reg-panel-header">
              <div>
                <h3>👥 Danh Sách Đăng Ký</h3>
                <p className="reg-panel-sub">{regModalTournament.name} • <code>{regModalTournament.code}</code></p>
              </div>
              <div className="reg-panel-actions">
                <select
                  className="reg-status-filter"
                  value={regFilterStatus}
                  onChange={e => handleRegStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">⏳ Chờ</option>
                  <option value="approved">✅ Duyệt</option>
                  <option value="rejected">❌ Từ chối</option>
                </select>
                <button className="btn-export-excel" onClick={exportToExcel} disabled={registrations.length === 0}>
                  📊 Excel ({registrations.length})
                </button>
                <button className="reg-panel-close" onClick={() => setRegModalTournament(null)}>✕</button>
              </div>
            </div>

            {regError && (
              <div className="alert alert-error" style={{margin:'0 20px'}}>
                ⚠️ {regError}
                <button onClick={() => setRegError('')}>✕</button>
              </div>
            )}

            <div className="reg-panel-body">
              {regLoading ? (
                <div className="loading">⏳ Đang tải...</div>
              ) : registrations.length === 0 ? (
                <div className="reg-empty-hint">
                  <div className="reg-empty-icon">📭</div>
                  <p>Chưa có đăng ký nào</p>
                </div>
              ) : (
                <>
                  <div className="reg-summary">
                    <span>Tổng: <strong>{registrations.length}</strong></span>
                    <span>✅ <strong className="text-green">{registrations.filter(r => r.status === 'approved').length}</strong></span>
                    <span>⏳ <strong className="text-yellow">{registrations.filter(r => r.status === 'pending').length}</strong></span>
                    <span>❌ <strong className="text-red">{registrations.filter(r => r.status === 'rejected').length}</strong></span>
                  </div>
                  <div className="reg-table-wrapper">
                    <table className="reg-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Thời Gian Đăng Ký</th>
                          {selectedTournamentSchema.length > 0
                            ? selectedTournamentSchema.map(f => <th key={f.id}>{f.label}</th>)
                            : <th>Dữ Liệu</th>
                          }
                          <th>Trạng Thái</th>
                          <th>Hành Động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrations.map((reg, idx) => {
                          const data = typeof reg.submitted_data === 'string'
                            ? JSON.parse(reg.submitted_data)
                            : (reg.submitted_data || {});
                          return (
                            <tr key={reg.id}>
                              <td>{idx + 1}</td>
                              <td className="reg-date">
                                {reg.registered_at
                                  ? new Date(reg.registered_at).toLocaleString('vi-VN')
                                  : '-'}
                              </td>
                              {selectedTournamentSchema.length > 0
                                ? selectedTournamentSchema.map(f => (
                                    <td key={f.id} className="reg-data-cell">
                                      {data[f.id] !== undefined ? String(data[f.id]) : <span className="text-muted">-</span>}
                                    </td>
                                  ))
                                : <td className="reg-data-cell">
                                    <button className="btn-view-data" onClick={() => setViewingReg(reg)}>👁️ Xem</button>
                                  </td>
                              }
                              <td>
                                <span className={`reg-status-badge reg-status-${reg.status}`}>
                                  {reg.status === 'approved' ? '✅ Duyệt'
                                    : reg.status === 'rejected' ? '❌ Từ chối'
                                    : '⏳ Chờ'}
                                </span>
                              </td>
                              <td className="reg-actions">
                                {reg.status !== 'approved' && (
                                  <button className="btn-reg-approve" onClick={() => handleUpdateRegStatus(reg.id, 'approved')} title="Duyệt">✅</button>
                                )}
                                {reg.status !== 'rejected' && (
                                  <button className="btn-reg-reject" onClick={() => handleUpdateRegStatus(reg.id, 'rejected')} title="Từ chối">❌</button>
                                )}
                                <button className="btn-reg-delete" onClick={() => handleDeleteReg(reg.id)} title="Xóa">🗑️</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Registration Detail Modal */}
      {viewingReg && (
        <div className="modal-overlay" onClick={() => setViewingReg(null)}>
          <div className="modal modal-reg-detail" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Chi Tiết Đăng Ký</h3>
              <button onClick={() => setViewingReg(null)} className="btn-close">✕</button>
            </div>
            <div className="reg-detail-content">
              <div className="reg-detail-meta">
                <span>⏰ {viewingReg.registered_at ? new Date(viewingReg.registered_at).toLocaleString('vi-VN') : '-'}</span>
                <span className={`reg-status-badge reg-status-${viewingReg.status}`}>
                  {viewingReg.status === 'approved' ? '✅ Đã duyệt'
                    : viewingReg.status === 'rejected' ? '❌ Từ chối'
                    : '⏳ Chờ duyệt'}
                </span>
              </div>
              <div className="reg-detail-fields">
                {Object.entries(
                  typeof viewingReg.submitted_data === 'string'
                    ? JSON.parse(viewingReg.submitted_data)
                    : (viewingReg.submitted_data || {})
                ).map(([k, v]) => {
                  const schemaField = selectedTournamentSchema.find(f => f.id === k);
                  return (
                    <div key={k} className="reg-detail-field">
                      <span className="reg-detail-label">{schemaField?.label || k}</span>
                      <span className="reg-detail-value">{String(v)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="modal-actions">
                {viewingReg.status !== 'approved' && (
                  <button className="btn-approve" onClick={() => { handleUpdateRegStatus(viewingReg.id, 'approved'); setViewingReg(null); }}>✅ Duyệt</button>
                )}
                {viewingReg.status !== 'rejected' && (
                  <button className="btn-reject" onClick={() => { handleUpdateRegStatus(viewingReg.id, 'rejected'); setViewingReg(null); }}>❌ Từ chối</button>
                )}
                <button className="btn-cancel" onClick={() => setViewingReg(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={() => !editingId || setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '✏️ Sửa Giải Đấu' : '➕ Thêm Giải Đấu Mới'}</h3>
              <button onClick={() => setShowModal(false)} className="btn-close">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {/* Row 1: Game Name & Tournament Name */}
              <div className="form-row">
                <div className="form-group">
                  <label>Tên Trò Chơi * 🎮</label>
                  <select
                    value={form.game_name}
                    onChange={(e) => {
                      const newGameName = e.target.value;
                      const logoUrl = getLogoUrl(newGameName);
                      setForm({ 
                        ...form, 
                        game_name: newGameName,
                        game_logo_url: logoUrl
                      });
                    }}
                    required
                  >
                    <option value="">-- Chọn Trò Chơi --</option>
                    {AVAILABLE_GAMES.map(game => (
                      <option key={game.code} value={game.name}>
                        {game.name}
                      </option>
                    ))}
                  </select>
                  <small>Logo sẽ tự động chọn khi bạn chọn trò chơi</small>
                </div>
                <div className="form-group">
                  <label>Tên Giải Đấu *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="VD: LOL Championship Q2"
                  />
                </div>
              </div>

              {/* Row 2: Participation Type & Max Participants */}
              <div className="form-row">
                <div className="form-group">
                  <label>Loại Tham Gia *</label>
                  <select
                    value={form.participation_type}
                    onChange={(e) => setForm({ ...form, participation_type: e.target.value })}
                  >
                    <option value="individual">👤 Cá nhân</option>
                    <option value="team">👥 Đội</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Số Đội Tối Đa *</label>
                  <input
                    type="number"
                    value={form.max_participants}
                    onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })}
                    required
                    min="1"
                  />
                </div>
              </div>

              {/* Conditional Team Size Fields */}
              {form.participation_type === 'team' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Số Thành Viên Tối Thiểu *</label>
                    <input
                      type="number"
                      value={form.min_team_size}
                      onChange={(e) => setForm({ ...form, min_team_size: e.target.value })}
                      required
                      min="1"
                      placeholder="VD: 3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Số Thành Viên Tối Đa *</label>
                    <input
                      type="number"
                      value={form.max_team_size}
                      onChange={(e) => setForm({ ...form, max_team_size: e.target.value })}
                      required
                      min="1"
                      placeholder="VD: 5"
                    />
                  </div>
                </div>
              )}

              {/* Prize Pool */}
              <div className="form-group">
                <label>Tổng Tiền Thưởng 💰</label>
                <input
                  type="number"
                  value={form.prize_pool}
                  onChange={(e) => setForm({ ...form, prize_pool: Number(e.target.value) })}
                  min="0"
                  step="1000000"
                  placeholder="VD: 7000000 (mặc định 0 nếu không nhập)"
                />
                <small>Nhập số tiền (VND). Nếu không nhập thì mặc định là 0đ</small>
              </div>

              {/* Banner Upload */}
              <div className="form-group">
                <label>📸 Ảnh Truyền Thông (Banner) *</label>
                <div
                  className={`banner-upload-zone ${bannerUploading ? 'uploading' : ''}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleBannerUpload(e.dataTransfer.files[0]); }}
                >
                  {form.banner_url ? (
                    <div className="banner-upload-preview">
                      <img src={form.banner_url} alt="Banner preview" />
                      <div className="banner-upload-overlay">
                        <label className="banner-change-btn">
                          🔄 Đổi ảnh
                          <input type="file" accept="image/*" style={{display:'none'}}
                            onChange={e => handleBannerUpload(e.target.files[0])} />
                        </label>
                        <button type="button" className="banner-remove-btn"
                          onClick={() => setForm(f => ({...f, banner_url: ''}))}>✕ Xóa</button>
                      </div>
                    </div>
                  ) : (
                    <label className="banner-upload-placeholder">
                      {bannerUploading ? (
                        <><span className="upload-spinner"></span><span>Đang tải ảnh...</span></>
                      ) : (
                        <>
                          <span className="upload-icon">📂</span>
                          <span className="upload-text">Kéo thả hoặc click để chọn ảnh</span>
                          <span className="upload-hint">PNG, JPG, WEBP • Tối đa 10MB</span>
                        </>
                      )}
                      <input type="file" accept="image/*" style={{display:'none'}}
                        onChange={e => handleBannerUpload(e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>

              {/* Registration Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>📅 Ngày &amp; Giờ Mở Đăng Ký</label>
                  <input
                    type="datetime-local"
                    value={form.registration_open_at}
                    onChange={(e) => setForm({ ...form, registration_open_at: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>📅 Ngày &amp; Giờ Đóng Đăng Ký</label>
                  <input
                    type="datetime-local"
                    value={form.registration_close_at}
                    onChange={(e) => setForm({ ...form, registration_close_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Tournament Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>🎮 Ngày &amp; Giờ Bắt Đầu</label>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>🏁 Ngày &amp; Giờ Kết Thúc</label>
                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Mô Tả</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows="3"
                  placeholder="Nhập mô tả chi tiết về giải đấu..."
                />
              </div>

              {/* ===== FORM BUILDER ===== */}
              <div className="form-group form-builder-section">
                <label className="form-builder-label">
                  📋 Thiết kế Form Đăng Ký
                  <span className="form-builder-badge">{(form.form_schema || []).length} trường</span>
                </label>
                <p className="form-builder-desc">
                  Thêm, xóa và thiết lập các trường cho form đăng ký. Người dùng sẽ điền vào những trường này khi đăng ký tham gia giải.
                </p>

                <div className="fb-field-list">
                  {(form.form_schema || []).length === 0 ? (
                    <div className="fb-empty">
                      <p>📝 Chưa có trường nào. Nhấn "+ Thêm trường" để bắt đầu thiết kế form.</p>
                    </div>
                  ) : (
                    (form.form_schema || []).map((field, idx) => (
                      <div key={field.id} className="fb-field-card">
                        <div className="fb-field-handle">
                          <button type="button" className="fb-move-btn" onClick={() => moveField(idx, -1)} disabled={idx === 0} title="Lên">↑</button>
                          <span className="fb-field-num">{idx + 1}</span>
                          <button type="button" className="fb-move-btn" onClick={() => moveField(idx, 1)} disabled={idx === (form.form_schema || []).length - 1} title="Xuống">↓</button>
                        </div>

                        <div className="fb-field-body">
                          <div className="fb-field-row">
                            <div className="fb-field-group">
                              <label className="fb-mini-label">Tên trường *</label>
                              <input
                                className="fb-input"
                                type="text"
                                value={field.label}
                                onChange={e => updateField(idx, 'label', e.target.value)}
                                placeholder="VD: Họ và tên, Số điện thoại..."
                                required
                              />
                            </div>
                            <div className="fb-field-group fb-type-group">
                              <label className="fb-mini-label">Loại</label>
                              <select
                                className="fb-select"
                                value={field.type}
                                onChange={e => updateField(idx, 'type', e.target.value)}
                              >
                                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div className="fb-field-group" style={{marginTop: '8px'}}>
                              <label className="fb-mini-label">📌 Các lựa chọn (cách nhau bằng dấu phẩy)</label>
                              <input
                                className="fb-input"
                                type="text"
                                value={field.options || ''}
                                onChange={e => updateField(idx, 'options', e.target.value)}
                                placeholder="VD: Hà Nội, TP.HCM, Đà Nẵng"
                              />
                            </div>
                          )}

                          <div className="fb-field-row fb-field-bottom">
                            <label className="fb-required-toggle">
                              <input
                                type="checkbox"
                                checked={field.required || false}
                                onChange={e => updateField(idx, 'required', e.target.checked)}
                              />
                              <span>Bắt buộc</span>
                            </label>
                            <span className="fb-type-badge">
                              {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                            </span>
                          </div>
                        </div>

                        <button type="button" className="fb-remove-btn" onClick={() => removeField(idx)} title="Xóa trường">✕</button>
                      </div>
                    ))
                  )}
                </div>

                <button type="button" className="fb-add-btn" onClick={addField}>
                  + Thêm trường
                </button>
              </div>

              {editingId && (
                <div className="form-group">
                  <label>Ghi Chú: Mã giải đấu sẽ được tự động tạo theo định dạng: &lt;TênGame&gt;&lt;THÁNG-NĂM&gt;&lt;MãTăng&gt;</label>
                  <small>Ví dụ: AOV052026001 (Liên Quân), LOL052026001 (League of Legend)</small>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {editingId ? 'Cập Nhật' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Xác Nhận Xóa</h3>
            </div>
            <p>Bạn chắc chắn muốn xóa giải đấu này? Hành động này không thể hoàn tác.</p>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirm(null)} className="btn-cancel">
                Hủy
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-delete">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation */}
      {approveConfirm && (
        <div className="modal-overlay" onClick={() => setApproveConfirm(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{approveStatus === 'approved' ? '✅ Duyệt Giải Đấu' : '❌ Từ Chối Giải Đấu'}</h3>
            </div>
            <p>
              {approveStatus === 'approved' 
                ? 'Bạn chắc chắn muốn duyệt giải đấu này?'
                : 'Bạn chắc chắn muốn từ chối giải đấu này?'}
            </p>
            <div className="modal-actions">
              <button onClick={() => setApproveConfirm(null)} className="btn-cancel">
                Hủy
              </button>
              <button 
                onClick={() => handleApprove(approveConfirm, approveStatus)} 
                className={approveStatus === 'approved' ? 'btn-approve' : 'btn-reject'}
              >
                {approveStatus === 'approved' ? '✅ Duyệt' : '❌ Từ Chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
