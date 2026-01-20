import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const authAPI = {
  register: (data) => axios.post(`${API_BASE}/auth/register`, data),
  login: (data) => axios.post(`${API_BASE}/auth/login`, data),
  getMe: () => axios.get(`${API_BASE}/auth/me`, { headers: getAuthHeaders() }),
};

export const organizationAPI = {
  create: (data) => axios.post(`${API_BASE}/organizations`, data, { headers: getAuthHeaders() }),
  getAll: () => axios.get(`${API_BASE}/organizations`, { headers: getAuthHeaders() }),
  getOne: (orgId) => axios.get(`${API_BASE}/organizations/${orgId}`, { headers: getAuthHeaders() }),
  invite: (orgId, data) => axios.post(`${API_BASE}/organizations/${orgId}/invite`, data, { headers: getAuthHeaders() }),
  getMembers: (orgId) => axios.get(`${API_BASE}/organizations/${orgId}/members`, { headers: getAuthHeaders() }),
  getStats: (orgId) => axios.get(`${API_BASE}/organizations/${orgId}/stats`, { headers: getAuthHeaders() }),
};

export const taskAPI = {
  create: (orgId, data) => axios.post(`${API_BASE}/organizations/${orgId}/tasks`, data, { headers: getAuthHeaders() }),
  getAll: (orgId, params) => axios.get(`${API_BASE}/organizations/${orgId}/tasks`, { params, headers: getAuthHeaders() }),
  getOne: (orgId, taskId) => axios.get(`${API_BASE}/organizations/${orgId}/tasks/${taskId}`, { headers: getAuthHeaders() }),
  update: (orgId, taskId, data) => axios.patch(`${API_BASE}/organizations/${orgId}/tasks/${taskId}`, data, { headers: getAuthHeaders() }),
  delete: (orgId, taskId) => axios.delete(`${API_BASE}/organizations/${orgId}/tasks/${taskId}`, { headers: getAuthHeaders() }),
};

export const paymentAPI = {
  createCheckout: (data) => axios.post(`${API_BASE}/payments/checkout`, data, { headers: getAuthHeaders() }),
  getStatus: (sessionId) => axios.get(`${API_BASE}/payments/status/${sessionId}`, { headers: getAuthHeaders() }),
};

export const adminAPI = {
  getConfig: () => axios.get(`${API_BASE}/admin/config`, { headers: getAuthHeaders() }),
  updateConfig: (data) => axios.post(`${API_BASE}/admin/config`, data, { headers: getAuthHeaders() }),
  deleteConfig: (keyName) => axios.delete(`${API_BASE}/admin/config/${keyName}`, { headers: getAuthHeaders() }),
  makeAdmin: (userId) => axios.post(`${API_BASE}/admin/make-admin/${userId}`, {}, { headers: getAuthHeaders() }),
};