/**
 * services/api.js – Cliente HTTP puro: resolución de base URL, headers,
 * manejo de sesión (token/usuario) y los verbos REST (get/post/put/del/upload).
 *
 * No contiene formateo ni utilidades de DOM (ver utils/format.js y utils/dom.js).
 * Requiere que utils/dom.js y utils/format.js se carguen ANTES que este archivo,
 * porque al final compone window.Api como fachada de compatibilidad hacia atrás.
 */

function normalizeApiBaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  return url.trim().replace(/\/+$/, '');
}

function isLocalhostHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolveApiBaseUrl() {
  const runtimeConfigUrl = window.__GASTOSAPP_CONFIG__?.apiBaseUrl;
  const windowOverride = window.API_BASE_URL;
  const storageOverride = localStorage.getItem('api_base_url');

  const configuredUrl = normalizeApiBaseUrl(runtimeConfigUrl)
    || normalizeApiBaseUrl(windowOverride)
    || normalizeApiBaseUrl(storageOverride);

  if (configuredUrl) return configuredUrl;

  if (isLocalhostHost(window.location.hostname)) {
    return 'http://localhost:4500/api';
  }

  // Same-origin fallback is useful when frontend and backend share host via reverse proxy.
  return `${window.location.origin}/api`;
}

const API_BASE_URL = resolveApiBaseUrl();

const ApiService = (() => {

  // ── Token management ──────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem('access_token');
  }

  function saveToken(token) {
    localStorage.setItem('access_token', token);
  }

  function clearToken() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }

  function saveUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  function getUser() {
    const raw = localStorage.getItem('user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  // ── Headers ───────────────────────────────────────────────────────
  function getHeaders(isMultipart = false) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    return headers;
  }

  // ── Core request ──────────────────────────────────────────────────
  async function request(method, path, body = null, isMultipart = false) {
    const url = `${API_BASE_URL}${path}`;

    const options = {
      method,
      headers: getHeaders(isMultipart),
    };

    if (body && !isMultipart) {
      options.body = JSON.stringify(body);
    } else if (body && isMultipart) {
      options.body = body; // FormData
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (networkError) {
      throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté corriendo.');
    }

    // Auto-logout on 401 – but NOT during login/register (those return 401 for wrong credentials)
    const isAuthEndpoint = path === '/auth/login' || path === '/auth/register';
    if (response.status === 401 && !isAuthEndpoint) {
      clearToken();
      const p = window.location.pathname;
      const isAuthPage = p.endsWith('index.html') || p.endsWith('register.html') ||
                         p === '/login' || p === '/register' || p === '/';
      if (!isAuthPage) {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada. Por favor iniciá sesión nuevamente.');
    }

    let data;
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message = (data && (data.message || JSON.stringify(data))) ||
                      `Error ${response.status}`;
      throw new Error(Array.isArray(message) ? message.join(' · ') : message);
    }

    return data;
  }

  // ── HTTP helpers ──────────────────────────────────────────────────
  const get    = (path)              => request('GET',    path);
  const post   = (path, body)        => request('POST',   path, body);
  const put    = (path, body)        => request('PUT',    path, body);
  const del    = (path)              => request('DELETE', path);
  const upload = (path, formData)    => request('POST',   path, formData, true);

  return {
    get, post, put, del, upload,
    getToken, saveToken, clearToken,
    saveUser, getUser,
    BASE_URL: API_BASE_URL,
  };
})();

window.ApiService = ApiService;

// ── Fachada de compatibilidad hacia atrás ──────────────────────────
// window.Api mantiene exactamente la misma superficie pública que antes
// (Api.get, Api.formatCurrency, Api.escapeHtml, etc.) para no romper los
// ~150 call-sites existentes en el resto del frontend. La lógica real ya
// no vive en un solo archivo: HTTP en ApiService, formateo en FormatUtils,
// DOM en DomUtils. Esta fachada solo compone los tres.
window.Api = {
  ...ApiService,
  ...window.FormatUtils,
  ...window.DomUtils,
};
