const UIComponents = (() => {
  async function loadSidebar(slotId, pageKey) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    const res = await fetch('components/sidebar.html', { cache: 'no-store' });
    const html = await res.text();
    slot.innerHTML = html;

    slot.querySelectorAll('.nav-link').forEach((link) => {
      const isActive = link.getAttribute('data-page') === pageKey;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (window.lucide) lucide.createIcons({ node: slot });
  }

  function renderContactRows(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = rows.map((row) => {
      const initials = (row.name || '')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const statusClass = row.status === 'Activo' ? 'badge-green' : 'badge-blue';

      return `
      <div class="contact-row">
        <div class="contact-avatar">${initials || 'NA'}</div>
        <div>
          <div class="contact-name">${escapeHtml(row.name)}</div>
          <div class="contact-company">${escapeHtml(row.company)}</div>
        </div>
        <div class="contact-value">${escapeHtml(row.value)}</div>
        <span class="badge ${statusClass}">${escapeHtml(row.status)}</span>
      </div>`;
    }).join('');
  }

  function renderActivity(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = rows.map((row) => `
      <div class="activity-item">
        <div>
          <div class="contact-name">${escapeHtml(row.title)}</div>
          <div class="activity-time">${escapeHtml(row.time)}</div>
        </div>
        <span class="badge badge-blue">${escapeHtml(row.type)}</span>
      </div>
    `).join('');
  }

  function renderPerformers(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = rows.map((row) => `
      <div class="performer-row">
        <div>
          <div class="contact-name">${escapeHtml(row.name)}</div>
          <div class="performer-meta">${escapeHtml(row.region)}</div>
        </div>
        <div class="contact-value">${escapeHtml(row.value)}</div>
      </div>
    `).join('');
  }

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    loadSidebar,
    renderContactRows,
    renderActivity,
    renderPerformers,
  };
})();

window.UIComponents = UIComponents;
