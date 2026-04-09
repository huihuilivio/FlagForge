import axios from 'axios';

const api = axios.create({
  baseURL: '',
});

export function getFeatures() {
  return api.get('/admin/features');
}

export function createFeature(data) {
  return api.post('/admin/feature', data);
}

export function updateFeature(id, data) {
  return api.put(`/admin/feature/${id}`, data);
}

export function deleteFeature(id) {
  return api.delete(`/admin/feature/${id}`);
}

export default api;
