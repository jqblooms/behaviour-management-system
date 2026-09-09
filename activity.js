const activityAwards = {
  positive: [['↑', 'Merit'], ['♥', 'Caring'], ['★', 'Star student'], ['✓', 'On task'], ['☀', 'Participation'], ['⚑', 'Teamwork'], ['1', 'Level 1'], ['2', 'Level 2']],
  negative: [['!', 'Warning'], ['↺', 'Retry'], ['⊘', 'Off task'], ['⌁', 'Disruption'], ['↯', 'Late work'], ['?', 'No equipment'], ['1', 'Level 1'], ['2', 'Level 2']],
};
const activityTeachers = ['Ms Carter', 'Mr Hughes', 'Ms Patel', 'Mr Singh', 'Mrs Green', 'Dr Okoro'];
const activityRooms = ['Computer Room 645', 'Computer Room 612', 'Innovation Lab', 'Library Suite', 'Science Lab 101'];

function buildInitialActivityLogs(nowMs) {
  const logs = [];
  const notes = {
    positive: ['Excellent effort this lesson.', 'Great contribution to the class discussion.', 'Persevered with the task.', 'Helped a peer in class.'],
    negative: ['Reminded repeatedly but continued.', 'Distracted the table next to them.', 'Did not complete the task.', 'Called out during the lesson.'],
  };
  const detentionReasons = ['Missed the start of the lesson.', 'Classroom disruption.', 'Late to lesson.', 'Failure to complete homework.'];
  const detentionLengths = ['30 minutes', '45 minutes', '60 minutes'];
  for (let i = 0, n = 60; i < n; i++) {
    const studentName = pupilNames[(i * 7 + 3) % pupilNames.length];
    const className = classes[(i * 5) % classes.length][0];
    const type = i % 3 === 0 ? 'negative' : 'positive';
    const award = activityAwards[type][(i * 3) % activityAwards[type].length];
    const hasDetention = type === 'negative' && i % 6 === 0;
    logs.push({
      id: `seed-${i}`,
      timestamp: new Date(nowMs - i * 47 * 60000),
      className,
      studentName,
      type,
      label: award[1],
      icon: award[0],
      note: i % 4 === 2 ? undefined : notes[type][(i * 5) % notes[type].length],
      detention: hasDetention ? {
        length: detentionLengths[i % detentionLengths.length],
        teacher: activityTeachers[i % activityTeachers.length],
        room: activityRooms[i % activityRooms.length],
        reason: detentionReasons[i % detentionReasons.length],
      } : undefined,
    });
  }
  return logs;
}

