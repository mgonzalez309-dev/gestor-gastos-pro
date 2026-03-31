/**
 * tickets.js – Carga de tickets con OCR y formulario de confirmación
 */

const Tickets = (() => {

  let selectedFile   = null;
  let currentTicketId = null;

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    bindDropzone();
    bindUploadBtn();
    bindStep3Form();
    loadTicketHistory();
  }

  // ══════════════════════════════════════════════════════════════════
  // DROPZONE
  // ══════════════════════════════════════════════════════════════════
  function bindDropzone() {
    const zone      = document.getElementById('dropzone');
    const input     = document.getElementById('ticket-file-input');
    const clearBtn  = document.getElementById('btn-clear-upload');
    const uploadBtn = document.getElementById('btn-upload');

    if (!zone) return;

    // Click to open file picker
    zone.addEventListener('click', () => input?.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input?.click(); });

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (file) handleFileSelected(file);
    });

    // Input change
    input?.addEventListener('change', () => {
      if (input.files[0]) handleFileSelected(input.files[0]);
    });

    // Clear button
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearFile();
    });
  }

  function handleFileSelected(file) {
    const MAX_MB = 10;
    const allowedTypes = ['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/bmp','image/tiff'];

    Api.hideAlert('upload-alert');

    if (!allowedTypes.includes(file.type)) {
      Api.showAlert('upload-alert', 'Formato no permitido. Usá JPG, PNG o WEBP.', 'error');
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      Api.showAlert('upload-alert', `El archivo es muy grande. Máximo ${MAX_MB} MB.`, 'error');
      return;
    }

    selectedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const img  = document.getElementById('preview-img');
      const name = document.getElementById('preview-name');
      if (img)  img.src = e.target.result;
      if (name) name.textContent = file.name;
      document.getElementById('dropzone-idle')?.classList.add('hidden');
      document.getElementById('dropzone-preview')?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    document.getElementById('btn-upload').disabled    = false;
    document.getElementById('btn-clear-upload').disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    const input  = document.getElementById('ticket-file-input');
    if (input) input.value = '';
    document.getElementById('dropzone-idle')?.classList.remove('hidden');
    document.getElementById('dropzone-preview')?.classList.add('hidden');
    document.getElementById('btn-upload').disabled    = true;
    document.getElementById('btn-clear-upload').disabled = true;
    Api.hideAlert('upload-alert');
  }

  // ══════════════════════════════════════════════════════════════════
  // UPLOAD & OCR
  // ══════════════════════════════════════════════════════════════════
  function bindUploadBtn() {
    document.getElementById('btn-upload')?.addEventListener('click', uploadAndProcess);
  }

  async function uploadAndProcess() {
    if (!selectedFile) return;

    setStep(1);
    Api.hideAlert('upload-alert');

    const btnText = document.getElementById('btn-upload-text');
    const btnSpin = document.getElementById('btn-upload-spinner');
    if (btnText) btnText.classList.add('hidden');
    if (btnSpin) btnSpin.classList.remove('hidden');
    document.getElementById('btn-upload').disabled = true;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Step 2: processing spinner
      setStep(2);

      const uploadRes = await Api.upload('/tickets/upload', formData);
      currentTicketId = uploadRes.id;

      // Poll for OCR completion (or wait and re-fetch the ticket)
      const ticketData = await pollTicketUntilProcessed(currentTicketId);

      setStep(3);
      fillStep3Form(ticketData);
      loadTicketHistory();
    } catch (err) {
      setStep(1);
      Api.showAlert('upload-alert', err.message, 'error');
      if (btnText) btnText.classList.remove('hidden');
      if (btnSpin) btnSpin.classList.add('hidden');
      document.getElementById('btn-upload').disabled = false;
    }
  }

  async function pollTicketUntilProcessed(ticketId) {
    const MAX_ATTEMPTS = 20;
    const DELAY_MS     = 2000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sleep(DELAY_MS);
      const ticket = await Api.get(`/tickets/${ticketId}`);
      if (ticket.extractedText !== null && ticket.extractedText !== undefined) {
        return ticket;
      }
    }

    // Return whatever we got even if OCR didn't finish
    return await Api.get(`/tickets/${ticketId}`);
  }

  function fillStep3Form(ticket) {
    const textEl = document.getElementById('extracted-text');
    if (textEl) textEl.textContent = ticket.extractedText || '(Sin texto extraído)';

    document.getElementById('ticket-id').value  = ticket.id;
    document.getElementById('t-merchant').value = ticket.parsedMerchant || '';
    document.getElementById('t-amount').value   = ticket.parsedAmount   || '';
    document.getElementById('t-date').value     = ticket.parsedDate
      ? new Date(ticket.parsedDate).toISOString().split('T')[0]
      : Api.todayISO();

    // Auto-suggest category based on merchant name
    const categorySelect = document.getElementById('t-category');
    if (categorySelect) {
      const suggested = suggestCategory(ticket.parsedMerchant);
      if (suggested) {
        categorySelect.value = suggested;
        let hint = document.getElementById('category-ai-hint');
        if (!hint) {
          hint = document.createElement('p');
          hint.id = 'category-ai-hint';
          hint.style.cssText = 'font-size:.78rem;color:var(--color-success);margin-top:.25rem;';
          categorySelect.parentNode.appendChild(hint);
        }
        hint.textContent = 'Categoría sugerida automáticamente según el comercio.';
      } else {
        const hint = document.getElementById('category-ai-hint');
        if (hint) hint.textContent = '';
      }
    }

    // Show OCR result badge
    const hasData = ticket.parsedAmount || ticket.parsedMerchant;
    Api.showAlert(
      'ocr-result-alert',
      hasData
        ? 'La IA extrajo datos del ticket. Revisálos y corregí si es necesario.'
        : 'No se pudo extraer información automáticamente. Completá el formulario manualmente.',
      hasData ? 'success' : 'warning',
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 3: Save expense from ticket
  // ══════════════════════════════════════════════════════════════════
  function bindStep3Form() {
    document.getElementById('btn-save-expense')?.addEventListener('click', saveExpenseFromTicket);
    document.getElementById('btn-restart-ocr')?.addEventListener('click', resetToStep1);
  }

  async function saveExpenseFromTicket() {
    const alertEl = 'ocr-result-alert';
    Api.hideAlert(alertEl);

    const ticketId  = document.getElementById('ticket-id').value;
    const merchant  = document.getElementById('t-merchant').value.trim();
    const amount    = parseFloat(document.getElementById('t-amount').value);
    const date      = document.getElementById('t-date').value;
    const category  = document.getElementById('t-category').value;
    const desc      = document.getElementById('t-description').value.trim();

    if (!merchant)             return Api.showAlert(alertEl, 'El comercio es obligatorio.', 'error');
    if (!amount || amount <= 0) return Api.showAlert(alertEl, 'El monto debe ser mayor a cero.', 'error');
    if (!category)             return Api.showAlert(alertEl, 'Seleccioná una categoría.', 'error');
    if (!date)                 return Api.showAlert(alertEl, 'La fecha es obligatoria.', 'error');

    const saveBtn = document.getElementById('btn-save-expense');
    saveBtn.disabled     = true;
    saveBtn.textContent  = 'Guardando...';

    try {
      await Api.post('/expenses', {
        merchant,
        amount,
        date,
        category,
        description: desc || undefined,
        ticketId: ticketId || undefined,
      });

      Api.showAlert(alertEl, 'Gasto registrado correctamente.', 'success');
      setTimeout(() => { window.location.href = 'expenses.html'; }, 1500);
    } catch (err) {
      Api.showAlert(alertEl, err.message, 'error');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Registrar gasto';
    }
  }

  function resetToStep1() {
    clearFile();
    setStep(1);
    currentTicketId = null;
    document.getElementById('ticket-expense-form')?.reset();
    document.getElementById('extracted-text').textContent = '-';
    Api.hideAlert('ocr-result-alert');
  }

  // ══════════════════════════════════════════════════════════════════
  // TICKET HISTORY
  // ══════════════════════════════════════════════════════════════════
  async function loadTicketHistory() {
    const container = document.getElementById('ticket-history');
    if (!container) return;

    try {
      const tickets = await Api.get('/tickets');

      if (!tickets.length) {
        container.innerHTML = '<div class="empty-state-sm">No hay tickets procesados aún.</div>';
        return;
      }

      container.innerHTML = tickets.slice(0, 8).map((t) => `
        <div class="ticket-card" title="Subido el ${Api.formatDate(t.createdAt)}">
          <img src="${Api.BASE_URL.replace('/api','')}${t.imageUrl}" alt="Ticket"
               onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'120\\'><rect width=\\'100\\' height=\\'120\\' fill=\\'%23e2e8f0\\' rx=\\'8\\'/><text x=\\'50\\' y=\\'68\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'11\\' font-family=\\'sans-serif\\'>Sin imagen</text></svg>'
          " />
          <div class="ticket-card-body">
            <div class="ticket-card-date">${Api.formatRelativeDate(t.createdAt)}</div>
            <div class="ticket-card-amount">${t.parsedAmount ? Api.formatCurrency(t.parsedAmount) : 'Sin datos'}</div>
            ${t.parsedMerchant ? `<div style="font-size:.78rem;color:var(--text-muted)">${esc(t.parsedMerchant)}</div>` : ''}
          </div>
        </div>`).join('');
    } catch (err) {
      container.innerHTML = '<div class="empty-state-sm">Error cargando historial.</div>';
    }
  }

  // ── Category suggestion heuristics ───────────────────────────────
  function suggestCategory(merchantName) {
    if (!merchantName) return '';
    const text = merchantName.toLowerCase();
    const rules = [
      { cat: 'FOOD',          keywords: ['super','supermercado','coto','jumbo','carrefour','walmart','dia','disco','vea','verduleria','fruteria','panaderia','fiambreria','carniceria','kiosco','despensa','almacen','mcdonald','burger','pizza','sushi','rappi','pedidosya','delivery','restaurant','restaurante','cafe','cafeteria','heladeria','pasteleria','rotiseria'] },
      { cat: 'TRANSPORT',     keywords: ['ypf','shell','axion','puma','petrobras','nafta','combustible','uber','cabify','taxi','remis','sube','subte','colectivo','tren','bus','latam','aerolineas','vuelo','aeropuerto','estacionamiento','peaje','autopista','gomeria','mecanico'] },
      { cat: 'ENTERTAINMENT', keywords: ['netflix','spotify','disney','hbo','prime','youtube','cine','cinema','teatro','recital','concierto','steam','playstation','xbox','nintendo','gaming','boliche','bowling','karting'] },
      { cat: 'HEALTH',        keywords: ['farmacia','osde','swiss medical','galeno','clinica','hospital','medico','doctor','dentista','odontologo','optica','kinesio','fisio','psicologo','nutricionista','laboratorio','drogueria','gym','gimnasio','fitness'] },
      { cat: 'EDUCATION',     keywords: ['universidad','facultad','colegio','instituto','academia','libreria','udemy','platzi','coursera','educacion','capacitacion','curso','taller','escuela'] },
      { cat: 'CLOTHING',      keywords: ['zara','h&m','nike','adidas','puma','lacoste','fila','gap','boutique','ropa','indumentaria','zapatilleria','calzado','joyeria','bijouterie'] },
      { cat: 'TECHNOLOGY',    keywords: ['fravega','garbarino','musimundo','compumundo','pc factory','apple','samsung','lg','sony','lenovo','hp','dell','computadora','celular','smartphone','tablet','electronico','tecnologia'] },
      { cat: 'HOME',          keywords: ['sodimac','easy','ferreteria','pintureria','bazar','muebleria','hogar','decoracion','jardin','plomero','electricista','cerrajero','limpieza'] },
      { cat: 'SERVICES',      keywords: ['banco','bbva','santander','galicia','hsbc','macro','nacion','claro','movistar','personal','telecentro','fibertel','cablevision','edesur','edenor','metrogas','afip','rentas','seguro','obra social','prepaga','expensas','alquiler'] },
    ];
    for (const rule of rules) {
      if (rule.keywords.some((kw) => text.includes(kw))) return rule.cat;
    }
    return '';
  }

  // ── Steps ─────────────────────────────────────────────────────────
  function setStep(step) {
    [1, 2, 3].forEach((n) => {
      document.getElementById(`step-${n}`)?.classList.toggle('hidden', n !== step);
      const indicator = document.getElementById(`step-${n}-indicator`);
      if (!indicator) return;
      indicator.classList.remove('active', 'done');
      if (n < step)  indicator.classList.add('done');
      if (n === step) indicator.classList.add('active');
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function esc(str = '') {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init };
})();

window.Tickets = Tickets;
