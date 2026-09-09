const HW_STORAGE_KEY = 'behaviour-management-system-homework';
const HW_CYCLE = { unmarked: 'done', done: 'notdone', notdone: 'late', late: 'unmarked' };
const HW_STATUS = {
  unmarked: { label: 'Unmarked' },
  done: { label: 'Done', color: '#54ba75' },
  notdone: { label: 'Not done', color: '#e76c71' },
  late: { label: 'Late', color: '#f3c04f' },
};
const HW_AWARDS = [
  { icon: '★', label: 'Excellent homework completed', type: 'positive', detention: false },
  { icon: '✓', label: 'Homework on time', type: 'positive', detention: false },
  { icon: '⚑', label: 'Neat and clearly organised', type: 'positive', detention: false },
  { icon: '✗', label: 'Homework not completed', type: 'negative', detention: true },
  { icon: '↯', label: 'Homework late', type: 'negative', detention: true },
  { icon: '?', label: 'No homework equipment', type: 'negative', detention: false },
  { icon: '!', label: 'Warning', type: 'negative', detention: false },
];

function hwPad(n) { return String(n).padStart(2, '0'); }
function hwDateStr(d) { return `${d.getFullYear()}-${hwPad(d.getMonth() + 1)}-${hwPad(d.getDate())}`; }
function hwToday() { return hwDateStr(new Date()); }
function hwPupilClass(name) { return classes[pupilNames.indexOf(name) % classes.length][0]; }
function hwClassRoster(className) { return getClassRoster(className); }
function hwSeeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

function loadHomework() {
  return readStoredArray(HW_STORAGE_KEY) ?? seedHomework();
}
function saveHomework(items) { writeStoredValue(HW_STORAGE_KEY, items); }

function seedHomework() {
  const rand = hwSeeded(424242);
  const picks = [
    ['Factors worksheet', 'Complete pages 12-14 of the factors booklet.', 'Y9/Cs', 2],
    ['Python loops', 'Write five programs using while and for loops.', 'Y8/Cs', 5],
    ['Fractions problems', 'Answer questions 1-20 on the fractions sheet.', 'Y7/Cs', 1],
    ['Essay draft', 'Write the first draft of your persuasive essay.', 'Y10/Cs', 4],
    ['Digestive system diagram', 'Label the digestive system diagram provided.', 'Y5/Cs', -1],
    ['Poetry analysis', 'Analyse the poem and annotate two stanzas.', 'Y12/Cs', 3],
  ];
  const items = [];
  picks.forEach(([title, description, className, offset], index) => {
    const due = new Date(); due.setDate(due.getDate() + offset);
    const statuses = {};
    hwClassRoster(className).forEach((name, i) => {
      const roll = rand();
      statuses[name] = roll < 0.42 ? 'done' : roll < 0.58 ? 'late' : roll < 0.72 ? 'notdone' : 'unmarked';
    });
    items.push({ id: `hw-${Date.now()}-${index}`, title, description, className, dueDate: hwDateStr(due), statuses });
  });
  return items;
}

function hwStatusCounts(statuses) {
  let done = 0; let pending = 0; let total = 0;
  Object.values(statuses).forEach((s) => { total += 1; if (s === 'done') done += 1; else if (s === 'unmarked') { } else pending += 1; });
  return { done, pending, total };
}

function hwToast(root, message) {
  const toast = document.createElement('div');
  toast.className = 'class-toast';
  toast.textContent = message;
  root.append(toast);
  setTimeout(() => toast.remove(), 3000);
}

function hwStatusChip(status, interactive) {
  const meta = HW_STATUS[status] || HW_STATUS.unmarked;
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `hw-chip hw-chip--${status}`;
  chip.textContent = meta.label;
  chip.setAttribute('aria-label', status);
  if (!interactive) chip.disabled = true;
  return chip;
}

