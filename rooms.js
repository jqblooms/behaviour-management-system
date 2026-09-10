const ROOM_STORE_KEY = 'behaviour-management-system-room-plans';
const ROOM_DESK_SIZE = { single: { w: 72, h: 56 }, double: { w: 144, h: 56 }, quad: { w: 144, h: 112 } };
const ROOM_SEAT_COUNT = { single: 1, double: 2, quad: 4 };
const ROOM_SEAT_OFFSETS = {
  single: [{ x: 0, y: 0 }],
  double: [{ x: 0, y: 0 }, { x: 72, y: 0 }],
  quad: [{ x: 0, y: 0 }, { x: 72, y: 0 }, { x: 0, y: 56 }, { x: 72, y: 56 }],
};

function roomInitials(name) { return name.split(' ').map((part) => part[0]).join(''); }

function roomSeeds() {
  const pupils = pupilNames.slice(0, 12);
  const double = (id, x, y, rotation, seats) => ({ id, type: 'double', x, y, rotation, seats });
  const quad = (id, x, y, rotation, seats) => ({ id, type: 'quad', x, y, rotation, seats });
  const single = (id, x, y, rotation, seats) => ({ id, type: 'single', x, y, rotation, seats });
  return [
    {
      id: 'room-645', name: 'Computer Room 645',
      desks: [
        double('d1', 6, 10, 0, [pupils[0], pupils[1]]),
        double('d2', 6, 32, 0, [pupils[2], pupils[3]]),
        double('d3', 6, 54, 0, [pupils[4], pupils[5]]),
        double('d4', 6, 76, 0, [pupils[6], pupils[7]]),
        double('d5', 72, 10, 180, [pupils[8], pupils[9]]),
        double('d6', 72, 32, 180, [pupils[10], pupils[11]]),
      ],
    },
    {
      id: 'room-612', name: 'Computer Room 612',
      desks: [
        quad('q1', 6, 10, 0, [pupils[0], pupils[1], pupils[2], pupils[3]]),
        quad('q2', 6, 62, 0, [pupils[4], pupils[5], pupils[6], pupils[7]]),
        single('s1', 76, 8, 0, [pupils[8]]),
        single('s2', 76, 26, 0, [pupils[9]]),
        single('s3', 76, 44, 0, [pupils[10]]),
        single('s4', 76, 62, 0, [pupils[11]]),
      ],
    },
    { id: 'room-lab', name: 'Innovation Lab', desks: [] },
    { id: 'room-lib', name: 'Library Suite', desks: [] },
  ];
}

function getRooms() {
  const stored = readStoredArray(ROOM_STORE_KEY, { allowEmpty: false });
  if (stored) return stored;
  const seeds = roomSeeds();
  saveRoomStore(seeds);
  return seeds;
}
function saveRoomStore(rooms) { writeStoredValue(ROOM_STORE_KEY, rooms); }
function getRoomByName(name) { return getRooms().find((room) => room.name === name); }
function addRoom(name) { const rooms = getRooms(); const room = { id: `room-${Date.now()}`, name, desks: [] }; rooms.push(room); saveRoomStore(rooms); return room; }
function deleteRoomByName(name) { const rooms = getRooms().filter((room) => room.name !== name); saveRoomStore(rooms); return rooms; }

function roomMovePupil(roomName, pupilName, deskId, seatIndex) {
  const rooms = getRooms();
  const room = rooms.find((r) => r.name === roomName);
  if (!room) return false;
  let prevDesk = null; let prevIndex = -1;
  room.desks.forEach((desk) => { const i = desk.seats.indexOf(pupilName); if (i !== -1) { prevDesk = desk; prevIndex = i; } });
  const target = room.desks.find((desk) => desk.id === deskId);
  if (!target) return false;
  const occupant = target.seats[seatIndex];
  target.seats[seatIndex] = pupilName;
  if (prevDesk) prevDesk.seats[prevIndex] = occupant;
  saveRoomStore(rooms);
  return true;
}

function makeDraggable(card, pupilName) {
  card.setAttribute('draggable', 'true');
  card.ondragstart = (event) => { event.dataTransfer.setData('text/pupil', pupilName); event.dataTransfer.effectAllowed = 'move'; };
}

function defaultSeatPupil(pupil, desk) {
  const chip = document.createElement('div');
  chip.className = 'room-pupil';
  chip.title = pupil;
  chip.style.transform = `rotate(-${desk.rotation}deg)`;
  chip.innerHTML = `<span class="room-pupil__photo">${roomInitials(pupil)}</span><span class="room-pupil__name">${pupil}</span>`;
  return chip;
}

