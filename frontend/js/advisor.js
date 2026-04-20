/**
 * advisor.js – Panel del asesor financiero
 * Solo accesible para usuarios con rol ADVISOR.
 */

const Advisor = (() => {

  let allUsers          = [];
  let selectedUser      = null;
  let advisorCharts     = {};

  // ── Init ──────────────────────────────────────────────────────────
  async function init() {
    await loadUsers();
    bindSearch();
    bindRecommendationModal();
    document.getElementById('btn-report')?.addEventListener('click', generatePDF);
    document.getElementById('btn-summary')?.addEventListener('click', copySummaryToClipboard);

    document.addEventListener('app-theme-changed', () => {
      if (selectedUser?.id) {
        loadUserAnalytics(selectedUser.id);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // USERS LIST
  // ══════════════════════════════════════════════════════════════════
  async function loadUsers() {
    const grid = document.getElementById('users-grid');
    if (!grid) return;

    try {
      const users = await Api.get('/users');
      allUsers = users.filter((u) => u.role === 'USER'); // show only regular users
      renderUsersGrid(allUsers);
    } catch (err) {
      grid.innerHTML = `<div class="empty-state-sm">Error cargando usuarios: ${Api.escapeHtml(err.message)}</div>`;
    }
  }

  function renderUsersGrid(users) {
    const grid = document.getElementById('users-grid');
    if (!grid) return;

    if (!users.length) {
      grid.innerHTML = '<div class="empty-state-sm">No hay usuarios registrados aún.</div>';
      return;
    }

    grid.innerHTML = users.map((u) => `
      <div class="user-card" onclick="Advisor.selectUser('${u.id}')">
        <div class="user-avatar">${Api.getInitials(u.name)}</div>
        <div class="user-card-info">
          <div class="user-card-name">${Api.escapeHtml(u.name)}</div>
          <div class="user-card-email">${Api.escapeHtml(u.email)}</div>
          <div class="user-card-meta">
            ${u._count?.expenses || 0} gasto${u._count?.expenses !== 1 ? 's' : ''}
            &nbsp;·&nbsp;
            ${u._count?.tickets || 0} ticket${u._count?.tickets !== 1 ? 's' : ''}
          </div>
        </div>
      </div>`).join('');
  }

  function bindSearch() {
    document.getElementById('user-search')?.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      const filtered = allUsers.filter((u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
      renderUsersGrid(filtered);
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // USER DETAIL
  // ══════════════════════════════════════════════════════════════════
  async function selectUser(userId) {
    selectedUser = allUsers.find((u) => u.id === userId);
    if (!selectedUser) return;

    // Show detail panel, hide users grid
    document.getElementById('user-detail-panel')?.classList.remove('hidden');
    document.getElementById('users-grid')?.closest('.section')?.classList.add('hidden');

    // Fill header
    document.getElementById('detail-avatar').textContent    = Api.getInitials(selectedUser.name);
    document.getElementById('detail-user-name').textContent = selectedUser.name;
    document.getElementById('detail-user-email').textContent = selectedUser.email;

    // Load analytics and recommendations in parallel
    await Promise.all([
      loadUserAnalytics(userId),
      loadUserRecommendations(userId),
      loadUserPatterns(userId),
    ]);

    // Bind back button
    document.getElementById('btn-back-users')?.addEventListener('click', backToUsers);
    document.getElementById('btn-auto-recommend')?.addEventListener('click', () => autoRecommend(userId));
    document.getElementById('btn-open-rec-form')?.addEventListener('click', openRecommendationModal);
  }

  function backToUsers() {
    document.getElementById('user-detail-panel')?.classList.add('hidden');
    document.getElementById('users-grid')?.closest('.section')?.classList.remove('hidden');
    selectedUser = null;
    destroyAllCharts();
  }

  async function loadUserAnalytics(userId) {
    try {
      const data = await Api.get(`/expenses/analytics/${userId}`);

      // Fill stat cards
      document.getElementById('detail-total').textContent  = Api.formatCurrency(data.currentMonth?.total || 0);
      document.getElementById('detail-count').textContent  = data.currentMonth?.count || 0;
      document.getElementById('detail-avg').textContent    = Api.formatCurrency(data.averageExpense || 0);

      const g = data.monthGrowth || 0;
      const growthEl = document.getElementById('detail-growth');
      if (growthEl) {
        growthEl.textContent = `${g > 0 ? '▲' : g < 0 ? '▼' : '─'} ${Math.abs(g).toFixed(1)}%`;
        growthEl.style.color = g > 10 ? 'var(--color-danger)' : g < -10 ? 'var(--color-success)' : 'var(--text-primary)';
      }

      renderAdvisorCategoryChart(data.byCategory);
      renderAdvisorMonthlyChart(data.monthlyData);
    } catch (err) {
      console.error('Error cargando analytics del usuario:', err);
    }
  }

  function renderAdvisorCategoryChart(byCategory) {
    const canvas = document.getElementById('advisor-chart-category');
    if (!canvas || !byCategory?.length) return;

    destroyChart('category');

    const labels = byCategory.map((c) => Api.categoryLabel(c.category).replace(/^\S+\s/, ''));
    const values = byCategory.map((c) => c.total);

    const palette = getChartPalette();

    advisorCharts.category = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.categories,
          borderWidth: 2,
          borderColor: palette.border,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: palette.text, font: { size: 11 }, padding: 10 } },
          tooltip: { callbacks: { label: (ctx) => ` ${Api.formatCurrency(ctx.raw)}` } },
        },
      },
    });
  }

  function renderAdvisorMonthlyChart(monthlyData) {
    const canvas = document.getElementById('advisor-chart-monthly');
    if (!canvas) return;

    destroyChart('monthly');

    const labels = (monthlyData || []).map((m) => {
      const [year, month] = m.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    });

    const palette = getChartPalette();

    advisorCharts.monthly = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Gastos',
          data: (monthlyData || []).map((m) => m.total),
          backgroundColor: palette.bar,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${Api.formatCurrency(ctx.raw)}` } },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `$${(v / 1000).toFixed(0)}k`, color: palette.text },
            grid: { color: palette.grid },
          },
          x: { ticks: { color: palette.text }, grid: { display: false } },
        },
      },
    });
  }

  async function loadUserPatterns(userId) {
    const trendsList = document.getElementById('trends-list');
    if (!trendsList) return;

    try {
      const data = await Api.get(`/expenses/patterns/${userId}`);
      const trends = data.trends || [];

      if (!trends.length) {
        trendsList.innerHTML = '<div class="empty-state-sm">No hay suficientes datos para detectar tendencias.</div>';
        return;
      }

      trendsList.innerHTML = trends.map((t) => {
        const arrow = t.trend === 'increasing' ? '▲' : t.trend === 'decreasing' ? '▼' : '─';
        const changeClass = t.trend === 'increasing' ? 'positive' : t.trend === 'decreasing' ? 'negative' : '';
        return `
          <div class="trend-item">
            <span class="trend-arrow">${arrow}</span>
            <span class="trend-category">${Api.categoryLabel(t.category).replace(/^\S+\s/, '')}</span>
            <span class="trend-change ${changeClass}">${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}%</span>
          </div>`;
      }).join('');
    } catch (err) {
      trendsList.innerHTML = '<div class="empty-state-sm">Error cargando tendencias.</div>';
    }
  }

  async function loadUserRecommendations(userId) {
    const list = document.getElementById('advisor-recs-list');
    if (!list) return;

    try {
      const recs = await Api.get(`/recommendations/${userId}`);

      if (!recs.length) {
        list.innerHTML = '<div class="empty-state-sm">Sin recomendaciones para este usuario.</div>';
        return;
      }

      list.innerHTML = recs.map((r) => `
        <div class="rec-item rec-${r.type}">
          ${Api.escapeHtml(r.message)}
          <div class="rec-meta">
            <span>${r.advisor ? Api.escapeHtml(r.advisor.name) : 'Sistema'}</span>
            <span>${Api.formatRelativeDate(r.createdAt)}</span>
          </div>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = '<div class="empty-state-sm">Error cargando recomendaciones.</div>';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // AUTO-GENERATE RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════════════
  async function autoRecommend(userId) {
    const btn = document.getElementById('btn-auto-recommend');
    if (!btn) return;

    btn.disabled    = true;
    btn.textContent = 'Generando...';

    try {
      const recs = await Api.post(`/recommendations/auto-generate/${userId}`, {});
      await loadUserRecommendations(userId);
      alert(`Se generaron ${recs.length} recomendacion(es) automaticamente.`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Generar recomendaciones automáticas';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // MANUAL RECOMMENDATION MODAL
  // ══════════════════════════════════════════════════════════════════
  function bindRecommendationModal() {
    document.getElementById('rec-modal-close')?.addEventListener('click', closeRecModal);
    document.getElementById('rec-cancel-btn')?.addEventListener('click', closeRecModal);
    document.getElementById('rec-modal')?.querySelector('.modal-backdrop')
      ?.addEventListener('click', closeRecModal);
    document.getElementById('rec-save-btn')?.addEventListener('click', saveRecommendation);
  }

  function openRecommendationModal() {
    document.getElementById('rec-form')?.reset();
    Api.hideAlert('rec-alert');
    document.getElementById('rec-modal').classList.remove('hidden');
  }

  function closeRecModal() {
    document.getElementById('rec-modal').classList.add('hidden');
  }

  async function saveRecommendation() {
    const alertEl = 'rec-alert';
    const message = document.getElementById('rec-message').value.trim();
    const type    = document.getElementById('rec-type').value;

    if (!message) return Api.showAlert(alertEl, 'El mensaje es obligatorio.', 'error');
    if (!selectedUser) return Api.showAlert(alertEl, 'No hay usuario seleccionado.', 'error');

    const btn = document.getElementById('rec-save-btn');
    btn.disabled    = true;
    btn.textContent = 'Enviando...';

    try {
      await Api.post('/recommendations', {
        userId: selectedUser.id,
        message,
        type,
      });
      closeRecModal();
      await loadUserRecommendations(selectedUser.id);
      Api.showAlert('rec-alert', 'Recomendación enviada.', 'success');
    } catch (err) {
      Api.showAlert(alertEl, err.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Enviar recomendación';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PDF REPORT
  // ══════════════════════════════════════════════════════════════════
  async function generatePDF() {
    if (!selectedUser) {
      alert('Seleccioná un usuario antes de generar el reporte.');
      return;
    }
    const btn = document.getElementById('btn-report');
    const btnText = btn?.querySelector('.btn-text');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Generando PDF...';

    try {
      const [analyticsData, recsData, patternsData] = await Promise.all([
        Api.get(`/expenses/analytics/${selectedUser.id}`),
        Api.get(`/recommendations/${selectedUser.id}`),
        Api.get(`/expenses/patterns/${selectedUser.id}`),
      ]);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const today    = new Date().toLocaleDateString('es-AR');
      const todayISO = new Date().toISOString().split('T')[0];
      const blue      = [15, 111, 255];
      const white     = [255, 255, 255];
      const lightGray = [248, 249, 252];
      const darkText  = [30, 41, 59];

      // ── PAGE 1 ───────────────────────────────────────────────────
      // Header
      doc.setFillColor(...blue);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('GastosApp', 14, 13);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Reporte financiero de cliente', 14, 21);
      doc.text(today, 196, 21, { align: 'right' });

      // Client card
      doc.setFillColor(...lightGray);
      doc.roundedRect(14, 34, 182, 22, 3, 3, 'F');
      doc.setTextColor(...darkText);
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text(selectedUser.name, 22, 44);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(selectedUser.email, 22, 51);

      // 4 metric boxes
      const g = analyticsData.monthGrowth || 0;
      const metrics = [
        { label: 'Total del mes',    value: Api.formatCurrency(analyticsData.currentMonth?.total || 0) },
        { label: 'Cant. de gastos',  value: String(analyticsData.currentMonth?.count || 0) },
        { label: 'Gasto promedio',   value: Api.formatCurrency(analyticsData.averageExpense || 0) },
        { label: 'Variación mensual', value: `${g > 0 ? '+' : ''}${g.toFixed(1)}%` },
      ];
      metrics.forEach((m, i) => {
        const x = 14 + i * 46;
        doc.setFillColor(240, 244, 255);
        doc.roundedRect(x, 62, 42, 22, 2, 2, 'F');
        doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.text(m.label, x + 21, 69, { align: 'center' });
        doc.setTextColor(...blue); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(m.value, x + 21, 79, { align: 'center' });
      });

      // Category table
      doc.setTextColor(...darkText); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Gastos por categoría', 14, 96);
      const totalSpent = analyticsData.currentMonth?.total || 1;
      const catRows = (analyticsData.byCategory || []).map((c) => [
        Api.categoryLabel(c.category).replace(/^\S+\s/, ''),
        String(c.count),
        Api.formatCurrency(c.total),
        `${Math.round((c.total / totalSpent) * 100)}%`,
      ]);
      doc.autoTable({
        startY: 100,
        head: [['Categoría', 'Gastos', 'Total', '% del mes']],
        body: catRows.length ? catRows : [['Sin datos', '-', '-', '-']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: lightGray },
        margin: { left: 14, right: 14 },
      });

      // ── PAGE 2 ───────────────────────────────────────────────────
      doc.addPage();
      doc.setFillColor(...blue);
      doc.rect(0, 0, 210, 14, 'F');
      doc.setTextColor(...white); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`GastosApp — Reporte: ${selectedUser.name}`, 14, 9);
      doc.text('Pág. 2', 196, 9, { align: 'right' });

      // Monthly evolution
      doc.setTextColor(...darkText); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Evolución mensual (últimos 6 meses)', 14, 24);
      const monthRows = (analyticsData.monthlyData || []).slice(-6).map((m) => {
        const [yr, mo] = m.month.split('-');
        return [new Date(yr, mo - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }), Api.formatCurrency(m.total)];
      });
      doc.autoTable({
        startY: 28,
        head: [['Mes', 'Total gastado']],
        body: monthRows.length ? monthRows : [['Sin datos', '-']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: lightGray },
        margin: { left: 14, right: 14 },
      });

      const afterMonthly = doc.lastAutoTable.finalY + 10;

      // Trends
      doc.setTextColor(...darkText); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Tendencias por categoría', 14, afterMonthly);
      const trendRows = (patternsData.trends || []).map((t) => [
        Api.categoryLabel(t.category).replace(/^\S+\s/, ''),
        t.trend === 'increasing' ? '▲' : t.trend === 'decreasing' ? '▼' : '─',
        `${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}%`,
      ]);
      doc.autoTable({
        startY: afterMonthly + 4,
        head: [['Categoría', 'Tendencia', 'Cambio %']],
        body: trendRows.length ? trendRows : [['Sin datos', '-', '-']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: lightGray },
        margin: { left: 14, right: 14 },
      });

      const afterTrends = doc.lastAutoTable.finalY + 10;

      // Recommendations
      doc.setTextColor(...darkText); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Recomendaciones del asesor', 14, afterTrends);
      const recRows = (recsData || []).map((r) => [
        r.type,
        r.message.length > 80 ? r.message.substring(0, 80) + '...' : r.message,
        new Date(r.createdAt).toLocaleDateString('es-AR'),
      ]);
      doc.autoTable({
        startY: afterTrends + 4,
        head: [['Tipo', 'Mensaje', 'Fecha']],
        body: recRows.length ? recRows : [['Sin recomendaciones', '-', '-']],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: lightGray },
        columnStyles: { 1: { cellWidth: 120 } },
        margin: { left: 14, right: 14 },
      });

      doc.save(`Reporte_${selectedUser.name.replace(/\s+/g, '_')}_${todayISO}.pdf`);
    } catch (err) {
      alert(`Error generando PDF: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Nuevo reporte';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // CLIPBOARD SUMMARY
  // ══════════════════════════════════════════════════════════════════
  async function copySummaryToClipboard() {
    if (!selectedUser) {
      alert('Seleccioná un usuario antes de copiar el resumen.');
      return;
    }
    const btn = document.getElementById('btn-summary');
    const btnText = btn?.querySelector('.btn-text');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Copiando...';

    try {
      const [analyticsData, recsData] = await Promise.all([
        Api.get(`/expenses/analytics/${selectedUser.id}`),
        Api.get(`/recommendations/${selectedUser.id}`),
      ]);

      const g          = analyticsData.monthGrowth || 0;
      const total      = analyticsData.currentMonth?.total || 0;
      const topCats    = (analyticsData.byCategory || []).slice(0, 5);
      const totalSpent = total || 1;

      let text = `*Resumen financiero — ${selectedUser.name}*\n`;
      text += `_Generado por GastosApp — ${new Date().toLocaleDateString('es-AR')}_\n\n`;
      text += `*Total del mes:* ${Api.formatCurrency(total)}\n`;
      text += `*Variación:* ${g > 0 ? '+' : ''}${g.toFixed(1)}% respecto al mes anterior\n\n`;
      text += `*Top categorías:*\n`;
      topCats.forEach((c) => {
        const pct = Math.round((c.total / totalSpent) * 100);
        text += `• ${Api.categoryLabel(c.category).replace(/^\S+\s/, '')}: ${Api.formatCurrency(c.total)} (${pct}%)\n`;
      });

      const activeRecs = (recsData || []).slice(0, 3);
      if (activeRecs.length) {
        text += `\n*Últimas recomendaciones:*\n`;
        activeRecs.forEach((r) => { text += `• [${r.type}] ${r.message}\n`; });
      }

      await navigator.clipboard.writeText(text);
      if (btnText) btnText.textContent = '✓ Copiado';
      setTimeout(() => { if (btnText) btnText.textContent = 'Enviar resumen'; }, 2000);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────
  function destroyChart(key) {
    if (advisorCharts[key]) { advisorCharts[key].destroy(); delete advisorCharts[key]; }
  }

  function destroyAllCharts() {
    Object.keys(advisorCharts).forEach((k) => { advisorCharts[k]?.destroy(); });
    advisorCharts = {};
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name)?.trim();
    return value || fallback;
  }

  function getChartPalette() {
    return {
      text: cssVar('--chart-text', '#4d5f77'),
      grid: cssVar('--chart-grid', '#e5edf8'),
      bar: cssVar('--chart-bar', 'rgba(15,111,255,.78)'),
      border: cssVar('--chart-border', '#ffffff'),
      categories: [
        cssVar('--chart-cat-1', '#0f6fff'),
        cssVar('--chart-cat-2', '#13a58b'),
        cssVar('--chart-cat-3', '#da8b19'),
        cssVar('--chart-cat-4', '#dc3f4e'),
        cssVar('--chart-cat-5', '#6f57e9'),
        cssVar('--chart-cat-6', '#2f8fff'),
        cssVar('--chart-cat-7', '#1cbb9f'),
        cssVar('--chart-cat-8', '#ff8b3d'),
        cssVar('--chart-cat-9', '#9c58f2'),
        cssVar('--chart-cat-10', '#50739e'),
      ],
    };
  }

  return { init, selectUser, backToUsers };
})();

window.Advisor = Advisor;