function buildHwForm(root, className, onSave) {
  const wrap = document.createElement('div');
  wrap.className = 'sensitive-modal';
  const card = document.createElement('div');
  card.className = 'sensitive-modal__card';
  card.innerHTML = `<h2>Set homework</h2><p>Create a homework assignment for the class.</p>
    <form class="hw-form">
      <label>Due date<input class="hw-field hw-date" type="date" value="${hwToday()}" aria-label="Due date"></label>
      <label>Class<select class="hw-field hw-class" aria-label="Class"></select></label>
      <label>Title<input class="hw-field hw-title" type="text" maxlength="80" required placeholder="e.g. Factors worksheet" aria-label="Homework title"></label>
      <label>Description<textarea class="hw-field hw-desc" rows="4" maxlength="500" required placeholder="What should students do to complete it?" aria-label="Homework description"></textarea></label>
      <div class="sensitive-modal__actions"><button class="hw-cancel" type="button">Cancel</button><button class="confirm" type="submit">Save homework</button></div>
    </form>`;
  const cselect = card.querySelector('.hw-class');
  classes.forEach(([name]) => cselect.append(new Option(name, name)));
  if (className && classes.some(([name]) => name === className)) cselect.value = className;
  const close = () => wrap.remove();
  card.querySelector('.hw-cancel').addEventListener('click', close);
  card.querySelector('.hw-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const dueDate = card.querySelector('.hw-date').value || hwToday();
    const title = card.querySelector('.hw-title').value.trim();
    const description = card.querySelector('.hw-desc').value.trim();
    const cls = cselect.value;
    const statuses = {};
    hwClassRoster(cls).forEach((name) => { statuses[name] = 'unmarked'; });
    const item = { id: `hw-${Date.now()}`, title, description, className: cls, dueDate, statuses };
    onSave(item);
    close();
  });
  wrap.append(card);
  root.append(wrap);
  return wrap;
}

function showHomeworkCalendarPage(content) {
  const state = { filterClass: 'all', filterStudent: '', filterStatus: 'all', expanded: null };
  const page = document.createElement('div');
  page.className = 'hw-page';
  page.setAttribute('aria-label', 'Homework calendar');

  const toolbar = document.createElement('div');
  toolbar.className = 'hw-toolbar';
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'hw-new';
  newBtn.textContent = 'New homework';
  newBtn.addEventListener('click', () => buildHwForm(page, '', (item) => { const all = loadHomework(); all.push(item); saveHomework(all); renderList(); }));
  const classFilter = document.createElement('select');
  classFilter.className = 'hw-filter hw-filter--class';
  classFilter.setAttribute('aria-label', 'Filter homework by class');
  classFilter.append(new Option('All classes', 'all'));
  classes.forEach(([name]) => classFilter.append(new Option(name, name)));
  const studentSearch = document.createElement('input');
  studentSearch.className = 'hw-filter hw-filter--student';
  studentSearch.type = 'search';
  studentSearch.placeholder = 'Search students…';
  studentSearch.setAttribute('aria-label', 'Filter homework by student');
  const statusFilter = document.createElement('select');
  statusFilter.className = 'hw-filter hw-filter--status';
  statusFilter.setAttribute('aria-label', 'Filter homework by status');
  [['all', 'Any status'], ['pending', 'Not all done'], ['done', 'All done']].forEach(([v, l]) => statusFilter.append(new Option(l, v)));
  toolbar.append(newBtn, classFilter, studentSearch, statusFilter);

  const list = document.createElement('div');
  list.className = 'hw-list';
  page.append(toolbar, list);

  classFilter.addEventListener('change', () => { state.filterClass = classFilter.value; renderList(); });
  studentSearch.addEventListener('input', () => { state.filterStudent = studentSearch.value.trim().toLowerCase(); renderList(); });
  statusFilter.addEventListener('change', () => { state.filterStatus = statusFilter.value; renderList(); });

  function matches(item) {
    if (state.filterClass !== 'all' && item.className !== state.filterClass) return false;
    if (state.filterStudent) {
      const pupilClass = hwPupilClass(pupilNames.find((n) => n.toLowerCase().includes(state.filterStudent)) || '');
      if (!pupilClass || item.className !== pupilClass) return false;
    }
    if (state.filterStatus === 'pending' && hwStatusCounts(item.statuses).pending === 0) return false;
    if (state.filterStatus === 'done' && (hwStatusCounts(item.statuses).pending > 0 || hwStatusCounts(item.statuses).done < hwStatusCounts(item.statuses).total)) return false;
    return true;
  }

  function renderList() {
    const items = loadHomework().filter(matches).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'hw-empty';
      empty.textContent = 'No homework matches the current filters.';
      list.append(empty);
      return;
    }
    items.forEach((item) => list.append(buildCard(item)));
  }

  function buildCard(item) {
    const card = document.createElement('div');
    card.className = 'hw-card';
    const counts = hwStatusCounts(item.statuses);
    const overdue = item.dueDate < hwToday();
    const isToday = item.dueDate === hwToday();
    const cardBody = document.createElement('button');
    cardBody.type = 'button';
    cardBody.className = 'hw-card__summary';
    cardBody.innerHTML = `
      <span class="hw-due${overdue ? ' is-overdue' : ''}${isToday ? ' is-today' : ''}">${item.dueDate}</span>
      <span class="hw-card__info"><strong>${item.title}</strong><small>${item.className} · ${item.description}</small></span>
      <span class="hw-card__progress">${counts.done}/${counts.total} done</span>`;
    cardBody.addEventListener('click', () => {
      state.expanded = state.expanded === item.id ? null : item.id;
      const detail = card.querySelector('.hw-card__detail');
      if (detail) detail.remove();
      else card.append(buildDetail(item));
    });
    card.append(cardBody);
    return card;
  }

  function buildDetail(item) {
    const detail = document.createElement('div');
    detail.className = 'hw-card__detail';
    const query = state.filterStudent ? pupilNames.find((n) => n.toLowerCase().includes(state.filterStudent)) : null;
    hwClassRoster(item.className).forEach((name) => {
      const row = document.createElement('div');
      row.className = `hw-row${query && name === query ? ' is-target' : ''}`;
      const initials = name.split(' ').map((p) => p[0]).join('');
      row.innerHTML = `<span class="pupil-photo">${initials}</span><span class="hw-row__name">${name}</span>`;
      row.append(hwStatusChip(item.statuses[name] || 'unmarked', false));
      detail.append(row);
    });
    return detail;
  }

  renderList();
  content.append(page);
}