function buildDeskElement(desk, opts = {}) {
  const size = ROOM_DESK_SIZE[desk.type];
  const el = document.createElement('div');
  el.className = `room-desk room-desk--${desk.type}${opts.selected ? ' is-selected' : ''}`;
  el.style.width = `${size.w}px`;
  el.style.height = `${size.h}px`;
  el.style.left = `${desk.x}%`;
  el.style.top = `${desk.y}%`;
  el.style.transform = `rotate(${desk.rotation}deg)`;
  ROOM_SEAT_OFFSETS[desk.type].forEach((off, index) => {
    const seat = document.createElement('div');
    seat.className = 'room-seat';
    seat.style.left = `${off.x}px`;
    seat.style.top = `${off.y}px`;
    seat.dataset.seatIndex = index;
    const pupil = desk.seats[index];
    if (pupil) {
      const content = opts.seatRenderer ? opts.seatRenderer(pupil, desk, index) : defaultSeatPupil(pupil, desk);
      if (content) {
        if (opts.onPupilClick) content.addEventListener('click', (event) => { event.stopPropagation(); opts.onPupilClick(pupil, desk.id, index); });
        seat.append(content);
      }
    } else if (opts.interactive) {
      seat.classList.add('is-empty');
    }
    if (opts.onSeatClick) {
      seat.addEventListener('click', (event) => { event.stopPropagation(); opts.onSeatClick(desk.id, index); });
    }
    if (opts.onSeatDrop) {
      seat.addEventListener('dragover', (event) => { event.preventDefault(); seat.classList.add('is-droptarget'); });
      seat.addEventListener('dragleave', () => seat.classList.remove('is-droptarget'));
      seat.addEventListener('drop', (event) => { event.preventDefault(); seat.classList.remove('is-droptarget'); const name = event.dataTransfer.getData('text/pupil'); opts.onSeatDrop(desk.id, index, name); });
    }
    el.append(seat);
  });
  if (opts.interactive) {
    const handle = document.createElement('div');
    handle.className = 'room-desk__handle';
    handle.title = 'Drag to move desk';
    handle.textContent = '≡';
    handle.addEventListener('pointerdown', (event) => { event.stopPropagation(); if (opts.onDeskDrag) opts.onDeskDrag(event, desk, el); });
    el.append(handle);
  }
  if (opts.onDeskClick) el.addEventListener('click', (event) => { event.stopPropagation(); opts.onDeskClick(desk.id); });
  return el;
}

