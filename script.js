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
