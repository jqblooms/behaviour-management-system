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
  Messages: (content) => showTeacherMessages(content),
  Admin: (content) => showAdminPage(content),
};

const ROLE_NAV = {
  student: ['Attendance', 'Behaviour'],
  parent: ['Attendance', 'Behaviour', 'Messages'],
};

function roleDefaultPage(role) {
  return role === 'teacher' ? 'Classes' : ROLE_NAV[role][0];
}

function showPage(content, page) {
  clearInterval(content._activityTimer);
  content._activityTimer = undefined;
  content.replaceChildren();
  const device = content.closest('.device');
  const role = device?.dataset.role || 'teacher';
  if (role !== 'teacher') return showFamilyPage(content, page, role);
  const render = pageRenderers[page];
  if (render) return render(content);
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder-page';
  placeholder.textContent = page;
  content.append(placeholder);
}

function navigateTo(device, page) {
  const content = device.querySelector('.screen-content');
  device.dataset.currentPage = page;
  showPage(content, page);
  device.querySelectorAll('[data-page]').forEach((item) => item.classList.toggle('is-active', item.dataset.page === page));
  const menu = device.querySelector('.mobile-menu');
  const toggle = device.querySelector('.menu-toggle');
  if (menu && toggle) {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  }
}

function wireNavLink(device, link) {
  if (link._navWired) return;
  link._navWired = true;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigateTo(device, link.dataset.page);
  });
}

function applyRole(device, role) {
  device.dataset.role = role;
  const linksContainer = device.querySelector('.nav-links');
  const menu = device.querySelector('.mobile-menu');
  const host = linksContainer || menu;
  if (!host) return;
  const list = role === 'teacher'
    ? device._teacherLinks
    : ROLE_NAV[role].map((name) => ({ page: name, href: `#${name.toLowerCase()}`, label: name }));
  host.replaceChildren(...list.map((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.dataset.page = item.page;
    link.textContent = item.label;
    wireNavLink(device, link);
    return link;
  }));
  if (linksContainer && menu) menu.replaceChildren();
  const switcher = device.querySelector('.role-switcher');
  if (switcher) switcher.value = role;
  device._relayoutNav?.();
  navigateTo(device, list[0].page);
}

function setupResponsiveNav(device) {
  const nav = device.querySelector('.navbar');
  const linksContainer = nav?.querySelector('.nav-links');
  const menu = nav?.querySelector('.mobile-menu');
  const toggle = nav?.querySelector('.menu-toggle');
  const brand = nav?.querySelector('.brand');
  if (!nav || !linksContainer || !menu || !toggle) return;

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  }

  const switcher = nav.querySelector('.role-switcher');

  function relayout() {
    const navWidth = nav.clientWidth;
    if (!navWidth) return;
    const links = [...linksContainer.children, ...menu.children];
    links.forEach((link) => linksContainer.append(link));
    menu.replaceChildren();
    closeMenu();

    const fixedWidth = (brand ? brand.offsetWidth : 0) + (switcher ? switcher.offsetWidth + 6 : 0);
    const linkWidths = links.map((link) => link.offsetWidth);
    const totalLinks = linkWidths.reduce((sum, width) => sum + width, 0);

    if (fixedWidth + totalLinks <= navWidth) {
      toggle.hidden = true;
      return;
    }

    toggle.hidden = false;
    const available = navWidth - fixedWidth - toggle.offsetWidth - 8;
    let used = 0;
    let cut = links.length;
    for (let i = 0; i < links.length; i += 1) {
      used += linkWidths[i];
      if (used > available) { cut = i; break; }
    }
    for (let i = cut; i < links.length; i += 1) menu.append(links[i]);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; relayout(); });
  }

  device._relayoutNav = relayout;
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(nav);
  window.addEventListener('resize', schedule);
  relayout();
}

function initializeDevice(device) {
  const toggle = device.querySelector('.menu-toggle');
  const menu = device.querySelector('.mobile-menu');
  device.dataset.role = 'teacher';
  device.dataset.currentPage = 'Classes';

  const navHost = device.querySelector('.nav-links') || device.querySelector('.mobile-menu');
  device._teacherLinks = [...navHost.querySelectorAll('a[data-page]')].map((link) => ({
    page: link.dataset.page,
    href: link.getAttribute('href') || `#${link.dataset.page.toLowerCase()}`,
    label: link.textContent.trim(),
  }));

  device.querySelectorAll('[data-page]').forEach((link) => wireNavLink(device, link));

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
      menu.hidden = open;
    });
  }

  const switcher = device.querySelector('.role-switcher');
  if (switcher) {
    switcher.addEventListener('change', () => {
      document.querySelectorAll('.device').forEach((other) => applyRole(other, switcher.value));
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
      showPage(content, device.dataset.currentPage || roleDefaultPage(device.dataset.role || 'teacher'));
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
