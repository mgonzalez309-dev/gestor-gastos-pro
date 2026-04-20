const UIComponents = (() => {
  async function loadSidebar(slotId, pageKey) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    const res = await fetch('components/sidebar.html', { cache: 'default' });
    const html = await res.text();
    slot.innerHTML = html;

    slot.querySelectorAll('.nav-link').forEach((link) => {
      const isActive = link.getAttribute('data-page') === pageKey;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (window.lucide) lucide.createIcons({ node: slot });
  }

  return { loadSidebar };
})();

window.UIComponents = UIComponents;
