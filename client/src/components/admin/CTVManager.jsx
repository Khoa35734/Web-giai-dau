import React, { useState, useEffect } from 'react';
import { ctvAPI } from '../../utils/api';
import '../../styles/admin/CTVManager.css';

const emptyForm = { full_name: '', email: '', password: '', is_active: true };

export default function CTVManager() {
  const [ctvs, setCTVs] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCTV, setEditingCTV] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Load CTVs on component mount and when filters change
  useEffect(() => {
    loadCTVs();
  }, [search, filterStatus, page]);

  const loadCTVs = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = filterStatus === 'all' ? 'all' : (filterStatus === 'active' ? 'active' : 'inactive');
      const result = await ctvAPI.getAll(search, status, page, 10);
      
      if (result.success) {
        setCTVs(result.data);
        setPagination(result.pagination);
      } else {
        setError(result.message || 'Lỗi khi tải dữ liệu');
      }
    } catch (err) {
      setError('Lỗi kế nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarLetter = (name) => {
    return name.charAt(0).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingCTV(null);
    setShowModal(true);
  };

  const openEdit = (ctv) => {
    setForm({
      full_name: ctv.full_name,
      email: ctv.email,
      password: '',
      is_active: ctv.is_active
    });
    setEditingCTV(ctv.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Tên và email là bắt buộc');
      return;
    }

    if (editingCTV && !form.password) {
      // Editing without changing password - that's ok
    } else if (!form.password || form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      let result;

      if (editingCTV) {
        // Update existing CTV
        result = await ctvAPI.update(
          editingCTV,
          form.email,
          form.full_name,
          form.password || undefined,
          form.is_active
        );
      } else {
        // Create new CTV
        if (!form.password) {
          setError('Mật khẩu là bắt buộc khi tạo CTV mới');
          setIsSaving(false);
          return;
        }
        result = await ctvAPI.create(form.email, form.password, form.full_name);
      }

      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowModal(false);
        await loadCTVs();
      } else {
        setError(result.message || 'Lỗi khi lưu dữ liệu');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const result = await ctvAPI.delete(deleteConfirm);
      
      if (result.success) {
        setSuccessMessage('Xóa CTV thành công');
        setTimeout(() => setSuccessMessage(null), 3000);
        setDeleteConfirm(null);
        await loadCTVs();
      } else {
        setError(result.message || 'Lỗi khi xóa CTV');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (id, is_active) => {
    try {
      setError(null);
      const result = await ctvAPI.updateStatus(id, is_active);
      
      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadCTVs();
      } else {
        setError(result.message || 'Lỗi khi cập nhật trạng thái');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    }
  };

  const filtered = ctvs;

  return (
    <div className="ctv-manager">
      {/* Messages */}
      {successMessage && (
        <div className="message success-message">✓ {successMessage}</div>
      )}
      {error && (
        <div className="message error-message">✕ {error}</div>
      )}

      {/* Toolbar */}
      <div className="manager-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm CTV..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="ctv-search"
            />
          </div>
          <div className="filter-group">
            {['all', 'active', 'inactive'].map(s => (
              <button
                key={s}
                className={`filter-btn ${filterStatus === s ? 'active' : ''}`}
                onClick={() => {
                  setFilterStatus(s);
                  setPage(1);
                }}
              >
                {s === 'all' ? 'Tất cả' : (s === 'active' ? 'Hoạt động' : 'Dừng hoạt động')}
                <span className="filter-count">
                  {pagination.total > 0 ? 
                    (s === 'all' ? pagination.total : filtered.filter(c => c.is_active === (s === 'active')).length)
                    : 0
                  }
                </span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-add" onClick={openAdd} id="btn-add-ctv" disabled={isSaving}>
          <span>+</span> Thêm CTV
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="table-container">
          <div className="loading-spinner">⏳ Đang tải dữ liệu...</div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên CTV</th>
                  <th>Email</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">Không tìm thấy CTV nào</td></tr>
                ) : (
                  filtered.map(ctv => (
                    <tr key={ctv.id} className="table-row">
                      <td>
                        <div className="ctv-cell">
                          <div className="ctv-avatar">{getAvatarLetter(ctv.full_name)}</div>
                          <span className="ctv-name">{ctv.full_name}</span>
                        </div>
                      </td>
                      <td>{ctv.email}</td>
                      <td>{formatDate(ctv.created_at)}</td>
                      <td>
                        <select
                          className={`status-select status-${ctv.is_active ? 'active' : 'inactive'}`}
                          value={ctv.is_active ? 'active' : 'inactive'}
                          onChange={e => handleStatusChange(ctv.id, e.target.value === 'active')}
                          disabled={isSaving}
                        >
                          <option value="active">Hoạt động</option>
                          <option value="inactive">Dừng hoạt động</option>
                        </select>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button 
                            className="btn-edit" 
                            onClick={() => openEdit(ctv)} 
                            title="Chỉnh sửa"
                            disabled={isSaving}
                          >✏️</button>
                          <button 
                            className="btn-delete" 
                            onClick={() => setDeleteConfirm(ctv.id)} 
                            title="Xóa"
                            disabled={isSaving}
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >← Trước</button>
              <span>Trang {page}/{pagination.pages}</span>
              <button 
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages || loading}
              >Sau →</button>
            </div>
          )}

          <div className="table-footer">
            Hiển thị {filtered.length} / {pagination.total} CTV
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCTV ? '✏️ Chỉnh Sửa CTV' : '➕ Thêm CTV Mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Họ và tên *</label>
                <input 
                  required 
                  value={form.full_name} 
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} 
                  placeholder="Nguyễn Văn A"
                  disabled={isSaving}
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input 
                  required 
                  type="email" 
                  value={form.email} 
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} 
                  placeholder="email@example.com"
                  disabled={isSaving}
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu {editingCTV ? '(để trống nếu không đổi)' : '*'}</label>
                <input 
                  type="password"
                  value={form.password} 
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} 
                  placeholder={editingCTV ? "Để trống để giữ nguyên" : "Tối thiểu 6 ký tự"}
                  required={!editingCTV}
                  disabled={isSaving}
                />
              </div>
              <div className="form-group">
                <label>Trạng thái</label>
                <select 
                  value={form.is_active ? 'active' : 'inactive'} 
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'active' }))}
                  disabled={isSaving}
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Dừng hoạt động</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)} disabled={isSaving}>Hủy</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? '⏳ Đang lưu...' : (editingCTV ? 'Cập nhật' : 'Thêm CTV')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3>Xác Nhận Xóa</h3>
            <p>Bạn có chắc muốn xóa CTV này? Hành động này không thể hoàn tác.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)} disabled={isSaving}>Hủy</button>
              <button className="btn-delete-confirm" onClick={handleDelete} disabled={isSaving}>
                {isSaving ? '⏳ Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

