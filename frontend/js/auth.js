/**
 * auth.js – Manejo de autenticación, sesión y sidebar común
 */

const Auth = (() => {

  const THEME_KEY = 'app_theme';

  // ── Sidebar & layout init (compartido por todas las páginas app) ──
  function initLayout() {
    const user = Api.getUser();
    if (!user) return;

    applyStoredTheme();

    const nameEl   = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('user-avatar-initials');

    if (nameEl)   nameEl.textContent   = user.name || 'Usuario';

    // Avatar: photo from localStorage or initials
    if (avatarEl) {
      const storedAvatar = localStorage.getItem(`avatar_${user.id}`);
      if (storedAvatar) {
        avatarEl.innerHTML = `<img src="${storedAvatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
      } else {
        avatarEl.textContent = Api.getInitials(user.name);
      }
    }

    // Show advisor-only links
    if (user.role === 'ADVISOR') {
      document.querySelectorAll('.advisor-only').forEach((el) => el.classList.remove('hidden'));
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Sidebar toggle (mobile)
    const sidebar  = document.getElementById('sidebar');
    const toggle   = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    const overlay  = document.getElementById('overlay');

    function openSidebar()  { sidebar?.classList.add('open');    overlay?.classList.remove('hidden'); }
    function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.add('hidden'); }

    toggle?.addEventListener('click',  openSidebar);
    closeBtn?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click',  closeSidebar);

    // Click on user info → navigate to profile page
    const userInfoEl = document.getElementById('sidebar-user');
    if (userInfoEl) {
      userInfoEl.addEventListener('click', () => { window.location.href = 'profile.html'; });
    }

    // Budget widget in sidebar footer (if monthlyIncome is set)
    injectSidebarBudget(user);

    // Theme UI
    injectThemeSwitcher();
  }

  function initPublicTheme() {
    applyStoredTheme();
  }

  function applyStoredTheme() {
    const raw = localStorage.getItem(THEME_KEY) || 'light';
    const current = raw === 'ocean' ? 'light' : raw === 'slate' ? 'dark' : raw;
    localStorage.setItem(THEME_KEY, current);
    document.body.setAttribute('data-theme', current);
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.body.setAttribute('data-theme', theme);
    const indicator = document.getElementById('theme-toggle-indicator');
    if (indicator) indicator.textContent = theme === 'light' ? 'Claro' : 'Oscuro';
    document.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme } }));
  }

  // ── Sidebar budget widget ─────────────────────────────────────────
  function injectSidebarBudget(user) {
    if (!user.monthlyIncome) return;
    const footer = document.querySelector('.sidebar-footer');
    if (!footer || document.getElementById('sidebar-budget')) return;

    const div = document.createElement('div');
    div.id = 'sidebar-budget';
    div.className = 'sidebar-budget';
    div.innerHTML = `<span class="sidebar-budget-label">Disponible este mes</span>
                     <span class="sidebar-budget-amount" id="sidebar-budget-amount">Cargando...</span>`;
    footer.insertAdjacentElement('beforebegin', div);

    // Fetch spent this month
    Api.get('/expenses/analytics').then((data) => {
      const spent     = data.currentMonth?.total || 0;
      const available = user.monthlyIncome - spent;
      const el = document.getElementById('sidebar-budget-amount');
      if (!el) return;
      el.textContent  = Api.formatCurrency(available);
      el.className    = `sidebar-budget-amount ${available < 0 ? 'over' : available < user.monthlyIncome * 0.1 ? 'low' : 'ok'}`;
    }).catch(() => {
      const el = document.getElementById('sidebar-budget-amount');
      if (el) el.textContent = '-';
    });
  }

  function injectThemeSwitcher() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer || document.getElementById('theme-toggle-btn')) return;

    const raw = localStorage.getItem(THEME_KEY) || 'light';
    const theme = raw === 'ocean' ? 'light' : raw === 'slate' ? 'dark' : raw;
    const wrap = document.createElement('div');
    wrap.className = 'theme-switch-wrap';
    wrap.innerHTML = `
      <button class="btn btn-ghost btn-sm theme-toggle-btn" id="theme-toggle-btn" type="button" title="Cambiar tema">
        Tema: <span id="theme-toggle-indicator">${theme === 'light' ? 'Claro' : 'Oscuro'}</span>
      </button>`;

    footer.insertAdjacentElement('afterbegin', wrap);

    const btn = document.getElementById('theme-toggle-btn');
    btn?.addEventListener('click', () => {
      const rawCurrent = localStorage.getItem(THEME_KEY) || 'light';
      const current = rawCurrent === 'ocean' ? 'light' : rawCurrent === 'slate' ? 'dark' : rawCurrent;
      const next = current === 'light' ? 'dark' : 'light';
      setTheme(next);
    });
  }

  function injectTopbarSearch() {
    const pageHeader = document.querySelector('.page-header');
    if (!pageHeader || document.getElementById('topbar-command')) return;

    const actions = pageHeader.querySelector('.header-actions') || (() => {
      const div = document.createElement('div');
      div.className = 'header-actions';
      pageHeader.appendChild(div);
      return div;
    })();

    const shell = document.createElement('div');
    shell.className = 'topbar-tools';
    shell.innerHTML = `
      <div class="topbar-search-shell">
        <input id="topbar-search" class="form-input form-input--sm topbar-search-input" type="text" placeholder="Buscar vistas, categorias o acciones..." />
      </div>
      <button id="topbar-command" class="btn btn-ghost btn-sm" type="button">Comando</button>`;

    actions.prepend(shell);

    document.getElementById('topbar-command')?.addEventListener('click', openCommandPalette);
    document.getElementById('topbar-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        openCommandPalette();
        const quickSearch = document.getElementById('command-input');
        if (quickSearch) {
          quickSearch.value = e.target.value.trim();
          quickSearch.dispatchEvent(new Event('input'));
        }
      }
    });
  }

  function injectCommandPalette() {
    if (document.getElementById('command-palette')) return;

    const palette = document.createElement('div');
    palette.id = 'command-palette';
    palette.className = 'modal hidden';
    palette.innerHTML = `
      <div class="modal-backdrop" id="command-backdrop"></div>
      <div class="modal-box modal-box--sm command-palette-box">
        <div class="modal-header">
          <h3>Ir a...</h3>
          <button class="modal-close" id="command-close" type="button">X</button>
        </div>
        <div class="modal-body">
          <input id="command-input" class="form-input" type="text" placeholder="Escribe para filtrar acciones" />
          <div id="command-list" class="command-list"></div>
        </div>
      </div>`;

    document.body.appendChild(palette);

    const close = () => closeCommandPalette();
    document.getElementById('command-close')?.addEventListener('click', close);
    document.getElementById('command-backdrop')?.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
      }
      if (e.key === 'Escape') closeCommandPalette();
    });

    document.getElementById('command-input')?.addEventListener('input', renderCommandList);
    renderCommandList();
  }

  function commandItems() {
    const user = Api.getUser();
    const items = [
      { label: 'Dashboard', href: 'dashboard.html', tags: 'inicio resumen metricas' },
      { label: 'Mis gastos', href: 'expenses.html', tags: 'tabla gastos movimientos' },
      { label: 'Subir ticket', href: 'upload-ticket.html', tags: 'ocr ticket foto carga' },
      { label: 'Mi perfil', href: 'profile.html', tags: 'usuario cuenta configuracion' },
    ];

    if (user?.role === 'ADVISOR') {
      items.push({ label: 'Panel asesor', href: 'advisor.html', tags: 'asesor clientes recomendaciones' });
    }

    return items;
  }

  function renderCommandList() {
    const list = document.getElementById('command-list');
    if (!list) return;

    const query = (document.getElementById('command-input')?.value || '').toLowerCase().trim();
    const filtered = commandItems().filter((i) => {
      return !query || i.label.toLowerCase().includes(query) || i.tags.includes(query);
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state-sm">Sin resultados</div>';
      return;
    }

    list.innerHTML = filtered.map((item) => {
      return `<button class="command-item" data-href="${item.href}" type="button">${item.label}</button>`;
    }).join('');

    list.querySelectorAll('.command-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const href = btn.getAttribute('data-href');
        if (href) window.location.href = href;
      });
    });
  }

  function openCommandPalette() {
    const palette = document.getElementById('command-palette');
    if (!palette) return;
    palette.classList.remove('hidden');
    const input = document.getElementById('command-input');
    if (input) {
      input.value = '';
      renderCommandList();
      setTimeout(() => input.focus(), 20);
    }
  }

  function closeCommandPalette() {
    document.getElementById('command-palette')?.classList.add('hidden');
  }

  // ── Require authentication ────────────────────────────────────────
  function requireAuth(requiredRole = null) {
    const token = Api.getToken();
    const user  = Api.getUser();

    if (!token || !user) {
      window.location.href = 'index.html';
      return;
    }

    if (requiredRole && user.role !== requiredRole) {
      window.location.href = 'dashboard.html';
      return;
    }

    initLayout();
  }

  // ── Redirect if already logged in ────────────────────────────────
  function redirectIfLoggedIn() {
    if (Api.getToken() && Api.getUser()) {
      window.location.href = 'dashboard.html';
    }
  }

  // ── Logout ───────────────────────────────────────────────────────
  function logout() {
    Api.clearToken();
    window.location.href = 'index.html';
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGIN PAGE
  // ═══════════════════════════════════════════════════════════════

  function initLoginPage() {
    initPublicTheme();
    redirectIfLoggedIn();

    const form      = document.getElementById('login-form');
    const btn       = document.getElementById('login-btn');
    const btnText   = btn?.querySelector('.btn-text');
    const btnSpin   = btn?.querySelector('.btn-spinner');
    const alertEl   = 'login-alert';

    // Toggle password
    document.querySelector('.toggle-password')?.addEventListener('click', function () {
      const input = document.getElementById('password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      Api.hideAlert(alertEl);
      clearErrors(['email', 'password']);

      const email    = form.email.value.trim();
      const password = form.password.value;

      let valid = true;
      if (!email || !isValidEmail(email)) {
        showFieldError('email', 'Ingresá un correo válido.'); valid = false;
      }
      if (!password) {
        showFieldError('password', 'Ingresá tu contraseña.'); valid = false;
      }
      if (!valid) return;

      setLoading(btn, btnText, btnSpin, true);

      try {
        const res = await Api.post('/auth/login', { email, password });
        Api.saveToken(res.access_token);
        Api.saveUser(res.user);
        window.location.href = 'dashboard.html';
      } catch (err) {
        Api.showAlert(alertEl, err.message, 'error');
        setLoading(btn, btnText, btnSpin, false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // REGISTER PAGE
  // ═══════════════════════════════════════════════════════════════

  function initRegisterPage() {
    initPublicTheme();
    redirectIfLoggedIn();

    const form    = document.getElementById('register-form');
    const btn     = document.getElementById('register-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnSpin = btn?.querySelector('.btn-spinner');
    const alertEl = 'register-alert';
    const strengthBar = document.getElementById('password-strength');

    // Toggle password
    document.querySelector('.toggle-password')?.addEventListener('click', function () {
      const input = document.getElementById('password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Password strength indicator
    document.getElementById('password')?.addEventListener('input', function () {
      const val = this.value;
      let strength = '';
      if (val.length >= 6) strength = 'weak';
      if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) strength = 'medium';
      if (val.length >= 10 && /[A-Z]/.test(val) && /[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) strength = 'strong';
      strengthBar.setAttribute('data-strength', strength);
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      Api.hideAlert(alertEl);
      clearErrors(['name', 'email', 'password', 'confirm-password']);

      const name     = form.name.value.trim();
      const email    = form.email.value.trim();
      const password = form.password.value;
      const confirm  = form.confirmPassword.value;

      let valid = true;
      if (!name || name.length < 2)            { showFieldError('name', 'Ingresá tu nombre completo.'); valid = false; }
      if (!email || !isValidEmail(email))       { showFieldError('email', 'Ingresá un correo válido.'); valid = false; }
      if (!password || password.length < 6)     { showFieldError('password', 'La contraseña debe tener al menos 6 caracteres.'); valid = false; }
      if (password !== confirm)                 { showFieldError('confirm-password', 'Las contraseñas no coinciden.'); valid = false; }
      if (!valid) return;

      setLoading(btn, btnText, btnSpin, true);

      try {
        const res = await Api.post('/auth/register', { name, email, password });
        Api.saveToken(res.access_token);
        Api.saveUser(res.user);
        window.location.href = 'dashboard.html';
      } catch (err) {
        Api.showAlert(alertEl, err.message, 'error');
        setLoading(btn, btnText, btnSpin, false);
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFieldError(fieldId, message) {
    const el = document.getElementById(`${fieldId}-error`);
    if (el) { el.textContent = message; }
    const input = document.getElementById(fieldId);
    if (input) input.classList.add('input-error');
  }

  function clearErrors(fields) {
    fields.forEach((id) => {
      const el = document.getElementById(`${id}-error`);
      if (el) el.textContent = '';
      const input = document.getElementById(id);
      if (input) input.classList.remove('input-error');
    });
  }

  function setLoading(btn, textEl, spinEl, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (textEl) textEl.classList.toggle('hidden', loading);
    if (spinEl) spinEl.classList.toggle('hidden', !loading);
  }

  return {
    requireAuth,
    redirectIfLoggedIn,
    initLoginPage,
    initRegisterPage,
    initPublicTheme,
    logout,
    initLayout,
  };
})();

window.Auth = Auth;
