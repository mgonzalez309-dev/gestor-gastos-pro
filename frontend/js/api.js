/**
 * api.js – Módulo base para comunicación con la API REST
 * Todos los módulos de la app lo usan para realizar peticiones HTTP.
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

const Api = (() => {

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

    // Auto-logout on 401
    if (response.status === 401) {
      clearToken();
      if (!window.location.pathname.endsWith('index.html') &&
          !window.location.pathname.endsWith('register.html') &&
          window.location.pathname !== '/') {
        window.location.href = 'index.html';
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

  // ── Utility: currency format ──────────────────────────────────────
  const CURRENCY_LOCALE = {
    ARS: 'es-AR',
    USD: 'en-US',
    EUR: 'es-ES',
    BRL: 'pt-BR',
    CLP: 'es-CL',
    MXN: 'es-MX',
    UYU: 'es-UY',
    GBP: 'en-GB',
  };

  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '-';
    const user = getUser();
    const currency = user?.currency || 'ARS';
    const locale = CURRENCY_LOCALE[currency] || 'es-AR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  }

  // ── Utility: date format ──────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Utility: relative date ────────────────────────────────────────
  function formatRelativeDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7) return `Hace ${diff} días`;
    return formatDate(dateStr);
  }

  // ── Utility: category label map ───────────────────────────────────
  const CATEGORY_LABELS = {
    FOOD:          'Alimentacion',
    TRANSPORT:     'Transporte',
    ENTERTAINMENT: 'Entretenimiento',
    HEALTH:        'Salud',
    EDUCATION:     'Educacion',
    CLOTHING:      'Ropa',
    TECHNOLOGY:    'Tecnologia',
    HOME:          'Hogar',
    SERVICES:      'Servicios',
    OTHER:         'Otros',
  };

  function categoryLabel(cat) {
    return CATEGORY_LABELS[cat] || cat;
  }

  // ── Utility: category pill HTML ───────────────────────────────────
  function categoryPill(cat) {
    return `<span class="category-pill category-${cat}">${categoryLabel(cat)}</span>`;
  }

  // ── Utility: today's date for inputs ─────────────────────────────
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  // ── Utility: get initials from name ──────────────────────────────
  function getInitials(name = '') {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  // ── Show alert ────────────────────────────────────────────────────
  function showAlert(elementId, message, type = 'error') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => el.classList.add('hidden'), 4000);
    }
  }

  function hideAlert(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.classList.add('hidden');
  }

  return {
    get, post, put, del, upload,
    getToken, saveToken, clearToken,
    saveUser, getUser,
    formatCurrency, formatDate, formatRelativeDate,
    categoryLabel, categoryPill, todayISO, getInitials,
    showAlert, hideAlert,
    BASE_URL: API_BASE_URL,
  };
})();

window.Api = Api;