function setupHomeworkMarking(view, className, students) {
  const toolbar = view.querySelector('.class-view__toolbar');
  const button = document.createElement('button');
  button.className = 'tool-button homework';
  button.type = 'button';
  button.setAttribute('aria-label', 'Mark homework');
  button.textContent = 'Homework';
  toolbar.insertBefore(button, toolbar.querySelector('.tool-button--right'));

  const panel = document.createElement('aside');
  panel.className = 'hw-sidebar';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Homework marking');
  view.append(panel);

  let activeHomework = null;

  function open() {
    panel.hidden = false;
    renderList();
  }
  button.addEventListener('click', open);

  function renderList() {
    panel.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'hw-sidebar__bar';
    bar.innerHTML = `<span>Homework · ${className}</span><button class="hw-sidebar__close" type="button" aria-label="Close homework">×</button>`;
    bar.querySelector('.hw-sidebar__close').addEventListener('click', () => { panel.hidden = true; });
    panel.append(bar);
    const body = document.createElement('div');
    body.className = 'hw-sidebar__body';
    const items = loadHomework().filter((item) => item.className === className).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const heading = document.createElement('div');
    heading.className = 'hw-sidebar__heading';
    heading.textContent = 'Select a homework to mark';
    body.append(heading);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'hw-sidebar__empty';
      empty.textContent = 'No homework set for this class yet.';
      body.append(empty);
    }
    items.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'hw-sidebar__item';
      const counts = hwStatusCounts(item.statuses);
      row.innerHTML = `<span class="hw-sidebar__item-title">${item.title}</span><span class="hw-sidebar__item-meta">${item.dueDate} · ${counts.done}/${counts.total} done</span>`;
      row.addEventListener('click', () => { activeHomework = item; renderMarking(); });
      body.append(row);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'hw-sidebar__add';
    addBtn.textContent = '+ New homework';
    addBtn.addEventListener('click', () => buildHwForm(view, className, (item) => { const all = loadHomework(); all.push(item); saveHomework(all); }));
    body.append(addBtn);
    panel.append(body);
  }

  function saveItem() {
    const all = loadHomework();
    const index = all.findIndex((item) => item.id === activeHomework.id);
    if (index !== -1) { all[index] = activeHomework; saveHomework(all); }
  }

  function renderMarking() {
    const hom = activeHomework;
    panel.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'hw-sidebar__bar';
    bar.innerHTML = `<button class="hw-back" type="button" aria-label="Back">‹</button><span>${hom.title}</span><button class="hw-sidebar__close" type="button" aria-label="Close homework">×</button>`;
    bar.querySelector('.hw-sidebar__close').addEventListener('click', () => { panel.hidden = true; });
    bar.querySelector('.hw-back').addEventListener('click', renderList);
    panel.append(bar);
    const body = document.createElement('div');
    body.className = 'hw-sidebar__body hw-marking';
    const meta = document.createElement('p');
    meta.className = 'hw-marking__meta';
    meta.textContent = `Due ${hom.dueDate} · click a pupil to cycle their status`;
    body.append(meta);
    const rows = document.createElement('div');
    rows.className = 'hw-marking__rows';
    hwClassRoster(className).forEach((name) => {
      const row = document.createElement('div');
      row.className = 'hw-marking__row';
      const initials = name.split(' ').map((p) => p[0]).join('');
      row.innerHTML = `<span class="pupil-photo">${initials}</span><span class="hw-row__name">${name}</span>`;
      const chip = hwStatusChip(hom.statuses[name] || 'unmarked', true);
      chip.addEventListener('click', () => {
        hom.statuses[name] = HW_CYCLE[hom.statuses[name] || 'unmarked'];
        chip.className = `hw-chip hw-chip--${hom.statuses[name]}`;
        chip.textContent = (HW_STATUS[hom.statuses[name]] || HW_STATUS.unmarked).label;
        saveItem();
      });
      row.append(chip);
      rows.append(row);
    });
    body.append(rows);

    const actions = document.createElement('div');
    actions.className = 'hw-marking__actions';
    const allDone = document.createElement('button');
    allDone.type = 'button';
    allDone.textContent = 'Mark all completed';
    allDone.addEventListener('click', () => {
      hwClassRoster(className).forEach((name) => { hom.statuses[name] = 'done'; });
      saveItem();
      renderMarking();
      hwToast(view, `${className} marked all completed`);
    });
    const allNot = document.createElement('button');
    allNot.type = 'button';
    allNot.className = 'is-muted';
    allNot.textContent = 'Mark all not completed';
    allNot.addEventListener('click', () => {
      hwClassRoster(className).forEach((name) => { hom.statuses[name] = 'notdone'; });
      saveItem();
      renderMarking();
      hwToast(view, `${className} marked all not completed`);
    });
    const log = document.createElement('button');
    log.type = 'button';
    log.className = 'hw-marking__log';
    log.textContent = 'Log behaviour';
    log.addEventListener('click', () => renderBulk());
    actions.append(allDone, allNot, log);
    body.append(actions);
    panel.append(body);
  }

  function renderBulk() {
    const hom = activeHomework;
    panel.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'hw-sidebar__bar';
    bar.innerHTML = `<button class="hw-back" type="button" aria-label="Back">‹</button><span>Log behaviour</span><button class="hw-sidebar__close" type="button" aria-label="Close homework">×</button>`;
    bar.querySelector('.hw-sidebar__close').addEventListener('click', () => { panel.hidden = true; });
    bar.querySelector('.hw-back').addEventListener('click', () => renderMarking());
    panel.append(bar);
    const body = document.createElement('div');
    body.className = 'hw-sidebar__body';
    const doneNames = hwClassRoster(className).filter((n) => hom.statuses[n] === 'done');
    const notNames = hwClassRoster(className).filter((n) => hom.statuses[n] === 'notdone' || hom.statuses[n] === 'late');
    const intro = document.createElement('p');
    intro.className = 'hw-bulk__intro';
    intro.textContent = `Positives apply to the ${doneNames.length} completed · negatives apply to the ${notNames.length} not completed/late.`;
    body.append(intro);
    const tabs = document.createElement('div');
    tabs.className = 'ana-direction';
    ['positive', 'negative'].forEach((type) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ana-direction__button';
      btn.textContent = type === 'positive' ? '+ Positive' : '− Negative';
      btn.addEventListener('click', () => {
        const group = type === 'positive' ? doneNames : notNames;
        if (!group.length) { hwToast(view, `No ${type === 'positive' ? 'completed' : 'not completed'} students`); return; }
        body.replaceChildren(intro);
        const grid = document.createElement('div');
        grid.className = 'award-icon-grid';
        HW_AWARDS.filter((a) => a.type === type).forEach((award) => {
          const item = document.createElement('button');
          item.className = 'award-icon';
          item.innerHTML = `${award.icon}<span>${award.label}</span>`;
          item.addEventListener('click', () => {
            let setDetention = false;
            if (award.detention && !window.confirm(`Set a detention for the ${group.length} students receiving “${award.label}”?`)) return;
            setDetention = award.detention;
            applyBulk(award, group, setDetention);
          });
          grid.append(item);
        });
        body.append(grid);
      });
      tabs.append(btn);
    });
    body.append(tabs);
    panel.append(body);
  }

  function applyBulk(award, group, setDetention) {
    let applied = 0;
    students.forEach((student) => {
      if (!group.includes(student.name)) return;
      if (award.type === 'positive') student.positive += 1; else student.negative += 1;
      const chip = student.card?.querySelector(award.type === 'positive' ? '.pupil-score--positive' : '.pupil-score--negative');
      if (chip) chip.textContent = award.type === 'positive' ? student.positive : student.negative;
      applied += 1;
    });
    hwToast(view, `${award.icon} ${award.label} applied to ${applied} pupil${applied === 1 ? '' : 's'}${setDetention ? ' (detention set)' : ''}`);
    renderMarking();
  }
}
