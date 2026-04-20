/**
 * profile.js – Página de perfil de usuario con foto, datos personales y presupuesto mensual
 */

const Profile = (() => {

  const AVATAR_KEY = (uid) => `avatar_${uid}`;

  async function init() {
    const user = Api.getUser();
    if (!user) return;

    // Load fresh user data from server
    let freshUser = user;
    try {
      const fresh = await Api.get(`/users/${user.id}`);
      Api.saveUser({ ...user, ...fresh });
      populateForm(fresh);
      renderStats(fresh);
      freshUser = fresh;
    } catch {
      populateForm(user);
      renderStats(user);
    }

    loadAvatar(user.id, freshUser.avatarUrl);
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
    set('p-savings',  user.savingsGoal  ?? '');
    updateCurrencyBadge(user.currency || 'ARS');
    updateSavingsPctHint(user.monthlyIncome, user.savingsGoal);
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
  let _cropper = null;

  function loadAvatar(userId, serverAvatarUrl) {
    const stored = localStorage.getItem(AVATAR_KEY(userId));
    if (stored) {
      applyAvatarImg(stored);
      // Auto-sync: if localStorage has a photo but the server doesn't (pre-fix avatars),
      // push it to the server now so other devices can see it.
      if (!serverAvatarUrl) {
        Api.put(`/users/${userId}`, { avatarUrl: stored })
          .then((res) => {
            if (res && res.avatarUrl) {
              // Replace local base64 cache with the Cloudinary URL
              localStorage.setItem(AVATAR_KEY(userId), res.avatarUrl);
              Api.saveUser({ ...Api.getUser(), avatarUrl: res.avatarUrl });
              applyAvatarImg(res.avatarUrl);
              updateSidebarAvatar(res.avatarUrl);
            }
          })
          .catch(() => {});
      }
    } else if (serverAvatarUrl) {
      // Cache server URL locally for faster loads next time
      localStorage.setItem(AVATAR_KEY(userId), serverAvatarUrl);
      applyAvatarImg(serverAvatarUrl);
    }
    // else: keep default SVG icon already in HTML
  }

  function applyAvatarImg(dataUrl) {
    const el = document.getElementById('profile-avatar-display');
    if (!el) return;
    el.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover" />`;
  }

  function bindAvatarInput() {
    const input = document.getElementById('profile-avatar-input');
    input?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Reset input so the same file can be selected again later
      input.value = '';

      let blob = file;

      // ── HEIC → JPEG conversion ─────────────────────────────────
      const isHeic = file.type === 'image/heic' ||
                     file.type === 'image/heif' ||
                     /\.heic$/i.test(file.name) ||
                     /\.heif$/i.test(file.name);

      if (isHeic) {
        try {
          Api.showAlert('profile-page-alert', 'Convirtiendo archivo HEIC…', 'info');
          blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
          // heic2any may return an array if multiple images
          if (Array.isArray(blob)) blob = blob[0];
        } catch {
          Api.showAlert('profile-page-alert', 'No se pudo convertir el archivo HEIC.', 'error');
          return;
        }
      }

      // ── Open crop modal ────────────────────────────────────────
      const url = URL.createObjectURL(blob);
      openCropModal(url);
    });
  }

  function openCropModal(imageUrl) {
    const modal    = document.getElementById('avatar-crop-modal');
    const img      = document.getElementById('avatar-crop-image');
    if (!modal || !img) return;

    img.src = imageUrl;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Destroy any previous instance
    if (_cropper) { _cropper.destroy(); _cropper = null; }

    img.onload = () => {
      _cropper = new Cropper(img, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.9,
        restore: false,
        guides: false,
        center: true,
        highlight: false,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
        ready() {
          // Style the crop box as a circle via CSS class
          const cropBox = modal.querySelector('.cropper-crop-box');
          if (cropBox) cropBox.style.borderRadius = '50%';
          const viewBox = modal.querySelector('.cropper-view-box');
          if (viewBox) viewBox.style.borderRadius = '50%';
        },
      });
    };

    // Wire close / cancel buttons each time modal opens (idempotent via once)
    document.getElementById('avatar-crop-close')?.addEventListener('click', closeCropModal, { once: true });
    document.getElementById('avatar-crop-cancel')?.addEventListener('click', closeCropModal, { once: true });
    document.getElementById('avatar-crop-save')?.addEventListener('click', saveCroppedAvatar, { once: true });
  }

  function closeCropModal() {
    const modal = document.getElementById('avatar-crop-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (_cropper) { _cropper.destroy(); _cropper = null; }
    const img = document.getElementById('avatar-crop-image');
    if (img) { URL.revokeObjectURL(img.src); img.src = ''; }
  }

  function saveCroppedAvatar() {
    if (!_cropper) return;
    const canvas = _cropper.getCroppedCanvas({ width: 280, height: 280, imageSmoothingQuality: 'high' });
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const user = Api.getUser();

    // Show immediately from local base64
    applyAvatarImg(dataUrl);
    updateSidebarAvatar(dataUrl);
    closeCropModal();
    Api.showAlert('profile-page-alert', 'Subiendo foto…', 'info');

    // Upload to server → Cloudinary → returns HTTPS URL
    Api.put(`/users/${user.id}`, { avatarUrl: dataUrl })
      .then((res) => {
        const finalUrl = res?.avatarUrl || dataUrl;
        // Cache the Cloudinary URL (or base64 fallback) locally
        localStorage.setItem(AVATAR_KEY(user.id), finalUrl);
        Api.saveUser({ ...Api.getUser(), avatarUrl: finalUrl });
        applyAvatarImg(finalUrl);
        updateSidebarAvatar(finalUrl);
        Api.showAlert('profile-page-alert', 'Foto de perfil actualizada.', 'success');
      })
      .catch(() => {
        // Keep base64 in localStorage as fallback for this device only
        localStorage.setItem(AVATAR_KEY(user.id), dataUrl);
        Api.showAlert('profile-page-alert', 'No se pudo sincronizar la foto con el servidor.', 'error');
      });
  }

  function updateSidebarAvatar(dataUrl) {
    const el = document.getElementById('user-avatar-initials');
    if (el) el.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  }

  // ── Budget summary ────────────────────────────────────────────────
  async function loadBudgetSummary() {
    const user = Api.getUser();
    const income = user?.monthlyIncome;
    const savingsGoal = user?.savingsGoal;

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

      // ── Savings summary ─────────────────────────────────────────
      renderSavingsSummary(income, savingsGoal, spent);
    } catch {
      set('bs-spent', 'Error');
    }
  }

  function renderSavingsSummary(income, savingsGoal, spent) {
    const summaryCard = document.getElementById('savings-summary-card');
    if (!summaryCard) return;

    if (!income || !savingsGoal || savingsGoal <= 0) {
      summaryCard.classList.add('hidden');
      return;
    }

    summaryCard.classList.remove('hidden');

    const freeBudget  = income - savingsGoal;       // cuánto podés gastar sin tocar ahorros
    const freeLeft    = freeBudget - spent;          // cuánto queda de ese presupuesto libre
    const savingsLeft = freeLeft < 0 ? Math.abs(freeLeft) : 0; // cuánto ya entró en ahorros

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sav-goal',        Api.formatCurrency(savingsGoal));
    set('sav-free-budget', Api.formatCurrency(freeBudget));
    set('sav-spent',       Api.formatCurrency(spent));

    const availEl = document.getElementById('sav-available');
    if (availEl) {
      availEl.textContent = freeLeft >= 0 ? Api.formatCurrency(freeLeft) : `−${Api.formatCurrency(Math.abs(freeLeft))}`;
      availEl.style.color = freeLeft < 0 ? 'var(--color-error, #e53e3e)' : freeLeft < freeBudget * 0.15 ? 'var(--color-warning, #d97706)' : '';
    }

    // Warning logic
    const warningEl   = document.getElementById('savings-warning');
    const warningText = document.getElementById('savings-warning-text');
    if (!warningEl || !warningText) return;

    if (freeLeft < 0) {
      // Already eating savings
      warningEl.classList.remove('hidden');
      warningEl.className = 'savings-warning savings-warning--danger';
      warningText.textContent = `¡Atención! Ya gastaste ${Api.formatCurrency(Math.abs(freeLeft))} de tus ahorros este mes.`;
    } else if (freeLeft < freeBudget * 0.15) {
      // Less than 15% of free budget remaining — close to savings
      warningEl.classList.remove('hidden');
      warningEl.className = 'savings-warning savings-warning--warning';
      warningText.textContent = `Estás cerca del límite. Si seguís gastando vas a empezar a consumir tus ahorros (${Api.formatCurrency(savingsGoal)}).`;
    } else {
      warningEl.classList.add('hidden');
    }

    // Rebuild lucide icons for any new <i data-lucide> elements
    if (window.lucide) lucide.createIcons();
  }
  function updateCurrencyBadge(currency) {
    const el = document.getElementById('income-currency-badge');
    if (el) el.textContent = currency;
    const savEl = document.getElementById('savings-currency-badge');
    if (savEl) savEl.textContent = currency;
  }

  function updateSavingsPctHint(income, savingsGoal) {
    const hint = document.getElementById('savings-pct-hint');
    if (!hint) return;
    if (income && savingsGoal && income > 0) {
      const pct = Math.round((savingsGoal / income) * 100);
      hint.textContent = `Eso representa el ${pct}% de tu ingreso mensual.`;
    } else {
      hint.textContent = '';
    }
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
      updateSavingsPctHint(monthlyIncome, Api.getUser()?.savingsGoal);
      await loadBudgetSummary();
    } catch (err) {
      Api.showAlert('profile-page-alert', err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      btnText?.classList.remove('hidden');
      btnSpin?.classList.add('hidden');
    }
  }

  // ── Save savings goal ─────────────────────────────────────────────
  async function saveSavings() {
    const user = Api.getUser();
    if (!user) return;

    const btn     = document.getElementById('savings-save-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnSpin = btn?.querySelector('.btn-spinner');
    const raw     = document.getElementById('p-savings')?.value;
    const savingsGoal = raw !== '' ? parseFloat(raw) : 0;

    if (isNaN(savingsGoal) || savingsGoal < 0) {
      Api.showAlert('profile-page-alert', 'La meta de ahorro debe ser un número positivo.', 'error'); return;
    }

    const income = user.monthlyIncome || 0;
    if (income > 0 && savingsGoal > income) {
      Api.showAlert('profile-page-alert', 'La meta de ahorro no puede superar el ingreso mensual.', 'error'); return;
    }

    if (btn) btn.disabled = true;
    btnText?.classList.add('hidden');
    btnSpin?.classList.remove('hidden');

    try {
      const updated = await Api.put(`/users/${user.id}`, { savingsGoal });
      Api.saveUser({ ...Api.getUser(), ...updated, savingsGoal });
      Api.showAlert('profile-page-alert', 'Meta de ahorro guardada.', 'success');
      updateSavingsPctHint(income, savingsGoal);
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
    document.getElementById('savings-save-btn')?.addEventListener('click', saveSavings);

    // Sync currency badge while selecting currency
    document.getElementById('p-currency')?.addEventListener('change', (e) => {
      updateCurrencyBadge(e.target.value);
    });

    // Live hint: update savings % as user types
    document.getElementById('p-savings')?.addEventListener('input', () => {
      const income = Api.getUser()?.monthlyIncome;
      const raw = document.getElementById('p-savings')?.value;
      updateSavingsPctHint(income, parseFloat(raw) || 0);
    });

    bindAvatarInput();
  }

  return { init };
})();

window.Profile = Profile;
