const API_BASE = 'http://localhost:5000/api';

export const getAuthToken = () => localStorage.getItem('auth_token');
export const setAuthToken = (token) => localStorage.setItem('auth_token', token);
export const removeAuthToken = () => localStorage.removeItem('auth_token');

export const getAuthHeader = () => ({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json'
});

// ===========================
// AUTH API
// ===========================
export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
      setAuthToken(data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
    }
    return data;
  },

  logout: () => {
    removeAuthToken();
    localStorage.removeItem('admin_user');
  },

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  register: async (email, password, full_name) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ email, password, full_name })
    });
    return await response.json();
  }
};

// ===========================
// TOURNAMENT API
// ===========================
export const tournamentAPI = {
  getAll: async (search = '', status = 'all') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status !== 'all') params.append('status', status);
    
    const response = await fetch(`${API_BASE}/tournaments?${params}`);
    return await response.json();
  },

  getById: async (id) => {
    const response = await fetch(`${API_BASE}/tournaments/${id}`);
    return await response.json();
  },

  create: async (tournament) => {
    const response = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(tournament)
    });
    return await response.json();
  },

  update: async (id, tournament) => {
    const response = await fetch(`${API_BASE}/tournaments/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(tournament)
    });
    return await response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/tournaments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getRegistrations: async (id) => {
    const response = await fetch(`${API_BASE}/tournaments/${id}/registrations`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getPending: async () => {
    const response = await fetch(`${API_BASE}/tournaments/pending`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getMyPending: async () => {
    const response = await fetch(`${API_BASE}/tournaments/my-pending`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getMine: async () => {
    const response = await fetch(`${API_BASE}/my-tournaments`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  approveTournament: async (id, status) => {
    const response = await fetch(`${API_BASE}/tournaments/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ status })
    });
    return await response.json();
  }
};

// ===========================
// REGISTRATION API
// ===========================
export const registrationAPI = {
  getAll: async (tournament_id = null, status = 'all') => {
    const params = new URLSearchParams();
    if (tournament_id) params.append('tournament_id', tournament_id);
    if (status !== 'all') params.append('status', status);
    
    const response = await fetch(`${API_BASE}/registrations?${params}`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getMyRegistrations: async (tournament_id = null, status = 'all') => {
    const params = new URLSearchParams();
    if (tournament_id) params.append('tournament_id', tournament_id);
    if (status !== 'all') params.append('status', status);
    
    const response = await fetch(`${API_BASE}/my-registrations?${params}`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getMyTournaments: async () => {
    const response = await fetch(`${API_BASE}/my-tournaments`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  updateStatus: async (id, status) => {
    const response = await fetch(`${API_BASE}/registrations/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ status })
    });
    return await response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/registrations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return await response.json();
  }
};

// ===========================
// ADMIN STATS API
// ===========================
export const adminAPI = {
  getStats: async () => {
    const response = await fetch(`${API_BASE}/admin/stats`, {
      headers: getAuthHeader()
    });
    return await response.json();
  }
};

// ===========================
// CTV MANAGEMENT API
// ===========================
export const ctvAPI = {
  getAll: async (search = '', status = 'all', page = 1, limit = 10) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status !== 'all') params.append('status', status);
    params.append('page', page);
    params.append('limit', limit);

    const response = await fetch(`${API_BASE}/admin/ctvs?${params}`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getById: async (id) => {
    const response = await fetch(`${API_BASE}/admin/ctvs/${id}`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  create: async (email, password, full_name) => {
    const response = await fetch(`${API_BASE}/admin/ctvs`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ email, password, full_name })
    });
    return await response.json();
  },

  update: async (id, email, full_name, password, is_active) => {
    const body = { email, full_name, is_active };
    if (password) body.password = password;

    const response = await fetch(`${API_BASE}/admin/ctvs/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(body)
    });
    return await response.json();
  },

  updateStatus: async (id, is_active) => {
    const response = await fetch(`${API_BASE}/admin/ctvs/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify({ is_active })
    });
    return await response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/admin/ctvs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return await response.json();
  }
};

// ===========================
// USER MANAGEMENT API
// ===========================
export const userAPI = {
  getAll: async (search = '', role = 'all', page = 1, limit = 10) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role !== 'all') params.append('role', role);
    params.append('page', page);
    params.append('limit', limit);

    const response = await fetch(`${API_BASE}/admin/users?${params}`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  getById: async (id) => {
    const response = await fetch(`${API_BASE}/admin/users/${id}`, {
      headers: getAuthHeader()
    });
    return await response.json();
  },

  create: async (email, password, full_name, role = 'ctv') => {
    const response = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ email, password, full_name, role })
    });
    return await response.json();
  },

  update: async (id, email, full_name, password, role, is_active) => {
    const body = { email, full_name, role, is_active };
    if (password) body.password = password;

    const response = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(body)
    });
    return await response.json();
  },

  updateStatus: async (id, is_active) => {
    const response = await fetch(`${API_BASE}/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify({ is_active })
    });
    return await response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return await response.json();
  }
};
