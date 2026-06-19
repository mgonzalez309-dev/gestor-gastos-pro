/**
 * utils/format.js – Formateo de moneda, fechas y categorías.
 * Autocontenido: lee la preferencia de moneda directamente de localStorage
 * para no depender de services/api.js (evita acoplamiento circular).
 */

const FormatUtils = (() => {

  // ── Lectura de usuario (solo para preferencia de moneda) ──────────
  function getStoredUser() {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Formato de moneda ─────────────────────────────────────────────
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

  // Cache de formatters por moneda para no recrear Intl.NumberFormat en cada llamada.
  const _currencyFormatters = new Map();

  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '-';
    const user = getStoredUser();
    const currency = user?.currency || 'ARS';
    const locale = CURRENCY_LOCALE[currency] || 'es-AR';
    const key = `${currency}-${locale}`;
    let formatter = _currencyFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      });
      _currencyFormatters.set(key, formatter);
    }
    return formatter.format(amount);
  }

  // ── Formato de fecha ──────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Fecha relativa ────────────────────────────────────────────────
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

  // ── Etiquetas de categoría ────────────────────────────────────────
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

  function categoryPill(cat) {
    return `<span class="category-pill category-${cat}">${categoryLabel(cat)}</span>`;
  }

  // ── Fecha de hoy en formato ISO (para inputs date) ────────────────
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  return {
    formatCurrency, formatDate, formatRelativeDate,
    categoryLabel, categoryPill, todayISO,
  };
})();

window.FormatUtils = FormatUtils;
