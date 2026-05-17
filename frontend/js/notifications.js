/**
 * notifications.js – Centro de notificaciones automáticas
 * Carga notificaciones del backend, muestra badge en la campana del sidebar
 * y emite Browser Notifications (Web API) para alertas críticas.
 */

const Notifications = (() => {

  const ICON_BY_TYPE = {
    BUDGET_ALERT:    'alert-circle',
    UNUSUAL_EXPENSE: 'zap',
    MONTHLY_GROWTH:  'trending-up',
    SAVINGS_RISK:    'shield-alert',
    GENERAL:         'check-circle',
  };

  const COLOR_BY_TYPE = {
    BUDGET_ALERT:    'var(--color-danger, #dc3f4e)',
    UNUSUAL_EXPENSE: 'var(--color-warning, #da8b19)',
    MONTHLY_GROWTH:  'var(--color-warning, #da8b19)',
    SAVINGS_RISK:    'var(--color-danger, #dc3f4e)',
    GENERAL:         'var(--color-success, #13a58b)',
  };

  let panelOpen = false;

  // ── Boot: llamado desde auth.js initLayout ────────────────────────
  async function init() {
    bindBell();
    await requestBrowserPermission();

    // 1. Intentar generar nuevas notificaciones (cooldown 24h en backend)
    try { await Api.post('/notifications/generate', {}); } catch { /* sin-gastos: ok */ }

    // 2. Cargar y mostrar
    await refresh();
  }

  // ── Bell toggle ───────────────────────────────────────────────────
  function bindBell() {
    const bell    = document.getElementById('notif-bell-btn');
    const panel   = document.getElementById('notif-panel');
    const markAll = document.getElementById('notif-mark-all-btn');
    const clearAll= document.getElementById('notif-clear-all-btn');

    if (!bell || !panel) return;

    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      panelOpen = !panelOpen;
      panel.classList.toggle('hidden', !panelOpen);
      if (panelOpen) loadPanel();
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (panelOpen && !panel.contains(e.target) && e.target !== bell) {
        panelOpen = false;
        panel.classList.add('hidden');
      }
    });

    markAll?.addEventListener('click', async () => {
      await Api.put('/notifications/read-all', {});
      await refresh();
      await loadPanel();
    });

    clearAll?.addEventListener('click', async () => {
      await Api.del('/notifications/clear-all');
      await refresh();
      await loadPanel();
    });
  }

  // ── Actualizar badge ──────────────────────────────────────────────
  async function refresh() {
    try {
      const { count } = await Api.get('/notifications/unread-count');
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', count === 0);
    } catch { /* silencioso */ }
  }

  // ── Cargar panel dropdown ─────────────────────────────────────────
  async function loadPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    list.innerHTML = '<div class="notif-empty">Cargando...</div>';

    try {
      const notifications = await Api.get('/notifications');
      if (!notifications.length) {
        list.innerHTML = '<div class="notif-empty">Sin notificaciones por el momento.</div>';
        return;
      }

      list.innerHTML = notifications.map((n) => {
        const icon  = ICON_BY_TYPE[n.type] || 'bell';
        const color = COLOR_BY_TYPE[n.type] || 'var(--text-muted)';
        const time  = Api.formatRelativeDate(n.createdAt);
        return `
          <div class="notif-item ${n.isRead ? '' : 'notif-item--unread'}" data-id="${n.id}">
            <span class="notif-item-icon" style="color:${color}">
              <i data-lucide="${icon}"></i>
            </span>
            <div class="notif-item-body">
              <div class="notif-item-title">${Api.escapeHtml(n.title)}</div>
              <div class="notif-item-msg">${Api.escapeHtml(n.message)}</div>
              <div class="notif-item-time">${time}</div>
            </div>
            <button class="notif-item-delete" data-id="${n.id}" title="Eliminar" type="button">×</button>
          </div>`;
      }).join('');

      if (window.lucide) lucide.createIcons({ node: list });

      // Marcar como leída al hacer clic; eliminar con ×
      list.querySelectorAll('.notif-item').forEach((el) => {
        el.addEventListener('click', async (e) => {
          if (e.target.closest('.notif-item-delete')) return;
          const id = el.dataset.id;
          if (!el.classList.contains('notif-item--unread')) return;
          el.classList.remove('notif-item--unread');
          await Api.put(`/notifications/${id}/read`, {});
          await refresh();
        });
      });

      list.querySelectorAll('.notif-item-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          await Api.del(`/notifications/${id}`);
          btn.closest('.notif-item')?.remove();
          if (!list.querySelector('.notif-item')) {
            list.innerHTML = '<div class="notif-empty">Sin notificaciones por el momento.</div>';
          }
          await refresh();
        });
      });
    } catch {
      list.innerHTML = '<div class="notif-empty">Error cargando notificaciones.</div>';
    }
  }

  // ── Browser Notifications (Web API) ──────────────────────────────
  async function requestBrowserPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  /** Emite una notificación nativa del sistema operativo para alertas críticas. */
  function showBrowserNotif(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: '/assets/logo.png',
        tag: 'gastosapp-alert',
      });
    } catch { /* silencioso si el navegador lo bloquea */ }
  }

  /**
   * Revisa si hay notificaciones críticas no leídas y las emite como
   * browser notifications. Se llama tras el generate inicial.
   */
  async function pushCriticalBrowserNotifs() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notifs = await Api.get('/notifications?unread=true');
      const critical = notifs.filter((n) =>
        ['BUDGET_ALERT', 'SAVINGS_RISK'].includes(n.type)
      );
      // Emitir solo la primera crítica para no spamear
      if (critical.length) {
        showBrowserNotif(critical[0].title, critical[0].message);
      }
    } catch { /* silencioso */ }
  }

  return { init, refresh, showBrowserNotif, pushCriticalBrowserNotifs };
})();

window.Notifications = Notifications;
