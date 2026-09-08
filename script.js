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
  showPage(content, 'Classes');

  device.querySelectorAll('[data-page]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const page = link.dataset.page;
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

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const fillMode = button.dataset.mode === 'fill';
    document.querySelector('.mockup-stage').classList.toggle('mode-fill', fillMode);
    document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
  });
});

let currentVersion;
async function refreshWhenChanged() {
  try {
    const response = await fetch('/__version', { cache: 'no-store' });
    const nextVersion = await response.text();
    if (currentVersion && currentVersion !== nextVersion) location.reload();
    currentVersion = nextVersion;
  } catch {
    // The visual remains usable if the local development server is restarted.
  }
}

  function showClassView(content, className, rosterSizeOverride, searchable) {
    clearInterval(content._activityTimer);
    content._activityTimer = undefined;
    content.replaceChildren();
  const device = content.closest('.device');
  const mobileLayout = device?.classList.contains('device--mobile') || (device?.classList.contains('device--fill') && window.matchMedia('(max-width: 700px)').matches);
  const seatingPlanDefault = !mobileLayout;
  const view = document.createElement('section');
  view.className = `class-view ${seatingPlanDefault ? 'class-view--seating' : 'class-view--list'}`;
  view.setAttribute('aria-label', `${className} class view`);
  let rooms = getRooms().map((room) => room.name);
  let roomLayoutActive = false;
  let showingList = !seatingPlanDefault;
  let currentRoomName = null;
  const rosterSize = rosterSizeOverride ?? classes.find(([name]) => name === className)?.[1] ?? 12;
  let sensitiveVisible = false;
  let attendanceTaken = false;
  let registerSubmitted = false;
  let multiAwardMode = false;
  const studentRecords = [];
  let activeRegisterSession;

  view.innerHTML = `
    <div class="class-view__toolbar">
      <button class="tool-button view-toggle${seatingPlanDefault ? ' is-active' : ''}" type="button" aria-label="${seatingPlanDefault ? 'Show list view' : 'Show seating plan'}">${seatingPlanDefault ? 'List view' : 'Seating plan'}</button>
      <div class="room-control"><button class="tool-button room-toggle" type="button" aria-label="Select room">Room <span>⌄</span></button><div class="room-menu" hidden></div></div>
      <button class="tool-button multi-award" type="button" aria-label="Award multiple pupils">Award multiple</button>
      <button class="tool-button attendance" type="button" aria-label="Take attendance">Attendance</button>
      <button class="tool-button random-pupil" type="button" aria-label="Select a random pupil">Random pupil</button>
      <button class="tool-button tool-button--right pupil-info" type="button" aria-label="Show pupil information">Show pupil info</button>
    </div>
    <div class="class-seat-grid"></div>
    <div class="award-panel" hidden><button class="award-positive" type="button">Award positive</button><button class="award-negative" type="button">Award negative</button></div>
    <aside class="award-sidebar" hidden aria-label="Pupil details"><div class="award-sidebar__bar"><span>Pupil</span><button class="award-sidebar__close" type="button" aria-label="Close pupil sidebar">×</button></div><div class="sidebar-body"></div></aside>
    <div class="sensitive-modal" hidden><div class="sensitive-modal__card"><h2>Display pupil information?</h2><p>This will reveal sensitive pupil indicators on the seating plan. Only continue when it is appropriate to view this information.</p><div class="sensitive-modal__actions"><button class="cancel" type="button">Cancel</button><button class="confirm" type="button">Display information</button></div></div></div>
    <div class="sensitive-modal room-modal" hidden><div class="sensitive-modal__card"><h2>Add a room</h2><p>Enter the name for the new room.</p><form class="room-form"><input class="room-name-input" type="text" maxlength="50" required placeholder="e.g. Science Lab 101" aria-label="Room name"><div class="sensitive-modal__actions"><button class="room-cancel" type="button">Cancel</button><button class="confirm" type="submit">Add room</button></div></form></div></div>
    <div class="sensitive-modal attendance-modal" hidden><div class="sensitive-modal__card"><h2>Take attendance</h2><p>Select the period you want to record attendance for ${className}.</p><select class="attendance-select" aria-label="Attendance period"></select><div class="sensitive-modal__actions"><button class="attendance-cancel" type="button">Cancel</button><button class="confirm" type="button">Open register</button></div></div></div>`;
  const roomMenu = view.querySelector('.room-menu');
  const roomToggle = view.querySelector('.room-toggle');
  const seatGrid = view.querySelector('.class-seat-grid');
  const infoButton = view.querySelector('.pupil-info');
  const modal = view.querySelector('.sensitive-modal');
  const roomModal = view.querySelector('.room-modal');
  const attendanceModal = view.querySelector('.attendance-modal');
  const viewToggle = view.querySelector('.view-toggle');
  const awardSidebar = view.querySelector('.award-sidebar');

  let searchInput;
  if (searchable) {
    const searchBar = document.createElement('div');
    searchBar.className = 'class-search';
    searchInput = document.createElement('input');
    searchInput.className = 'class-search__input';
    searchInput.type = 'search';
    searchInput.placeholder = 'Filter pupils by name…';
    searchInput.setAttribute('aria-label', 'Filter pupils by name');
    const searchCount = document.createElement('span');
    searchCount.className = 'class-search__count';
    const filterPupils = () => {
      const query = searchInput.value.trim().toLowerCase();
      let visible = 0;
      view.querySelectorAll('.pupil-card').forEach((card) => {
        const name = card.querySelector('.pupil-card__name').textContent.toLowerCase();
        const show = query === '' || name.includes(query);
        card.hidden = !show;
        if (show) visible += 1;
      });
      searchCount.textContent = `${visible} of ${rosterSize} pupils`;
    };
    searchInput.addEventListener('input', filterPupils);
    searchBar.append(searchInput, searchCount);
    view.insertBefore(searchBar, seatGrid);
  }

  function renderSidebar(student, selectedTab = 'positive') {
    const isPositive = selectedTab === 'positive';
    const awardNames = isPositive ? [['↑', 'Merit'], ['♥', 'Caring'], ['★', 'Star student'], ['✓', 'On task'], ['☀', 'Participation'], ['⚑', 'Teamwork'], ['1', 'Level 1'], ['2', 'Level 2']] : [['!', 'Warning'], ['↺', 'Retry'], ['⊘', 'Off task'], ['⌁', 'Disruption'], ['↯', 'Late work'], ['?', 'No equipment'], ['1', 'Level 1'], ['2', 'Level 2']];
    const tabs = [['positive', 'Positive'], ['negative', 'Negative'], ['sen', 'SEN'], ['notes', 'Notes'], ['qa', 'Q+A']];
    let content = '';
    if (selectedTab === 'sen') content = sensitiveVisible ? `<p class="sen-empty">${Object.entries(student.needs).filter(([, enabled]) => enabled).map(([label]) => label).join(' · ') || 'No recorded indicators'}</p>` : '<p class="sen-empty">Pupil information is hidden. Use “Show pupil info” to reveal it.</p>';
    else if (selectedTab === 'notes') content = '<textarea class="sidebar-note" placeholder="Write a note about this pupil…"></textarea>';
    else if (selectedTab === 'qa') content = '<div class="quick-answer"><button type="button" aria-label="Answer correct"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H4V10h3Zm2 10h8.5a2 2 0 0 0 1.9-1.4l1.6-5A2 2 0 0 0 19.1 11H15l.5-4.1A2 2 0 0 0 13.5 4L9 10v10Z"/></svg></button><button type="button" aria-label="Answer incorrect"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v10H4V4h3Zm2 0h8.5a2 2 0 0 1 1.9 1.4l1.6 5A2 2 0 0 1 19.1 13H15l.5 4.1a2 2 0 0 1-2 2.9L9 14V4Z"/></svg></button></div>';
    else content = `<div class="award-icon-grid">${awardNames.map(([icon, label]) => `<button class="award-icon${isPositive ? '' : ' award-icon--negative'}" type="button">${icon}<span>${label}</span></button>`).join('')}</div>`;
    awardSidebar.querySelector('.sidebar-body').innerHTML = `<div class="student-summary"><span class="pupil-photo">${student.initials}</span><span class="summary-positive">${student.positive}</span><span class="summary-name">${student.name}</span><span class="summary-negative">${student.negative}</span></div><div class="sidebar-tab-nav"><button class="sidebar-tab-scroll" type="button" data-direction="-1" aria-label="Show earlier tabs">‹</button><div class="sidebar-tabs">${tabs.map(([key, label]) => `<button class="sidebar-tab${key === selectedTab ? ' is-active' : ''}" type="button" data-tab="${key}">${label}</button>`).join('')}</div><button class="sidebar-tab-scroll" type="button" data-direction="1" aria-label="Show later tabs">›</button></div><div class="sidebar-content">${content}</div>`;
    awardSidebar.querySelectorAll('.sidebar-tab').forEach((tab) => tab.addEventListener('click', () => renderSidebar(student, tab.dataset.tab)));
    const tabStrip = awardSidebar.querySelector('.sidebar-tabs');
    awardSidebar.querySelectorAll('.sidebar-tab-scroll').forEach((button) => button.addEventListener('click', () => tabStrip.scrollBy({ left: Number(button.dataset.direction) * 90, behavior: 'smooth' })));
    if (selectedTab === 'positive' || selectedTab === 'negative') {
      awardSidebar.querySelectorAll('.award-icon').forEach((button) => {
        button.addEventListener('click', () => {
          if (isPositive) student.positive += 1; else student.negative += 1;
          const score = student.card?.querySelector(isPositive ? '.pupil-score--positive' : '.pupil-score--negative');
          if (score) score.textContent = isPositive ? student.positive : student.negative;
          renderSidebar(student, selectedTab);
        });
      });
    }
    if (selectedTab === 'qa') {
      const [correct, incorrect] = awardSidebar.querySelectorAll('.quick-answer button');
      correct.addEventListener('click', () => {
        student.positive += 1;
        const score = student.card?.querySelector('.pupil-score--positive');
        if (score) score.textContent = student.positive;
        renderSidebar(student, 'qa');
      });
      incorrect.addEventListener('click', () => {
        student.negative += 1;
        const score = student.card?.querySelector('.pupil-score--negative');
        if (score) score.textContent = student.negative;
        renderSidebar(student, 'qa');
      });
    }
  }

  function showSidebar(student) {
    awardSidebar.hidden = false;
    awardSidebar.querySelector('.award-sidebar__bar span').textContent = 'Pupil';
    renderSidebar(student);
  }

  function registerSortKey(student) {
    if (student.isThai) return (student.nickname || student.name.split(' ')[0]).toLocaleLowerCase();
    return student.name.split(' ').at(-1).toLocaleLowerCase();
  }

  function refreshAttendanceHighlights() {
    const hasSelectedPupils = view.querySelector('.pupil-card.is-selected');
    studentRecords.forEach((student) => {
      const card = student.card;
      if (!card) return;
      card.classList.remove('is-registered-present', 'is-registered-late', 'is-registered-absent');
      if (hasSelectedPupils) return;
      if (student.attendance === '/' || student.attendance === '\\') card.classList.add('is-registered-present');
      if (student.attendance === 'L') card.classList.add('is-registered-late');
      if (student.attendance === 'O' || student.attendance === 'N') card.classList.add('is-registered-absent');
    });
  }

  function showMinutesPicker(record, index, registerList) {
    awardSidebar.querySelector('.minute-picker')?.remove();
    let minutes = record.minutes ?? 0;
    const picker = document.createElement('div');
    picker.className = 'minute-picker';
    picker.innerHTML = '<button type="button" data-adjust="1" aria-label="Increase minutes late">▲</button><output>0</output><button type="button" data-adjust="-1" aria-label="Decrease minutes late">▼</button><button class="minute-done" type="button">Done</button>';
    const output = picker.querySelector('output');
    const refresh = () => { output.textContent = `${minutes}m`; };
    picker.querySelectorAll('[data-adjust]').forEach((button) => button.addEventListener('click', () => { minutes = Math.max(0, minutes + Number(button.dataset.adjust)); refresh(); }));
    picker.querySelector('.minute-done').addEventListener('click', () => {
      record.minutes = minutes;
      picker.remove();
      renderRegister(registerList, index + 1);
    });
    refresh();
    awardSidebar.append(picker);
  }

  function renderRegister(registerList, focusIndex) {
    const sorted = [...studentRecords].sort((a, b) => registerSortKey(a).localeCompare(registerSortKey(b)));
    registerList.replaceChildren();
    sorted.forEach((student, index) => {
      const row = document.createElement('div');
      row.className = 'register-row';
      row.classList.toggle('is-late', student.attendance === 'L');
      row.dataset.registerIndex = index;
      const lateControl = student.attendance === 'L' ? (mobileLayout ? `<button class="late-minutes-mobile" type="button">${student.minutes ?? 0}m</button>` : `<input class="late-minutes" type="number" min="0" value="${student.minutes ?? ''}" aria-label="Minutes late">`) : '';
      const currentCode = student.attendance ?? '';
      row.innerHTML = `<span class="pupil-photo">${student.initials}</span><span class="register-name">${student.name}</span><div class="register-code-control"><button class="register-code" type="button" aria-label="Attendance for ${student.name}">${currentCode || '—'}⌄</button><div class="register-code-menu" hidden><button type="button" data-code="/">/ Present</button><button type="button" data-code="\\">\\ Present PM</button><button type="button" data-code="O">O Unauthorised</button><button type="button" data-code="N">N Absent</button><button type="button" data-code="L">L Late</button></div></div>${lateControl}`;
      const codeButton = row.querySelector('.register-code');
      const applyCode = (code, focusNext = false) => {
        student.attendance = code;
        if (code === '/' && activeRegisterSession?.id === 'P6') student.pmPresent = true;
        refreshAttendanceHighlights();
        renderRegister(registerList);
        const nextRow = registerList.querySelector(`[data-register-index="${index + (focusNext ? 1 : 0)}"]`);
        if (code === 'L') {
          if (mobileLayout) showMinutesPicker(student, index, registerList);
          else nextRow?.querySelector('.late-minutes')?.focus();
        } else if (focusNext) nextRow?.querySelector('.register-code')?.focus();
      };
      codeButton.addEventListener('click', () => {
        registerList.querySelectorAll('.register-code-menu').forEach((menu) => { if (menu !== row.querySelector('.register-code-menu')) menu.hidden = true; });
        const menu = row.querySelector('.register-code-menu');
        menu.hidden = !menu.hidden;
      });
      row.querySelectorAll('[data-code]').forEach((option) => option.addEventListener('click', () => applyCode(option.dataset.code, true)));
      codeButton.addEventListener('keydown', (event) => {
        const code = event.key.toUpperCase();
        if (['/', '\\', 'O', 'N', 'L'].includes(code)) { event.preventDefault(); applyCode(code, true); }
      });
      const minutesInput = row.querySelector('.late-minutes');
      if (minutesInput) {
        minutesInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            student.minutes = Number(minutesInput.value) || 0;
            renderRegister(registerList, index + 1);
          }
        });
      }
      row.querySelector('.late-minutes-mobile')?.addEventListener('click', () => showMinutesPicker(student, index, registerList));
      registerList.append(row);
    });
    if (Number.isInteger(focusIndex)) registerList.querySelector(`[data-register-index="${focusIndex}"] .register-code`)?.focus();
    requestAnimationFrame(() => {
      registerList.querySelectorAll('.register-name').forEach((name) => {
        let size = 11;
        name.style.fontSize = `${size}px`;
        while (name.scrollWidth > name.clientWidth && size > 7) {
          size -= .5;
          name.style.fontSize = `${size}px`;
        }
      });
    });
  }

  function classPeriodLabel(period) {
    const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const session = registrationSessions.find((entry) => entry.id === period.id);
    const start = `${String(Math.floor(session.start / 60)).padStart(2, '0')}:${String(session.start % 60).padStart(2, '0')}`;
    return `${dayNames[period.day]} · ${session.label} · ${start}`;
  }

  function getClassPeriods(className) {
    const periods = [];
    Object.entries(teacherTimetable).forEach(([day, timetable]) => {
      Object.entries(timetable).forEach(([id, taught]) => {
        if (taught === className && registrationSessions.some((entry) => entry.id === id)) {
          periods.push({ day: Number(day), id });
        }
      });
    });
    periods.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
    return periods;
  }

  function currentClassPeriod(className) {
    const session = getCurrentSession();
    if (!session || session.id === 'AM' || session.id === 'PM') return null;
    const day = new Date().getDay();
    if (day === 0 || day === 6) return null;
    return teacherTimetable[day]?.[session.id] === className ? { day, id: session.id } : null;
  }

  function openAttendanceModal() {
    const periods = getClassPeriods(className);
    const select = attendanceModal.querySelector('.attendance-select');
    select.replaceChildren();
    if (!periods.length) {
      const toast = document.createElement('div');
      toast.className = 'class-toast';
      toast.textContent = 'No timetabled periods found for this class.';
      view.append(toast);
      setTimeout(() => toast.remove(), 2600);
      return;
    }
    const current = currentClassPeriod(className);
    periods.forEach((period) => {
      const option = document.createElement('option');
      option.value = `${period.day}:${period.id}`;
      option.textContent = classPeriodLabel(period);
      select.append(option);
    });
    if (current) select.value = `${current.day}:${current.id}`;
    attendanceModal.hidden = false;
  }

  function resetAttendance() {
    studentRecords.forEach((student) => {
      student.attendance = undefined;
      student.minutes = undefined;
      student.pmPresent = false;
    });
    refreshAttendanceHighlights();
  }

  function showRegister(session) {
    if (activeRegisterSession && activeRegisterSession.id !== session.id && !registerSubmitted) resetAttendance();
    registerSubmitted = false;
    activeRegisterSession = session;
    awardSidebar.hidden = false;
    awardSidebar.querySelector('.award-sidebar__bar span').textContent = `Register · ${className} · ${session.label}`;
    const body = awardSidebar.querySelector('.sidebar-body');
    body.innerHTML = '<div class="register-legend">/ Present (marks PM present automatically) · \\ Present PM · O Unauthorised · N Absent · L Late</div><div class="register-list"></div><button class="submit-register" type="button">Submit register</button>';
    const registerList = body.querySelector('.register-list');
    renderRegister(registerList);
    body.querySelector('.submit-register').addEventListener('click', (event) => {
      if (activeRegisterSession?.id !== session.id) {
        event.currentTarget.textContent = 'Register submitted';
        event.currentTarget.disabled = true;
        return;
      }
      const unmarked = studentRecords.filter((student) => !student.attendance).length;
      if (unmarked) {
        event.currentTarget.textContent = `${unmarked} pupil${unmarked === 1 ? '' : 's'} still need a code`;
        return;
      }
      attendanceTaken = true;
      registerSubmitted = true;
      event.currentTarget.textContent = 'Register submitted';
      event.currentTarget.disabled = true;
    });
  }

  function todayDetentions(index) {
    if (index % 11 === 0) return [{ length: '30 minutes', teacher: 'Ms Carter', room: 'Room 645', reason: 'Late to lesson' }, { length: '45 minutes', teacher: 'Mr Hughes', room: 'Room 612', reason: 'Missed homework' }];
    if (index % 6 === 0) return [{ length: '30 minutes', teacher: 'Ms Patel', room: 'Room 645', reason: 'Classroom disruption' }];
    return [];
  }

  function pupilNeeds(index) {
    const has = (entries) => entries.includes(index);
    const fsm = has([1, 4, 7, 10, 13, 16, 20, 24]);
    const ehcp = has([18, 30]);
    return {
      PP: fsm || has([28]),
      FSM: fsm,
      SEN: ehcp || has([2, 8, 14, 22, 27]),
      EAL: has([3, 6, 11, 17, 23, 29, 31]),
      LAC: has([30]),
      EHCP: ehcp,
      PIP: false,
    };
  }

  function showDetentionPopover(card, detentions) {
    view.querySelector('.detention-popover')?.remove();
    const cardBounds = card.getBoundingClientRect();
    const viewBounds = view.getBoundingClientRect();
    const popover = document.createElement('aside');
    popover.className = 'detention-popover';
    popover.innerHTML = `<h3>Today’s detentions (${detentions.length})</h3>${detentions.map((detention) => `<p><strong>${detention.length}</strong> · ${detention.teacher}<br>${detention.room} · ${detention.reason}</p>`).join('')}`;
    popover.style.left = `${Math.max(12, Math.min(cardBounds.left - viewBounds.left, view.clientWidth - 252))}px`;
    popover.style.top = `${Math.max(12, Math.min(cardBounds.bottom - viewBounds.top + 8, view.clientHeight - 125))}px`;
    view.append(popover);
  }

  function renderRooms() {
    roomMenu.replaceChildren();
    rooms.forEach((room) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = room;
      button.addEventListener('click', () => {
        roomToggle.innerHTML = `${room} <span>⌄</span>`;
        roomMenu.hidden = true;
        applyRoom(room);
      });
      roomMenu.append(button);
    });
    const addRoom = document.createElement('button');
    addRoom.className = 'room-menu__add';
    addRoom.type = 'button';
    addRoom.textContent = '+ Add new room';
    addRoom.addEventListener('click', () => {
      roomMenu.hidden = true;
      roomModal.hidden = false;
      roomModal.querySelector('.room-name-input').focus();
    });
    roomMenu.append(addRoom);
  }

  const roomLayout = document.createElement('div');
  roomLayout.className = 'class-room-layout';
  seatGrid.append(roomLayout);

  function restoreCards() {
    studentRecords.forEach((student) => {
      student.card.style.transform = '';
      seatGrid.append(student.card);
    });
    roomLayout.replaceChildren();
  }

  function renderSeatArea() {
    restoreCards();
    seatGrid.classList.remove('is-room');
    roomLayoutActive = false;
    if (!showingList && currentRoomName) {
      const cardsByName = {};
      studentRecords.forEach((student) => { cardsByName[student.name] = student.card; });
      const ok = renderRoomSeating(roomLayout, currentRoomName, cardsByName, pupilNames.slice(0, rosterSize), () => renderSeatArea());
      if (ok) { seatGrid.classList.add('is-room'); roomLayoutActive = true; }
    }
    view.classList.toggle('class-view--list', showingList);
    view.classList.toggle('class-view--seating', !showingList && !roomLayoutActive);
    view.classList.toggle('class-view--room', roomLayoutActive);
  }

  function updateViewToggle() {
    viewToggle.textContent = showingList ? 'Seating plan' : 'List view';
    viewToggle.setAttribute('aria-label', showingList ? 'Show seating plan' : 'Show list view');
    viewToggle.classList.toggle('is-active', !showingList);
  }

  function applyRoom(roomName) {
    currentRoomName = roomName;
    showingList = false;
    renderSeatArea();
    updateViewToggle();
  }

  function renderPupilDetails() {
    view.querySelectorAll('.pupil-card').forEach((card) => card.classList.toggle('has-details', sensitiveVisible));
    view.querySelectorAll('.pupil-card__details').forEach((details) => { details.hidden = !sensitiveVisible; });
  }

  pupilNames.slice(0, rosterSize).forEach((name, index) => {
    const card = document.createElement('article');
    card.className = 'pupil-card';
    const initials = name.split(' ').map((part) => part[0]).join('');
    const positive = (index * 3 + 2) % 9;
    const negative = (index + 1) % 4;
    const detentions = todayDetentions(index);
    const needs = pupilNeeds(index);
    const student = { name, initials, positive, negative, needs, timetable: buildStudentTimetable(className), ...(thaiStudentDetails[name] || {}) };
    const detentionTile = detentions.length ? '<button class="pupil-tag pupil-tag--detention has-detention" type="button" aria-label="View today’s detentions">◷</button>' : '<span class="pupil-tag is-inactive"></span>';
    const needTile = (label) => `<span class="pupil-tag${needs[label] ? '' : ' is-inactive'}">${needs[label] ? label : ''}</span>`;
    card.innerHTML = `<div class="pupil-card__top"><div class="pupil-card__header"><span class="pupil-photo" aria-label="${name} profile picture">${initials}</span><span class="pupil-scores"><span class="pupil-score pupil-score--positive">${positive}</span><span class="pupil-score pupil-score--negative">${negative}</span></span></div><div class="pupil-card__name">${name}</div></div><div class="pupil-card__details" hidden>${needTile('PP')}${needTile('FSM')}${needTile('SEN')}${needTile('EAL')}${needTile('LAC')}${needTile('EHCP')}${needTile('PIP')}${detentionTile}</div>`;
    if (detentions.length) {
      const detentionButton = card.querySelector('.pupil-tag--detention');
      detentionButton.addEventListener('mouseenter', () => showDetentionPopover(card, detentions));
      detentionButton.addEventListener('focus', () => showDetentionPopover(card, detentions));
      detentionButton.addEventListener('click', (event) => event.stopPropagation());
      detentionButton.addEventListener('mouseleave', () => view.querySelector('.detention-popover')?.remove());
      detentionButton.addEventListener('blur', () => view.querySelector('.detention-popover')?.remove());
    }
    card.addEventListener('click', () => {
      if (multiAwardMode) {
        card.classList.toggle('is-selected');
        refreshAttendanceHighlights();
      }
      else showSidebar(student);
    });
    seatGrid.append(card);
    student.card = card;
    studentRecords.push(student);
  });
  renderRooms();

  roomToggle.addEventListener('click', () => { roomMenu.hidden = !roomMenu.hidden; });
  viewToggle.addEventListener('click', () => {
    showingList = !showingList;
    renderSeatArea();
    updateViewToggle();
  });
  view.querySelector('.multi-award').addEventListener('click', (event) => {
    multiAwardMode = !multiAwardMode;
    view.querySelector('.award-panel').hidden = !multiAwardMode;
    if (multiAwardMode) awardSidebar.hidden = true;
    event.currentTarget.classList.toggle('is-active', multiAwardMode);
    if (!multiAwardMode) view.querySelectorAll('.pupil-card').forEach((card) => card.classList.remove('is-selected'));
    refreshAttendanceHighlights();
  });
  view.querySelector('.award-positive').addEventListener('click', () => showBulkAward('positive'));
  view.querySelector('.award-negative').addEventListener('click', () => showBulkAward('negative'));

  function classToast(message) {
    const toast = document.createElement('div');
    toast.className = 'class-toast';
    toast.textContent = message;
    view.append(toast);
    setTimeout(() => toast.remove(), 2800);
  }

  function showBulkAward(type) {
    const selected = studentRecords.filter((student) => student.card?.classList.contains('is-selected'));
    if (!selected.length) { classToast('Select one or more pupils first'); return; }
    multiAwardMode = false;
    view.querySelector('.award-panel').hidden = true;
    view.querySelector('.multi-award').classList.remove('is-active');
    awardSidebar.hidden = false;
    awardSidebar.querySelector('.award-sidebar__bar span').textContent = `Award ${type} · ${selected.length} pupil${selected.length === 1 ? '' : 's'}`;
    const body = awardSidebar.querySelector('.sidebar-body');
    const isPositive = type === 'positive';
    const awardNames = activityAwards[type];
    body.innerHTML = `<div class="bulk-award-summary">Applying to ${selected.length} selected pupil${selected.length === 1 ? '' : 's'}.</div><div class="award-icon-grid">${awardNames.map(([icon, label]) => `<button class="award-icon${isPositive ? '' : ' award-icon--negative'}" type="button">${icon}<span>${label}</span></button>`).join('')}</div>`;
    body.querySelectorAll('.award-icon').forEach((button) => {
      button.addEventListener('click', () => {
        const label = button.querySelector('span').textContent;
        selected.forEach((student) => {
          if (isPositive) student.positive += 1; else student.negative += 1;
          const score = student.card?.querySelector(isPositive ? '.pupil-score--positive' : '.pupil-score--negative');
          if (score) score.textContent = isPositive ? student.positive : student.negative;
        });
        view.querySelectorAll('.pupil-card').forEach((card) => card.classList.remove('is-selected'));
        refreshAttendanceHighlights();
        awardSidebar.hidden = true;
        classToast(`${label} awarded to ${selected.length} pupil${selected.length === 1 ? '' : 's'}`);
      });
    });
  }
  awardSidebar.querySelector('.award-sidebar__close').addEventListener('click', () => {
    if (activeRegisterSession) {
      if (!registerSubmitted) resetAttendance();
      activeRegisterSession = undefined;
      registerSubmitted = false;
    }
    awardSidebar.hidden = true;
  });
  view.querySelector('.attendance').addEventListener('click', () => { openAttendanceModal(); });
  view.querySelector('.random-pupil').addEventListener('click', async () => {
    const cards = [...view.querySelectorAll('.pupil-card')];
    view.querySelectorAll('.pupil-card').forEach((card) => card.classList.remove('is-selected', 'is-random'));
    const picks = cards.sort(() => Math.random() - .5).slice(0, Math.min(4, cards.length));
    for (const card of picks) {
      card.classList.add('is-random');
      await new Promise((resolve) => setTimeout(resolve, 500));
      card.classList.remove('is-random');
    }
    picks.at(-1)?.classList.add('is-selected');
    refreshAttendanceHighlights();
  });
  infoButton.addEventListener('click', () => {
    if (sensitiveVisible) { sensitiveVisible = false; renderPupilDetails(); infoButton.textContent = 'Show pupil info'; }
    else modal.hidden = false;
  });
  modal.querySelector('.cancel').addEventListener('click', () => { modal.hidden = true; });
  modal.querySelector('.confirm').addEventListener('click', () => {
    sensitiveVisible = true;
    renderPupilDetails();
    infoButton.textContent = 'Hide pupil info';
    modal.hidden = true;
  });
  attendanceModal.querySelector('.attendance-cancel').addEventListener('click', () => { attendanceModal.hidden = true; });
  attendanceModal.querySelector('.confirm').addEventListener('click', () => {
    const [day, id] = attendanceModal.querySelector('.attendance-select').value.split(':');
    const session = registrationSessions.find((entry) => entry.id === id);
    attendanceModal.hidden = true;
    if (session) showRegister({ ...session, day: Number(day) });
  });
  roomModal.querySelector('.room-cancel').addEventListener('click', () => { roomModal.hidden = true; });
  roomModal.querySelector('.room-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = roomModal.querySelector('.room-name-input');
    const roomName = input.value.trim();
    if (!roomName) return;
    if (!getRooms().some((room) => room.name.toLowerCase() === roomName.toLowerCase())) addRoom(roomName);
    rooms = getRooms().map((room) => room.name);
  renderRooms();
  renderSeatArea();
  updateViewToggle();
    roomToggle.innerHTML = `${roomName} <span>⌄</span>`;
    input.value = '';
    roomModal.hidden = true;
  });
  setupHomeworkMarking(view, className, studentRecords);
  content.append(view);
}

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

