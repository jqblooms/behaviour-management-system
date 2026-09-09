/* Student and parent ("family") views: a read-only analytics breakdown for one
   pupil, parent behaviour alerts, and a simulated parent-to-teacher messaging
   app. Students see the same breakdown but cannot message teachers. */

const FAMILY_STUDENT = pupilNames[0];
const FAMILY_YEAR = 'Year 9';

const FAMILY_TEACHERS = [
  { id: 'carter', name: 'Ms Carter', subject: 'Form tutor' },
  { id: 'hughes', name: 'Mr Hughes', subject: 'Mathematics' },
  { id: 'patel', name: 'Ms Patel', subject: 'English' },
  { id: 'singh', name: 'Mr Singh', subject: 'Science' },
  { id: 'green', name: 'Mrs Green', subject: 'Humanities' },
  { id: 'okoro', name: 'Dr Okoro', subject: 'Computing' },
];

const FAMILY_ATT_CODES = {
  '/': ['Present', '#54ba75'],
  '\\': ['Present PM', '#54ba75'],
  L: ['Late', '#f3c04f'],
  O: ['Unauthorised', '#e76c71'],
  N: ['Absent', '#e76c71'],
};

let familyDataCache;
function familyData() {
  if (!familyDataCache) familyDataCache = buildAnalyticsData();
  return familyDataCache;
}

let familyMessageStore;
function familyMessages() {
  if (!familyMessageStore) familyMessageStore = familySeedMessages();
  return familyMessageStore;
}

let familyAlertsDismissed = false;

function familyInitials(name) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 3).toUpperCase();
}

function familyEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function familyMondayOf(date) {
  const day = date.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + shift);
}

