const ANALYTICS_AWARDS = {
  positive: [['↑', 'Merit'], ['♥', 'Caring'], ['★', 'Star student'], ['✓', 'On task'], ['☀', 'Participation'], ['⚑', 'Teamwork'], ['1', 'Level 1'], ['2', 'Level 2']],
  negative: [['!', 'Warning'], ['↺', 'Retry'], ['⊘', 'Off task'], ['⌁', 'Disruption'], ['↯', 'Late work'], ['?', 'No equipment'], ['1', 'Level 1'], ['2', 'Level 2']],
};
const ANALYTICS_TEACHERS = ['Ms Carter', 'Mr Hughes', 'Ms Patel', 'Mr Singh', 'Mrs Green', 'Dr Okoro'];
const ANALYTICS_CHART_COLORS = ['#55b5dd', '#54ba75', '#e76c71', '#f3c04f', '#9a77cf', '#5bbfae', '#e08a3f', '#6f8fa8'];
const ANALYTICS_NOTE_POSITIVE = ['Excellent effort this lesson.', 'Great contribution to the class discussion.', 'Persevered with the task.', 'Helped a peer in class.', 'Outstanding homework.'];
const ANALYTICS_NOTE_NEGATIVE = ['Reminded repeatedly but continued.', 'Distracted the table next to them.', 'Did not complete the task.', 'Called out during the lesson.', 'Late to the start of the lesson.'];
const ANALYTICS_DETENTION_REASONS = ['Missed the start of the lesson.', 'Classroom disruption.', 'Late to lesson.', 'Failure to complete homework.'];

function analyticsPad(n) { return String(n).padStart(2, '0'); }
function analyticsDateStr(d) { return `${d.getFullYear()}-${analyticsPad(d.getMonth() + 1)}-${analyticsPad(d.getDate())}`; }
function analyticsDayTime(s) { return new Date(`${s}T12:00:00`).getTime(); }
function analyticsSeeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

function buildAnalyticsData() {
  const rand = analyticsSeeded(987654321);
  const pupils = pupilNames.map((name, i) => ({ name, className: classes[i % classes.length][0] }));
  const attendance = [];
  const behaviour = [];
  const start = new Date();
  start.setDate(start.getDate() - 180);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const date = analyticsDateStr(d);
    pupils.forEach((pupil) => {
      const roll = rand();
      let code; let minutes = 0;
      if (roll < 0.84) code = '/';
      else if (roll < 0.88) code = '\\';
      else if (roll < 0.92) code = 'L';
      else if (roll < 0.96) code = 'O';
      else code = 'N';
      if (code === 'L') minutes = 5 + Math.floor(rand() * 40);
      attendance.push({ date, pupil: pupil.name, className: pupil.className, code, minutes });
      if (rand() < 0.16) {
        const type = rand() < 0.6 ? 'positive' : 'negative';
        const award = ANALYTICS_AWARDS[type][Math.floor(rand() * ANALYTICS_AWARDS[type].length)];
        behaviour.push({
          date, pupil: pupil.name, className: pupil.className,
          teacher: ANALYTICS_TEACHERS[Math.floor(rand() * ANALYTICS_TEACHERS.length)],
          type, label: award[1], icon: award[0],
          note: rand() < 0.7 ? (type === 'positive' ? ANALYTICS_NOTE_POSITIVE : ANALYTICS_NOTE_NEGATIVE)[Math.floor(rand() * 5)] : undefined,
          detention: type === 'negative' && rand() < 0.2 ? {
            length: ['30 minutes', '45 minutes', '60 minutes'][Math.floor(rand() * 3)],
            teacher: ANALYTICS_TEACHERS[Math.floor(rand() * ANALYTICS_TEACHERS.length)],
            room: activityRooms[Math.floor(rand() * activityRooms.length)],
            reason: ANALYTICS_DETENTION_REASONS[Math.floor(rand() * ANALYTICS_DETENTION_REASONS.length)],
          } : undefined,
        });
      }
    });
  }
  return { pupils, attendance, behaviour };
}

function analyticsPieChart(segments, opts = {}) {
  const size = opts.size || 170;
  const thickness = opts.thickness || 30;
  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0);
  const r = size / 2 - thickness / 2 - 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  let arcs = '';
  segments.filter((seg) => seg.value > 0).forEach((seg) => {
    const len = (seg.value / total) * c;
    arcs += `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${seg.color}" stroke-width="${thickness}" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" />`;
    offset += len;
  });
  const inner = r - thickness / 2;
  return `<svg class="ana-chart__svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Pie chart"><g transform="rotate(-90 ${size / 2} ${size / 2})">${arcs}</g><circle r="${inner}" cx="${size / 2}" cy="${size / 2}" fill="#fff" /></svg>`;
}

