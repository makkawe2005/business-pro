export const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:3001`;

function getAuthToken() {
  return localStorage.getItem('authToken');
}

export async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = Object.assign({}, options.headers, token ? { Authorization: `Bearer ${token}` } : {});
  const res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
  if (res.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  return res;
}