function showActivityPage(content) {
  const device = content.closest('.device');
  const isMobile = device?.classList.contains('device--mobile') || (device?.classList.contains('device--fill') && window.matchMedia('(max-width: 700px)').matches);
  const totals = new Map();
  pupilNames.forEach((name, index) => totals.set(name, { positive: (index * 3 + 2) % 9, negative: (index + 1) % 4 }));
  const logs = buildInitialActivityLogs(Date.now());
  const state = { filterClass: 'all', filterDate: 'all', sort: 'new', visibleCount: 10 };
  const page = document.createElement('div');
  page.className = 'activity-page';
  page.setAttribute('aria-label', 'Behaviour activity feed');

  const toolbar = document.createElement('div');
  toolbar.className = 'activity-toolbar';
  const classSelect = document.createElement('select');
  classSelect.className = 'activity-filter activity-filter--class';
  classSelect.setAttribute('aria-label', 'Filter behaviour by class');
  classSelect.append(new Option('All classes', 'all'));
  classes.forEach(([name]) => classSelect.append(new Option(name, name)));
  classSelect.value = 'all';
  const dateSelect = document.createElement('select');
  dateSelect.className = 'activity-filter activity-filter--date';
  dateSelect.setAttribute('aria-label', 'Filter behaviour by date');
  [['All time', 'all'], ['Today', 'today'], ['Last 7 days', 'week'], ['Last 30 days', 'month'], ['Custom range…', 'custom']].forEach(([label, value]) => dateSelect.append(new Option(label, value)));
  const range = document.createElement('div');
  range.className = 'activity-date-range';
  range.hidden = true;
  const rangeFrom = document.createElement('input');
  rangeFrom.className = 'activity-date';
  rangeFrom.type = 'date';
  rangeFrom.setAttribute('aria-label', 'From date');
  const rangeTo = document.createElement('input');
  rangeTo.className = 'activity-date';
  rangeTo.type = 'date';
  rangeTo.setAttribute('aria-label', 'To date');
  const fromLabel = document.createElement('span');
  fromLabel.className = 'activity-date-range__label';
  fromLabel.textContent = 'From';
  const toLabel = document.createElement('span');
  toLabel.className = 'activity-date-range__label';
  toLabel.textContent = 'To';
  range.append(fromLabel, rangeFrom, toLabel, rangeTo);
  const sort = document.createElement('div');
  sort.className = 'activity-sort';
  const sortButtons = [['new', 'Newest'], ['old', 'Oldest']].map(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `activity-sort__button${value === state.sort ? ' is-active' : ''}`;
    button.dataset.sort = value;
    button.textContent = label;
    button.addEventListener('click', () => {
      state.sort = value;
      sortButtons.forEach((el) => el.classList.toggle('is-active', el.dataset.sort === value));
      renderList();
    });
    sort.append(button);
    return button;
  });
  toolbar.append(classSelect, dateSelect, sort, range);

  const list = document.createElement('div');
  list.className = 'activity-list';
  const loadMore = document.createElement('button');
  loadMore.className = 'activity-load-more';
  loadMore.type = 'button';
  loadMore.textContent = 'Load more';
  loadMore.addEventListener('click', () => { state.visibleCount += 10; renderList(); });

  page.append(toolbar, list, loadMore);

  function matchesFilters(log, nowMs) {
    if (state.filterClass !== 'all' && log.className !== state.filterClass) return false;
    if (state.filterDate === 'today') {
      if (new Date(log.timestamp).toDateString() !== new Date(nowMs).toDateString()) return false;
    } else if (state.filterDate === 'week') {
      if (nowMs - log.timestamp.getTime() > 7 * 86400000) return false;
    } else if (state.filterDate === 'month') {
      if (nowMs - log.timestamp.getTime() > 30 * 86400000) return false;
    } else if (state.filterDate === 'custom') {
      const from = rangeFrom.value ? new Date(`${rangeFrom.value}T00:00:00`).getTime() : -Infinity;
      const to = rangeTo.value ? new Date(`${rangeTo.value}T23:59:59.999`).getTime() : Infinity;
      const ts = log.timestamp.getTime();
      if (ts < from || ts > to) return false;
    }
    return true;
  }

  function filteredLogs(nowMs) {
    return logs.filter((log) => matchesFilters(log, nowMs)).sort((a, b) => state.sort === 'new' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
  }

  function relativeTime(ts) {
    const mins = Math.floor((Date.now() - ts.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function renderLog(log) {
    const initials = log.studentName.split(' ').map((part) => part[0]).join('');
    const card = document.createElement('article');
    card.className = `activity-log activity-log--${log.type}`;
    card.innerHTML = `
      <div class="activity-log__head">
        <span class="pupil-photo" aria-hidden="true">${initials}</span>
        <div class="activity-log__who">
          <span class="activity-log__name">${log.studentName}</span>
          <span class="activity-log__class">${log.className}</span>
        </div>
        <span class="activity-scores"><span class="pupil-score pupil-score--positive">${totals.get(log.studentName)?.positive ?? 0}</span><span class="pupil-score pupil-score--negative">${totals.get(log.studentName)?.negative ?? 0}</span></span>
        <span class="activity-log__time">${relativeTime(log.timestamp)}</span>
      </div>
      <div class="activity-log__body"><span class="activity-log__dot" aria-hidden="true">${log.icon}</span><span class="activity-log__label">${log.type === 'negative' ? '−' : '+'} ${log.label}</span></div>
      ${log.note ? `<p class="activity-log__note">“${log.note}”</p>` : ''}
      ${log.detention ? `<div class="activity-log__detention"><span class="activity-detention__badge">Detention</span><div class="activity-detention__meta"><strong>${log.detention.length}</strong> · ${log.detention.teacher}<br>${log.detention.room}</div><p class="activity-detention__reason">${log.detention.reason}</p></div>` : ''}
    `;
    return card;
  }

  function renderList() {
    const nowMs = Date.now();
    const filtered = filteredLogs(nowMs);
    list.replaceChildren();
    filtered.slice(0, state.visibleCount).forEach((log) => list.append(renderLog(log)));
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'activity-empty';
      empty.textContent = 'No behaviour logs match these filters.';
      list.append(empty);
    }
    loadMore.hidden = filtered.length <= state.visibleCount;
  }

  classSelect.addEventListener('change', () => { state.filterClass = classSelect.value; renderList(); });
  dateSelect.addEventListener('change', () => {
    state.filterDate = dateSelect.value;
    const custom = state.filterDate === 'custom';
    range.hidden = !custom;
    if (custom) {
      const now = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);
      if (!rangeFrom.value) rangeFrom.value = iso(new Date(now.getTime() - 7 * 86400000));
      if (!rangeTo.value) rangeTo.value = iso(now);
    }
    renderList();
  });
  rangeFrom.addEventListener('change', () => renderList());
  rangeTo.addEventListener('change', () => renderList());

  function addLiveLog() {
    const studentName = pupilNames[Math.floor(Math.random() * pupilNames.length)];
    const className = classes[Math.floor(Math.random() * classes.length)][0];
    const type = Math.random() < 0.6 ? 'positive' : 'negative';
    const award = activityAwards[type][Math.floor(Math.random() * activityAwards[type].length)];
    const notePool = {
      positive: ['Excellent effort this lesson.', 'Great contribution to the class discussion.', 'Persevered with the task.', 'Helped a peer in class.'],
      negative: ['Reminded repeatedly but continued.', 'Distracted the table next to them.', 'Did not complete the task.', 'Called out during the lesson.'],
    };
    const hasDetention = type === 'negative' && Math.random() < 0.18;
    const log = {
      id: `live-${Date.now()}`,
      timestamp: new Date(),
      className,
      studentName,
      type,
      label: award[1],
      icon: award[0],
      note: Math.random() < 0.7 ? notePool[type][Math.floor(Math.random() * notePool[type].length)] : undefined,
      detention: hasDetention ? {
        length: ['30 minutes', '45 minutes', '60 minutes'][Math.floor(Math.random() * 3)],
        teacher: activityTeachers[Math.floor(Math.random() * activityTeachers.length)],
        room: activityRooms[Math.floor(Math.random() * activityRooms.length)],
        reason: ['Late to lesson.', 'Classroom disruption.', 'Missed the start of the lesson.'][Math.floor(Math.random() * 3)],
      } : undefined,
    };
    const record = totals.get(studentName) || { positive: 0, negative: 0 };
    if (type === 'positive') record.positive += 1; else record.negative += 1;
    logs.push(log);
    if (logs.length > 200) logs.shift();
    renderList();
  }

  content._activityTimer = setInterval(addLiveLog, 3500);
  renderList();
  content.append(page);
}

