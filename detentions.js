const DETENTION_STORE_KEY = 'behaviour-management-system-detentions';
const DETENTION_STATUS_CYCLE = { pending: 'attended', attended: 'notattended', notattended: 'pending' };
const DETENTION_STATUS_META = {
  pending: { label: 'Pending', color: '#e0a23b' },
  attended: { label: 'Attended', color: '#54ba75' },
  notattended: { label: 'Not attended', color: '#e76c71' },
};
const DETENTION_REASONS = ['Late to lesson', 'Classroom disruption', 'Missed homework', 'Failure to complete work', 'Misbehaviour'];
const DETENTION_LENGTHS = ['30 minutes', '45 minutes', '60 minutes'];
const DETENTION_TEACHERS = ['Ms Carter', 'Mr Hughes', 'Ms Patel', 'Mr Singh', 'Mrs Green', 'Dr Okoro'];
const DETENTION_ROOMS = ['Computer Room 645', 'Computer Room 612', 'Innovation Lab', 'Library Suite', 'Room 101'];

const DETENTION_COLUMNS = [
  ['pupil', 'Student'], ['className', 'Class'], ['teacher', 'Teacher'], ['room', 'Room'],
  ['date', 'Date'], ['time', 'Time'], ['minutes', 'Length'], ['reason', 'Reason'], ['status', 'Status'],
];

function detDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function detSeeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

function detentionSeeds() {
  const rand = detSeeded(777777);
  const detentions = [];
  const now = new Date();
  for (let offset = -30; offset <= 30; offset++) {
    const d = new Date(now); d.setDate(now.getDate() + offset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const date = detDateStr(d);
    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const minutes = [30, 45, 60][Math.floor(rand() * 3)];
      const hour = 15 + Math.floor(rand() * 2);
      const minute = [0, 15, 30, 45][Math.floor(rand() * 4)];
      let status = 'pending';
      if (offset < 0) status = rand() < 0.5 ? 'attended' : (rand() < 0.85 ? 'notattended' : 'pending');
      detentions.push({
        id: `det-${date}-${i}-${Math.floor(rand() * 100000)}`,
        date, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        minutes, length: `${minutes} minutes`,
        pupil: pupilNames[Math.floor(rand() * pupilNames.length)],
        className: classes[Math.floor(rand() * classes.length)][0],
        teacher: DETENTION_TEACHERS[Math.floor(rand() * DETENTION_TEACHERS.length)],
        room: DETENTION_ROOMS[Math.floor(rand() * DETENTION_ROOMS.length)],
        reason: DETENTION_REASONS[Math.floor(rand() * DETENTION_REASONS.length)],
        status,
      });
    }
  }
  return detentions;
}

function getDetentions() {
  const stored = readStoredArray(DETENTION_STORE_KEY, { allowEmpty: false });
  if (stored) return stored;
  const seeds = detentionSeeds();
  saveDetentions(seeds);
  return seeds;
}
function saveDetentions(detentions) { writeStoredValue(DETENTION_STORE_KEY, detentions); }

function detEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function detOptionList(values, selected) {
  return values.map((value) => `<option value="${detEscape(value)}"${value === selected ? ' selected' : ''}>${detEscape(value)}</option>`).join('');
}

