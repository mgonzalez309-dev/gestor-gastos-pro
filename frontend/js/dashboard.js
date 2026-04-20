/**
 * dashboard.js – Dashboard principal con gráficos y resumen de gastos
 */

const Dashboard = (() => {

  let charts = {};
  let cachedAnalytics = null;
  let categoryPeriod = 'all';

  const CATEGORY_META = {
    FOOD:          { icon: 'shopping-cart', label: 'Alimentaci\u00f3n' },
    TRANSPORT:     { icon: 'car',           label: 'Transporte' },
    ENTERTAINMENT: { icon: 'film',          label: 'Entretenimiento' },
    HEALTH:        { icon: 'heart',         label: 'Salud' },
    EDUCATION:     { icon: 'book-open',     label: 'Educaci\u00f3n' },
    CLOTHING:      { icon: 'tag',           label: 'Ropa' },
    TECHNOLOGY:    { icon: 'monitor',       label: 'Tecnolog\u00eda' },
    HOME:          { icon: 'home',          label: 'Hogar' },
    SERVICES:      { icon: 'wrench',        label: 'Servicios' },
    OTHER:         { icon: 'package',       label: 'Otros' },
  };

  async function init() {
    // Update greeting
    const user = Api.getUser();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const greetEl = document.getElementById('greeting');
    if (greetEl) greetEl.textContent = `${greeting}, ${user?.name?.split(' ')[0] || ''}!`;

    bindCategoryPeriodFilter();

    await Promise.all([
      loadAnalytics(),
      loadRecentExpensesAndMovements(),
      loadRecommendations(),
      loadRecentTickets(),
    ]);

    document.addEventListener('app-theme-changed', () => {
      if (!cachedAnalytics) return;
      renderStatCards(cachedAnalytics);
      renderCategoryChart(cachedAnalytics.byCategory);
      renderMonthlyChart(cachedAnalytics.monthlyData);
      renderMerchantList(cachedAnalytics.topMerchants);
      renderPaceCard(cachedAnalytics);
      renderCategoryBars(cachedAnalytics.byCategory, cachedAnalytics.currentMonth?.total);
    });
  }

  function bindCategoryPeriodFilter() {
    const container = document.getElementById('category-period-filter');
    if (!container) return;
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.chart-period-btn');
      if (!btn) return;
      const period = btn.dataset.period;
      if (period === categoryPeriod) return;
      categoryPeriod = period;
      container.querySelectorAll('.chart-period-btn').forEach((b) => b.classList.toggle('active', b === btn));
      await loadCategoryChart(period);
    });
  }

  async function loadCategoryChart(period) {
    try {
      const data = await Api.get(`/expenses/analytics?period=${period}`);
      renderCategoryChart(data.byCategory);
    } catch (err) {
      console.error('Error cargando gráfico de categorías:', err);
    }
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
      renderPaceCard(data);
      renderCategoryBars(data.byCategory, data.currentMonth?.total);
      renderSavingsCard(data);
      renderSavingsAlert(data);

      // Show unusual expenses alert if any
      if (data.unusualExpenses && data.unusualExpenses.length > 0) {
        showUnusualModal(data.unusualExpenses);
      }
    } catch (err) {
      console.error('Error cargando analytics:', err);
    }
  }

  function renderSavingsCard(data) {
    const user = Api.getUser();
    const income = user?.monthlyIncome;
    const savingsGoal = data.savingsGoal != null ? data.savingsGoal : user?.savingsGoal;

    const section = document.getElementById('savings-section');
    if (!section) return;

    if (!income || !savingsGoal || savingsGoal <= 0) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');

    const spent      = data.currentMonth?.total || 0;
    const freeBudget = income - savingsGoal;
    const freeLeft   = freeBudget - spent;
    const freePct    = freeBudget > 0 ? Math.round(Math.max(0, Math.min(100, (freeLeft / freeBudget) * 100))) : 0;

    // Ring
    const CIRCUMFERENCE = 2 * Math.PI * 34;
    const ringFill = document.getElementById('sav-ring-fill');
    const ringPct  = document.getElementById('sav-ring-pct');
    if (ringFill) {
      ringFill.style.strokeDasharray  = CIRCUMFERENCE;
      ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - freePct / 100);
    }
    if (ringPct) ringPct.textContent = `${freePct}%`;

    // State
    const card = document.getElementById('savings-progress-card');
    let state, desc, badgeText;

    if (freeLeft < 0) {
      state     = 'sav-danger';
      desc      = `Atención: consumiste ${Api.formatCurrency(Math.abs(freeLeft))} de tu meta de ahorro este mes.`;
      badgeText = 'En riesgo';
    } else if (freePct < 25) {
      state     = 'sav-warning';
      desc      = `Cuidado: solo te quedan ${Api.formatCurrency(freeLeft)} disponibles antes de afectar tu ahorro.`;
      badgeText = 'Precaución';
    } else {
      state     = 'sav-safe';
      desc      = `Vas bien — tenés ${Api.formatCurrency(freeLeft)} libres sin tocar tu meta de ahorro.`;
      badgeText = 'En orden';
    }

    if (card) card.className = `savings-progress-card ${state}`;

    // Values
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('sav-goal-val',  Api.formatCurrency(savingsGoal));
    set('sav-free-val',  Api.formatCurrency(Math.max(0, freeBudget)));
    set('sav-spent-val', Api.formatCurrency(spent));
    set('sav-badge',     badgeText);

    const availEl = document.getElementById('sav-avail-val');
    if (availEl) {
      availEl.textContent = freeLeft < 0
        ? `−${Api.formatCurrency(Math.abs(freeLeft))}`
        : Api.formatCurrency(freeLeft);
      availEl.style.color = freeLeft < 0
        ? 'var(--color-danger)'
        : freeLeft < freeBudget * 0.25
          ? 'var(--color-warning)'
          : 'var(--color-success)';
    }

    // Progress bar (shows % of free budget consumed)
    const spentPct = freeBudget > 0 ? Math.min(100, Math.round((spent / freeBudget) * 100)) : 0;
    const barFill  = document.getElementById('sav-bar-fill');
    const barLabel = document.getElementById('sav-bar-label');
    if (barFill)  barFill.style.width     = `${spentPct}%`;
    if (barLabel) barLabel.textContent    = `${spentPct}% del presupuesto libre usado`;
  }

  function renderSavingsAlert(data) {
    const user = Api.getUser();
    const income = user?.monthlyIncome;
    const savingsGoal = data.savingsGoal || user?.savingsGoal;
    if (!income || !savingsGoal || savingsGoal <= 0) return;

    const spent     = data.currentMonth?.total || 0;
    const freeBudget = income - savingsGoal;
    const freeLeft   = freeBudget - spent;

    // Only show if within danger/warning zone
    let alertEl = document.getElementById('dashboard-savings-alert');
    if (!alertEl) {
      // Insert before the charts section
      const chartsSection = document.querySelector('.charts-grid');
      if (!chartsSection) return;
      alertEl = document.createElement('div');
      alertEl.id = 'dashboard-savings-alert';
      alertEl.className = 'alert hidden mb-1';
      chartsSection.parentNode.insertBefore(alertEl, chartsSection);
    }

    if (freeLeft < 0) {
      Api.showAlert('dashboard-savings-alert',
        `⚠️ Atención: ya gastaste ${Api.formatCurrency(Math.abs(freeLeft))} de tu meta de ahorro (${Api.formatCurrency(savingsGoal)}) este mes.`,
        'error'
      );
    } else if (freeLeft < freeBudget * 0.15) {
      Api.showAlert('dashboard-savings-alert',
        `⚠️ Cuidado: te quedan ${Api.formatCurrency(freeLeft)} antes de empezar a consumir tu meta de ahorro (${Api.formatCurrency(savingsGoal)}).`,
        'warning'
      );
    } else {
      alertEl.classList.add('hidden');
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
            <div class="merchant-name">${Api.escapeHtml(m.merchant)}</div>
            <div class="merchant-bar" style="width:${barWidth}%"></div>
          </div>
          <div class="merchant-amount">${Api.formatCurrency(m.total)}</div>
        </div>`;
    }).join('');
  }

  // ── Recent expenses + sidebar movements (single API call) ──────────
  async function loadRecentExpensesAndMovements() {
    const tbody     = document.getElementById('recent-expenses-body');
    const movements = document.getElementById('recent-movements');

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
      const res = await Api.get('/expenses?limit=8');
      const expenses = res.data || [];

      // Recent expenses table
      if (tbody) {
        if (!expenses.length) {
          tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Sin gastos registrados aún. ¡Agregá tu primer gasto!</td></tr>';
        } else {
          tbody.innerHTML = expenses.map((e) => `
            <tr>
              <td><strong>${Api.escapeHtml(e.merchant)}</strong></td>
              <td>${Api.categoryPill(e.category)}</td>
              <td>${Api.formatDate(e.date)}</td>
              <td class="text-right amount">${Api.formatCurrency(e.amount)}</td>
            </tr>`).join('');
        }
      }

      // Sidebar movements (first 4)
      if (movements) {
        const recent = expenses.slice(0, 4);
        if (!recent.length) {
          movements.innerHTML = '<div class="movement-item"><span class="movement-name" style="color:var(--text-muted)">Sin movimientos aún.</span></div>';
        } else {
          movements.innerHTML = recent.map((e) => `
            <div class="movement-item">
              <span class="movement-icon"><i data-lucide="${CATEGORY_META[e.category]?.icon || 'package'}"></i></span>
              <div class="movement-info">
                <span class="movement-name">${Api.escapeHtml(e.merchant)}</span>
                <span class="movement-time">${timeAgo(e.date || e.createdAt)}</span>
              </div>
              <span class="movement-amount movement-amount--expense">${Api.formatCurrency(e.amount)}</span>
            </div>`).join('');
          if (window.lucide) lucide.createIcons({ node: movements });
        }
      }
    } catch {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Error cargando gastos.</td></tr>`;
      if (movements) movements.innerHTML = '<div class="movement-item"><span class="movement-name" style="color:var(--text-muted)">Error al cargar.</span></div>';
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
          ${Api.escapeHtml(r.message)}
          <div class="rec-meta">
            <span>${r.advisor ? `Asesor: ${r.advisor.name}` : 'Sistema automático'}</span>
            <span>${Api.formatRelativeDate(r.createdAt)}</span>
          </div>
        </div>`).join('');
    } catch (err) {
      container.innerHTML = '<div class="empty-state-sm">Error cargando recomendaciones.</div>';
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
        icon: 'lightbulb',
        text: `Tu comercio top es <strong>${Api.escapeHtml(top.merchant)}</strong>, concentra el ${pct}% de tus gastos este mes.`,
      });
    }

    // Insight: month growth warning
    if (data.monthGrowth !== undefined) {
      if (data.monthGrowth > 20) {
        insights.push({
          type: 'warn',
          icon: 'alert-triangle',
          text: `Tus gastos subieron un <strong>+${data.monthGrowth.toFixed(1)}%</strong> respecto al mes anterior.`,
        });
      } else if (data.monthGrowth < -10) {
        insights.push({
          type: 'info',
          icon: 'check-circle',
          text: `Bajaste tus gastos un <strong>${Math.abs(data.monthGrowth).toFixed(1)}%</strong> respecto al mes anterior. ¡Bien hecho!`,
        });
      }
    }

    // Insight: unusual expenses
    if (data.unusualExpenses?.length) {
      insights.push({
        type: 'alert',
        icon: 'bell',
        text: `Detectamos <strong>${data.unusualExpenses.length}</strong> gasto${data.unusualExpenses.length > 1 ? 's' : ''} inusual${data.unusualExpenses.length > 1 ? 'es' : ''} este mes.`,
      });
    }

    // Fallback
    if (!insights.length) {
      insights.push({ type: 'info', icon: 'lightbulb', text: 'Seguí registrando tus gastos para ver análisis personalizados.' });
    }

    container.innerHTML = insights.map((ins) => `
      <div class="insight-card insight-card--${ins.type}">
        <span class="insight-icon"><i data-lucide="${ins.icon}"></i></span>
        <p class="insight-text">${ins.text}</p>
      </div>`).join('');
    if (window.lucide) lucide.createIcons({ node: container });
  }

  // ── Unusual alert modal ────────────────────────────────────────────
  function showUnusualModal(expenses) {
    const modal = document.getElementById('unusual-modal');
    const body  = document.getElementById('unusual-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <p>Detectamos los siguientes gastos inusualmente altos en los últimos 30 días:</p>
      <ul style="margin:1rem 0;padding-left:1.25rem;">
        ${expenses.map((e) => `<li><strong>${Api.escapeHtml(e.merchant)}</strong> — ${Api.formatCurrency(e.amount)} (${Api.formatDate(e.date)})</li>`).join('')}
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

  // ── Ritmo de Gasto ────────────────────────────────────────────────
  function renderPaceCard(data) {
    const user = Api.getUser();
    if (!user?.monthlyIncome) return;

    const paceSection = document.getElementById('pace-section');
    if (!paceSection) return;
    paceSection.classList.remove('hidden');

    const spent   = data.currentMonth?.total || 0;
    const income  = user.monthlyIncome;
    const now     = new Date();
    const day     = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const expectedPct = Math.round((day / daysInMonth) * 100);
    const realPct     = Math.round((spent / income) * 100);
    const diff        = realPct - expectedPct;
    const projected   = day > 0 ? Math.round((spent / day) * daysInMonth) : 0;

    let status, icon, desc;
    if (diff > 15) {
      status = 'elevated'; icon = 'zap';
      desc = `Estás gastando más rápido de lo esperado (${diff > 0 ? '+' : ''}${diff}% sobre el ritmo)`;
    } else if (diff < -15) {
      status = 'low'; icon = 'trending-down';
      desc = `Estás por debajo del ritmo esperado (${Math.abs(diff)}% de margen)`;
    } else {
      status = 'normal'; icon = 'check-circle-2';
      desc = `Tu ritmo de gasto está en línea con tu presupuesto`;
    }

    const card = document.getElementById('pace-card');
    if (card) card.className = `pace-card pace-${status}`;

    const descEl = document.getElementById('pace-desc');
    if (descEl) {
      descEl.innerHTML = `<i data-lucide="${icon}" style="width:1em;height:1em;vertical-align:-.15em;margin-right:.3em"></i>${desc}`;
      if (window.lucide) lucide.createIcons({ node: descEl });
    }

    // SVG ring (r=34, circumference ≈ 213.6)
    const circumference = 2 * Math.PI * 34;
    const fillEl = document.getElementById('pace-ring-fill');
    if (fillEl) {
      fillEl.style.strokeDasharray  = circumference;
      fillEl.style.strokeDashoffset = circumference - (Math.min(realPct, 100) / 100) * circumference;
    }
    const ringVal = document.getElementById('pace-pct-real');
    if (ringVal) ringVal.textContent = `${realPct}%`;

    // Bars
    const expectedBar = document.getElementById('pace-bar-expected');
    const realBar     = document.getElementById('pace-bar-real');
    if (expectedBar) expectedBar.style.width = `${Math.min(expectedPct, 100)}%`;
    if (realBar)     realBar.style.width     = `${Math.min(realPct, 100)}%`;

    const pctExpEl = document.getElementById('pace-pct-expected');
    const pctRealEl = document.getElementById('pace-pct-real-bar');
    if (pctExpEl)  pctExpEl.textContent  = `${expectedPct}%`;
    if (pctRealEl) pctRealEl.textContent = `${realPct}%`;

    // Projection
    const projEl = document.getElementById('pace-projection');
    if (projEl) projEl.innerHTML = `Proyección al fin de mes: <strong>${Api.formatCurrency(projected)}</strong>`;

    // Add insight to sidebar if elevated
    if (diff > 15) {
      const insights = document.getElementById('insights-list');
      if (insights) {
        const html = `<div class="insight-card insight-card--warn"><span class="insight-icon"><i data-lucide="zap"></i></span><p class="insight-text">A este ritmo gastarías <strong>${Api.formatCurrency(projected)}</strong> este mes (${Math.round((projected / income) * 100)}% de tu ingreso).</p></div>`;
        insights.innerHTML = html + insights.innerHTML;
        if (window.lucide) lucide.createIcons({ node: insights });
      }
    }
  }

  // ── Últimos tickets escaneados ────────────────────────────────────
  async function loadRecentTickets() {
    const container = document.getElementById('dashboard-tickets-list');
    if (!container) return;

    try {
      const tickets = await Api.get('/tickets');

      if (!tickets.length) {
        container.innerHTML = `
          <div class="empty-state-sm">
            Aún no subiste tickets. 
            <a href="upload-ticket.html" style="color:var(--color-primary)">Subir el primero</a>
          </div>`;
        return;
      }

      const baseUrl = Api.BASE_URL.replace('/api', '');

      container.innerHTML = tickets.slice(0, 4).map((t) => `
        <div class="dashboard-ticket-row">
          <div class="dashboard-ticket-thumb">
            <img
              src="${baseUrl}${t.imageUrl}"
              alt="Ticket"
              onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
            />
            <span class="dashboard-ticket-thumb-fallback" style="display:none"><i data-lucide="receipt"></i></span>
          </div>
          <div class="dashboard-ticket-info">
            <span class="dashboard-ticket-merchant">
              ${t.parsedMerchant ? Api.escapeHtml(t.parsedMerchant) : '<span style="color:var(--text-muted)">Sin procesar</span>'}
            </span>
            <span class="dashboard-ticket-date">${Api.formatRelativeDate(t.createdAt)}</span>
          </div>
          <span class="dashboard-ticket-amount">
            ${t.parsedAmount ? Api.formatCurrency(t.parsedAmount) : '—'}
          </span>
        </div>`).join('');
      if (window.lucide) lucide.createIcons({ node: container });
    } catch {
      container.innerHTML = '<div class="empty-state-sm">Error cargando tickets.</div>';
    }
  }

  // ── Top categorías del mes (barras reales) ────────────────────────
  function renderCategoryBars(byCategory, monthTotal) {
    const container = document.getElementById('dashboard-category-bars');
    if (!container) return;

    // byCategory comes from /expenses/analytics and is all-time; we want current month
    // monthTotal is the denominator for percentage
    if (!byCategory || !byCategory.length) {
      container.innerHTML = '<div class="empty-state-sm">Sin gastos este mes aún.</div>';
      return;
    }

    const total = monthTotal || byCategory.reduce((s, c) => s + (c.total || 0), 0);

    const palette = getChartPalette();
    const top = byCategory.slice(0, 6);

    container.innerHTML = top.map((c, i) => {
      const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
      const color = palette.categories[i % palette.categories.length];
      const { icon = 'circle', label = c.category } = CATEGORY_META[c.category] || {};
      return `
        <div class="dashboard-cat-bar-row">
          <div class="dashboard-cat-bar-header">
            <span class="dashboard-cat-bar-label">
              <i data-lucide="${icon}"></i>${label}
            </span>
            <div class="dashboard-cat-bar-meta">
              <span class="dashboard-cat-bar-amount">${Api.formatCurrency(c.total)}</span>
              <span class="dashboard-cat-bar-pct">${pct}%</span>
            </div>
          </div>
          <div class="dashboard-cat-bar-track">
            <div class="dashboard-cat-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ node: container });
  }

  return { init };
})();

window.Dashboard = Dashboard;
