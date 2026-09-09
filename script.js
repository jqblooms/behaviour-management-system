const pageRenderers = {
  Classes: (content) => {
    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard';
    dashboard.append(scheduleBar((className) => showClassView(content, className)), classGrid((className) => showClassView(content, className)));
    content.append(dashboard);
  },
  Activity: (content) => showActivityPage(content),
  Pupils: (content) => showClassView(content, 'All pupils', 9999, true),
  Analytics: (content) => showAnalyticsPage(content),
  'Homework Calendar': (content) => showHomeworkCalendarPage(content),
  Rooms: (content) => showRoomsPage(content),
  Detentions: (content) => showDetentionsPage(content),
  Admin: (content) => showAdminPage(content),
};

function showPage(content, page) {
  clearInterval(content._activityTimer);
  content._activityTimer = undefined;
  content.replaceChildren();
  const render = pageRenderers[page];
  if (render) return render(content);
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder-page';
  placeholder.textContent = page;
  content.append(placeholder);
}

function setupResponsiveNav(device) {
  const nav = device.querySelector('.navbar');
  const linksContainer = nav?.querySelector('.nav-links');
  const menu = nav?.querySelector('.mobile-menu');
  const toggle = nav?.querySelector('.menu-toggle');
  const brand = nav?.querySelector('.brand');
  if (!nav || !linksContainer || !menu || !toggle) return;

  const orderedLinks = [...linksContainer.children];

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  }

  function relayout() {
    const navWidth = nav.clientWidth;
    if (!navWidth) return;
    orderedLinks.forEach((link) => linksContainer.append(link));
    menu.replaceChildren();
    closeMenu();

    const brandWidth = brand ? brand.offsetWidth : 0;
    const linkWidths = orderedLinks.map((link) => link.offsetWidth);
    const totalLinks = linkWidths.reduce((sum, width) => sum + width, 0);

    if (brandWidth + totalLinks <= navWidth) {
      toggle.hidden = true;
      return;
    }

    toggle.hidden = false;
    const available = navWidth - brandWidth - toggle.offsetWidth - 8;
    let used = 0;
    let cut = orderedLinks.length;
    for (let i = 0; i < orderedLinks.length; i += 1) {
      used += linkWidths[i];
      if (used > available) { cut = i; break; }
    }
    for (let i = cut; i < orderedLinks.length; i += 1) menu.append(orderedLinks[i]);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; relayout(); });
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(nav);
  window.addEventListener('resize', schedule);
  relayout();
}

function initializeDevice(device) {
  const content = device.querySelector('.screen-content');
  const toggle = device.querySelector('.menu-toggle');
  const menu = device.querySelector('.mobile-menu');
  device.dataset.currentPage = 'Classes';

  device.querySelectorAll('[data-page]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const page = link.dataset.page;
      device.dataset.currentPage = page;
      showPage(content, page);
      device.querySelectorAll('[data-page]').forEach((item) => item.classList.toggle('is-active', item.dataset.page === page));
      if (menu) {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
      }
    });
  });

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
      menu.hidden = open;
    });
  }

  setupResponsiveNav(device);
}

document.querySelectorAll('.device').forEach(initializeDevice);

const mobileViewport = window.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)');

function syncVisibleDevices() {
  const fillMode = mobileViewport.matches || document.querySelector('.mockup-stage').classList.contains('mode-fill');
  document.querySelectorAll('.device').forEach((device) => {
    const active = fillMode ? device.classList.contains('device--fill') : !device.classList.contains('device--fill');
    const content = device.querySelector('.screen-content');
    if (active) {
      showPage(content, device.dataset.currentPage || 'Classes');
    } else {
      clearInterval(content._activityTimer);
      content._activityTimer = undefined;
      content.replaceChildren();
    }
  });
}

mobileViewport.addEventListener('change', syncVisibleDevices);

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const fillMode = button.dataset.mode === 'fill';
    document.querySelector('.mockup-stage').classList.toggle('mode-fill', fillMode);
    document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
    syncVisibleDevices();
  });
});

syncVisibleDevices();

let currentVersion;
async function refreshWhenChanged() {
  try {
    const response = await fetch('/__version', { cache: 'no-store' });
    if (!response.ok) return;
    const nextVersion = await response.text();
    if (currentVersion && currentVersion !== nextVersion) location.reload();
    currentVersion = nextVersion;
  } catch {
    // The visual remains usable if the local development server is restarted.
  }
}

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  refreshWhenChanged();
  setInterval(refreshWhenChanged, 1000);
}
