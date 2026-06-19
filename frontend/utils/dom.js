/**
 * utils/dom.js – Utilidades de manipulación de DOM (sin dependencias de red ni storage).
 */

const DomUtils = (() => {

  // ── HTML escaping ─────────────────────────────────────────────────
  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Alertas inline ────────────────────────────────────────────────
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

  // ── Iniciales de un nombre ────────────────────────────────────────
  function getInitials(name = '') {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return { escapeHtml, showAlert, hideAlert, getInitials };
})();

window.DomUtils = DomUtils;
