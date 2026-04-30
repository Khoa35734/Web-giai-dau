import React, { useState, useEffect } from 'react';
import { userAPI } from '../../utils/api';
import '../../styles/admin/UserManagement.css';

const emptyForm = { full_name: '', email: '', password: '', role: 'ctv', is_active: true };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    loadUsers();
  }, [search, filterRole, page]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await userAPI.getAll(search, filterRole, page, 10);
      
      if (result.success) {
        setUsers(result.data);
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

  const getRoleLabel = (role) => {
    return role === 'admin' ? 'Quản trị viên' : 'Cộng tác viên';
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? '#FF6B00' : '#00C6FF';
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingUser(null);
    setShowModal(true);
  };

  const openEdit = (user) => {
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active
    });
    setEditingUser(user.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Tên và email là bắt buộc');
      return;
    }

    if (editingUser && !form.password) {
      // Editing without changing password - that's ok
    } else if (!form.password || form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      let result;

      if (editingUser) {
        result = await userAPI.update(
          editingUser,
          form.email,
          form.full_name,
          form.password || undefined,
          form.role,
          form.is_active
        );
      } else {
        if (!form.password) {
          setError('Mật khẩu là bắt buộc khi tạo người dùng mới');
          setIsSaving(false);
          return;
        }
        result = await userAPI.create(form.email, form.password, form.full_name, form.role);
      }

      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowModal(false);
        await loadUsers();
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
      const result = await userAPI.delete(deleteConfirm);
      
      if (result.success) {
        setSuccessMessage('Xóa người dùng thành công');
        setTimeout(() => setSuccessMessage(null), 3000);
        setDeleteConfirm(null);
        await loadUsers();
      } else {
        setError(result.message || 'Lỗi khi xóa người dùng');
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
      const result = await userAPI.updateStatus(id, is_active);
      
      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadUsers();
      } else {
        setError(result.message || 'Lỗi khi cập nhật trạng thái');
      }
    } catch (err) {
      setError('Lỗi: ' + err.message);
    }
  };

  return (
    <div className="user-manager">
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
              placeholder="Tìm kiếm người dùng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="user-search"
            />
          </div>
          <div className="filter-group">
            {['all', 'admin', 'ctv'].map(r => (
              <button
                key={r}
                className={`filter-btn ${filterRole === r ? 'active' : ''}`}
                onClick={() => {
                  setFilterRole(r);
                  setPage(1);
                }}
              >
                {r === 'all' ? 'Tất cả' : (r === 'admin' ? 'Admin' : 'CTV')}
                <span className="filter-count">
                  {pagination.total > 0 ? 
                    (r === 'all' ? pagination.total : users.filter(u => u.role === r).length)
                    : 0
                  }
                </span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-add" onClick={openAdd} id="btn-add-user" disabled={isSaving}>
          <span>+</span> Thêm Người Dùng
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
                  <th>Tên Người Dùng</th>
                  <th>Email</th>
                  <th>Vai Trò</th>
                  <th>Ngày Tạo</th>
                  <th>Trạng Thái</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">Không tìm thấy người dùng nào</td></tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="table-row">
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">{getAvatarLetter(user.full_name)}</div>
                          <span className="user-name">{user.full_name}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span 
                          className="role-badge" 
                          style={{ backgroundColor: getRoleColor(user.role) + '20', color: getRoleColor(user.role) }}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <select
                          className={`status-select status-${user.is_active ? 'active' : 'inactive'}`}
                          value={user.is_active ? 'active' : 'inactive'}
                          onChange={e => handleStatusChange(user.id, e.target.value === 'active')}
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
                            onClick={() => openEdit(user)} 
                            title="Chỉnh sửa"
                            disabled={isSaving}
                          >✏️</button>
                          <button 
                            className="btn-delete" 
                            onClick={() => setDeleteConfirm(user.id)} 
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
            Hiển thị {users.length} / {pagination.total} người dùng
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? '✏️ Chỉnh Sửa Người Dùng' : '➕ Thêm Người Dùng Mới'}</h3>
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
              <div className="form-row">
                <div className="form-group">
                  <label>Vai Trò *</label>
                  <select 
                    value={form.role} 
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    disabled={isSaving}
                  >
                    <option value="ctv">Cộng tác viên (CTV)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
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
              </div>
              <div className="form-group">
                <label>Mật khẩu {editingUser ? '(để trống nếu không đổi)' : '*'}</label>
                <input 
                  type="password"
                  value={form.password} 
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} 
                  placeholder={editingUser ? "Để trống để giữ nguyên" : "Tối thiểu 6 ký tự"}
                  required={!editingUser}
                  disabled={isSaving}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)} disabled={isSaving}>Hủy</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? '⏳ Đang lưu...' : (editingUser ? 'Cập nhật' : 'Thêm Người Dùng')}
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
            <p>Bạn có chắc muốn xóa người dùng này? Hành động này không thể hoàn tác.</p>
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
