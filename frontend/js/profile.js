/**
 * profile.js – Página de perfil de usuario con foto, datos personales y presupuesto mensual
 */

const Profile = (() => {

  const AVATAR_KEY = (uid) => `avatar_${uid}`;

  async function init() {
    const user = Api.getUser();
    if (!user) return;

    // Load fresh user data from server
    try {
      const fresh = await Api.get(`/users/${user.id}`);
      // Merge keeping avatar (stored locally) and currency from DB
      Api.saveUser({ ...user, ...fresh });
      populateForm(fresh);
      renderStats(fresh);
    } catch {
      populateForm(user);
      renderStats(user);
    }

    loadAvatar(user.id);
    await loadBudgetSummary();
    bindEvents();
  }

  // ── Populate form ─────────────────────────────────────────────────
  function populateForm(user) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('p-name',     user.name);
    set('p-age',      user.age ?? '');
    set('p-email',    user.email);
    set('p-currency', user.currency || 'ARS');
    set('p-income',   user.monthlyIncome ?? '');
    updateCurrencyBadge(user.currency || 'ARS');
  }

  function renderStats(user) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ps-expense-count', user._count?.expenses ?? '-');
    set('ps-ticket-count',  user._count?.tickets  ?? '-');
    set('ps-member-since',  user.createdAt
      ? new Date(user.createdAt).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      : '-');
  }

  // ── Avatar ────────────────────────────────────────────────────────
  function loadAvatar(userId) {
    const stored = localStorage.getItem(AVATAR_KEY(userId));
    if (stored) applyAvatarImg(stored);
    // else: keep default SVG icon already in HTML
  }

  function applyAvatarImg(dataUrl) {
    const el = document.getElementById('profile-avatar-display');
    if (!el) return;
    el.innerHTML = `<img src="${dataUrl}" alt="Avatar" />`;
  }

  function bindAvatarInput() {
    const input = document.getElementById('profile-avatar-input');
    input?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      compressAndSaveAvatar(file);
    });
  }

  function compressAndSaveAvatar(file) {
    const user = Api.getUser();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const SIZE = 160;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        // Crop to square, then resize
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width  - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        localStorage.setItem(AVATAR_KEY(user.id), dataUrl);
        applyAvatarImg(dataUrl);
        // Also update sidebar avatar immediately
        updateSidebarAvatar(dataUrl);
        Api.showAlert('profile-page-alert', 'Foto actualizada.', 'success');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateSidebarAvatar(dataUrl) {
    const el = document.getElementById('user-avatar-initials');
    if (el) el.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  }

  // ── Budget summary ────────────────────────────────────────────────
  async function loadBudgetSummary() {
    const user = Api.getUser();
    const income = user?.monthlyIncome;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('bs-income', income ? Api.formatCurrency(income) : 'No configurado');

    if (!income) {
      set('bs-spent',     '-');
      set('bs-available', '-');
      const bar = document.getElementById('bs-bar');
      if (bar) bar.style.width = '0%';
      return;
    }

    try {
      const data = await Api.get('/expenses/analytics');
      const spent = data.currentMonth?.total || 0;
      const available = income - spent;
      const pct = Math.min(100, Math.round((spent / income) * 100));

      set('bs-spent', Api.formatCurrency(spent));

      const availEl = document.getElementById('bs-available');
      if (availEl) {
        availEl.textContent = Api.formatCurrency(available);
        availEl.className = `budget-value budget-available ${available < 0 ? 'budget-available--over' : available < income * 0.1 ? 'budget-available--low' : 'budget-available--ok'}`;
      }

      const bar = document.getElementById('bs-bar');
      if (bar) {
        bar.style.width = `${pct}%`;
        bar.className = `budget-bar-fill ${pct >= 100 ? 'budget-bar-fill--over' : pct >= 80 ? 'budget-bar-fill--warning' : 'budget-bar-fill--ok'}`;
      }

      const pctEl = document.getElementById('bs-pct');
      if (pctEl) pctEl.textContent = `${pct}% usado`;
    } catch {
      set('bs-spent', 'Error');
    }
  }

  function updateCurrencyBadge(currency) {
    const el = document.getElementById('income-currency-badge');
    if (el) el.textContent = currency;
  }

  // ── Save profile ──────────────────────────────────────────────────
  async function saveProfile() {
    const user = Api.getUser();
    if (!user) return;

    const btn     = document.getElementById('profile-save-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnSpin = btn?.querySelector('.btn-spinner');

    const name     = document.getElementById('p-name')?.value.trim();
    const email    = document.getElementById('p-email')?.value.trim();
    const currency = document.getElementById('p-currency')?.value;
    const ageRaw   = document.getElementById('p-age')?.value;
    const password = document.getElementById('p-password')?.value;
    const confirm  = document.getElementById('p-password-confirm')?.value;
    const age      = ageRaw ? parseInt(ageRaw) : undefined;

    Api.hideAlert('profile-page-alert');

    if (!name) { Api.showAlert('profile-page-alert', 'El nombre no puede estar vacío.', 'error'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Api.showAlert('profile-page-alert', 'Ingresá un email válido.', 'error'); return;
    }
    if (password && password.length < 6) {
      Api.showAlert('profile-page-alert', 'La contraseña debe tener al menos 6 caracteres.', 'error'); return;
    }
    if (password && password !== confirm) {
      Api.showAlert('profile-page-alert', 'Las contraseñas no coinciden.', 'error'); return;
    }

    if (btn) btn.disabled = true;
    btnText?.classList.add('hidden');
    btnSpin?.classList.remove('hidden');

    try {
      const body = { name, email, currency };
      if (age)      body.age = age;
      if (password) body.password = password;

      const updated = await Api.put(`/users/${user.id}`, body);
      Api.saveUser({ ...user, ...updated, currency });
      updateCurrencyBadge(currency);

      document.getElementById('p-password').value         = '';
      document.getElementById('p-password-confirm').value = '';

      Api.showAlert('profile-page-alert', 'Perfil actualizado correctamente.', 'success');
    } catch (err) {
      Api.showAlert('profile-page-alert', err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      btnText?.classList.remove('hidden');
      btnSpin?.classList.add('hidden');
    }
  }

  // ── Save income separately ────────────────────────────────────────
  async function saveIncome() {
    const user = Api.getUser();
    if (!user) return;

    const btn     = document.getElementById('income-save-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnSpin = btn?.querySelector('.btn-spinner');
    const incomeRaw = document.getElementById('p-income')?.value;
    const monthlyIncome = incomeRaw !== '' ? parseFloat(incomeRaw) : 0;

    if (isNaN(monthlyIncome) || monthlyIncome < 0) {
      Api.showAlert('profile-page-alert', 'El ingreso debe ser un número positivo.', 'error'); return;
    }

    if (btn) btn.disabled = true;
    btnText?.classList.add('hidden');
    btnSpin?.classList.remove('hidden');

    try {
      const updated = await Api.put(`/users/${user.id}`, { monthlyIncome });
      Api.saveUser({ ...Api.getUser(), ...updated, monthlyIncome });
      Api.showAlert('profile-page-alert', 'Ingreso actualizado.', 'success');
      await loadBudgetSummary();
    } catch (err) {
      Api.showAlert('profile-page-alert', err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      btnText?.classList.remove('hidden');
      btnSpin?.classList.add('hidden');
    }
  }

  // ── Bind events ───────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('profile-save-btn')?.addEventListener('click', saveProfile);
    document.getElementById('income-save-btn')?.addEventListener('click', saveIncome);

    // Sync currency badge while selecting currency
    document.getElementById('p-currency')?.addEventListener('change', (e) => {
      updateCurrencyBadge(e.target.value);
    });

    bindAvatarInput();
  }

  return { init };
})();

window.Profile = Profile;
