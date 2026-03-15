/**
 * expenses.js – Gestión completa de gastos (CRUD + filtros + paginación)
 */

const Expenses = (() => {

  let currentPage  = 1;
  let totalPages   = 1;
  let editingId    = null;
  let deletingId   = null;
  let currentFilters = {};

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    bindFilters();
    bindModal();
    bindDeleteModal();
    loadExpenses();

    // Set today as default date in form
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = Api.todayISO();
  }

  // ── Load expenses ──────────────────────────────────────────────────
  async function loadExpenses(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando...</td></tr>';

    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (currentFilters.category) params.set('category',  currentFilters.category);
      if (currentFilters.startDate) params.set('startDate', currentFilters.startDate);
      if (currentFilters.endDate)   params.set('endDate',   currentFilters.endDate);

      const res = await Api.get(`/expenses?${params}`);
      const { data: expenses, meta } = res;

      totalPages = meta.totalPages || 1;

      if (!expenses.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No hay gastos que coincidan con los filtros.</td></tr>';
        renderPagination(meta);
        return;
      }

      tbody.innerHTML = expenses.map((e) => `
        <tr>
          <td><strong>${esc(e.merchant)}</strong></td>
          <td>${Api.categoryPill(e.category)}</td>
          <td class="text-muted" style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(e.description || '-')}
          </td>
          <td>${Api.formatDate(e.date)}</td>
          <td class="text-right"><strong>${Api.formatCurrency(e.amount)}</strong></td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-icon btn-icon--edit" title="Editar" aria-label="Editar" onclick="Expenses.openEdit('${e.id}')">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 21h4l11-11a2.1 2.1 0 0 0-4-4L3 17v4z"></path>
                  <path d="M14 6l4 4"></path>
                </svg>
              </button>
              <button type="button" class="btn-icon btn-icon--delete" title="Eliminar" aria-label="Eliminar" onclick="Expenses.confirmDelete('${e.id}')">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4h8v2"></path>
                  <path d="M19 6l-1 14H6L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>`).join('');

      renderPagination(meta);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${esc(err.message)}</td></tr>`;
    }
  }

  // ── Pagination ────────────────────────────────────────────────────
  function renderPagination(meta) {
    const pg = document.getElementById('pagination');
    if (!pg) return;

    const { page, total, limit, totalPages: tp } = meta;
    if (tp <= 1) { pg.innerHTML = ''; return; }

    let html = `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="Expenses.goPage(${page - 1})">‹</button>`;
    for (let i = 1; i <= tp; i++) {
      if (i === 1 || i === tp || Math.abs(i - page) <= 1) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="Expenses.goPage(${i})">${i}</button>`;
      } else if (Math.abs(i - page) === 2) {
        html += `<span style="padding:0 .25rem;color:var(--text-muted)">…</span>`;
      }
    }
    html += `<button class="page-btn" ${page === tp ? 'disabled' : ''} onclick="Expenses.goPage(${page + 1})">›</button>`;
    html += `<span style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem">${total} registro${total !== 1 ? 's' : ''}</span>`;
    pg.innerHTML = html;
  }

  function goPage(page) {
    if (page < 1 || page > totalPages) return;
    loadExpenses(page);
  }

  // ── Filters ───────────────────────────────────────────────────────
  function bindFilters() {
    // Populate year dropdowns
    const currentYear = new Date().getFullYear();
    ['filter-year', 'filter-month-year'].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      for (let y = currentYear; y >= currentYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
      }
    });

    // Set current month default
    const monthSel = document.getElementById('filter-month');
    if (monthSel) monthSel.value = new Date().getMonth() + 1;

    // Set today as default for week/date pickers
    const today = Api.todayISO();
    ['filter-week', 'filter-specific-date'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = today;
    });

    // Show/hide period-specific fields when period selector changes
    document.getElementById('filter-period')?.addEventListener('change', (e) => {
      const v = e.target.value;
      document.querySelectorAll('.filter-period-field').forEach(el => el.style.display = 'none');
      if (v === 'year')   { show('fp-year'); }
      if (v === 'month')  { show('fp-month'); show('fp-month-year'); }
      if (v === 'week')   { show('fp-week'); }
      if (v === 'date')   { show('fp-date'); }
      if (v === 'custom') { show('fp-custom-start'); show('fp-custom-end'); }
    });

    document.getElementById('btn-filter')?.addEventListener('click', applyFilters);

    document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
      document.getElementById('filter-category').value  = '';
      document.getElementById('filter-period').value    = '';
      document.querySelectorAll('.filter-period-field').forEach(el => el.style.display = 'none');
      currentFilters = {};
      loadExpenses(1);
    });
  }

  function show(id) {
    const el = document.getElementById(id); if (el) el.style.display = '';
  }

  function applyFilters() {
    const category = document.getElementById('filter-category')?.value || '';
    const period   = document.getElementById('filter-period')?.value   || '';

    let startDate = '';
    let endDate   = '';

    if (period === 'year') {
      const y = parseInt(document.getElementById('filter-year')?.value);
      if (y) { startDate = `${y}-01-01`; endDate = `${y}-12-31`; }

    } else if (period === 'month') {
      const y = parseInt(document.getElementById('filter-month-year')?.value);
      const m = parseInt(document.getElementById('filter-month')?.value);
      if (y && m) {
        const lastDay = new Date(y, m, 0).getDate();
        const mm = String(m).padStart(2, '0');
        startDate = `${y}-${mm}-01`;
        endDate   = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
      }

    } else if (period === 'week') {
      const raw = document.getElementById('filter-week')?.value;
      if (raw) {
        const d = new Date(raw + 'T00:00:00');
        const day = d.getDay(); // 0=Sun
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const mon = new Date(d); mon.setDate(d.getDate() + diffToMon);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        startDate = mon.toISOString().slice(0, 10);
        endDate   = sun.toISOString().slice(0, 10);
      }

    } else if (period === 'date') {
      const raw = document.getElementById('filter-specific-date')?.value;
      if (raw) { startDate = raw; endDate = raw; }

    } else if (period === 'custom') {
      startDate = document.getElementById('filter-start')?.value  || '';
      endDate   = document.getElementById('filter-end')?.value    || '';
    }

    currentFilters = { category, startDate, endDate };
    loadExpenses(1);
  }

  // ── Create / Edit Modal ───────────────────────────────────────────
  function bindModal() {
    document.getElementById('btn-new-expense')?.addEventListener('click', openCreate);
    document.getElementById('expense-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('expense-cancel-btn')?.addEventListener('click', closeModal);
    document.getElementById('expense-modal')?.querySelector('.modal-backdrop')
      ?.addEventListener('click', closeModal);
    document.getElementById('expense-save-btn')?.addEventListener('click', saveExpense);
  }

  function openCreate() {
    editingId = null;
    resetForm();
    document.getElementById('expense-modal-title').textContent = 'Nuevo gasto';
    document.getElementById('exp-date').value = Api.todayISO();
    document.getElementById('expense-modal').classList.remove('hidden');
  }

  async function openEdit(id) {
    editingId = id;
    resetForm();
    document.getElementById('expense-modal-title').textContent = 'Editar gasto';

    try {
      const expense = await Api.get(`/expenses/${id}`);
      document.getElementById('expense-id').value      = expense.id;
      document.getElementById('exp-merchant').value    = expense.merchant;
      document.getElementById('exp-amount').value      = expense.amount;
      document.getElementById('exp-category').value    = expense.category;
      document.getElementById('exp-date').value        = expense.date?.split('T')[0] || '';
      document.getElementById('exp-description').value = expense.description || '';
      document.getElementById('expense-modal').classList.remove('hidden');
    } catch (err) {
      Api.showAlert('expenses-alert', err.message, 'error');
    }
  }

  function closeModal() {
    document.getElementById('expense-modal').classList.add('hidden');
    editingId = null;
  }

  function resetForm() {
    document.getElementById('expense-form')?.reset();
    Api.hideAlert('expense-form-alert');
    document.getElementById('expense-id').value = '';
  }

  async function saveExpense() {
    const alertEl = 'expense-form-alert';
    Api.hideAlert(alertEl);

    const merchant    = document.getElementById('exp-merchant').value.trim();
    const amount      = parseFloat(document.getElementById('exp-amount').value);
    const category    = document.getElementById('exp-category').value;
    const date        = document.getElementById('exp-date').value;
    const description = document.getElementById('exp-description').value.trim();

    if (!merchant)            return Api.showAlert(alertEl, 'El comercio es obligatorio.');
    if (!amount || amount <= 0) return Api.showAlert(alertEl, 'El monto debe ser mayor a cero.');
    if (!category)            return Api.showAlert(alertEl, 'Seleccioná una categoría.');
    if (!date)                return Api.showAlert(alertEl, 'La fecha es obligatoria.');

    const payload = { merchant, amount, category, date, description: description || undefined };

    const saveBtn = document.getElementById('expense-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      if (editingId) {
        await Api.put(`/expenses/${editingId}`, payload);
      } else {
        await Api.post('/expenses', payload);
      }

      closeModal();
      loadExpenses(currentPage);
      Api.showAlert('expenses-alert', `Gasto ${editingId ? 'actualizado' : 'registrado'} correctamente.`, 'success');
    } catch (err) {
      Api.showAlert(alertEl, err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';
    }
  }

  // ── Delete Modal ──────────────────────────────────────────────────
  function bindDeleteModal() {
    document.getElementById('delete-modal-close')?.addEventListener('click', closeDeleteModal);
    document.getElementById('delete-cancel-btn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('delete-modal')?.querySelector('.modal-backdrop')
      ?.addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm-btn')?.addEventListener('click', deleteExpense);
  }

  function confirmDelete(id) {
    deletingId = id;
    document.getElementById('delete-modal').classList.remove('hidden');
  }

  function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    deletingId = null;
  }

  async function deleteExpense() {
    if (!deletingId) return;

    const btn = document.getElementById('delete-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Eliminando...';

    try {
      await Api.del(`/expenses/${deletingId}`);
      closeDeleteModal();
      loadExpenses(currentPage);
      Api.showAlert('expenses-alert', 'Gasto eliminado correctamente.', 'success');
    } catch (err) {
      Api.showAlert('expenses-alert', err.message, 'error');
      closeDeleteModal();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Eliminar';
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────
  function esc(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init, goPage, openEdit, confirmDelete };
})();

window.Expenses = Expenses;
