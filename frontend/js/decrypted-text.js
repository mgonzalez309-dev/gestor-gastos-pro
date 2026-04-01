/**
 * DecryptedText — Vanilla JS port of the React DecryptedText component.
 *
 * Usage (HTML):
 *   <span
 *     data-decrypted-text="GastosApp"
 *     data-animate-on="view"
 *     data-speed="40"
 *     data-max-iterations="12"
 *     data-sequential="true"
 *     data-reveal-direction="start"
 *     data-use-original-chars-only="false"
 *     data-characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$"
 *     data-encrypted-class="dt-encrypted"
 *     data-revealed-class="dt-revealed"
 *   ></span>
 *
 * Options (JS constructor):
 *   new DecryptedText(element, {
 *     text, speed, maxIterations, characters,
 *     animateOn, revealDirection, sequential,
 *     useOriginalCharsOnly, encryptedClassName,
 *     revealedClassName, clickMode
 *   })
 */
class DecryptedText {
  constructor(element, opts = {}) {
    this.el = element;

    // ── Options (with defaults matching the React original) ──────────────
    this.text            = opts.text            ?? element.dataset.decryptedText ?? element.textContent.trim();
    this.speed           = Number(opts.speed    ?? element.dataset.speed    ?? 50);
    this.maxIterations   = Number(opts.maxIterations ?? element.dataset.maxIterations ?? 10);
    this.characters      = opts.characters      ?? element.dataset.characters  ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    this.animateOn       = opts.animateOn       ?? element.dataset.animateOn     ?? 'hover';
    this.revealDirection = opts.revealDirection ?? element.dataset.revealDirection ?? 'start';
    this.sequential      = opts.sequential      ?? (element.dataset.sequential === 'true')  ?? false;
    this.useOrigCharsOnly= opts.useOriginalCharsOnly ?? (element.dataset.useOriginalCharsOnly === 'true') ?? false;
    this.encClass        = opts.encryptedClassName ?? element.dataset.encryptedClass ?? 'dt-encrypted';
    this.revClass        = opts.revealedClassName  ?? element.dataset.revealedClass  ?? 'dt-revealed';
    // click mode: 'once' (reveal once, stay) | 'toggle' (toggle back/forth)
    this.clickMode       = opts.clickMode       ?? element.dataset.clickMode ?? 'once';
    // delay in ms before starting animation (used to chain sequentially)
    this.delay           = Number(opts.delay    ?? element.dataset.decryptDelay ?? 0);

    this._animating = false;
    this._revealed  = false;
    this._timer     = null;

    this._build();
    this._attach();
  }

  // ── Build character spans ────────────────────────────────────────────────
  _build() {
    this.el.innerHTML = '';
    this.spans = Array.from(this.text).map((ch) => {
      const span = document.createElement('span');
      // Start encrypted (scrambled)
      span.textContent = ch === ' ' ? '\u00A0' : this._randChar(ch);
      if (ch !== ' ') span.classList.add(this.encClass);
      this.el.appendChild(span);
      return span;
    });
  }

  // ── Attach event listeners based on animateOn ────────────────────────────
  _attach() {
    const trigger = this.animateOn;

    if (trigger === 'hover') {
      const parent = this.el.closest('[data-decrypt-parent]') ?? this.el.parentElement;
      parent.addEventListener('mouseenter', () => this._animate());
      parent.addEventListener('mouseleave', () => this._reset());

    } else if (trigger === 'view') {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (this.delay > 0) {
            setTimeout(() => this._animate(), this.delay);
          } else {
            this._animate();
          }
          io.disconnect();
        }
      }, { threshold: 0.1 });
      io.observe(this.el);

    } else if (trigger === 'click') {
      const parent = this.el.closest('[data-decrypt-parent]') ?? this.el.parentElement;
      parent.style.cursor = 'pointer';
      parent.addEventListener('click', () => {
        if (this.clickMode === 'toggle') {
          this._revealed ? this._reset(true) : this._animate();
        } else {
          this._animate();
        }
      });
    }
  }

  // ── Return a random scramble character ──────────────────────────────────
  _randChar(original) {
    if (this.useOrigCharsOnly) {
      return this.text[Math.floor(Math.random() * this.text.length)];
    }
    return this.characters[Math.floor(Math.random() * this.characters.length)];
  }

  // ── Build reveal order based on direction ────────────────────────────────
  _revealOrder() {
    const n = this.spans.length;
    const dir = this.revealDirection;

    if (dir === 'end') {
      return Array.from({ length: n }, (_, i) => n - 1 - i);
    }
    if (dir === 'center') {
      const order = [];
      let l = Math.floor(n / 2) - 1;
      let r = Math.ceil(n / 2);
      while (l >= 0 || r < n) {
        if (r < n) order.push(r++);
        if (l >= 0) order.push(l--);
      }
      return order;
    }
    // default: 'start' (left → right)
    return Array.from({ length: n }, (_, i) => i);
  }

  // ── Main animation loop ──────────────────────────────────────────────────
  _animate() {
    if (this._animating || this._revealed) return;
    this._animating = true;

    clearTimeout(this._timer);

    const total   = this.spans.length;
    const order   = this._revealOrder();
    const revSet  = new Set();      // indices that have been fully revealed
    let   iter    = 0;
    let   revIdx  = 0;              // pointer into order[] for sequential mode

    const tick = () => {
      // Sequential reveal: unlock one more character every few iterations
      if (this.sequential) {
        const toReveal = Math.floor((iter / this.maxIterations) * total);
        while (revIdx < toReveal && revIdx < total) {
          revSet.add(order[revIdx]);
          revIdx++;
        }
      }

      // Update each span
      this.spans.forEach((span, i) => {
        const ch = this.text[i];
        if (ch === ' ') return; // spaces are always non-breaking spaces

        if (revSet.has(i)) {
          span.textContent = ch;
          span.classList.remove(this.encClass);
          span.classList.add(this.revClass);
        } else {
          span.textContent = this._randChar(ch);
          span.classList.add(this.encClass);
          span.classList.remove(this.revClass);
        }
      });

      iter++;

      if (iter < this.maxIterations) {
        this._timer = setTimeout(tick, this.speed);
      } else {
        // Final frame — guarantee full reveal
        this.spans.forEach((span, i) => {
          const ch = this.text[i];
          span.textContent = ch === ' ' ? '\u00A0' : ch;
          span.classList.remove(this.encClass);
          span.classList.add(this.revClass);
        });
        this._animating = false;
        this._revealed  = true;
      }
    };

    tick();
  }

  // ── Reset back to scrambled state ────────────────────────────────────────
  _reset(immediate = false) {
    clearTimeout(this._timer);
    this._animating = false;
    this._revealed  = false;

    if (immediate) {
      this.spans.forEach((span, i) => {
        const ch = this.text[i];
        span.textContent = ch === ' ' ? '\u00A0' : this._randChar(ch);
        span.classList.add(this.encClass);
        span.classList.remove(this.revClass);
      });
      return;
    }

    // Smooth scramble-back loop
    let iter = 0;
    const maxIter = Math.ceil(this.maxIterations / 2);
    const tick = () => {
      this.spans.forEach((span, i) => {
        const ch = this.text[i];
        if (ch === ' ') return;
        span.textContent = this._randChar(ch);
        span.classList.add(this.encClass);
        span.classList.remove(this.revClass);
      });
      iter++;
      if (iter < maxIter) this._timer = setTimeout(tick, this.speed);
    };
    tick();
  }
}

// ── Auto-init all elements with [data-decrypted-text] ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-decrypted-text]').forEach((el) => {
    new DecryptedText(el);
  });
});