function showRoomsPage(content) {
  const rooms = getRooms();
  const state = { currentId: rooms[0].id, editMode: true, selectedDeskId: null };
  const current = () => rooms.find((room) => room.id === state.currentId);
  const save = () => saveRoomStore(rooms);

  const page = document.createElement('div');
  page.className = 'rooms-page';
  page.setAttribute('aria-label', 'Room seating plan editor');
  const topbar = document.createElement('div');
  topbar.className = 'rooms-topbar';
  topbar.innerHTML = `<div class="rooms-title">Rooms &amp; seating plans</div><label class="rooms-edit-toggle"><input type="checkbox" ${state.editMode ? 'checked' : ''} aria-label="Edit mode"><span>Edit mode</span></label>`;
  page.append(topbar);
  topbar.querySelector('.rooms-edit-toggle input').addEventListener('change', (event) => { state.editMode = event.target.checked; render(); });

  const body = document.createElement('div');
  body.className = 'rooms-body';
  const canvas = document.createElement('div');
  canvas.className = 'room-canvas';
  const panel = document.createElement('aside');
  panel.className = 'rooms-panel';
  body.append(canvas, panel);
  page.append(body);

  function renderCanvas() {
    canvas.replaceChildren();
    if (!current().desks.length) {
      const hint = document.createElement('div');
      hint.className = 'rooms-empty';
      hint.textContent = 'No desks yet. Add a desk from the panel to start.';
      canvas.append(hint);
      return;
    }
    current().desks.forEach((desk) => {
      canvas.append(buildDeskElement(desk, {
        selected: desk.id === state.selectedDeskId,
        interactive: state.editMode,
        onDeskClick: (id) => { state.selectedDeskId = id; render(); },
        onDeskDrag: (event, desk, el) => {
          if (!state.editMode) return;
          state.selectedDeskId = desk.id;
          const startX = event.clientX; const startY = event.clientY;
          const startLeft = desk.x; const startTop = desk.y;
          const rect = canvas.getBoundingClientRect();
          const move = (ev) => {
            desk.x = Math.max(0, Math.min(100, startLeft + ((ev.clientX - startX) / rect.width) * 100));
            desk.y = Math.max(0, Math.min(100, startTop + ((ev.clientY - startY) / rect.height) * 100));
            el.style.left = `${desk.x}%`;
            el.style.top = `${desk.y}%`;
          };
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); save(); render(); };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        },
      }));
    });
  }

  function renderPanel() {
    panel.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'rooms-panel__heading';
    heading.textContent = 'Rooms';
    panel.append(heading);

    const list = document.createElement('div');
    list.className = 'rooms-panel__list';
    rooms.forEach((room) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `rooms-panel__room${room.id === state.currentId ? ' is-active' : ''}`;
      btn.textContent = room.name;
      btn.addEventListener('click', () => { state.currentId = room.id; state.selectedDeskId = null; render(); });
      list.append(btn);
    });
    panel.append(list);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'rooms-panel__add';
    addBtn.textContent = '+ Add room';
    addBtn.addEventListener('click', () => {
      const room = addRoom(`Room ${rooms.length + 1}`);
      rooms.length = 0; getRooms().forEach((r) => rooms.push(r));
      state.currentId = room.id;
      state.selectedDeskId = null;
      render();
    });
    panel.append(addBtn);

    const section = document.createElement('div');
    section.className = 'rooms-panel__section';
    section.innerHTML = '<div class="rooms-panel__heading">Selected room</div>';
    const nameInput = document.createElement('input');
    nameInput.className = 'rooms-panel__name';
    nameInput.type = 'text';
    nameInput.maxLength = 40;
    nameInput.value = current().name;
    nameInput.setAttribute('aria-label', 'Room name');
    nameInput.addEventListener('change', () => { current().name = nameInput.value.trim() || current().name; nameInput.value = current().name; save(); render(); });
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'rooms-panel__delete';
    deleteBtn.textContent = 'Delete room';
    deleteBtn.addEventListener('click', () => {
      if (rooms.length <= 1) return;
      const remaining = deleteRoomByName(current().name);
      rooms.length = 0; remaining.forEach((room) => rooms.push(room));
      state.currentId = rooms[0].id;
      state.selectedDeskId = null;
      render();
    });
    section.append(nameInput, deleteBtn);
    panel.append(section);

    const desksHeading = document.createElement('div');
    desksHeading.className = 'rooms-panel__heading';
    desksHeading.textContent = 'Desks';
    panel.append(desksHeading);
    const palette = document.createElement('div');
    palette.className = 'rooms-desk-palette';
    [['single', 'Single'], ['double', 'Double'], ['quad', 'Four']].forEach(([type, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `rooms-desk-palette__button rooms-desk-palette__button--${type}`;
      b.innerHTML = `<span class="rooms-desk-icon rooms-desk-icon--${type}"></span>${label}`;
      b.addEventListener('click', () => {
        const room = current();
        const desk = { id: `desk-${Date.now()}`, type, x: 18 + (room.desks.length * 7) % 60, y: 10 + (room.desks.length * 9) % 60, rotation: 0, seats: new Array(ROOM_SEAT_COUNT[type]).fill(null) };
        room.desks.push(desk);
        state.selectedDeskId = desk.id;
        save();
        render();
      });
      palette.append(b);
    });
    panel.append(palette);

    const actions = document.createElement('div');
    actions.className = 'rooms-panel__actions';
    const rotateBtn = document.createElement('button');
    rotateBtn.type = 'button';
    rotateBtn.textContent = 'Rotate desk';
    rotateBtn.disabled = !state.selectedDeskId;
    rotateBtn.addEventListener('click', () => {
      const desk = current().desks.find((d) => d.id === state.selectedDeskId);
      if (!desk) return;
      desk.rotation = (desk.rotation + 90) % 360;
      save();
      render();
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Delete desk';
    removeBtn.disabled = !state.selectedDeskId;
    removeBtn.addEventListener('click', () => {
      const room = current();
      room.desks = room.desks.filter((d) => d.id !== state.selectedDeskId);
      state.selectedDeskId = null;
      save();
      render();
    });
    actions.append(rotateBtn, removeBtn);
    panel.append(actions);

    const hint = document.createElement('p');
    hint.className = 'rooms-panel__hint';
    hint.textContent = 'Drag desks by their handle. Pupils are seated from each class page.';
    panel.append(hint);
  }

  function render() { renderCanvas(); renderPanel(); }

  render();
  content.append(page);
}

function renderRoomSeating(container, roomName, cardsByName, rosterNames, onChanged) {
  const room = getRoomByName(roomName);
  container.replaceChildren();
  if (!room || !room.desks.length) return false;
  const wrap = document.createElement('div');
  wrap.className = 'room-wrap';
  const layout = document.createElement('div');
  layout.className = 'room-layout';
  const seated = new Set();
  room.desks.forEach((desk) => {
    desk.seats.forEach((name) => { if (name) seated.add(name); });
    layout.append(buildDeskElement(desk, {
      seatRenderer: (pupil, d) => {
        const card = cardsByName[pupil];
        if (!card) return null;
        card.style.transform = `rotate(-${d.rotation}deg)`;
        makeDraggable(card, pupil);
        return card;
      },
      onSeatDrop: (deskId, index, name) => {
        if (name) { roomMovePupil(roomName, name, deskId, index); if (onChanged) onChanged(); }
      },
    }));
  });
  wrap.append(layout);
  const unseated = rosterNames.filter((name) => !seated.has(name));
  if (unseated.length) {
    const panel = document.createElement('aside');
    panel.className = 'room-unseated-panel';
    panel.innerHTML = `<div class="room-unseated__bar"><span>Unseated pupils (${unseated.length})</span><button class="room-unseated__toggle" type="button" aria-label="Hide unseated pupils">×</button></div><div class="room-unseated__list"></div>`;
    const list = panel.querySelector('.room-unseated__list');
    unseated.forEach((name) => {
      const card = cardsByName[name];
      if (!card) return;
      card.style.transform = '';
      makeDraggable(card, name);
      list.append(card);
    });
    panel.querySelector('.room-unseated__toggle').addEventListener('click', () => panel.classList.toggle('is-collapsed'));
    wrap.append(panel);
  }
  container.append(wrap);
  return true;
}
