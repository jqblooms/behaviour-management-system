const STUDENT_OVERVIEW_CODES = [
  ['/', 'Present', '#54ba75'],
  ['\\', 'Present PM', '#54ba75'],
  ['L', 'Late', '#f3c04f'],
  ['O', 'Unauthorised', '#e76c71'],
  ['N', 'Absent', '#e76c71'],
];

function studentOverviewInitials(name) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 3).toUpperCase();
}

function showStudentOverview(content, studentName, className, returnTo) {
  clearInterval(content._activityTimer);
  content._activityTimer = undefined;
  content.replaceChildren();

  const device = content.closest('.device');
  const isMobile = device?.classList.contains('device--mobile')
    || (device?.classList.contains('device--fill') && window.matchMedia('(max-width: 700px)').matches);

  const data = buildAnalyticsData();
  const behaviourAll = data.behaviour.filter((record) => record.pupil === studentName);
  const attendanceAll = data.attendance.filter((record) => record.pupil === studentName);
  const knownClass = behaviourAll[0]?.className || attendanceAll[0]?.className || className;

  const state = {
    from: analyticsDateStr(new Date(Date.now() - 90 * 86400000)),
    to: analyticsDateStr(new Date()),
    direction: 'all',
    codes: new Set(),
    visibleCount: 12,
  };

  const page = document.createElement('section');
  page.className = 'student-overview';
  page.setAttribute('aria-label', `${studentName} overview`);
  page.innerHTML = `
    <div class="student-overview__bar">
      <button class="student-overview__back" type="button">‹ Back to class</button>
      <span class="pupil-photo" aria-hidden="true">${studentOverviewInitials(studentName)}</span>
      <div class="student-overview__id">
        <strong>${studentName}</strong>
        <span>${knownClass}</span>
      </div>
      <span class="student-overview__totals" aria-live="polite"></span>
      <button class="student-overview__filter-toggle" type="button" aria-expanded="true" aria-controls="so-filters">Filters <span class="so-caret" aria-hidden="true">⌃</span></button>
    </div>
    <div class="student-overview__filters" id="so-filters">
      <div class="so-filter">
        <span class="so-filter__label">Period</span>
        <div class="so-period">
          <input class="so-date so-date--from" type="date" value="${state.from}" aria-label="From date">
          <input class="so-date so-date--to" type="date" value="${state.to}" aria-label="To date">
        </div>
        <div class="so-preset-row">
          <button type="button" class="so-preset" data-day="7">7d</button>
          <button type="button" class="so-preset" data-day="30">30d</button>
          <button type="button" class="so-preset" data-day="90">90d</button>
          <button type="button" class="so-preset" data-day="all">All</button>
        </div>
      </div>
      <div class="so-filter">
        <span class="so-filter__label">Behaviour</span>
        <div class="so-direction">
          <button type="button" class="so-direction__button is-active" data-dir="all">All</button>
          <button type="button" class="so-direction__button" data-dir="positive">Positive</button>
          <button type="button" class="so-direction__button" data-dir="negative">Negative</button>
        </div>
      </div>
      <div class="so-filter">
        <span class="so-filter__label">Attendance codes</span>
        <div class="so-codes">
          ${STUDENT_OVERVIEW_CODES.map(([code, label]) => `<label class="so-code"><input type="checkbox" value="${code}"><span>${label}</span></label>`).join('')}
        </div>
      </div>
    </div>
    <div class="student-overview__body">
      <div class="student-overview__charts"></div>
      <div class="student-overview__stats"></div>
      <div class="student-overview__cols">
        <div class="student-overview__panel so-types">
          <h3>Behaviour by type</h3>
          <div class="so-type-list"></div>
        </div>
        <div class="student-overview__panel so-history">
          <h3>Recent activity</h3>
          <div class="so-history-list"></div>
          <button class="so-load-more" type="button" hidden>Load more</button>
        </div>
      </div>
    </div>`;

  const totalsLabel = page.querySelector('.student-overview__totals');
  const chartsHost = page.querySelector('.student-overview__charts');
  const statsHost = page.querySelector('.student-overview__stats');
  const typeList = page.querySelector('.so-type-list');
  const historyList = page.querySelector('.so-history-list');
  const loadMore = page.querySelector('.so-load-more');
  const fromInput = page.querySelector('.so-date--from');
  const toInput = page.querySelector('.so-date--to');

  page.querySelector('.student-overview__back').addEventListener('click', () => {
    if (typeof returnTo === 'function') returnTo();
  });

  const filterToggle = page.querySelector('.student-overview__filter-toggle');
  filterToggle.addEventListener('click', () => {
    const collapsed = page.classList.toggle('is-filters-collapsed');
    filterToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  fromInput.addEventListener('change', () => { state.from = fromInput.value; recompute(true); });
  toInput.addEventListener('change', () => { state.to = toInput.value; recompute(true); });
  page.querySelectorAll('.so-preset').forEach((button) => {
    button.addEventListener('click', () => {
      const day = button.dataset.day;
      const start = day === 'all' ? new Date(Date.now() - 180 * 86400000) : new Date(Date.now() - Number(day) * 86400000);
      state.from = analyticsDateStr(start);
      state.to = analyticsDateStr(new Date());
      fromInput.value = state.from;
      toInput.value = state.to;
      recompute(true);
    });
  });
  page.querySelectorAll('.so-direction__button').forEach((button) => {
    button.addEventListener('click', () => {
      state.direction = button.dataset.dir;
      page.querySelectorAll('.so-direction__button').forEach((el) => el.classList.toggle('is-active', el === button));
      recompute(true);
    });
  });
  page.querySelectorAll('.so-code input').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) state.codes.add(box.value); else state.codes.delete(box.value);
      recompute(true);
    });
  });
  loadMore.addEventListener('click', () => { state.visibleCount += 12; renderHistory(filterRecords().behaviour); });

  function filterRecords() {
    const fromT = state.from ? analyticsDayTime(state.from) : -Infinity;
    const toT = state.to ? analyticsDayTime(state.to) + 86399000 : Infinity;
    const behaviour = behaviourAll.filter((record) => {
      const time = analyticsDayTime(record.date);
      if (time < fromT || time > toT) return false;
      if (state.direction !== 'all' && record.type !== state.direction) return false;
      return true;
    });
    const attendance = attendanceAll.filter((record) => {
      const time = analyticsDayTime(record.date);
      if (time < fromT || time > toT) return false;
      if (state.codes.size && !state.codes.has(record.code)) return false;
      return true;
    });
    return { behaviour, attendance };
  }

  function renderCharts(behaviour, attendance) {
    const positive = behaviour.filter((record) => record.type === 'positive').length;
    const negative = behaviour.filter((record) => record.type === 'negative').length;
    const present = attendance.filter((record) => record.code === '/' || record.code === '\\').length;
    const late = attendance.filter((record) => record.code === 'L').length;
    const absent = attendance.filter((record) => record.code === 'N' || record.code === 'O').length;
    const size = isMobile ? 128 : 150;

    const behaviourSegments = [
      { label: 'Positive', value: positive, color: '#54ba75' },
      { label: 'Negative', value: negative, color: '#e76c71' },
    ].filter((segment) => segment.value > 0);
    const attendanceSegments = [
      { label: 'Present', value: present, color: '#54ba75' },
      { label: 'Late', value: late, color: '#f3c04f' },
      { label: 'Absent', value: absent, color: '#e76c71' },
    ].filter((segment) => segment.value > 0);

    chartsHost.innerHTML = `
      ${chartCard('Positive vs negative', behaviourSegments, size)}
      ${chartCard('Attendance breakdown', attendanceSegments, size)}`;
  }

  function chartCard(heading, segments, size) {
    const legend = segments.length
      ? segments.map((segment) => `<div class="so-legend__item"><i style="background:${segment.color}"></i>${segment.label} · ${segment.value}</div>`).join('')
      : '<div class="so-legend__item so-legend__item--empty">No data in range</div>';
    const chart = segments.length
      ? analyticsPieChart(segments, { size, thickness: 24 })
      : `<div class="so-chart-empty" style="width:${size}px;height:${size}px"></div>`;
    return `<div class="so-chart-card"><div class="so-chart-card__title">${heading}</div>${chart}<div class="so-legend">${legend}</div></div>`;
  }

  function renderStats(behaviour, attendance) {
    const positive = behaviour.filter((record) => record.type === 'positive').length;
    const negative = behaviour.filter((record) => record.type === 'negative').length;
    const detentions = behaviour.filter((record) => record.detention).length;
    const presentDays = attendance.filter((record) => record.code === '/' || record.code === '\\').length;
    const lateDays = attendance.filter((record) => record.code === 'L').length;
    const absentDays = attendance.filter((record) => record.code === 'N' || record.code === 'O').length;
    const percent = attendance.length ? Math.round((presentDays / attendance.length) * 100) : 0;
    const tiles = [
      ['Behaviour logs', behaviour.length],
      ['Positive', positive, 'is-positive'],
      ['Negative', negative, 'is-negative'],
      ['Detentions', detentions],
      ['Attendance', `${percent}%`],
      ['Late days', lateDays],
      ['Absent days', absentDays],
    ];
    statsHost.innerHTML = tiles.map(([label, value, cls]) => `<div class="so-stat ${cls || ''}"><span class="so-stat__value">${value}</span><span class="so-stat__label">${label}</span></div>`).join('');
    totalsLabel.textContent = `+${positive} · −${negative}`;
  }

  function renderTypes(behaviour) {
    const counts = new Map();
    behaviour.forEach((record) => {
      const key = `${record.type}|${record.icon}|${record.label}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!rows.length) {
      typeList.innerHTML = '<p class="so-empty">No behaviour logs in range.</p>';
      return;
    }
    const max = rows[0][1];
    typeList.innerHTML = rows.map(([key, count]) => {
      const [type, icon, label] = key.split('|');
      return `<div class="so-type-row so-type-row--${type}">
        <span class="so-type-row__icon">${icon}</span>
        <span class="so-type-row__label">${type === 'negative' ? '−' : '+'} ${label}</span>
        <span class="so-type-row__bar"><i style="width:${Math.round((count / max) * 100)}%"></i></span>
        <span class="so-type-row__count">${count}</span>
      </div>`;
    }).join('');
  }

  function renderHistory(behaviour) {
    const records = [...behaviour].sort((a, b) => b.date.localeCompare(a.date));
    if (!records.length) {
      historyList.innerHTML = '<p class="so-empty">No activity matches these filters.</p>';
      loadMore.hidden = true;
      return;
    }
    historyList.innerHTML = records.slice(0, state.visibleCount).map((record) => `
      <article class="activity-log activity-log--${record.type}">
        <div class="activity-log__head">
          <div class="activity-log__who"><span class="activity-log__name">${record.type === 'negative' ? '−' : '+'} ${record.label}</span><span class="activity-log__class">${record.className} · ${record.teacher}</span></div>
          <span class="activity-log__time">${record.date}</span>
        </div>
        <div class="activity-log__body"><span class="activity-log__dot" aria-hidden="true">${record.icon}</span><span class="activity-log__label">${record.note ? `“${record.note}”` : record.label}</span></div>
        ${record.detention ? `<div class="activity-log__detention"><span class="activity-detention__badge">Detention</span><div class="activity-detention__meta"><strong>${record.detention.length}</strong> · ${record.detention.teacher}<br>${record.detention.room}</div><p class="activity-detention__reason">${record.detention.reason}</p></div>` : ''}
      </article>`).join('');
    loadMore.hidden = records.length <= state.visibleCount;
  }

  function recompute(resetHistory) {
    if (resetHistory) state.visibleCount = 12;
    const { behaviour, attendance } = filterRecords();
    renderCharts(behaviour, attendance);
    renderStats(behaviour, attendance);
    renderTypes(behaviour);
    renderHistory(behaviour);
  }

  content.append(page);
  recompute(true);
}
