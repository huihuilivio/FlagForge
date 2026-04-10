import axios from 'axios';

const api = axios.create({ baseURL: '', timeout: 15000 });

// 统一错误响应拦截
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.error || error.message || '请求失败';
    // 让调用方 catch 时能拿到友好消息
    return Promise.reject(new Error(msg));
  }
);

// ---- App ----
export const getApps = () => api.get('/admin/apps');
export const createApp = (data) => api.post('/admin/app', data);
export const updateApp = (id, data) => api.put(`/admin/app/${id}`, data);
export const deleteApp = (id) => api.delete(`/admin/app/${id}`);

// ---- Environment ----
export const getEnvs = (appId) => api.get(`/admin/apps/${appId}/envs`);
export const createEnv = (appId, data) => api.post(`/admin/apps/${appId}/env`, data);
export const updateEnv = (id, data) => api.put(`/admin/env/${id}`, data);
export const deleteEnv = (id) => api.delete(`/admin/env/${id}`);

// ---- Feature ----
export const getFeatures = (appId) => api.get('/admin/features', { params: { app_id: appId } });
export const createFeature = (data) => api.post('/admin/feature', data);
export const updateFeature = (id, data) => api.put(`/admin/feature/${id}`, data);
export const deleteFeature = (id) => api.delete(`/admin/feature/${id}`);

// ---- Targeting Rule ----
export const getRules = (params) => api.get('/admin/rules', { params });
export const createRule = (data) => api.post('/admin/rule', data);
export const updateRule = (id, data) => api.put(`/admin/rule/${id}`, data);
export const deleteRule = (id) => api.delete(`/admin/rule/${id}`);

// ---- Audit Log ----
export const getAuditLogs = (params) => api.get('/admin/audit-logs', { params });

// ---- Client: Feature Evaluation ----
export const evalFeatures = (params) => api.get('/api/v1/features', { params });

export default api;
