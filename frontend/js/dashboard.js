/**
 * dashboard.js – Dashboard principal con gráficos y resumen de gastos
 */

const Dashboard = (() => {

  let charts = {};
  let cachedAnalytics = null;

  async function init() {
    // Update greeting
    const user = Api.getUser();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const greetEl = document.getElementById('greeting');
    if (greetEl) greetEl.textContent = `${greeting}, ${user?.name?.split(' ')[0] || ''}!`;

    await Promise.all([
      loadAnalytics(),
      loadRecentExpenses(),
      loadRecommendations(),
      loadSidebarMovements(),
    ]);

    document.addEventListener('app-theme-changed', () => {
      if (!cachedAnalytics) return;
      renderStatCards(cachedAnalytics);
      renderCategoryChart(cachedAnalytics.byCategory);
      renderMonthlyChart(cachedAnalytics.monthlyData);
      renderMerchantList(cachedAnalytics.topMerchants);
    });
  }

  // ── Analytics & Charts ────────────────────────────────────────────
  async function loadAnalytics() {
    try {
      const data = await Api.get('/expenses/analytics');
      cachedAnalytics = data;
      renderStatCards(data);
      renderCategoryChart(data.byCategory);
      renderMonthlyChart(data.monthlyData);
      renderMerchantList(data.topMerchants);
      renderSidebarInsights(data);

      // Show unusual expenses alert if any
      if (data.unusualExpenses && data.unusualExpenses.length > 0) {
        showUnusualModal(data.unusualExpenses);
      }
    } catch (err) {
      console.error('Error cargando analytics:', err);
    }
  }

  function renderStatCards(data) {
    // Total this month
    const totalEl = document.getElementById('stat-month-total');
    if (totalEl) totalEl.textContent = Api.formatCurrency(data.currentMonth?.total || 0);

    // Growth badge
    const growthEl = document.getElementById('stat-month-growth');
    if (growthEl && data.monthGrowth !== undefined) {
      const g = data.monthGrowth;
      growthEl.textContent = `${g > 0 ? '+' : ''}${g.toFixed(1)}% vs mes ant.`;
      growthEl.className = `stat-badge ${g > 0 ? 'negative' : 'positive'}`;
    }

    // Count
    const countEl = document.getElementById('stat-count');
    if (countEl) countEl.textContent = data.currentMonth?.count || 0;

    // Average
    const avgEl = document.getElementById('stat-avg');
    if (avgEl) avgEl.textContent = Api.formatCurrency(data.averageExpense || 0);

    // Top merchant
    const merchantEl = document.getElementById('stat-top-merchant');
    if (merchantEl && data.topMerchants?.length > 0) {
      merchantEl.textContent = data.topMerchants[0].merchant;
    }

    // Income + available (only shown if user configured monthly income)
    const user = Api.getUser();
    if (user?.monthlyIncome) {
      const spent     = data.currentMonth?.total || 0;
      const available = user.monthlyIncome - spent;
      const pct       = Math.round((spent / user.monthlyIncome) * 100);

      const incomeCard = document.getElementById('stat-income-card');
      const availCard  = document.getElementById('stat-available-card');
      if (incomeCard) incomeCard.style.display = '';
      if (availCard)  availCard.style.display  = '';

      const incomeEl = document.getElementById('stat-income');
      if (incomeEl) incomeEl.textContent = Api.formatCurrency(user.monthlyIncome);

      const availEl = document.getElementById('stat-available');
      if (availEl) {
        availEl.textContent = Api.formatCurrency(available);
        availEl.style.color = available < 0 ? 'var(--color-danger)' : available < user.monthlyIncome * 0.1 ? 'var(--color-warning)' : 'var(--color-success)';
      }

      const availBadge = document.getElementById('stat-available-badge');
      if (availBadge) {
        availBadge.textContent = `${pct}% usado`;
        availBadge.className   = `stat-badge ${available < 0 ? 'negative' : available < user.monthlyIncome * 0.1 ? 'warning' : 'positive'}`;
      }
    }
  }

  function renderCategoryChart(byCategory) {
    const canvas = document.getElementById('chart-category');
    if (!canvas || !byCategory?.length) return;

    destroyChart('category');

    const labels = byCategory.map((c) => Api.categoryLabel(c.category).replace(/^\S+\s/, ''));
    const values = byCategory.map((c) => c.total);

    const palette = getChartPalette();

    charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.categories,
          borderWidth: 2,
          borderColor: palette.border,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: palette.text, font: { size: 11 }, padding: 12, boxWidth: 14 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${Api.formatCurrency(ctx.raw)}`,
            },
          },
        },
        cutout: '62%',
      },
    });
  }

  function renderMonthlyChart(monthlyData) {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas) return;

    destroyChart('monthly');

    const labels = (monthlyData || []).map((m) => {
      const [year, month] = m.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    });
    const values = (monthlyData || []).map((m) => m.total);

    const palette = getChartPalette();

    charts.monthly = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Gasto mensual',
          data: values,
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
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${Api.formatCurrency(ctx.raw)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => `$${(v / 1000).toFixed(0)}k`,
              color: palette.text,
            },
            grid: { color: palette.grid },
          },
          x: { ticks: { color: palette.text }, grid: { display: false } },
        },
      },
    });
  }

  function renderMerchantList(topMerchants) {
    const container = document.getElementById('merchant-list');
    if (!container) return;

    if (!topMerchants?.length) {
      container.innerHTML = '<div class="empty-state-sm">Sin datos de comercios aún.</div>';
      return;
    }

    const maxAmount = topMerchants[0].total;

    container.innerHTML = topMerchants.slice(0, 8).map((m, i) => {
      const barWidth = maxAmount > 0 ? Math.round((m.total / maxAmount) * 100) : 0;
      return `
        <div class="merchant-item">
          <div class="merchant-rank">${i + 1}</div>
          <div class="merchant-bar-wrapper">
            <div class="merchant-name">${escapeHtml(m.merchant)}</div>
            <div class="merchant-bar" style="width:${barWidth}%"></div>
          </div>
          <div class="merchant-amount">${Api.formatCurrency(m.total)}</div>
        </div>`;
    }).join('');
  }

  // ── Recent expenses ────────────────────────────────────────────────
  async function loadRecentExpenses() {
    const tbody = document.getElementById('recent-expenses-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/expenses?limit=8');
      const expenses = res.data || [];

      if (!expenses.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Sin gastos registrados aún. ¡Agregá tu primer gasto!</td></tr>';
        return;
      }

      tbody.innerHTML = expenses.map((e) => `
        <tr>
          <td><strong>${escapeHtml(e.merchant)}</strong></td>
          <td>${Api.categoryPill(e.category)}</td>
          <td>${Api.formatDate(e.date)}</td>
          <td class="text-right amount">${Api.formatCurrency(e.amount)}</td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Error cargando gastos.</td></tr>`;
    }
  }

  // ── Recommendations ────────────────────────────────────────────────
  async function loadRecommendations() {
    const container = document.getElementById('recommendations-list');
    if (!container) return;

    try {
      const recs = await Api.get('/recommendations/my');

      if (!recs.length) {
        container.innerHTML = '<div class="empty-state-sm">Aún no tenés recomendaciones. Un asesor puede generarlas automáticamente.</div>';
        return;
      }

      container.innerHTML = recs.slice(0, 5).map((r) => `
        <div class="rec-item rec-${r.type}">
          ${escapeHtml(r.message)}
          <div class="rec-meta">
            <span>${r.advisor ? `Asesor: ${r.advisor.name}` : 'Sistema automático'}</span>
            <span>${Api.formatRelativeDate(r.createdAt)}</span>
          </div>
        </div>`).join('');
    } catch (err) {
      container.innerHTML = '<div class="empty-state-sm">Error cargando recomendaciones.</div>';
    }
  }

  // ── Sidebar: Últimos Movimientos ──────────────────────────────────
  async function loadSidebarMovements() {
    const container = document.getElementById('recent-movements');
    if (!container) return;

    const CATEGORY_ICONS = {
      FOOD: '🛒', TRANSPORT: '🚗', ENTERTAINMENT: '🎬',
      HEALTH: '🏥', EDUCATION: '📚', CLOTHING: '👗',
      TECHNOLOGY: '💻', HOME: '🏠', SERVICES: '🔧', OTHER: '📋',
    };

    function timeAgo(dateStr) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1)  return 'Ahora';
      if (m < 60) return `Hace ${m} min`;
      const h = Math.floor(m / 60);
      if (h < 24) return `Hace ${h} h`;
      const d = Math.floor(h / 24);
      return `Hace ${d} día${d > 1 ? 's' : ''}`;
    }

    try {
      const res = await Api.get('/expenses?limit=4');
      const expenses = res.data || [];

      if (!expenses.length) {
        container.innerHTML = '<div class="movement-item"><span class="movement-name" style="color:var(--text-muted)">Sin movimientos aún.</span></div>';
        return;
      }

      container.innerHTML = expenses.map((e) => `
        <div class="movement-item">
          <span class="movement-icon">${CATEGORY_ICONS[e.category] || '📋'}</span>
          <div class="movement-info">
            <span class="movement-name">${escapeHtml(e.merchant)}</span>
            <span class="movement-time">${timeAgo(e.date || e.createdAt)}</span>
          </div>
          <span class="movement-amount movement-amount--expense">${Api.formatCurrency(e.amount)}</span>
        </div>`).join('');
    } catch (err) {
      container.innerHTML = '<div class="movement-item"><span class="movement-name" style="color:var(--text-muted)">Error al cargar.</span></div>';
    }
  }

  // ── Sidebar: Smart Insights ───────────────────────────────────────
  function renderSidebarInsights(data) {
    const container = document.getElementById('insights-list');
    if (!container) return;

    const insights = [];

    // Insight: top merchant + percentage
    if (data.topMerchants?.length && data.currentMonth?.total > 0) {
      const top = data.topMerchants[0];
      const pct = Math.round((top.total / data.currentMonth.total) * 100);
      insights.push({
        type: 'info',
        icon: '💡',
        text: `Tu comercio top es <strong>${escapeHtml(top.merchant)}</strong>, concentra el ${pct}% de tus gastos este mes.`,
      });
    }

    // Insight: month growth warning
    if (data.monthGrowth !== undefined) {
      if (data.monthGrowth > 20) {
        insights.push({
          type: 'warn',
          icon: '⚠️',
          text: `Tus gastos subieron un <strong>+${data.monthGrowth.toFixed(1)}%</strong> respecto al mes anterior.`,
        });
      } else if (data.monthGrowth < -10) {
        insights.push({
          type: 'info',
          icon: '✅',
          text: `Bajaste tus gastos un <strong>${Math.abs(data.monthGrowth).toFixed(1)}%</strong> respecto al mes anterior. ¡Bien hecho!`,
        });
      }
    }

    // Insight: unusual expenses
    if (data.unusualExpenses?.length) {
      insights.push({
        type: 'alert',
        icon: '🔔',
        text: `Detectamos <strong>${data.unusualExpenses.length}</strong> gasto${data.unusualExpenses.length > 1 ? 's' : ''} inusual${data.unusualExpenses.length > 1 ? 'es' : ''} este mes.`,
      });
    }

    // Fallback
    if (!insights.length) {
      insights.push({ type: 'info', icon: '💡', text: 'Seguí registrando tus gastos para ver análisis personalizados.' });
    }

    container.innerHTML = insights.map((ins) => `
      <div class="insight-card insight-card--${ins.type}">
        <span class="insight-icon">${ins.icon}</span>
        <p class="insight-text">${ins.text}</p>
      </div>`).join('');
  }

  // ── Unusual alert modal ────────────────────────────────────────────
  function showUnusualModal(expenses) {
    const modal = document.getElementById('unusual-modal');
    const body  = document.getElementById('unusual-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <p>Detectamos los siguientes gastos inusualmente altos en los últimos 30 días:</p>
      <ul style="margin:1rem 0;padding-left:1.25rem;">
        ${expenses.map((e) => `<li><strong>${escapeHtml(e.merchant)}</strong> — ${Api.formatCurrency(e.amount)} (${Api.formatDate(e.date)})</li>`).join('')}
      </ul>
      <p>Revisalos para asegurarte de que todo esté en orden.</p>`;

    modal.classList.remove('hidden');

    const closeBtn = document.getElementById('unusual-modal-close');
    const okBtn    = document.getElementById('unusual-modal-ok');
    const close = () => modal.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    okBtn?.addEventListener('click', close);
    modal.querySelector('.modal-backdrop')?.addEventListener('click', close);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
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

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init };
})();

window.Dashboard = Dashboard;
