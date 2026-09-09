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
  const rosterNames = className === 'All pupils' ? pupilNames : getClassRoster(className);
  const rosterSize = Math.min(rosterSizeOverride ?? rosterNames.length, rosterNames.length);
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
    const awardNames = getBehaviourAwardPairs(isPositive ? 'positive' : 'negative');
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
      const ok = renderRoomSeating(roomLayout, currentRoomName, cardsByName, rosterNames.slice(0, rosterSize), () => renderSeatArea());
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

  rosterNames.slice(0, rosterSize).forEach((name, index) => {
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
    const awardNames = getBehaviourAwardPairs(type);
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