const registrationSessions = [
  { id: 'AM', label: 'AM form', start: 8 * 60, end: 8 * 60 + 30 },
  { id: 'P1', label: 'P1', start: 8 * 60 + 30, end: 9 * 60 + 25 },
  { id: 'P2', label: 'P2', start: 9 * 60 + 25, end: 10 * 60 + 20 },
  { id: 'P3', label: 'P3', start: 10 * 60 + 40, end: 11 * 60 + 35 },
  { id: 'P4', label: 'P4', start: 11 * 60 + 35, end: 12 * 60 + 30 },
  { id: 'P5', label: 'P5', start: 13 * 60 + 20, end: 14 * 60 + 15 },
  { id: 'P6', label: 'P6', start: 14 * 60 + 15, end: 15 * 60 + 10 },
  { id: 'PM', label: 'PM form', start: 15 * 60 + 10, end: 15 * 60 + 20 },
];

const teacherForm = { name: 'Year 8 Form', amRegister: true, pmRegister: true };
const teacherTimetable = {
  1: { P1: 'Y9/Cs', P2: 'Y8/Cs', P3: 'Y7/Cs', P4: 'Y12/Cs', P5: 'Y5/Cs', P6: 'Y10/Cs' },
  2: { P1: 'Y8/Cs', P2: 'Y10/Cs', P3: 'Y3/Cs', P4: 'Y11/Cs', P5: 'Y6/Cs', P6: 'Y13/Cs' },
  3: { P1: 'Y11/Cs', P2: 'Y6/Cs', P3: 'Y13/Cs', P4: 'Y9/Cs', P5: 'Y4/Cs', P6: 'Y1/Cs' },
  4: { P1: 'Y5/Cs', P2: 'Y2/Cs', P3: 'Y9/Cs', P4: 'Y7/Cs', P5: 'Y10/Cs', P6: 'Y12/Cs' },
  5: { P1: 'YR/Cs', P2: 'Y4/Cs', P3: 'Y8/Cs', P4: 'Y3/Cs', P5: 'Y6/Cs', P6: 'Y11/Cs' },
};

function getCurrentSession(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return registrationSessions.find((session) => minutes >= session.start && minutes < session.end) || null;
}

function getRegisterWindow(className, date = new Date()) {
  const session = getCurrentSession(date);
  if (!session || date.getDay() === 0 || date.getDay() === 6) return null;
  if (session.id === 'AM' && teacherForm.amRegister && className === teacherForm.name) return session;
  if (session.id === 'PM' && teacherForm.pmRegister && className === teacherForm.name) return session;
  return teacherTimetable[date.getDay()]?.[session.id] === className ? session : null;
}

function buildStudentTimetable(className) {
  return Object.fromEntries(Object.entries(teacherTimetable).map(([day, timetable]) => [
    day,
    Object.fromEntries(Object.keys(timetable).map((period) => [period, timetable[period] === className ? className : 'Other class'])),
  ]));
}

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  refreshWhenChanged();
  setInterval(refreshWhenChanged, 1000);
}
