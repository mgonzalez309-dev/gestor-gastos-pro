/**
 * expenses.js – Gestión completa de gastos (CRUD + filtros + paginación)
 */

const Expenses = (() => {

  const PDF_THEME = {
    primary: [15, 111, 255],
    primaryStrong: [10, 84, 194],
    secondary: [19, 165, 139],
    text: [15, 23, 38],
    textMuted: [77, 95, 119],
    border: [219, 229, 242],
    bgSoft: [244, 247, 251],
    bgChip: [237, 244, 255],
    white: [255, 255, 255],
  };

  let cachedManropeBase64 = null;
  let cachedLogoDataUrl = null;

  let currentPage  = 1;
  let totalPages   = 1;
  let editingId    = null;
  let deletingId   = null;
  let currentFilters = {};

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    bindFilters();
    bindExportActions();
    bindReportModal();
    bindModal();
    bindDeleteModal();
    loadExpenses();

    // Set today as default date in form
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = Api.todayISO();

    // Auto-open new expense modal if navigated with ?new=1
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      // Small delay so the page finishes rendering first
      setTimeout(openCreate, 120);
    }
  }

  // ── Load expenses ──────────────────────────────────────────────────
  async function loadExpenses(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando...</td></tr>';

    try {
      const params = buildQueryParams(page, 15);

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

  function buildQueryParams(page, limit) {
    return buildQueryParamsFromFilters(page, limit, currentFilters);
  }

  function buildQueryParamsFromFilters(page, limit, filters) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.category) params.set('category', filters.category);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    return params;
  }

  // ── Filters ───────────────────────────────────────────────────────
  function bindFilters() {
    // Populate year dropdowns
    const currentYear = new Date().getFullYear();
    ['filter-year', 'filter-month-year', 'report-filter-year', 'report-filter-month-year'].forEach((id) => {
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
    const reportMonthSel = document.getElementById('report-filter-month');
    if (reportMonthSel) reportMonthSel.value = new Date().getMonth() + 1;

    // Set today as default for week/date pickers
    const today = Api.todayISO();
    ['filter-week', 'filter-specific-date', 'report-filter-week', 'report-filter-specific-date'].forEach((id) => {
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
    const parsed = collectFiltersFromForm('main');
    currentFilters = {
      category: parsed.category,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    };
    loadExpenses(1);
  }

  function collectFiltersFromForm(scope) {
    const cfg = scope === 'report'
      ? {
          category: 'report-filter-category',
          period: 'report-filter-period',
          year: 'report-filter-year',
          month: 'report-filter-month',
          monthYear: 'report-filter-month-year',
          week: 'report-filter-week',
          date: 'report-filter-specific-date',
          start: 'report-filter-start',
          end: 'report-filter-end',
        }
      : {
          category: 'filter-category',
          period: 'filter-period',
          year: 'filter-year',
          month: 'filter-month',
          monthYear: 'filter-month-year',
          week: 'filter-week',
          date: 'filter-specific-date',
          start: 'filter-start',
          end: 'filter-end',
        };

    const categoryEl = document.getElementById(cfg.category);
    const periodEl = document.getElementById(cfg.period);
    const category = categoryEl?.value || '';
    const period = periodEl?.value || '';

    const range = resolveDateRange(period, {
      year: document.getElementById(cfg.year)?.value,
      month: document.getElementById(cfg.month)?.value,
      monthYear: document.getElementById(cfg.monthYear)?.value,
      week: document.getElementById(cfg.week)?.value,
      date: document.getElementById(cfg.date)?.value,
      start: document.getElementById(cfg.start)?.value,
      end: document.getElementById(cfg.end)?.value,
    });

    return {
      category,
      period,
      startDate: range.startDate,
      endDate: range.endDate,
      categoryLabel: categoryEl?.selectedOptions?.[0]?.textContent || 'Todas',
      periodLabel: periodEl?.selectedOptions?.[0]?.textContent || 'Todos',
    };
  }

  function resolveDateRange(period, values) {
    let startDate = '';
    let endDate = '';

    if (period === 'year') {
      const y = parseInt(values.year, 10);
      if (y) { startDate = `${y}-01-01`; endDate = `${y}-12-31`; }
    } else if (period === 'month') {
      const y = parseInt(values.monthYear, 10);
      const m = parseInt(values.month, 10);
      if (y && m) {
        const lastDay = new Date(y, m, 0).getDate();
        const mm = String(m).padStart(2, '0');
        startDate = `${y}-${mm}-01`;
        endDate = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (period === 'week') {
      if (values.week) {
        const d = new Date(values.week + 'T00:00:00');
        const day = d.getDay();
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const mon = new Date(d);
        mon.setDate(d.getDate() + diffToMon);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        startDate = mon.toISOString().slice(0, 10);
        endDate = sun.toISOString().slice(0, 10);
      }
    } else if (period === 'date') {
      if (values.date) { startDate = values.date; endDate = values.date; }
    } else if (period === 'custom') {
      startDate = values.start || '';
      endDate = values.end || '';
    }

    return { startDate, endDate };
  }

  // ── Export ────────────────────────────────────────────────────────
  function bindExportActions() {
    document.getElementById('btn-export-excel')?.addEventListener('click', () => exportExpenses('excel'));
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => exportExpenses('pdf'));
  }

  async function exportExpenses(format) {
    const alertId = 'expenses-alert';
    Api.hideAlert(alertId);

    const buttonId = format === 'excel' ? 'btn-export-excel' : 'btn-export-pdf';
    const button = document.getElementById(buttonId);
    const originalText = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Exportando...';
    }

    try {
      const expenses = await fetchAllFilteredExpenses();
      if (!expenses.length) {
        Api.showAlert(alertId, 'No hay gastos para exportar con los filtros actuales.', 'error');
        return;
      }

      const filters = buildFilterSummary();
      const exportJson = buildExportJson(expenses, filters);

      if (format === 'excel') {
        await exportAsExcel(exportJson);
      } else {
        await exportAsPdf(exportJson);
      }

      Api.showAlert(alertId, `Archivo ${format === 'excel' ? 'Excel' : 'PDF'} generado correctamente.`, 'success');
    } catch (err) {
      Api.showAlert(alertId, err.message || 'No se pudo exportar los gastos.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function fetchAllFilteredExpenses(filters = currentFilters) {
    const limit = 100;
    let page = 1;
    let totalPagesToFetch = 1;
    const all = [];

    // Fetch all filtered pages to export the full filtered dataset.
    while (page <= totalPagesToFetch) {
      const params = buildQueryParamsFromFilters(page, limit, filters);
      const res = await Api.get(`/expenses?${params.toString()}`);
      const rows = res?.data || [];
      const meta = res?.meta || {};

      all.push(...rows);
      totalPagesToFetch = meta.totalPages || 1;
      page += 1;
    }

    return all;
  }

  function buildFilterSummary(override = null) {
    const parsed = collectFiltersFromForm('main');
    const source = override || parsed;

    return {
      Categoria: source.categoryLabel || 'Todas',
      Periodo: source.periodLabel || 'Todos',
      Desde: source.startDate || '-',
      Hasta: source.endDate || '-',
    };
  }

  function buildExportJson(expenses, filters) {
    return {
      nombre: 'Gastos',
      generadoEn: new Date().toISOString(),
      filtros: filters,
      items: expenses.map((e) => ({
        Comercio: e.merchant,
        Categoria: Api.categoryLabel(e.category),
        Descripcion: e.description || '',
        Fecha: e.date ? e.date.split('T')[0] : '',
        Monto: Number(e.amount),
      })),
    };
  }

  async function exportAsExcel(exportJson) {
    if (typeof ExcelJS === 'undefined') {
      // Fallback keep working even if ExcelJS CDN fails.
      if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(exportJson.items);
        XLSX.utils.book_append_sheet(wb, sheet, 'Gastos');
        XLSX.writeFile(wb, 'Gastos.xlsx');
        return;
      }
      throw new Error('No se pudo cargar la libreria de Excel.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GastosApp';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('Gastos', {
      views: [{ state: 'frozen', ySplit: 15 }],
    });

    const colors = {
      primary: 'FF0F6FFF',
      primaryStrong: 'FF0A54C2',
      secondary: 'FF13A58B',
      text: 'FF0F1726',
      textMuted: 'FF4D5F77',
      border: 'FFDCE6F2',
      soft: 'FFF4F7FB',
      chip: 'FFEDF4FF',
      white: 'FFFFFFFF',
      stripe: 'FFF9FCFF',
    };

    ws.columns = [
      { width: 6 },
      { width: 30 },
      { width: 20 },
      { width: 44 },
      { width: 15 },
      { width: 18 },
    ];

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = 'GastosApp · Exportacion de Gastos';
    ws.getRow(1).height = 28;
    ws.getCell('A1').font = { name: 'Manrope', size: 16, bold: true, color: { argb: colors.white } };
    ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };

    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = `Generado: ${new Date(exportJson.generadoEn).toLocaleString('es-AR')}`;
    ws.getRow(2).height = 20;
    ws.getCell('A2').font = { name: 'Manrope', size: 10, color: { argb: colors.white } };
    ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primaryStrong } };

    ws.mergeCells('A4:F4');
    ws.getCell('A4').value = 'Filtros aplicados';
    ws.getCell('A4').font = { name: 'Manrope', size: 11, bold: true, color: { argb: colors.text } };
    ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.soft } };
    ws.getCell('A4').border = { bottom: { style: 'thin', color: { argb: colors.border } } };

    const filters = exportJson.filtros || {};
    const filterRows = [
      ['Categoria', filters.Categoria || 'Todas', 'Periodo', filters.Periodo || 'Todos'],
      ['Desde', filters.Desde || '-', 'Hasta', filters.Hasta || '-'],
    ];

    filterRows.forEach((row, idx) => {
      const rowNum = 5 + idx;
      ws.getCell(`A${rowNum}`).value = row[0];
      ws.getCell(`B${rowNum}`).value = row[1];
      ws.getCell(`D${rowNum}`).value = row[2];
      ws.getCell(`E${rowNum}`).value = row[3];

      ['A', 'D'].forEach((col) => {
        const c = ws.getCell(`${col}${rowNum}`);
        c.font = { name: 'Manrope', size: 10, bold: true, color: { argb: colors.textMuted } };
      });

      ['B', 'E'].forEach((col) => {
        const c = ws.getCell(`${col}${rowNum}`);
        c.font = { name: 'Manrope', size: 10, color: { argb: colors.text } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.chip } };
        c.border = {
          top: { style: 'thin', color: { argb: colors.border } },
          left: { style: 'thin', color: { argb: colors.border } },
          bottom: { style: 'thin', color: { argb: colors.border } },
          right: { style: 'thin', color: { argb: colors.border } },
        };
      });
    });

    const totalAmount = exportJson.items.reduce((acc, item) => acc + Number(item.Monto || 0), 0);
    const count = exportJson.items.length;
    const avg = count ? totalAmount / count : 0;

    ws.mergeCells('A8:F8');
    ws.getCell('A8').value = 'Resumen';
    ws.getCell('A8').font = { name: 'Manrope', size: 11, bold: true, color: { argb: colors.text } };
    ws.getCell('A8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.soft } };
    ws.getCell('A8').border = { bottom: { style: 'thin', color: { argb: colors.border } } };

    ws.getRow(9).values = ['Total gastos', totalAmount, 'Cantidad', count, 'Promedio', avg];
    ws.getRow(9).height = 22;
    ['A9', 'C9', 'E9'].forEach((ref) => {
      const c = ws.getCell(ref);
      c.font = { name: 'Manrope', size: 10, bold: true, color: { argb: colors.textMuted } };
    });
    ['B9', 'D9', 'F9'].forEach((ref) => {
      const c = ws.getCell(ref);
      c.font = { name: 'Manrope', size: 11, bold: true, color: { argb: colors.text } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.chip } };
      c.border = {
        top: { style: 'thin', color: { argb: colors.border } },
        left: { style: 'thin', color: { argb: colors.border } },
        bottom: { style: 'thin', color: { argb: colors.border } },
        right: { style: 'thin', color: { argb: colors.border } },
      };
    });

    ws.mergeCells('A11:F11');
    ws.getCell('A11').value = 'Detalle de gastos';
    ws.getCell('A11').font = { name: 'Manrope', size: 11, bold: true, color: { argb: colors.text } };
    ws.getCell('A11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.soft } };
    ws.getCell('A11').border = { bottom: { style: 'thin', color: { argb: colors.border } } };

    const headerRow = 12;
    const dataStartRow = 13;
    const headers = ['#', 'Comercio', 'Categoria', 'Descripcion', 'Fecha', 'Monto'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { name: 'Manrope', size: 10, bold: true, color: { argb: colors.white } };
      cell.alignment = { vertical: 'middle', horizontal: i === 5 ? 'right' : 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
      cell.border = {
        top: { style: 'thin', color: { argb: colors.primaryStrong } },
        left: { style: 'thin', color: { argb: colors.primaryStrong } },
        bottom: { style: 'thin', color: { argb: colors.primaryStrong } },
        right: { style: 'thin', color: { argb: colors.primaryStrong } },
      };
    });
    ws.getRow(headerRow).height = 22;

    const currencyCode = Api.getUser()?.currency || 'ARS';
    const currencyFormat = `"${currencyCode}" #,##0.00`;

    exportJson.items.forEach((item, idx) => {
      const rowNum = dataStartRow + idx;
      const row = ws.getRow(rowNum);
      row.values = [
        idx + 1,
        item.Comercio,
        item.Categoria,
        item.Descripcion || '-',
        item.Fecha || '-',
        Number(item.Monto || 0),
      ];

      row.height = 20;
      row.font = { name: 'Manrope', size: 10, color: { argb: colors.text } };
      row.alignment = { vertical: 'middle' };

      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.stripe } };
        });
      }

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: colors.border } },
          left: { style: 'thin', color: { argb: colors.border } },
          bottom: { style: 'thin', color: { argb: colors.border } },
          right: { style: 'thin', color: { argb: colors.border } },
        };
        if (colNumber === 1) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNumber === 6) cell.alignment = { vertical: 'middle', horizontal: 'right' };
      });

      const dateCell = ws.getCell(`E${rowNum}`);
      if (item.Fecha) {
        const parsedDate = new Date(`${item.Fecha}T00:00:00`);
        if (!Number.isNaN(parsedDate.getTime())) {
          dateCell.value = parsedDate;
          dateCell.numFmt = 'dd/mm/yyyy';
        }
      }

      const amountCell = ws.getCell(`F${rowNum}`);
      amountCell.numFmt = currencyFormat;
    });

    const lastRow = Math.max(dataStartRow, dataStartRow + exportJson.items.length - 1);
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: 6 },
    };

    ws.getCell(`A${lastRow + 2}`).value = `Total registros: ${count}`;
    ws.getCell(`A${lastRow + 2}`).font = { name: 'Manrope', size: 10, bold: true, color: { argb: colors.textMuted } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Gastos.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportAsPdf(exportJson) {
    if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
      throw new Error('No se pudo cargar la libreria PDF.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    await ensurePdfBranding(doc);
    const nowText = new Date(exportJson.generadoEn).toLocaleString('es-AR');
    const pageWidth = doc.internal.pageSize.getWidth();

    drawPdfHeader(doc, {
      title: 'Exportacion de gastos',
      subtitle: `Datos tabulares listos para compartir · ${nowText}`,
      logoDataUrl: cachedLogoDataUrl,
    });

    drawSectionTitle(doc, 'Filtros aplicados', 14, 32);
    drawFilterPanel(doc, exportJson.filtros, 14, 36, pageWidth - 28);

    const body = exportJson.items.map((i) => [
      i.Comercio,
      i.Categoria,
      i.Descripcion,
      i.Fecha,
      formatMoney(i.Monto),
    ]);

    doc.autoTable({
      head: [['Comercio', 'Categoria', 'Descripcion', 'Fecha', 'Monto']],
      body,
      startY: 60,
      theme: 'grid',
      styles: {
        fontSize: 9,
        lineColor: PDF_THEME.border,
        lineWidth: 0.1,
        textColor: PDF_THEME.text,
        cellPadding: 2.4,
      },
      headStyles: {
        fillColor: PDF_THEME.primary,
        textColor: PDF_THEME.white,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [251, 253, 255],
      },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 38 },
        2: { cellWidth: 115 },
        3: { cellWidth: 34 },
        4: { halign: 'right', cellWidth: 28 },
      },
      didDrawPage: () => {
        drawPdfFooter(doc, 'GastosApp · Exportacion');
      },
    });

    doc.save('Gastos.pdf');
  }

  // ── Report Modal + PDF report ───────────────────────────────────
  function bindReportModal() {
    document.getElementById('btn-generate-report')?.addEventListener('click', openReportModal);
    document.getElementById('report-modal-close')?.addEventListener('click', closeReportModal);
    document.getElementById('report-cancel-btn')?.addEventListener('click', closeReportModal);
    document.getElementById('report-generate-btn')?.addEventListener('click', generateReport);
    document.getElementById('report-modal')?.querySelector('.modal-backdrop')
      ?.addEventListener('click', closeReportModal);

    document.getElementById('report-filter-period')?.addEventListener('change', (e) => {
      const v = e.target.value;
      document.querySelectorAll('.report-filter-period-field').forEach((el) => { el.style.display = 'none'; });
      if (v === 'year') show('rfp-year');
      if (v === 'month') { show('rfp-month'); show('rfp-month-year'); }
      if (v === 'week') show('rfp-week');
      if (v === 'date') show('rfp-date');
      if (v === 'custom') show('rfp-custom');
    });
  }

  function openReportModal() {
    Api.hideAlert('report-form-alert');

    document.getElementById('report-filter-category').value = document.getElementById('filter-category')?.value || '';
    document.getElementById('report-filter-period').value = document.getElementById('filter-period')?.value || '';
    document.getElementById('report-filter-year').value = document.getElementById('filter-year')?.value || document.getElementById('report-filter-year')?.value;
    document.getElementById('report-filter-month').value = document.getElementById('filter-month')?.value || document.getElementById('report-filter-month')?.value;
    document.getElementById('report-filter-month-year').value = document.getElementById('filter-month-year')?.value || document.getElementById('report-filter-month-year')?.value;
    document.getElementById('report-filter-week').value = document.getElementById('filter-week')?.value || Api.todayISO();
    document.getElementById('report-filter-specific-date').value = document.getElementById('filter-specific-date')?.value || Api.todayISO();
    document.getElementById('report-filter-start').value = document.getElementById('filter-start')?.value || '';
    document.getElementById('report-filter-end').value = document.getElementById('filter-end')?.value || '';

    document.getElementById('report-filter-period')?.dispatchEvent(new Event('change'));
    document.getElementById('report-modal').classList.remove('hidden');
  }

  function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
  }

  async function generateReport() {
    Api.hideAlert('report-form-alert');

    const generateBtn = document.getElementById('report-generate-btn');
    const oldText = generateBtn?.textContent || '';
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generando...';
    }

    try {
      const parsedFilters = collectFiltersFromForm('report');
      const queryFilters = {
        category: parsedFilters.category,
        startDate: parsedFilters.startDate,
        endDate: parsedFilters.endDate,
      };

      const expenses = await fetchAllFilteredExpenses(queryFilters);
      if (!expenses.length) {
        Api.showAlert('report-form-alert', 'No hay gastos para generar reporte con esos filtros.', 'error');
        return;
      }

      const filterSummary = buildFilterSummary(parsedFilters);
      const exportJson = buildExportJson(expenses, filterSummary);
      await generateReportPdf(exportJson);

      closeReportModal();
      Api.showAlert('expenses-alert', 'Reporte PDF generado correctamente.', 'success');
    } catch (err) {
      Api.showAlert('report-form-alert', err.message || 'No se pudo generar el reporte.', 'error');
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = oldText;
      }
    }
  }

  async function generateReportPdf(exportJson) {
    if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
      throw new Error('No se pudo cargar la libreria PDF.');
    }

    const metrics = buildReportMetrics(exportJson.items);
    const insights = buildInsights(exportJson.items, metrics);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait' });
    await ensurePdfBranding(doc);
    const nowText = new Date(exportJson.generadoEn).toLocaleString('es-AR');

    drawPdfHeader(doc, {
      title: 'Reporte financiero',
      subtitle: `Resumen visual y metricas clave · ${nowText}`,
      logoDataUrl: cachedLogoDataUrl,
    });

    const filterLines = [
      `Categoria: ${exportJson.filtros.Categoria}`,
      `Periodo: ${exportJson.filtros.Periodo}`,
      `Desde: ${exportJson.filtros.Desde}`,
      `Hasta: ${exportJson.filtros.Hasta}`,
    ];

    drawSectionTitle(doc, 'Filtros aplicados', 14, 32);
    drawFilterPanel(doc, {
      Categoria: exportJson.filtros.Categoria,
      Periodo: exportJson.filtros.Periodo,
      Desde: exportJson.filtros.Desde,
      Hasta: exportJson.filtros.Hasta,
    }, 14, 36, 182);

    const yMetrics = 63;
    drawSectionTitle(doc, 'Metricas principales', 14, yMetrics);
    drawMetricCards(doc, [
      { label: 'Total gastado', value: formatMoney(metrics.total), tone: 'primary' },
      { label: 'Cantidad', value: String(metrics.count), tone: 'secondary' },
      { label: 'Promedio', value: formatMoney(metrics.avg), tone: 'neutral' },
      { label: 'Ticket mas alto', value: `${formatMoney(metrics.maxAmount)} · ${metrics.maxMerchant}`, tone: 'neutral' },
    ], 14, yMetrics + 4, 182);

    drawHorizontalBarChart(doc, {
      title: 'Top categorias por monto',
      data: metrics.byCategory.slice(0, 6),
      x: 14,
      y: 108,
      width: 182,
      height: 68,
      color: PDF_THEME.primary,
    });

    drawHorizontalBarChart(doc, {
      title: 'Top comercios por monto',
      data: metrics.byMerchant.slice(0, 6),
      x: 14,
      y: 184,
      width: 182,
      height: 68,
      color: PDF_THEME.secondary,
    });

    drawInsightsPanel(doc, insights, 14, 260, 182);

    drawPdfFooter(doc, 'GastosApp · Reporte');

    doc.addPage();
    drawPdfHeader(doc, {
      title: 'Detalle de movimientos',
      subtitle: `Tabla completa de ${metrics.count} gasto(s)`,
      logoDataUrl: cachedLogoDataUrl,
    });

    const body = exportJson.items.map((i) => [
      i.Comercio,
      i.Categoria,
      i.Descripcion || '-',
      i.Fecha,
      formatMoney(i.Monto),
    ]);

    doc.autoTable({
      head: [['Comercio', 'Categoria', 'Descripcion', 'Fecha', 'Monto']],
      body,
      startY: 28,
      theme: 'grid',
      styles: {
        fontSize: 8.4,
        lineColor: PDF_THEME.border,
        lineWidth: 0.1,
        textColor: PDF_THEME.text,
        cellPadding: 2.2,
      },
      headStyles: {
        fillColor: PDF_THEME.primary,
        textColor: PDF_THEME.white,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [251, 253, 255],
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 29 },
        2: { cellWidth: 76 },
        3: { cellWidth: 24 },
        4: { halign: 'right', cellWidth: 20 },
      },
      didDrawPage: () => {
        drawPdfFooter(doc, 'GastosApp · Reporte');
      },
    });

    doc.save('Gastos-Reporte.pdf');
  }

  function buildReportMetrics(items) {
    const count = items.length;
    const total = items.reduce((acc, item) => acc + Number(item.Monto || 0), 0);
    const avg = count ? total / count : 0;

    let maxAmount = 0;
    let maxMerchant = '-';
    const categoryTotals = {};
    const merchantTotals = {};

    items.forEach((item) => {
      const amount = Number(item.Monto || 0);
      if (amount > maxAmount) {
        maxAmount = amount;
        maxMerchant = item.Comercio || '-';
      }

      categoryTotals[item.Categoria] = (categoryTotals[item.Categoria] || 0) + amount;
      merchantTotals[item.Comercio] = (merchantTotals[item.Comercio] || 0) + amount;
    });

    return {
      count,
      total,
      avg,
      maxAmount,
      maxMerchant,
      byCategory: toSortedPairs(categoryTotals),
      byMerchant: toSortedPairs(merchantTotals),
    };
  }

  function buildInsights(items, metrics) {
    const insights = [];

    if (metrics.byCategory.length) {
      const topCategory = metrics.byCategory[0];
      const pct = metrics.total > 0 ? ((topCategory.value / metrics.total) * 100) : 0;
      insights.push(`La categoria ${topCategory.label} concentra ${pct.toFixed(1)}% del gasto total.`);
    }

    if (metrics.byMerchant.length) {
      const topMerchant = metrics.byMerchant[0];
      insights.push(`El comercio con mayor impacto es ${topMerchant.label} con ${formatMoney(topMerchant.value)} acumulados.`);
    }

    const perDay = {};
    items.forEach((item) => {
      const day = item.Fecha || '-';
      perDay[day] = (perDay[day] || 0) + Number(item.Monto || 0);
    });
    const topDay = toSortedPairs(perDay)[0];
    if (topDay) {
      insights.push(`El dia de mayor gasto fue ${topDay.label} con ${formatMoney(topDay.value)}.`);
    }

    return insights.slice(0, 3);
  }

  function toSortedPairs(mapObj) {
    return Object.entries(mapObj)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  function drawHorizontalBarChart(doc, cfg) {
    const x = cfg.x;
    const y = cfg.y;
    const width = cfg.width;
    const height = cfg.height;
    const data = cfg.data || [];
    const color = cfg.color || [15, 111, 255];

    const cardPadding = 4;
    doc.setDrawColor(PDF_THEME.border[0], PDF_THEME.border[1], PDF_THEME.border[2]);
    doc.setFillColor(PDF_THEME.bgSoft[0], PDF_THEME.bgSoft[1], PDF_THEME.bgSoft[2]);
    doc.roundedRect(x, y - 2, width, height + 6, 2, 2, 'FD');

    setPdfFont(doc, 'semibold');
    doc.setTextColor(PDF_THEME.text[0], PDF_THEME.text[1], PDF_THEME.text[2]);
    doc.setFontSize(10);
    doc.text(cfg.title || '', x + cardPadding, y + 3);

    if (!data.length) {
      doc.setFontSize(9);
      doc.setTextColor(PDF_THEME.textMuted[0], PDF_THEME.textMuted[1], PDF_THEME.textMuted[2]);
      doc.text('Sin datos para mostrar.', x + cardPadding, y + 12);
      doc.setTextColor(0, 0, 0);
      return;
    }

    const chartTop = y + 8;
    const rowHeight = Math.max(8, Math.floor((height - 8) / data.length));
    const maxVal = Math.max(...data.map((d) => d.value), 1);

    data.forEach((d, idx) => {
      const rowY = chartTop + (idx * rowHeight);
      const barStart = x + 56;
      const barMax = width - 72;
      const barWidth = ((d.value / maxVal) * barMax);
      const label = String(d.label || '-').slice(0, 22);

      setPdfFont(doc, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(PDF_THEME.textMuted[0], PDF_THEME.textMuted[1], PDF_THEME.textMuted[2]);
      doc.text(label, x + cardPadding, rowY + 4);
      doc.setFillColor(230, 238, 249);
      doc.rect(barStart, rowY, barMax, 5, 'F');
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(barStart, rowY, barWidth, 5, 'F');
      doc.setTextColor(PDF_THEME.text[0], PDF_THEME.text[1], PDF_THEME.text[2]);
      doc.text(formatMoney(d.value), barStart + barMax + 2, rowY + 4);
      doc.setTextColor(0, 0, 0);
    });
  }

  function drawPdfHeader(doc, cfg) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(PDF_THEME.primary[0], PDF_THEME.primary[1], PDF_THEME.primary[2]);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(PDF_THEME.primaryStrong[0], PDF_THEME.primaryStrong[1], PDF_THEME.primaryStrong[2]);
    doc.rect(pageWidth - 66, 0, 66, 24, 'F');

    doc.setTextColor(PDF_THEME.white[0], PDF_THEME.white[1], PDF_THEME.white[2]);
    setPdfFont(doc, 'semibold');
    doc.setFontSize(16);
    doc.text(cfg.title || 'Documento', 14, 11);
    setPdfFont(doc, 'normal');
    doc.setFontSize(9.5);
    doc.text(cfg.subtitle || '', 14, 18);
    doc.setFontSize(9);
    doc.text('GastosApp', pageWidth - 18, 11, { align: 'right' });
    if (cfg.logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 34, 5, 10, 10, 2, 2, 'F');
      doc.addImage(cfg.logoDataUrl, 'PNG', pageWidth - 33, 6, 8, 8);
    }
    doc.setTextColor(0, 0, 0);
  }

  function drawSectionTitle(doc, title, x, y) {
    setPdfFont(doc, 'semibold');
    doc.setTextColor(PDF_THEME.text[0], PDF_THEME.text[1], PDF_THEME.text[2]);
    doc.setFontSize(11.5);
    doc.text(title, x, y);
  }

  function drawFilterPanel(doc, filters, x, y, width) {
    const entries = Object.entries(filters || {});
    const cardW = (width - 8) / 2;
    const cardH = 9;

    entries.forEach(([key, value], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = x + (col * (cardW + 8));
      const py = y + (row * (cardH + 4));

      doc.setFillColor(PDF_THEME.bgChip[0], PDF_THEME.bgChip[1], PDF_THEME.bgChip[2]);
      doc.setDrawColor(PDF_THEME.border[0], PDF_THEME.border[1], PDF_THEME.border[2]);
      doc.roundedRect(px, py, cardW, cardH, 2, 2, 'FD');
      setPdfFont(doc, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(PDF_THEME.textMuted[0], PDF_THEME.textMuted[1], PDF_THEME.textMuted[2]);
      doc.text(String(key), px + 3, py + 3.2);
      doc.setTextColor(PDF_THEME.text[0], PDF_THEME.text[1], PDF_THEME.text[2]);
      doc.text(String(value || '-').slice(0, 42), px + 3, py + 7.2);
    });
    doc.setTextColor(0, 0, 0);
  }

  function drawMetricCards(doc, metrics, x, y, width) {
    const cols = 2;
    const gap = 6;
    const cardW = (width - gap) / cols;
    const cardH = 16;

    metrics.forEach((metric, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const px = x + (col * (cardW + gap));
      const py = y + (row * (cardH + 4));

      const tone = metric.tone === 'primary'
        ? PDF_THEME.primary
        : metric.tone === 'secondary'
          ? PDF_THEME.secondary
          : PDF_THEME.bgChip;

      doc.setFillColor(tone[0], tone[1], tone[2]);
      doc.setDrawColor(PDF_THEME.border[0], PDF_THEME.border[1], PDF_THEME.border[2]);
      doc.roundedRect(px, py, cardW, cardH, 2, 2, 'FD');

      const lightText = metric.tone === 'primary' || metric.tone === 'secondary';
      const labelColor = lightText ? PDF_THEME.white : PDF_THEME.textMuted;
      const valueColor = lightText ? PDF_THEME.white : PDF_THEME.text;

      doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
      setPdfFont(doc, 'normal');
      doc.setFontSize(8.5);
      doc.text(metric.label, px + 3, py + 5.2);
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
      setPdfFont(doc, 'semibold');
      doc.setFontSize(10);
      doc.text(String(metric.value).slice(0, 34), px + 3, py + 11.5);
    });
    doc.setTextColor(0, 0, 0);
  }

  function drawInsightsPanel(doc, insights, x, y, width) {
    doc.setFillColor(PDF_THEME.bgSoft[0], PDF_THEME.bgSoft[1], PDF_THEME.bgSoft[2]);
    doc.setDrawColor(PDF_THEME.border[0], PDF_THEME.border[1], PDF_THEME.border[2]);
    doc.roundedRect(x, y, width, 24, 2, 2, 'FD');
    setPdfFont(doc, 'semibold');
    doc.setFontSize(10.5);
    doc.setTextColor(PDF_THEME.text[0], PDF_THEME.text[1], PDF_THEME.text[2]);
    doc.text('Insights automaticos', x + 4, y + 5.5);

    setPdfFont(doc, 'normal');
    doc.setFontSize(8.7);
    if (!insights.length) {
      doc.setTextColor(PDF_THEME.textMuted[0], PDF_THEME.textMuted[1], PDF_THEME.textMuted[2]);
      doc.text('- Sin insights disponibles para este rango.', x + 4, y + 12);
      doc.setTextColor(0, 0, 0);
      return;
    }

    insights.forEach((line, idx) => {
      const yy = y + 11 + (idx * 4.2);
      doc.setTextColor(PDF_THEME.textMuted[0], PDF_THEME.textMuted[1], PDF_THEME.textMuted[2]);
      doc.text('-', x + 4, yy);
      doc.setTextColor(PDF_THEME.text[0], PDF_THEME.text[1], PDF_THEME.text[2]);
      doc.text(String(line).slice(0, 110), x + 7, yy);
    });
    doc.setTextColor(0, 0, 0);
  }

  function drawPdfFooter(doc, leftText) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const page = doc.internal.getCurrentPageInfo().pageNumber;
    const total = doc.internal.getNumberOfPages();

    doc.setDrawColor(PDF_THEME.border[0], PDF_THEME.border[1], PDF_THEME.border[2]);
    doc.line(10, pageHeight - 8, pageWidth - 10, pageHeight - 8);
    setPdfFont(doc, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(PDF_THEME.textMuted[0], PDF_THEME.textMuted[1], PDF_THEME.textMuted[2]);
    doc.text(leftText || 'GastosApp', 12, pageHeight - 4);
    doc.text(`Pagina ${page} de ${total}`, pageWidth - 12, pageHeight - 4, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  function formatMoney(value) {
    const user = Api.getUser();
    const currency = user?.currency || 'ARS';
    const localeMap = {
      ARS: 'es-AR',
      USD: 'en-US',
      EUR: 'es-ES',
      BRL: 'pt-BR',
      CLP: 'es-CL',
      MXN: 'es-MX',
      UYU: 'es-UY',
      GBP: 'en-GB',
    };
    const locale = localeMap[currency] || 'es-AR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  async function ensurePdfBranding(doc) {
    await ensurePdfFont(doc);
    if (!cachedLogoDataUrl) {
      cachedLogoDataUrl = await loadLogoDataUrl();
    }
  }

  async function ensurePdfFont(doc) {
    try {
      if (!cachedManropeBase64) {
        const response = await fetch('assets/fonts/Manrope-Variable.ttf');
        if (!response.ok) throw new Error('Font not found');
        const buffer = await response.arrayBuffer();
        cachedManropeBase64 = arrayBufferToBase64(buffer);
      }

      doc.addFileToVFS('Manrope-Regular.ttf', cachedManropeBase64);
      doc.addFont('Manrope-Regular.ttf', 'Manrope', 'normal');
      doc.addFileToVFS('Manrope-Semibold.ttf', cachedManropeBase64);
      doc.addFont('Manrope-Semibold.ttf', 'Manrope', 'bold');
      setPdfFont(doc, 'normal');
    } catch {
      doc.setFont('helvetica', 'normal');
    }
  }

  function setPdfFont(doc, weight = 'normal') {
    try {
      doc.setFont('Manrope', weight === 'semibold' ? 'bold' : 'normal');
    } catch {
      doc.setFont('helvetica', weight === 'semibold' ? 'bold' : 'normal');
    }
  }

  async function loadLogoDataUrl() {
    try {
      const response = await fetch('assets/logo.png');
      if (!response.ok) return null;
      const blob = await response.blob();
      return await blobToDataURL(blob);
    } catch {
      return null;
    }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
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