function buildMultiSelect(options, onChange, opts = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msel';
  const label = document.createElement('div');
  label.className = 'msel__label';
  label.textContent = opts.label || 'Option';
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'msel__control';
  control.textContent = opts.placeholder || 'Any';
  const panel = document.createElement('div');
  panel.className = 'msel__panel';
  panel.hidden = true;
  const search = document.createElement('input');
  search.className = 'msel__search';
  search.type = 'text';
  search.placeholder = opts.searchPlaceholder || 'Search…';
  search.setAttribute('aria-label', `Search ${label.textContent}`);
  const list = document.createElement('div');
  list.className = 'msel__list';
  const footer = document.createElement('div');
  footer.className = 'msel__footer';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.textContent = 'All';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  footer.append(allBtn, clearBtn);
  const selected = new Set();
  const selectedValues = new Map();

  function renderList() {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren();
    options.filter((o) => !q || String(o.label).toLowerCase().includes(q)).forEach((o) => {
      const row = document.createElement('label');
      row.className = 'msel__item';
      if (selected.has(o.value)) row.classList.add('is-checked');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = selected.has(o.value);
      box.addEventListener('change', () => {
        if (box.checked) selected.add(o.value); else selected.delete(o.value);
        row.classList.toggle('is-checked', box.checked);
        updateControl();
        onChange(selectedValues);
      });
      const text = document.createElement('span');
      text.textContent = o.label;
      row.append(box, text);
      list.append(row);
    });
    if (!list.children.length) {
      const empty = document.createElement('div');
      empty.className = 'msel__empty';
      empty.textContent = 'No matches';
      list.append(empty);
    }
  }

  function updateControl() {
    control.textContent = selected.size ? `${selected.size} selected` : (opts.placeholder || 'Any');
    control.classList.toggle('is-active', selected.size > 0);
  }

  allBtn.addEventListener('click', () => {
    selected.clear();
    options.forEach((o) => selected.add(o.value));
    updateControl();
    onChange(selectedValues);
    if (!panel.hidden) renderList();
  });
  clearBtn.addEventListener('click', () => {
    selected.clear();
    updateControl();
    onChange(selectedValues);
    renderList();
  });
  search.addEventListener('input', renderList);
  control.addEventListener('click', (event) => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { search.value = ''; renderList(); }
  });
  wrapper.addEventListener('click', (event) => event.stopPropagation());
  wrapper.append(label, control, panel);
  panel.append(search, list, footer);
  return {
    wrapper,
    get value() { return new Set(selected).size ? new Set(selected) : null; },
    reset() { selected.clear(); updateControl(); onChange(selectedValues); },
  };
}

