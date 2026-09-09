const classes = [
  ['YR/Cs', 32], ['Y1/Cs', 32], ['Y2/Cs', 31], ['Y3/Cs', 30], ['Y4/Cs', 29], ['Y5/Cs', 28], ['Y6/Cs', 27],
  ['Y7/Cs', 26], ['Y8/Cs', 24], ['Y9/Cs', 22], ['Y10/Cs', 20], ['Y11/Cs', 18], ['Y12/Cs', 10], ['Y13/Cs', 8],
];

const IMPORTED_CLASSES_KEY = 'behaviour-management-system-imported-classes';

function getImportedClasses() { return readStoredArray(IMPORTED_CLASSES_KEY) ?? []; }

function syncImportedClasses() {
  getImportedClasses().forEach((record) => {
    const existing = classes.find(([name]) => name === record.name);
    if (existing) existing[1] = record.students.length;
    else if (!existing) classes.push([record.name, record.students.length]);
  });
}

function getClassRoster(className) {
  const imported = getImportedClasses().find((record) => record.name === className);
  if (imported) return imported.students.map((student) => student.name).filter(Boolean);
  const size = classes.find(([name]) => name === className)?.[1] ?? 12;
  return pupilNames.slice(0, size);
}

function importClassRecords(records) {
  const byName = new Map(getImportedClasses().map((record) => [record.name, record]));
  records.forEach((record) => byName.set(record.name, record));
  writeStoredValue(IMPORTED_CLASSES_KEY, [...byName.values()]);
  syncImportedClasses();
}

syncImportedClasses();

const week = [
  { day: 'MON', date: '7', classes: [['Y9/Cs', '09:00'], ['Y8/Cs', '10:10'], ['Y7/Cs', '11:20'], ['Y12/Cs', '13:30'], ['Y5/Cs', '14:40'], ['Y10/Cs', '15:30']] },
  { day: 'TUE', date: '8', classes: [['Y8/Cs', '09:00'], ['Y10/Cs', '10:10'], ['Y3/Cs', '11:20'], ['Y11/Cs', '13:30']] },
  { day: 'WED', date: '9', classes: [['Y11/Cs', '09:00'], ['Y6/Cs', '10:10'], ['Y13/Cs', '11:20'], ['Y9/Cs', '13:30'], ['Y4/Cs', '14:40']] },
  { day: 'THU', date: '10', classes: [['Y5/Cs', '09:00'], ['Y2/Cs', '10:10'], ['Y9/Cs', '11:20'], ['Y7/Cs', '13:30'], ['Y10/Cs', '14:40'], ['Y12/Cs', '15:30']] },
  { day: 'FRI', date: '11', classes: [['YR/Cs', '09:00'], ['Y4/Cs', '10:10'], ['Y8/Cs', '11:20'], ['Y3/Cs', '13:30']] },
];

function scheduleBar(onOpen) {
  const bar = document.createElement('section');
  bar.className = 'schedule-bar';
  const picker = document.createElement('div');
  picker.className = 'day-picker';
  const dateSelector = document.createElement('input');
  dateSelector.className = 'date-selector';
  dateSelector.type = 'date';
  dateSelector.value = '2026-09-08';
  dateSelector.setAttribute('aria-label', 'Select timetable date');
  const upcoming = document.createElement('div');
  upcoming.className = 'coming-up';
  upcoming.innerHTML = '<span class="coming-up__label">Coming up</span><div class="upcoming-list"></div>';
  const list = upcoming.querySelector('.upcoming-list');
  let activeEntry;
  let lessonOffset = 0;

  const UPCOMING_MIN = 52;
  function upcomingGap() { const value = parseFloat(getComputedStyle(list).columnGap); return Number.isFinite(value) ? value : 7; }
  function visibleCount() {
    const width = list.clientWidth;
    if (!width) return activeEntry.classes.length;
    const gap = upcomingGap();
    return Math.max(1, Math.floor((width + gap) / (UPCOMING_MIN + gap)));
  }

  function renderUpcoming() {
    upcoming.querySelectorAll('.upcoming-nav').forEach((button) => button.remove());
    list.replaceChildren();
    const visible = Math.min(visibleCount(), activeEntry.classes.length) || 1;
    if (lessonOffset > activeEntry.classes.length - 1) lessonOffset = Math.max(0, activeEntry.classes.length - 1);
    activeEntry.classes.slice(lessonOffset, lessonOffset + visible).forEach(([className, time], index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `upcoming-class${lessonOffset + index === 0 ? ' is-current' : ''}`;
      item.innerHTML = `<strong>${className}</strong><time>${time}</time>`;
      if (onOpen) item.addEventListener('click', () => onOpen(className));
      list.append(item);
    });
    if (activeEntry.classes.length > visible) {
      const previous = document.createElement('button');
      previous.className = 'upcoming-nav';
      previous.type = 'button';
      previous.disabled = lessonOffset === 0;
      previous.setAttribute('aria-label', 'Show earlier upcoming lessons');
      previous.textContent = '‹';
      previous.addEventListener('click', () => {
        lessonOffset = Math.max(0, lessonOffset - visible);
        renderUpcoming();
      });
      const next = document.createElement('button');
      next.className = 'upcoming-nav';
      next.type = 'button';
      next.disabled = lessonOffset + visible >= activeEntry.classes.length;
      next.setAttribute('aria-label', 'Show later upcoming lessons');
      next.textContent = '›';
      next.addEventListener('click', () => {
        lessonOffset += visible;
        renderUpcoming();
      });
      list.before(previous);
      upcoming.append(next);
    }
  }

  function selectDay(selected, button) {
    picker.querySelectorAll('.day-choice').forEach((item) => item.classList.toggle('is-selected', item === button));
    activeEntry = selected;
    lessonOffset = 0;
    renderUpcoming();
  }

  week.forEach((entry, index) => {
    const button = document.createElement('button');
    button.className = `day-choice${index === 1 ? ' is-selected' : ''}`;
    button.type = 'button';
    button.setAttribute('aria-label', `${entry.day}, ${entry.classes.length} classes`);
    button.innerHTML = `<span class="day-choice__label">${entry.day}</span><span class="day-choice__classes">${entry.classes.length} classes</span>`;
    button.addEventListener('click', () => selectDay(entry, button));
    picker.append(button);
    if (index === 1) selectDay(entry, button);
  });
  dateSelector.addEventListener('change', () => {
    const dayOfWeek = new Date(`${dateSelector.value}T12:00:00`).getDay();
    const index = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : dayOfWeek - 1;
    selectDay(week[index], picker.children[index]);
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => renderUpcoming()).observe(upcoming);
  bar.append(picker, dateSelector, upcoming);
  return bar;
}

function classGrid(onOpen) {
  const grid = document.createElement('div');
  grid.className = 'class-grid';
  classes.forEach(([name, students]) => {
    const card = document.createElement('button');
    card.className = 'class-card';
    card.type = 'button';
    card.setAttribute('aria-label', `Open ${name}`);
    card.innerHTML = `<div class="class-card__title"><span class="subject-icon" aria-hidden="true">⌘</span>${name}</div><p class="class-card__teacher">Teacher name</p><p class="class-card__room">Computer room 645</p><p class="class-card__count">${students}/32</p>`;
    card.addEventListener('click', () => onOpen(name));
    grid.append(card);
  });
  return grid;
}