function showDetentionsPage(content) {
  const detentions = getDetentions();
  const state = { tab: 'today', sortKey: 'time', sortDir: 'asc', studentFilter: '', visibleCount: 50, selectedId: null };

  const page = document.createElement('div');
  page.className = 'det-page';
  page.setAttribute('aria-label', 'Detentions');

  const tabs = document.createElement('div');
  tabs.className = 'det-tabs';
  const tabButtons = [['previous', 'Previous'], ['today', 'Today'], ['future', 'Future']].map(([value, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `det-tabs__button${value === state.tab ? ' is-active' : ''}`;
    btn.dataset.tab = value;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.tab = value;
      state.sortKey = value === 'today' ? 'time' : 'date';
      state.sortDir = value === 'previous' ? 'desc' : 'asc';
      state.visibleCount = 50;
      tabButtons.forEach((el) => el.classList.toggle('is-active', el.dataset.tab === value));
      render();
    });
    return btn;
  });
  tabs.append(...tabButtons);
  const search = document.createElement('input');
  search.className = 'det-search';
  search.type = 'search';
  search.placeholder = 'Filter by student…';
  search.setAttribute('aria-label', 'Filter detentions by student');
  search.addEventListener('input', () => { state.studentFilter = search.value.trim().toLowerCase(); state.visibleCount = 50; renderTable(); });
  const toolbar = document.createElement('div');
  toolbar.className = 'det-toolbar';
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'det-add';
  addButton.textContent = '+ New detention';
  toolbar.append(tabs, search, addButton);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'det-table-wrap';
  const loadMore = document.createElement('button');
  loadMore.type = 'button';
  loadMore.className = 'det-load-more';
  loadMore.textContent = 'Load more';
  loadMore.addEventListener('click', () => { state.visibleCount += 50; renderTable(); });

  const sidebar = document.createElement('aside');
  sidebar.className = 'det-sidebar';
  sidebar.hidden = true;
  const deleteModal = document.createElement('div');
  deleteModal.className = 'det-confirm';
  deleteModal.hidden = true;
  deleteModal.innerHTML = `<div class="det-confirm__card" role="dialog" aria-modal="true" aria-labelledby="det-confirm-title"><h2 id="det-confirm-title">Delete detention?</h2><p>This removes the detention from this mockup.</p><div class="det-confirm__actions"><button type="button" class="det-confirm__cancel">Cancel</button><button type="button" class="det-confirm__delete">Delete</button></div></div>`;

  page.append(toolbar, tableWrap, loadMore, sidebar, deleteModal);

  function todayStr() { return detDateStr(new Date()); }
  function filtered() {
    const t = todayStr();
    return detentions.filter((d) => {
      if (state.studentFilter && !d.pupil.toLowerCase().includes(state.studentFilter)) return false;
      return state.tab === 'today' ? d.date === t : state.tab === 'previous' ? d.date < t : d.date > t;
    });
  }
  function sorted() {
    const dir = state.sortDir === 'asc' ? 1 : -1;
    return [...filtered()].sort((a, b) => {
      if (state.sortKey === 'date') { const cmp = a.date.localeCompare(b.date) || a.time.localeCompare(b.time); return cmp * dir; }
      if (state.sortKey === 'minutes') return (a.minutes - b.minutes) * dir;
      return String(a[state.sortKey]).localeCompare(String(b[state.sortKey])) * dir;
    });
  }

  function closeSidebar() {
    state.selectedId = null;
    sidebar.hidden = true;
    sidebar.replaceChildren();
  }

  function defaultDetention() {
    return {
      id: null, pupil: pupilNames[0], className: classes[0][0], teacher: DETENTION_TEACHERS[0], room: DETENTION_ROOMS[0],
      date: todayStr(), time: '15:30', minutes: 30, length: '30 minutes', reason: DETENTION_REASONS[0], status: 'pending',
    };
  }

  function openSidebar(record, isNew = false) {
    const detention = record || defaultDetention();
    state.selectedId = isNew ? '__new__' : detention.id;
    const lengthOptions = DETENTION_LENGTHS.map((length) => Number.parseInt(length, 10));
    const classNames = classes.map(([name]) => name);
    const pupilOptions = detOptionList(pupilNames, detention.pupil);
    const classOptions = detOptionList(classNames, detention.className);
    const teacherOptions = detOptionList(DETENTION_TEACHERS, detention.teacher);
    const roomOptions = detOptionList(DETENTION_ROOMS, detention.room);
    const reasonOptions = detOptionList(DETENTION_REASONS, detention.reason);
    const statusOptions = Object.entries(DETENTION_STATUS_META).map(([value, meta]) => `<option value="${value}"${value === detention.status ? ' selected' : ''}>${meta.label}</option>`).join('');
    sidebar.innerHTML = `
      <div class="det-sidebar__bar"><strong>${isNew ? 'New detention' : 'Detention details'}</strong><button type="button" class="det-sidebar__close" aria-label="Close detention details">×</button></div>
      <form class="det-form">
        <label class="det-field det-field--wide">Student<select name="pupil">${pupilOptions}</select></label>
        <label class="det-field">Class<select name="className">${classOptions}</select></label>
        <label class="det-field">Status<select name="status">${statusOptions}</select></label>
        <label class="det-field">Teacher<select name="teacher">${teacherOptions}</select></label>
        <label class="det-field">Room<select name="room">${roomOptions}</select></label>
        <label class="det-field">Date<input name="date" type="date" value="${detEscape(detention.date)}" required></label>
        <label class="det-field">Time<input name="time" type="time" value="${detEscape(detention.time)}" required></label>
        <label class="det-field">Length<select name="minutes">${lengthOptions.map((minutes) => `<option value="${minutes}"${minutes === Number(detention.minutes) ? ' selected' : ''}>${minutes} minutes</option>`).join('')}</select></label>
        <label class="det-field det-field--wide">Reason<select name="reason">${reasonOptions}</select></label>
        <div class="det-form__actions"><button type="button" class="det-form__cancel">Cancel</button><button type="submit" class="det-form__save">Save detention</button></div>
        ${isNew ? '' : '<button type="button" class="det-form__remove">Delete detention</button>'}
      </form>`;
    sidebar.hidden = false;
    sidebar.querySelector('.det-sidebar__close').addEventListener('click', closeSidebar);
    sidebar.querySelector('.det-form__cancel').addEventListener('click', closeSidebar);
    sidebar.querySelector('.det-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const minutes = Number(values.minutes);
      const payload = { ...detention, ...values, minutes, length: `${minutes} minutes` };
      if (isNew) {
        payload.id = `det-user-${Date.now()}`;
        detentions.unshift(payload);
      } else {
        Object.assign(detention, payload);
      }
      saveDetentions(detentions);
      closeSidebar();
      renderTable();
    });
    const removeButton = sidebar.querySelector('.det-form__remove');
    if (removeButton) removeButton.addEventListener('click', () => { deleteModal.hidden = false; });
  }

  addButton.addEventListener('click', () => openSidebar(null, true));
  deleteModal.querySelector('.det-confirm__cancel').addEventListener('click', () => { deleteModal.hidden = true; });
  deleteModal.querySelector('.det-confirm__delete').addEventListener('click', () => {
    const index = detentions.findIndex((detention) => detention.id === state.selectedId);
    if (index !== -1) detentions.splice(index, 1);
    saveDetentions(detentions);
    deleteModal.hidden = true;
    closeSidebar();
    renderTable();
  });

  function renderTable() {
    tableWrap.replaceChildren();
    const rows = sorted();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'det-empty';
      empty.textContent = state.tab === 'today' ? 'No detentions scheduled for today.' : state.tab === 'previous' ? 'No previous detentions.' : 'No future detentions.';
      tableWrap.append(empty);
      loadMore.hidden = true;
      return;
    }
    const table = document.createElement('table');
    table.className = 'det-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    DETENTION_COLUMNS.forEach(([key, label]) => {
      const th = document.createElement('th');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `det-sort${state.sortKey === key ? ' is-active' : ''}`;
      btn.textContent = label;
      if (state.sortKey === key) btn.dataset.dir = state.sortDir;
      btn.addEventListener('click', () => {
        if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortKey = key; state.sortDir = 'asc'; }
        renderTable();
      });
      th.append(btn);
      headRow.append(th);
    });
    thead.append(headRow);
    const tbody = document.createElement('tbody');
    rows.slice(0, state.visibleCount).forEach((detention) => {
      const tr = document.createElement('tr');
      tr.className = state.selectedId === detention.id ? 'is-selected' : '';
      tr.tabIndex = 0;
      tr.setAttribute('aria-label', `View detention for ${detention.pupil}`);
      tr.addEventListener('click', () => openSidebar(detention));
      tr.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSidebar(detention); } });
      const initials = detention.pupil.split(' ').map((part) => part[0]).join('');
      const pupilTd = document.createElement('td');
      pupilTd.className = 'det-student';
      pupilTd.innerHTML = `<span class="pupil-photo">${initials}</span><span>${detention.pupil}</span>`;
      tr.append(pupilTd);
      [['className', detention.className], ['teacher', detention.teacher], ['room', detention.room], ['date', detention.date], ['time', detention.time], ['length', detention.length], ['reason', detention.reason]].forEach(([cls, value]) => {
        const td = document.createElement('td');
        if (cls) td.className = `det-${cls}`;
        td.textContent = value;
        tr.append(td);
      });
      const statusTd = document.createElement('td');
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `det-status det-status--${detention.status}`;
      pill.textContent = DETENTION_STATUS_META[detention.status].label;
      pill.setAttribute('aria-label', `Mark ${detention.pupil} ${DETENTION_STATUS_META[detention.status].label}`);
      pill.addEventListener('click', (event) => {
        event.stopPropagation();
        detention.status = DETENTION_STATUS_CYCLE[detention.status];
        pill.className = `det-status det-status--${detention.status}`;
        pill.textContent = DETENTION_STATUS_META[detention.status].label;
        saveDetentions(detentions);
      });
      statusTd.append(pill);
      tr.append(statusTd);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    tableWrap.append(table);
    loadMore.hidden = rows.length <= state.visibleCount;
  }

  function render() {
    renderTable();
  }

  render();
  content.append(page);
}