function showAnalyticsPage(content) {
  const data = buildAnalyticsData();
  const device = content.closest('.device');
  const isMobile = device?.classList.contains('device--mobile') || (device?.classList.contains('device--fill') && window.matchMedia('(max-width: 700px)').matches);
  const state = {
    tab: 'behaviour',
    from: analyticsDateStr(new Date(Date.now() - 90 * 86400000)),
    to: analyticsDateStr(new Date()),
    compare: false,
    compareFrom: '',
    compareTo: '',
    dims: new Set(['students']),
    direction: 'all',
    minPresent: 0,
    sortBy: 'total',
    sortDir: 'desc',
    view: 'history',
    visibleCount: 50,
  };
  const page = document.createElement('div');
  page.className = 'analytics';
  page.setAttribute('aria-label', 'Analytics dashboard');
  const sidebar = document.createElement('aside');
  sidebar.className = 'analytics-sidebar';
  const main = document.createElement('div');
  main.className = 'analytics-main';

  const tabSwitch = document.createElement('div');
  tabSwitch.className = 'ana-tabs';
  const tabButtons = [['behaviour', 'Behaviour'], ['attendance', 'Attendance']].map(([value, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ana-tabs__button${value === state.tab ? ' is-active' : ''}`;
    btn.dataset.tab = value;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.tab = value;
      state.sortBy = value === 'behaviour' ? 'total' : 'days';
      tabButtons.forEach((el) => el.classList.toggle('is-active', el.dataset.tab === value));
      renderFilterControls();
      recompute(true);
    });
    return btn;
  });
  tabSwitch.append(...tabButtons);

  const filterHost = document.createElement('div');
  filterHost.className = 'ana-filters';
  const sidebarHeader = document.createElement('div');
  sidebarHeader.className = 'analytics-sidebar__header';
  sidebarHeader.innerHTML = '<span>Filters</span><button class="analytics-sidebar__close" type="button" aria-label="Close filters">×</button>';
  sidebarHeader.querySelector('.analytics-sidebar__close').addEventListener('click', () => page.classList.remove('is-filters-open'));
  sidebar.append(sidebarHeader, tabSwitch, filterHost);

  const mainbar = document.createElement('div');
  mainbar.className = 'analytics-mainbar';
  const filterToggle = document.createElement('button');
  filterToggle.type = 'button';
  filterToggle.className = 'analytics-filter-toggle';
  filterToggle.textContent = 'Filters';
  filterToggle.setAttribute('aria-label', 'Toggle filters');
  filterToggle.addEventListener('click', () => page.classList.toggle('is-filters-open'));
  const title = document.createElement('div');
  title.className = 'analytics-title';
  title.textContent = 'Behaviour report';
  const exportGroup = document.createElement('div');
  exportGroup.className = 'analytics-export-group';
  const exportExcel = document.createElement('button');
  exportExcel.type = 'button';
  exportExcel.className = 'analytics-export';
  exportExcel.textContent = 'Export Excel';
  const exportPdf = document.createElement('button');
  exportPdf.type = 'button';
  exportPdf.className = 'analytics-export analytics-export--pdf';
  exportPdf.textContent = 'Export PDF';
  exportGroup.append(exportExcel, exportPdf);
  mainbar.append(filterToggle, title, exportGroup);

  const chartHost = document.createElement('div');
  chartHost.className = 'analytics-charts';
  const summary = document.createElement('div');
  summary.className = 'analytics-summary';
  const contentHost = document.createElement('div');
  contentHost.className = 'analytics-results';
  const viewToggle = document.createElement('div');
  viewToggle.className = 'ana-view-toggle';
  const viewButtons = [['history', 'History'], ['table', 'Table']].map(([value, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ana-view-toggle__button${value === state.view ? ' is-active' : ''}`;
    btn.dataset.view = value;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.view = value;
      viewButtons.forEach((el) => el.classList.toggle('is-active', el.dataset.view === value));
      recompute(false);
    });
    return btn;
  });
  viewToggle.append(...viewButtons);
  const tableHost = document.createElement('div');
  tableHost.className = 'analytics-table-wrap';
  const historyHost = document.createElement('div');
  historyHost.className = 'analytics-history';
  const loadMore = document.createElement('button');
  loadMore.type = 'button';
  loadMore.className = 'analytics-load-more';
  loadMore.textContent = 'Load more';
  loadMore.addEventListener('click', () => { state.visibleCount += 50; recompute(false); });
  main.append(mainbar, chartHost, summary, contentHost);
  contentHost.append(viewToggle, tableHost, historyHost, loadMore);
  page.append(sidebar, main);
  const backdrop = document.createElement('div');
  backdrop.className = 'analytics-backdrop';
  backdrop.addEventListener('click', () => page.classList.remove('is-filters-open'));
  page.append(backdrop);
  content.append(page);

  const studentsSelect = buildMultiSelect(pupilNames.map((name) => ({ value: name, label: name })), () => recompute(), { label: 'Students', placeholder: 'All students', searchPlaceholder: 'Search students…' });
  const classesSelect = buildMultiSelect(classes.map(([name]) => ({ value: name, label: name })), () => recompute(), { label: 'Classes', placeholder: 'All classes', searchPlaceholder: 'Search classes…' });
  const typeOptions = Object.entries(ANALYTICS_AWARDS).flatMap(([dir, list]) => list.map(([icon, label]) => ({ value: `${dir}|${label}`, label: `${label} (${dir})` })));
  const typesSelect = buildMultiSelect(typeOptions, () => recompute(), { label: 'Behaviour types', placeholder: 'Any type', searchPlaceholder: 'Search behaviour…' });
  const codeOptions = [
    { value: '/', label: 'Present ( / )' }, { value: '\\', label: 'Present PM ( \\ )' },
    { value: 'L', label: 'Late ( L )' }, { value: 'O', label: 'Unauthorised ( O )' }, { value: 'N', label: 'Absent ( N )' },
  ];
  const codesSelect = buildMultiSelect(codeOptions, () => recompute(), { label: 'Attendance codes', placeholder: 'Any code', searchPlaceholder: 'Search codes…' });

  const behaviorFilters = document.createElement('div');
  behaviorFilters.className = 'ana-filter-group';
  const direction = document.createElement('div');
  direction.className = 'ana-direction';
  const dirButtons = [['all', 'All'], ['positive', 'Positive'], ['negative', 'Negative']].map(([value, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ana-direction__button${value === state.direction ? ' is-active' : ''}`;
    btn.dataset.dir = value;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.direction = value;
      dirButtons.forEach((el) => el.classList.toggle('is-active', el.dataset.dir === value));
      recompute();
    });
    return btn;
  });
  direction.append(...dirButtons);
  behaviorFilters.append(typesSelect.wrapper);

  const attendanceFilters = document.createElement('div');
  attendanceFilters.className = 'ana-filter-group';
  const minPresent = document.createElement('label');
  minPresent.className = 'ana-metric-filter';
  minPresent.innerHTML = `<span>Min present %</span><input class="ana-present" type="number" min="0" max="100" step="5" value="0" aria-label="Minimum present percentage">`;
  minPresent.querySelector('.ana-present').addEventListener('input', (event) => { state.minPresent = Number(event.target.value) || 0; recompute(); });
  attendanceFilters.append(codesSelect.wrapper, minPresent);

  function renderFilterControls() {
    filterHost.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'ana-filter-heading';
    heading.textContent = state.tab === 'behaviour' ? 'Behaviour filters' : 'Attendance filters';
    const period = buildPeriodGroup();
    const dims = buildDimsGroup();
    const studentsGroup = buildGroup(studentsSelect.wrapper);
    const classesGroup = buildGroup(classesSelect.wrapper);
    const tabSpecific = buildTabGroup();
    filterHost.append(heading, period, dims, studentsGroup, classesGroup, tabSpecific);
  }

  function buildGroup(node) {
    const wrap = document.createElement('div');
    wrap.className = 'ana-filter-group';
    wrap.append(node);
    return wrap;
  }

  function buildPeriodGroup() {
    const group = document.createElement('div');
    group.className = 'ana-filter-group';
    group.innerHTML = `<div class="ana-filter-group__title">Period</div>
      <div class="ana-period"><input class="ana-date" type="date" value="${state.from}" aria-label="From date"><input class="ana-date" type="date" value="${state.to}" aria-label="To date"></div>
      <div class="ana-preset-row">
        <button type="button" class="ana-preset" data-day="7">7d</button>
        <button type="button" class="ana-preset" data-day="30">30d</button>
        <button type="button" class="ana-preset" data-day="90">90d</button>
        <button type="button" class="ana-preset" data-day="all">All</button>
      </div>
      <label class="ana-compare-toggle"><input type="checkbox" aria-label="Compare with previous period"><span>Compare previous period</span></label>
      <div class="ana-compare" hidden><div class="ana-period"><input class="ana-date ana-comparison from" type="date" aria-label="Previous period from"><input class="ana-date ana-comparison to" type="date" aria-label="Previous period to"></div></div>`;
    const [from, to] = group.querySelectorAll('.ana-date');
    from.value = state.from;
    to.value = state.to;
    from.addEventListener('change', () => { state.from = from.value; recompute(); });
    to.addEventListener('change', () => { state.to = to.value; recompute(); });
    const preset = group.querySelectorAll('.ana-preset');
    preset.forEach((btn) => btn.addEventListener('click', () => {
      const day = btn.dataset.day;
      if (day === 'all') { state.from = analyticsDateStr(new Date(Date.now() - 180 * 86400000)); state.to = analyticsDateStr(new Date()); }
      else { state.from = analyticsDateStr(new Date(Date.now() - Number(day) * 86400000)); state.to = analyticsDateStr(new Date()); }
      from.value = state.from; to.value = state.to;
      recompute();
    }));
    const compareToggle = group.querySelector('.ana-compare-toggle input');
    const compareWrap = group.querySelector('.ana-compare');
    const cFrom = compareWrap.querySelector('.from');
    const cTo = compareWrap.querySelector('.to');
    compareToggle.addEventListener('change', () => {
      state.compare = compareToggle.checked;
      compareWrap.hidden = !state.compare;
      if (state.compare) {
        const span = analyticsDayTime(state.to) - analyticsDayTime(state.from) + 86400000;
        state.compareTo = state.from;
        state.compareFrom = analyticsDateStr(new Date(analyticsDayTime(state.from) - span));
        cFrom.value = state.compareFrom; cTo.value = state.compareTo;
      }
      recompute();
    });
    cFrom.addEventListener('change', () => { state.compareFrom = cFrom.value; recompute(); });
    cTo.addEventListener('change', () => { state.compareTo = cTo.value; recompute(); });
    return group;
  }

  function buildDimsGroup() {
    const group = document.createElement('div');
    group.className = 'ana-filter-group';
    const h = document.createElement('div');
    h.className = 'ana-filter-group__title';
    h.textContent = 'Show by';
    const list = document.createElement('div');
    list.className = 'ana-dims';
    const dimDefs = {
      behaviour: [['students', 'Students'], ['classes', 'Classes'], ['behaviourType', 'Behaviour'], ['teacher', 'Teacher'], ['date', 'Date']],
      attendance: [['students', 'Students'], ['classes', 'Classes'], ['code', 'Code'], ['date', 'Date']],
    };
    dimDefs[state.tab].forEach(([key, label]) => {
      const row = document.createElement('label');
      row.className = 'ana-dim';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = state.dims.has(key);
      box.addEventListener('change', () => {
        if (box.checked) state.dims.add(key); else state.dims.delete(key);
        recompute();
      });
      row.append(box, document.createTextNode(label));
      list.append(row);
    });
    group.append(h, list);
    return group;
  }

  function buildTabGroup() {
    const group = document.createElement('div');
    group.className = 'ana-filter-group';
    if (state.tab === 'behaviour') {
      const h = document.createElement('div');
      h.className = 'ana-filter-group__title';
      h.textContent = 'Direction';
      group.append(h, direction, behaviorFilters);
    } else {
      const h = document.createElement('div');
      h.className = 'ana-filter-group__title';
      h.textContent = 'Presence';
      group.append(h, attendanceFilters);
    }
    return group;
  }

  const sortSelect = document.createElement('select');
  sortSelect.className = 'analytics-sort';
  sortSelect.addEventListener('change', () => {
    state.sortBy = sortSelect.value;
    recompute(false);
  });

  function buildSelection(overrides = {}) {
    const from = overrides.from ?? state.from;
    const to = overrides.to ?? state.to;
    return {
      from, to,
      students: studentsSelect.value,
      classes: classesSelect.value,
      direction: overrides.preserveDirection ? state.direction : state.direction,
      types: typesSelect.value,
      codes: codesSelect.value,
      minPresent: state.minPresent,
      dims: new Set(state.dims),
    };
  }

  function computeBehaviour(sel) {
    const fromT = sel.from ? analyticsDayTime(sel.from) : -Infinity;
    const toT = sel.to ? analyticsDayTime(sel.to) + 86399000 : Infinity;
    const events = data.behaviour.filter((e) => {
      const t = analyticsDayTime(e.date);
      if (t < fromT || t > toT) return false;
      if (sel.students && !sel.students.has(e.pupil)) return false;
      if (sel.classes && !sel.classes.has(e.className)) return false;
      if (sel.direction !== 'all' && e.type !== sel.direction) return false;
      if (sel.types && !sel.types.has(`${e.type}|${e.label}`)) return false;
      return true;
    });
    const cols = [];
    if (sel.dims.has('students')) cols.push({ key: 'pupil', label: 'Student' });
    if (sel.dims.has('classes')) cols.push({ key: 'className', label: 'Class' });
    if (sel.dims.has('behaviourType')) cols.push({ key: 'typeLabel', label: 'Behaviour' });
    if (sel.dims.has('teacher')) cols.push({ key: 'teacher', label: 'Teacher' });
    if (sel.dims.has('date')) cols.push({ key: 'date', label: 'Date' });
    const rows = new Map();
    events.forEach((e) => {
      const cell = { pupil: e.pupil, className: e.className, typeLabel: `${e.type === 'positive' ? '+' : '−'} ${e.label}`, teacher: e.teacher, date: e.date };
      const key = cols.map((c) => cell[c.key]).join('\u0000');
      let row = rows.get(key);
      if (!row) { row = { cells: cols.map((c) => cell[c.key]), positive: 0, negative: 0, total: 0, detentions: 0 }; rows.set(key, row); }
      row.total += 1;
      if (e.type === 'positive') row.positive += 1; else row.negative += 1;
      if (e.detention) row.detentions += 1;
    });
    const rowList = [...rows.values()];
    const totals = { positive: 0, negative: 0, total: 0, detentions: 0 };
    rowList.forEach((r) => { totals.positive += r.positive; totals.negative += r.negative; totals.total += r.total; totals.detentions += r.detentions; });
    return { cols, rows: rowList, totals, records: events };
  }

  function computeAttendance(sel) {
    const fromT = sel.from ? analyticsDayTime(sel.from) : -Infinity;
    const toT = sel.to ? analyticsDayTime(sel.to) + 86399000 : Infinity;
    const records = data.attendance.filter((r) => {
      const t = analyticsDayTime(r.date);
      if (t < fromT || t > toT) return false;
      if (sel.students && !sel.students.has(r.pupil)) return false;
      if (sel.classes && !sel.classes.has(r.className)) return false;
      if (sel.codes && !sel.codes.has(r.code)) return false;
      return true;
    });
    const cols = [];
    if (sel.dims.has('students')) cols.push({ key: 'pupil', label: 'Student' });
    if (sel.dims.has('classes')) cols.push({ key: 'className', label: 'Class' });
    if (sel.dims.has('code')) cols.push({ key: 'code', label: 'Code' });
    if (sel.dims.has('date')) cols.push({ key: 'date', label: 'Date' });
    const rows = new Map();
    records.forEach((r) => {
      const cell = { pupil: r.pupil, className: r.className, code: r.code, date: r.date };
      const key = cols.map((c) => cell[c.key]).join('\u0000');
      let row = rows.get(key);
      if (!row) { row = { cells: cols.map((c) => cell[c.key]), present: 0, presentPM: 0, late: 0, absent: 0, unauthorized: 0, days: 0 }; rows.set(key, row); }
      row.days += 1;
      if (r.code === '/') row.present += 1;
      else if (r.code === '\\') row.presentPM += 1;
      else if (r.code === 'L') row.late += 1;
      else if (r.code === 'N') row.absent += 1;
      else if (r.code === 'O') row.unauthorized += 1;
    });
    let rowList = [...rows.values()].map((r) => {
      const presentDays = r.present + r.presentPM;
      r.percent = r.days ? Math.round((presentDays / r.days) * 100) : 0;
      return r;
    });
    if (sel.minPresent > 0) rowList = rowList.filter((r) => r.percent >= sel.minPresent);
    const totals = { present: 0, presentPM: 0, late: 0, absent: 0, unauthorized: 0, days: 0 };
    rowList.forEach((r) => { totals.present += r.present; totals.presentPM += r.presentPM; totals.late += r.late; totals.absent += r.absent; totals.unauthorized += r.unauthorized; totals.days += r.days; });
    return { cols, rows: rowList, totals, records };
  }

  function metricColumns(kind) {
    return kind === 'behaviour'
      ? [['positive', 'Positive'], ['negative', 'Negative'], ['total', 'Total'], ['detentions', 'Detentions']]
      : [['present', 'Present'], ['presentPM', 'Present PM'], ['late', 'Late'], ['absent', 'Absent'], ['unauthorized', 'Unauthorised'], ['percent', '% Present']];
  }

  function sortRows(rows, kind) {
    const dir = state.sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (state.sortBy === 'student') return String(a.cells[0]).localeCompare(String(b.cells[0])) * dir;
      if (kind === 'attendance') {
        const key = ['present', 'presentPM', 'late', 'absent', 'unauthorized', 'days', 'percent'].includes(state.sortBy) ? state.sortBy : 'days';
        return (a[key] - b[key]) * dir;
      }
      const key = ['positive', 'negative', 'total', 'detentions'].includes(state.sortBy) ? state.sortBy : 'total';
      return (a[key] - b[key]) * dir;
    });
  }

  function chartSegments(result) {
    if (state.tab === 'behaviour') {
      return [
        { label: 'Positive', value: result.totals.positive, color: '#54ba75' },
        { label: 'Negative', value: result.totals.negative, color: '#e76c71' },
      ].filter((s) => s.value > 0);
    }
    return [
      { label: 'Present', value: result.totals.present + result.totals.presentPM, color: '#54ba75' },
      { label: 'Late', value: result.totals.late, color: '#f3c04f' },
      { label: 'Absent', value: result.totals.absent + result.totals.unauthorized, color: '#e76c71' },
    ].filter((s) => s.value > 0);
  }

  function renderChart(result) {
    chartHost.replaceChildren();
    if (!result.totals.total && state.tab === 'behaviour') return;
    if (!result.totals.days && state.tab === 'attendance') return;
    const chart = document.createElement('div');
    chart.className = 'analytics-chart-card';
    const legend = document.createElement('div');
    legend.className = 'ana-legend';
    const segs = chartSegments(result);
    chart.innerHTML = `<div class="analytics-chart-card__title">${state.tab === 'behaviour' ? 'Positive vs negative' : 'Attendance breakdown'}</div>${analyticsPieChart(segs, { size: 160 * (isMobile ? 0.85 : 1), thickness: 26 })}`;
    segs.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'ana-legend__item';
      item.innerHTML = `<i style="background:${s.color}"></i>${s.label} · ${s.value}`;
      legend.append(item);
    });
    chart.append(legend);
    chartHost.append(chart);
  }

  function renderSummary(result) {
    const kind = state.tab;
    const fmt = (r) => kind === 'behaviour' ? `${r.total} events` : `${r.days} records`;
    let text = '';
    if (kind === 'behaviour') {
      text = `${result.totals.total} behaviour logs in range (${result.totals.positive} positive, ${result.totals.negative} negative, ${result.totals.detentions} detentions)`;
    } else {
      text = `${result.totals.days} attendance records (${result.totals.present + result.totals.presentPM} present, ${result.totals.late} late, ${result.totals.absent + result.totals.unauthorized} absent/unauthorised)`;
    }
    if (state.compare) {
      const prevSel = buildSelection({ from: state.compareFrom, to: state.compareTo });
      const prev = kind === 'behaviour' ? computeBehaviour(prevSel) : computeAttendance(prevSel);
      const delta = state.tab === 'behaviour'
        ? `Δ ${result.totals.total - prev.totals.total} (${prev.totals.total} previous)`
        : `Δ ${result.totals.days - prev.totals.days} (${prev.totals.days} previous)`;
      text += ` · ${delta}`;
    }
    summary.textContent = text;
  }

  function renderTable(result) {
    tableHost.replaceChildren();
    const mc = metricColumns(state.tab);
    if (state.tab === 'behaviour') {
      const sf = [['total', 'Total'], ['positive', 'Positive'], ['negative', 'Negative'], ['detentions', 'Detentions']];
      sortSelect.replaceChildren();
      sortSelect.append(new Option('Sort by student', 'student'), ...sf.map(([v, l]) => new Option(`Sort by ${l.toLowerCase()}`, v)));
      sortSelect.value = state.sortBy;
    } else {
      sortSelect.replaceChildren();
      sortSelect.append(new Option('Sort by student', 'student'), new Option('Sort by % present', 'percent'), new Option('Sort by days', 'days'));
      sortSelect.value = state.sortBy;
    }
    const rows = sortRows(result.rows, state.tab);
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'ana-empty';
      empty.textContent = 'No data matches the current filters.';
      tableHost.append(sortSelect, empty);
      return;
    }
    const table = document.createElement('table');
    table.className = 'ana-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    result.cols.forEach((c) => { const th = document.createElement('th'); th.textContent = c.label; headRow.append(th); });
    mc.forEach(([k, l]) => { const th = document.createElement('th'); th.textContent = l; headRow.append(th); });
    thead.append(headRow);
    const tbody = document.createElement('tbody');
    rows.slice(0, state.visibleCount).forEach((r) => {
      const tr = document.createElement('tr');
      result.cols.forEach((c, i) => { const td = document.createElement('td'); td.textContent = r.cells[i]; tr.append(td); });
      mc.forEach(([k]) => { const td = document.createElement('td'); td.textContent = k === 'percent' ? `${r[k]}%` : r[k]; if (k === 'total' || k === 'percent' || k === 'days') td.className = 'is-strong'; tr.append(td); });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    tableHost.replaceChildren(sortSelect, table);
    loadMore.hidden = rows.length <= state.visibleCount;
  }

  function pupilRangeTotals(records) {
    const map = new Map();
    records.forEach((r) => {
      const t = map.get(r.pupil) || { positive: 0, negative: 0 };
      if (r.type === 'positive') t.positive += 1; else t.negative += 1;
      map.set(r.pupil, t);
    });
    return map;
  }

  function buildBehaviourHistoryCard(record, totals) {
    const initials = record.pupil.split(' ').map((part) => part[0]).join('');
    const points = totals.get(record.pupil) || { positive: 0, negative: 0 };
    const card = document.createElement('article');
    card.className = `activity-log activity-log--${record.type}`;
    card.innerHTML = `
      <div class="activity-log__head">
        <span class="pupil-photo" aria-hidden="true">${initials}</span>
        <div class="activity-log__who"><span class="activity-log__name">${record.pupil}</span><span class="activity-log__class">${record.className} · ${record.teacher}</span></div>
        <span class="activity-scores"><span class="pupil-score pupil-score--positive">${points.positive}</span><span class="pupil-score pupil-score--negative">${points.negative}</span></span>
        <span class="activity-log__time">${record.date}</span>
      </div>
      <div class="activity-log__body"><span class="activity-log__dot" aria-hidden="true">${record.icon}</span><span class="activity-log__label">${record.type === 'negative' ? '−' : '+'} ${record.label}</span></div>
      ${record.note ? `<p class="activity-log__note">“${record.note}”</p>` : ''}
      ${record.detention ? `<div class="activity-log__detention"><span class="activity-detention__badge">Detention</span><div class="activity-detention__meta"><strong>${record.detention.length}</strong> · ${record.detention.teacher}<br>${record.detention.room}</div><p class="activity-detention__reason">${record.detention.reason}</p></div>` : ''}
    `;
    return card;
  }

  function buildAttendanceHistoryCard(record) {
    const initials = record.pupil.split(' ').map((part) => part[0]).join('');
    const codeMap = { '/': ['Present', '#54ba75'], '\\': ['Present PM', '#54ba75'], 'L': ['Late', '#f3c04f'], 'O': ['Unauthorised', '#e76c71'], 'N': ['Absent', '#e76c71'] };
    const [label, color] = codeMap[record.code] || ['—', '#9aa7ae'];
    const card = document.createElement('article');
    card.className = 'activity-log activity-log--attendance';
    card.innerHTML = `
      <div class="activity-log__head">
        <span class="pupil-photo" aria-hidden="true">${initials}</span>
        <div class="activity-log__who"><span class="activity-log__name">${record.pupil}</span><span class="activity-log__class">${record.className}</span></div>
        <span class="attendance-pill" style="background:${color}">${label}</span>
        <span class="activity-log__time">${record.date}</span>
      </div>
      ${record.code === 'L' && record.minutes ? `<div class="activity-log__body"><span class="activity-log__label">${record.minutes} minutes late</span></div>` : ''}
    `;
    return card;
  }

  function renderHistory(result) {
    historyHost.replaceChildren();
    const records = [...result.records].sort((a, b) => b.date.localeCompare(a.date));
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'ana-empty';
      empty.textContent = 'No activity matches the current filters.';
      historyHost.append(empty);
      loadMore.hidden = true;
      return;
    }
    const totals = state.tab === 'behaviour' ? pupilRangeTotals(records) : null;
    records.slice(0, state.visibleCount).forEach((r) => {
      historyHost.append(state.tab === 'behaviour' ? buildBehaviourHistoryCard(r, totals) : buildAttendanceHistoryCard(r));
    });
    loadMore.hidden = records.length <= state.visibleCount;
  }

  function renderResults(result) {
    if (state.view === 'history') {
      tableHost.hidden = true;
      historyHost.hidden = false;
      renderHistory(result);
    } else {
      historyHost.hidden = true;
      tableHost.hidden = false;
      renderTable(result);
    }
  }

  function recompute(reset) {
    if (reset) state.visibleCount = 50;
    const sel = buildSelection();
    const result = state.tab === 'behaviour' ? computeBehaviour(sel) : computeAttendance(sel);
    renderChart(result);
    renderSummary(result);
    renderResults(result);
    title.textContent = state.tab === 'behaviour' ? 'Behaviour report' : 'Attendance report';
  }

  function buildReportHTML(result) {
    const mc = metricColumns(state.tab);
    const head = result.cols.map((c) => `<th>${c.label}</th>`).join('') + mc.map(([, l]) => `<th>${l}</th>`).join('');
    const body = sortRows(result.rows, state.tab).map((r) => {
      const cells = result.cols.map((_, i) => `<td>${escapeHtml(String(r.cells[i]))}</td>`).join('');
      const metrics = mc.map(([k]) => `<td>${k === 'percent' ? `${r[k]}%` : r[k]}</td>`).join('');
      return `<tr>${cells}${metrics}</tr>`;
    }).join('');
    const segs = chartSegments(result);
    const chart = segs.length ? analyticsPieChart(segs, { size: 200, thickness: 32 }) : '';
    const period = `Period: ${state.from || 'earliest'} to ${state.to || 'today'}${state.compare ? ` · compared with ${state.compareFrom} to ${state.compareTo}` : ''}`;
    const table = body ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` : '<p>No data.</p>';
    return `<h1>${title.textContent}</h1><p>${period}</p><div class="print-chart">${chart}</div>${table}`;
  }

  function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  exportExcel.addEventListener('click', () => {
    const sel = buildSelection();
    const result = state.tab === 'behaviour' ? computeBehaviour(sel) : computeAttendance(sel);
    const html = `\ufeff<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>table,td,th{border:1px solid #bbb;border-collapse:collapse;font-family:Arial;font-size:12px}</style></head><body>${buildReportHTML(result).replace(/<div class="print-chart">[\s\S]*?<\/div>/, '')}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.tab}-report.xls`;
    a.click();
    URL.revokeObjectURL(url);
  });

  exportPdf.addEventListener('click', () => {
    const sel = buildSelection();
    const result = state.tab === 'behaviour' ? computeBehaviour(sel) : computeAttendance(sel);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.textContent}</title><style>body{font-family:Arial,sans-serif;color:#2c3e50;margin:28px}h1{font-size:20px}table,td,th{border:1px solid #cfdae0;border-collapse:collapse;padding:5px 8px;font-size:11px}th{background:#f2f7fa}.print-chart{text-align:center;margin:14px 0}</style></head><body>${buildReportHTML(result)}<script>window.onload=()=>window.print()</` + `script></body></html>`);
    w.document.close();
  });

  renderFilterControls();
  recompute(true);
  content.append(page);
}