function familyAgo(dateStr) {
  const days = Math.round((Date.now() - analyticsDayTime(dateStr)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

function familyClockTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function familyPeerTime(ms) {
  return new Date(ms).toDateString() === new Date().toDateString() ? familyClockTime(ms) : familyDayLabel(ms);
}

function familyDayLabel(ms) {
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((midnight(new Date()) - midnight(new Date(ms))) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return new Date(ms).toLocaleDateString([], { weekday: 'long' });
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function familyWeekLabel(range) {
  const opts = { day: 'numeric', month: 'short' };
  return `${range.monday.toLocaleDateString([], opts)} – ${range.friday.toLocaleDateString([], opts)}`;
}

function familyChartCard(heading, segments) {
  const size = 150;
  const legend = segments.length
    ? segments.map((seg) => `<div class="so-legend__item"><i style="background:${seg.color}"></i>${seg.label} · ${seg.value}</div>`).join('')
    : '<div class="so-legend__item so-legend__item--empty">No data in range</div>';
  const chart = segments.length
    ? analyticsPieChart(segments, { size, thickness: 24 })
    : `<div class="so-chart-empty" style="width:${size}px;height:${size}px"></div>`;
  return `<div class="so-chart-card"><div class="so-chart-card__title">${heading}</div>${chart}<div class="so-legend">${legend}</div></div>`;
}

function familyStat(label, value, cls) {
  return `<div class="so-stat ${cls || ''}"><span class="so-stat__value">${value}</span><span class="so-stat__label">${label}</span></div>`;
}

function familyAlertRecords() {
  return familyData().behaviour
    .filter((record) => record.pupil === FAMILY_STUDENT && record.type === 'negative')
    .filter((record) => Date.now() - analyticsDayTime(record.date) <= 14 * 86400000)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}

function familyAlertBanner() {
  if (familyAlertsDismissed) return '';
  const records = familyAlertRecords();
  if (!records.length) return '';
  const items = records.map((record) => `<li><span>−</span> ${record.label} · ${record.className} · <em>${familyAgo(record.date)}</em>${record.detention ? ' · detention set' : ''}</li>`).join('');
  return `<div class="family-alert" role="status">
    <div class="family-alert__head">
      <span class="family-alert__bell" aria-hidden="true">🔔</span>
      <strong>${records.length} behaviour alert${records.length === 1 ? '' : 's'} in the last fortnight</strong>
      <button class="family-alert__close" type="button" aria-label="Dismiss alerts">×</button>
    </div>
    <ul class="family-alert__list">${items}</ul>
  </div>`;
}

function wireAlertBanner(scope) {
  const close = scope.querySelector('.family-alert__close');
  if (!close) return;
  close.addEventListener('click', () => {
    familyAlertsDismissed = true;
    scope.querySelector('.family-alert')?.remove();
  });
}

function showFamilyPage(content, page, role) {
  const pages = role === 'parent' ? ['Attendance', 'Behaviour', 'Messages'] : ['Attendance', 'Behaviour'];
  const active = pages.includes(page) ? page : 'Attendance';

  const view = document.createElement('section');
  view.className = `family-view family-view--${role}`;
  view.setAttribute('aria-label', `${FAMILY_STUDENT} ${role} view`);
  view.innerHTML = `
    <header class="family-id">
      <span class="pupil-photo" aria-hidden="true">${familyInitials(FAMILY_STUDENT)}</span>
      <div class="family-id__text">
        <strong>${FAMILY_STUDENT}</strong>
        <span>${role === 'parent' ? 'Parent view' : 'Student view'} · ${FAMILY_YEAR}</span>
      </div>
    </header>
    <div class="family-body"></div>`;
  const body = view.querySelector('.family-body');
  content.append(view);

  if (active === 'Messages') renderFamilyMessages(body, content);
  else renderFamilyReport(body, active, role);
}

function renderFamilyReport(body, tab, role) {
  const behaviourAll = familyData().behaviour.filter((record) => record.pupil === FAMILY_STUDENT);
  const attendanceAll = familyData().attendance.filter((record) => record.pupil === FAMILY_STUDENT);
  const today = new Date();

  const state = {
    weekOffset: 0,
    useRange: false,
    from: analyticsDateStr(new Date(Date.now() - 30 * 86400000)),
    to: analyticsDateStr(today),
    direction: 'all',
  };

  const page = document.createElement('div');
  page.className = 'student-overview family-report';
  page.innerHTML = `
    <div class="student-overview__bar family-report__bar">
      <strong>${tab}</strong>
      <span class="student-overview__totals" aria-live="polite"></span>
      <button class="student-overview__filter-toggle" type="button" aria-expanded="true">Filters <span class="so-caret" aria-hidden="true">⌃</span></button>
    </div>
    <div class="student-overview__filters"></div>
    <div class="student-overview__body"></div>`;
  body.append(page);

  const filters = page.querySelector('.student-overview__filters');
  const out = page.querySelector('.student-overview__body');
  const totals = page.querySelector('.student-overview__totals');
  const toggle = page.querySelector('.student-overview__filter-toggle');
  toggle.addEventListener('click', () => {
    const collapsed = page.classList.toggle('is-filters-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });

  function weekRange() {
    const monday = familyMondayOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + state.weekOffset * 7));
    const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
    return { monday, friday, from: analyticsDateStr(monday), to: analyticsDateStr(friday) };
  }

  function activeRange() {
    if (tab === 'Attendance' && !state.useRange) return weekRange();
    return { from: state.from, to: state.to };
  }

  function inRange(list) {
    const range = activeRange();
    const fromT = analyticsDayTime(range.from);
    const toT = analyticsDayTime(range.to) + 86399000;
    return list.filter((record) => {
      const time = analyticsDayTime(record.date);
      return time >= fromT && time <= toT;
    });
  }

  function renderFilters() {
    if (tab === 'Attendance') {
      const range = weekRange();
      filters.innerHTML = `
        <div class="so-filter">
          <span class="so-filter__label">Week</span>
          <div class="fam-week-nav">
            <button type="button" class="fam-week-step" data-step="-1" aria-label="Previous week">‹</button>
            <span class="fam-week-label">${state.useRange ? 'Custom range' : familyWeekLabel(range)}</span>
            <button type="button" class="fam-week-step" data-step="1" aria-label="Next week"${!state.useRange && state.weekOffset >= 0 ? ' disabled' : ''}>›</button>
          </div>
          <button type="button" class="so-preset fam-this-week">This week</button>
        </div>
        <div class="so-filter">
          <span class="so-filter__label">Or date range</span>
          <div class="so-period">
            <input class="so-date fam-from" type="date" value="${state.from}" aria-label="From date">
            <input class="so-date fam-to" type="date" value="${state.to}" aria-label="To date">
          </div>
        </div>`;
      filters.querySelectorAll('.fam-week-step').forEach((button) => button.addEventListener('click', () => {
        state.useRange = false;
        state.weekOffset = Math.min(0, state.weekOffset + Number(button.dataset.step));
        update();
      }));
      filters.querySelector('.fam-this-week').addEventListener('click', () => { state.useRange = false; state.weekOffset = 0; update(); });
      filters.querySelector('.fam-from').addEventListener('change', (event) => { state.from = event.target.value; state.useRange = true; update(); });
      filters.querySelector('.fam-to').addEventListener('change', (event) => { state.to = event.target.value; state.useRange = true; update(); });
    } else {
      filters.innerHTML = `
        <div class="so-filter">
          <span class="so-filter__label">Period</span>
          <div class="so-period">
            <input class="so-date fam-from" type="date" value="${state.from}" aria-label="From date">
            <input class="so-date fam-to" type="date" value="${state.to}" aria-label="To date">
          </div>
          <div class="so-preset-row">
            <button type="button" class="so-preset" data-day="7">7d</button>
            <button type="button" class="so-preset" data-day="30">30d</button>
            <button type="button" class="so-preset" data-day="90">90d</button>
          </div>
        </div>
        <div class="so-filter">
          <span class="so-filter__label">Direction</span>
          <div class="so-direction">
            <button type="button" class="so-direction__button${state.direction === 'all' ? ' is-active' : ''}" data-dir="all">All</button>
            <button type="button" class="so-direction__button${state.direction === 'positive' ? ' is-active' : ''}" data-dir="positive">Positive</button>
            <button type="button" class="so-direction__button${state.direction === 'negative' ? ' is-active' : ''}" data-dir="negative">Negative</button>
          </div>
        </div>`;
      filters.querySelector('.fam-from').addEventListener('change', (event) => { state.from = event.target.value; update(); });
      filters.querySelector('.fam-to').addEventListener('change', (event) => { state.to = event.target.value; update(); });
      filters.querySelectorAll('.so-preset').forEach((button) => button.addEventListener('click', () => {
        state.from = analyticsDateStr(new Date(Date.now() - Number(button.dataset.day) * 86400000));
        state.to = analyticsDateStr(new Date());
        update();
      }));
      filters.querySelectorAll('.so-direction__button').forEach((button) => button.addEventListener('click', () => {
        state.direction = button.dataset.dir;
        update();
      }));
    }
  }

  function weekGrid() {
    const range = weekRange();
    const cells = [];
    for (let i = 0; i < 5; i += 1) {
      const day = new Date(range.monday.getFullYear(), range.monday.getMonth(), range.monday.getDate() + i);
      const key = analyticsDateStr(day);
      const record = attendanceAll.find((entry) => entry.date === key);
      let label = 'No data';
      let color = '#c9d4d9';
      if (record) { [label, color] = FAMILY_ATT_CODES[record.code] || [record.code, '#9aa7ae']; }
      else if (analyticsDayTime(key) > Date.now()) label = 'Upcoming';
      const late = record && record.code === 'L' && record.minutes ? ` (${record.minutes}m)` : '';
      cells.push(`<div class="fam-day">
        <span class="fam-day__name">${day.toLocaleDateString([], { weekday: 'short' })}</span>
        <span class="fam-day__date">${day.getDate()}</span>
        <span class="fam-day__code" style="background:${color}">${label}${late}</span>
      </div>`);
    }
    return `<div class="student-overview__panel"><h3>Week of ${familyWeekLabel(range)}</h3><div class="fam-week">${cells.join('')}</div></div>`;
  }

  function attendanceHistory(rows) {
    if (!rows.length) return '<p class="so-empty">No attendance records for this period.</p>';
    return [...rows].sort((a, b) => b.date.localeCompare(a.date)).map((record) => {
      const [label, color] = FAMILY_ATT_CODES[record.code] || ['—', '#9aa7ae'];
      return `<article class="activity-log activity-log--attendance">
        <div class="activity-log__head">
          <div class="activity-log__who"><span class="activity-log__name">${label}</span><span class="activity-log__class">${record.className}</span></div>
          <span class="attendance-pill" style="background:${color}">${record.date}</span>
        </div>
        ${record.code === 'L' && record.minutes ? `<div class="activity-log__body"><span class="activity-log__label">${record.minutes} minutes late</span></div>` : ''}
      </article>`;
    }).join('');
  }

  function behaviourHistory(rows) {
    if (!rows.length) return '<p class="so-empty">No behaviour logs for this period.</p>';
    return [...rows].sort((a, b) => b.date.localeCompare(a.date)).map((record) => `
      <article class="activity-log activity-log--${record.type}">
        <div class="activity-log__head">
          <div class="activity-log__who"><span class="activity-log__name">${record.type === 'negative' ? '−' : '+'} ${record.label}</span><span class="activity-log__class">${record.className} · ${record.teacher}</span></div>
          <span class="activity-log__time">${record.date}</span>
        </div>
        <div class="activity-log__body"><span class="activity-log__dot" aria-hidden="true">${record.icon}</span><span class="activity-log__label">${record.note ? `“${familyEscape(record.note)}”` : record.label}</span></div>
        ${record.detention ? `<div class="activity-log__detention"><span class="activity-detention__badge">Detention</span><div class="activity-detention__meta"><strong>${record.detention.length}</strong> · ${record.detention.teacher}<br>${record.detention.room}</div><p class="activity-detention__reason">${record.detention.reason}</p></div>` : ''}
      </article>`).join('');
  }

  function renderAttendance() {
    const rows = inRange(attendanceAll);
    const present = rows.filter((record) => record.code === '/' || record.code === '\\').length;
    const late = rows.filter((record) => record.code === 'L').length;
    const absent = rows.filter((record) => record.code === 'N' || record.code === 'O').length;
    const percent = rows.length ? Math.round((present / rows.length) * 100) : 0;
    totals.textContent = rows.length ? `${percent}% present` : 'No records';
    const segments = [
      { label: 'Present', value: present, color: '#54ba75' },
      { label: 'Late', value: late, color: '#f3c04f' },
      { label: 'Absent', value: absent, color: '#e76c71' },
    ].filter((segment) => segment.value > 0);

    out.innerHTML = `
      ${role === 'parent' ? familyAlertBanner() : ''}
      <div class="student-overview__charts family-report__charts--single">${familyChartCard('Attendance breakdown', segments)}</div>
      <div class="student-overview__stats">
        ${familyStat('Attendance', `${percent}%`)}
        ${familyStat('Present', present, 'is-positive')}
        ${familyStat('Late', late, 'is-warn')}
        ${familyStat('Absent', absent, 'is-negative')}
        ${familyStat('Sessions', rows.length)}
      </div>
      ${!state.useRange ? weekGrid() : ''}
      <div class="student-overview__panel"><h3>Attendance history</h3><div class="so-history-list">${attendanceHistory(rows)}</div></div>`;
    wireAlertBanner(out);
  }

  function renderBehaviour() {
    let rows = inRange(behaviourAll);
    if (state.direction !== 'all') rows = rows.filter((record) => record.type === state.direction);
    const positive = rows.filter((record) => record.type === 'positive').length;
    const negative = rows.filter((record) => record.type === 'negative').length;
    const detentions = rows.filter((record) => record.detention).length;
    totals.textContent = `+${positive} · −${negative}`;
    const segments = [
      { label: 'Positive', value: positive, color: '#54ba75' },
      { label: 'Negative', value: negative, color: '#e76c71' },
    ].filter((segment) => segment.value > 0);

    const counts = new Map();
    rows.forEach((record) => {
      const key = `${record.type}|${record.icon}|${record.label}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const typeRows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = typeRows[0] ? typeRows[0][1] : 1;
    const typeList = typeRows.length
      ? typeRows.map(([key, count]) => {
        const [type, icon, label] = key.split('|');
        return `<div class="so-type-row so-type-row--${type}">
          <span class="so-type-row__icon">${icon}</span>
          <span class="so-type-row__label">${type === 'negative' ? '−' : '+'} ${label}</span>
          <span class="so-type-row__bar"><i style="width:${Math.round((count / max) * 100)}%"></i></span>
          <span class="so-type-row__count">${count}</span>
        </div>`;
      }).join('')
      : '<p class="so-empty">No behaviour logs in this period.</p>';

    out.innerHTML = `
      ${role === 'parent' ? familyAlertBanner() : ''}
      <div class="student-overview__charts family-report__charts--single">${familyChartCard('Positive vs negative', segments)}</div>
      <div class="student-overview__stats">
        ${familyStat('Logs', rows.length)}
        ${familyStat('Positive', positive, 'is-positive')}
        ${familyStat('Negative', negative, 'is-negative')}
        ${familyStat('Detentions', detentions)}
      </div>
      <div class="student-overview__cols">
        <div class="student-overview__panel"><h3>Behaviour by type</h3><div class="so-type-list">${typeList}</div></div>
        <div class="student-overview__panel"><h3>Recent activity</h3><div class="so-history-list">${behaviourHistory(rows)}</div></div>
      </div>`;
    wireAlertBanner(out);
  }

  function update() {
    renderFilters();
    if (tab === 'Attendance') renderAttendance();
    else renderBehaviour();
  }

  update();
}

function familySeedMessages() {
  const now = Date.now();
  const hour = 3600000;
  const day = 86400000;
  return {
    carter: [
      { from: 'teacher', text: 'Good afternoon — just a note that Aisha has settled in really well this term.', at: now - 3 * day - 5 * hour },
      { from: 'parent', text: 'Thank you, that’s lovely to hear.', at: now - 3 * day - 4 * hour },
      { from: 'teacher', text: 'Parents’ evening is on the 24th — I’ll share a booking link next week.', at: now - 2 * day - 2 * hour },
    ],
    hughes: [
      { from: 'teacher', text: 'Aisha scored 84% on the algebra assessment — a real step up.', at: now - 6 * day },
      { from: 'parent', text: 'That’s great, she’s been practising most evenings.', at: now - 6 * day + 2 * hour },
      { from: 'teacher', text: 'It shows. A bit of practice over half term would keep the momentum.', at: now - 6 * day + 3 * hour },
    ],
    patel: [
      { from: 'parent', text: 'Hi Ms Patel, which book does Aisha need for next week?', at: now - 1 * day - 3 * hour },
      { from: 'teacher', text: 'It’s “Animal Farm” — we start reading on Monday.', at: now - 1 * day - 2 * hour },
    ],
    singh: [
      { from: 'teacher', text: 'Reminder: safety goggles are needed for Thursday’s practical.', at: now - 5 * hour },
    ],
    green: [],
    okoro: [
      { from: 'teacher', text: 'Aisha’s Scratch game was one of the best in the class today.', at: now - 9 * hour },
      { from: 'parent', text: 'She was so proud of it — thank you for letting me know.', at: now - 8 * hour },
    ],
  };
}

function familyLastMessage(id) {
  const list = familyMessages()[id] || [];
  return list[list.length - 1] || null;
}

function renderFamilyMessages(body, content) {
  const device = content.closest('.device');
  const narrow = () => !!device && (device.classList.contains('device--mobile')
    || (device.classList.contains('device--fill') && window.matchMedia('(max-width: 700px)').matches));

  const app = document.createElement('div');
  app.className = 'msg-app';
  app.innerHTML = `
    <aside class="msg-list">
      <div class="msg-list__head"><strong>${FAMILY_STUDENT.split(' ')[0]}’s teachers</strong></div>
      <div class="msg-list__scroll"></div>
    </aside>
    <section class="msg-thread">
      <div class="msg-thread__head">
        <button class="msg-list-toggle" type="button" aria-label="Show or hide teacher list">☰</button>
        <span class="pupil-photo msg-thread__avatar" aria-hidden="true"></span>
        <span class="msg-thread__who"></span>
      </div>
      <div class="msg-scroll" aria-live="polite"></div>
      <form class="msg-compose">
        <input class="msg-input" type="text" placeholder="Type a message" aria-label="Message to teacher" autocomplete="off">
        <button class="msg-send" type="submit">Send</button>
      </form>
    </section>`;
  body.append(app);

  const listScroll = app.querySelector('.msg-list__scroll');
  const scroll = app.querySelector('.msg-scroll');
  const who = app.querySelector('.msg-thread__who');
  const avatar = app.querySelector('.msg-thread__avatar');
  const form = app.querySelector('.msg-compose');
  const input = app.querySelector('.msg-input');
  let currentId = FAMILY_TEACHERS[0].id;

  app.querySelector('.msg-list-toggle').addEventListener('click', () => app.classList.toggle('is-list-hidden'));

  function renderPeers() {
    listScroll.replaceChildren();
    FAMILY_TEACHERS.forEach((teacher) => {
      const last = familyLastMessage(teacher.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `msg-peer${teacher.id === currentId ? ' is-active' : ''}`;
      row.innerHTML = `
        <span class="pupil-photo" aria-hidden="true">${familyInitials(teacher.name)}</span>
        <span class="msg-peer__text">
          <span class="msg-peer__row"><strong>${teacher.name}</strong><span class="msg-peer__time">${last ? familyPeerTime(last.at) : ''}</span></span>
          <span class="msg-peer__preview">${last ? `${last.from === 'parent' ? 'You: ' : ''}${familyEscape(last.text)}` : teacher.subject}</span>
        </span>`;
      row.addEventListener('click', () => {
        currentId = teacher.id;
        renderPeers();
        renderThread();
        if (narrow()) app.classList.add('is-list-hidden');
        input.focus();
      });
      listScroll.append(row);
    });
  }

  function renderThread() {
    const teacher = FAMILY_TEACHERS.find((entry) => entry.id === currentId);
    who.textContent = `${teacher.name} · ${teacher.subject}`;
    avatar.textContent = familyInitials(teacher.name);
    const messages = familyMessages()[currentId] || [];
    if (!messages.length) {
      scroll.innerHTML = '<p class="msg-empty">No messages yet — send the first one below.</p>';
      return;
    }
    let html = '';
    let lastDay = '';
    messages.forEach((message) => {
      const label = familyDayLabel(message.at);
      if (label !== lastDay) { html += `<div class="msg-day">${label}</div>`; lastDay = label; }
      const meta = `${familyClockTime(message.at)}${message.from === 'parent' ? ' <span class="msg-tick">✓✓</span>' : ''}`;
      html += `<div class="msg-bubble msg-bubble--${message.from === 'parent' ? 'out' : 'in'}">
        <span class="msg-bubble__text">${familyEscape(message.text)}</span>
        <span class="msg-bubble__meta">${meta}</span>
      </div>`;
    });
    scroll.innerHTML = html;
    scroll.scrollTop = scroll.scrollHeight;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!familyMessages()[currentId]) familyMessages()[currentId] = [];
    familyMessages()[currentId].push({ from: 'parent', text, at: Date.now() });
    input.value = '';
    renderThread();
    renderPeers();
  });

  renderPeers();
  renderThread();
}

/* Teacher side of the same messaging app: pick a class, then a pupil, then
   message home. Existing conversations are listed newest-first. */

let teacherMessageStore;
function teacherMessages() {
  if (!teacherMessageStore) teacherMessageStore = teacherSeedMessages();
  return teacherMessageStore;
}

function teacherSeedMessages() {
  const now = Date.now();
  const hour = 3600000;
  const day = 86400000;
  return {
    'Ben Carter': { className: 'Y1/Cs', messages: [
      { from: 'teacher', text: 'Hi — Ben left his PE kit today, could it come back in tomorrow?', at: now - 2 * day - 3 * hour },
      { from: 'parent', text: 'Sorry about that, will send it in.', at: now - 2 * day - 2 * hour },
    ] },
    'Grace Hall': { className: 'Y6/Cs', messages: [
      { from: 'parent', text: 'Is Grace behind on the reading log?', at: now - 6 * hour },
      { from: 'teacher', text: 'A little — two entries would catch her up, nothing to worry about.', at: now - 5 * hour },
    ] },
    'Noah Okafor': { className: 'Y3/Cs', messages: [
      { from: 'teacher', text: 'Noah had a great week — three merits for helping others.', at: now - 1 * day },
    ] },
    'Isla James': { className: 'Y8/Cs', messages: [
      { from: 'teacher', text: 'Reminder: parents’ evening booking closes Friday.', at: now - 35 * 60000 },
    ] },
  };
}

function showTeacherMessages(content) {
  const device = content.closest('.device');
  const narrow = () => !!device && (device.classList.contains('device--mobile')
    || (device.classList.contains('device--fill') && window.matchMedia('(max-width: 700px)').matches));

  const view = document.createElement('section');
  view.className = 'family-view family-view--teacher';
  view.setAttribute('aria-label', 'Parent messages');
  view.innerHTML = `
    <header class="family-id">
      <span class="pupil-photo" aria-hidden="true">✉</span>
      <div class="family-id__text"><strong>Messages</strong><span>Message home about a pupil</span></div>
    </header>
    <div class="family-body">
      <div class="msg-app">
        <aside class="msg-list">
          <div class="msg-list__head"><strong>Conversations</strong><button class="msg-new" type="button">＋ New</button></div>
          <div class="msg-new-picker" hidden>
            <select class="msg-new-class" aria-label="Class"><option value="">Choose a class…</option>${classes.map(([name]) => `<option value="${name}">${name}</option>`).join('')}</select>
            <select class="msg-new-student" aria-label="Pupil" disabled><option value="">Choose a pupil…</option></select>
            <div class="msg-new-actions"><button class="msg-new-cancel" type="button">Cancel</button><button class="msg-new-start confirm" type="button" disabled>Start</button></div>
          </div>
          <div class="msg-list__scroll"></div>
        </aside>
        <section class="msg-thread">
          <div class="msg-thread__head">
            <button class="msg-list-toggle" type="button" aria-label="Show or hide conversations">☰</button>
            <span class="pupil-photo msg-thread__avatar" aria-hidden="true"></span>
            <span class="msg-thread__who"></span>
          </div>
          <div class="msg-scroll" aria-live="polite"></div>
          <form class="msg-compose">
            <input class="msg-input" type="text" placeholder="Message home…" aria-label="Message to parent" autocomplete="off">
            <button class="msg-send" type="submit">Send</button>
          </form>
        </section>
      </div>
    </div>`;
  content.append(view);

  const app = view.querySelector('.msg-app');
  const listScroll = view.querySelector('.msg-list__scroll');
  const scroll = view.querySelector('.msg-scroll');
  const who = view.querySelector('.msg-thread__who');
  const avatar = view.querySelector('.msg-thread__avatar');
  const form = view.querySelector('.msg-compose');
  const input = view.querySelector('.msg-input');
  const picker = view.querySelector('.msg-new-picker');
  const classSelect = view.querySelector('.msg-new-class');
  const studentSelect = view.querySelector('.msg-new-student');
  const startButton = view.querySelector('.msg-new-start');

  let current = teacherConversationsSorted()[0]?.student || null;

  view.querySelector('.msg-list-toggle').addEventListener('click', () => app.classList.toggle('is-list-hidden'));
  view.querySelector('.msg-new').addEventListener('click', () => { picker.hidden = false; });
  view.querySelector('.msg-new-cancel').addEventListener('click', () => { picker.hidden = true; });
  classSelect.addEventListener('change', () => {
    const roster = classSelect.value ? getClassRoster(classSelect.value) : [];
    studentSelect.innerHTML = `<option value="">Choose a pupil…</option>${roster.map((name) => `<option value="${name}">${name}</option>`).join('')}`;
    studentSelect.disabled = !roster.length;
    startButton.disabled = true;
  });
  studentSelect.addEventListener('change', () => { startButton.disabled = !studentSelect.value; });
  startButton.addEventListener('click', () => {
    const student = studentSelect.value;
    if (!student) return;
    if (!teacherMessages()[student]) teacherMessages()[student] = { className: classSelect.value, messages: [] };
    current = student;
    picker.hidden = true;
    classSelect.value = '';
    studentSelect.innerHTML = '<option value="">Choose a pupil…</option>';
    studentSelect.disabled = true;
    startButton.disabled = true;
    renderConversations();
    renderThread();
    if (narrow()) app.classList.add('is-list-hidden');
    input.focus();
  });

  function teacherConversationsSorted() {
    return Object.entries(teacherMessages())
      .map(([student, conv]) => ({ student, className: conv.className, last: conv.messages[conv.messages.length - 1] }))
      .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
  }

  function renderConversations() {
    listScroll.replaceChildren();
    const rows = teacherConversationsSorted();
    if (!rows.length) {
      listScroll.innerHTML = '<p class="msg-empty">No conversations yet — start one with “＋ New”.</p>';
      return;
    }
    rows.forEach(({ student, className, last }) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `msg-peer${student === current ? ' is-active' : ''}`;
      row.innerHTML = `
        <span class="pupil-photo" aria-hidden="true">${familyInitials(student)}</span>
        <span class="msg-peer__text">
          <span class="msg-peer__row"><strong>${student}</strong><span class="msg-peer__time">${last ? familyPeerTime(last.at) : ''}</span></span>
          <span class="msg-peer__preview">${last ? `${last.from === 'teacher' ? 'You: ' : ''}${familyEscape(last.text)}` : className}</span>
        </span>`;
      row.addEventListener('click', () => {
        current = student;
        renderConversations();
        renderThread();
        if (narrow()) app.classList.add('is-list-hidden');
        input.focus();
      });
      listScroll.append(row);
    });
  }

  function renderThread() {
    if (!current || !teacherMessages()[current]) {
      who.textContent = 'Select a conversation';
      avatar.textContent = '';
      scroll.innerHTML = '<p class="msg-empty">Choose a pupil on the left, or start a new message.</p>';
      return;
    }
    const conv = teacherMessages()[current];
    who.textContent = `${current} · ${conv.className}`;
    avatar.textContent = familyInitials(current);
    if (!conv.messages.length) {
      scroll.innerHTML = '<p class="msg-empty">No messages yet — send the first one below.</p>';
      return;
    }
    let html = '';
    let lastDay = '';
    conv.messages.forEach((message) => {
      const label = familyDayLabel(message.at);
      if (label !== lastDay) { html += `<div class="msg-day">${label}</div>`; lastDay = label; }
      const meta = `${familyClockTime(message.at)}${message.from === 'teacher' ? ' <span class="msg-tick">✓✓</span>' : ''}`;
      html += `<div class="msg-bubble msg-bubble--${message.from === 'teacher' ? 'out' : 'in'}">
        <span class="msg-bubble__text">${familyEscape(message.text)}</span>
        <span class="msg-bubble__meta">${meta}</span>
      </div>`;
    });
    scroll.innerHTML = html;
    scroll.scrollTop = scroll.scrollHeight;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !current) return;
    if (!teacherMessages()[current]) teacherMessages()[current] = { className: '', messages: [] };
    teacherMessages()[current].messages.push({ from: 'teacher', text, at: Date.now() });
    input.value = '';
    renderThread();
    renderConversations();
  });

  renderConversations();
  renderThread();
}
