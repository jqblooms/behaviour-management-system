const ADMIN_ICON_CHOICES = ['★', '✓', '↑', '♥', '☀', '⚑', '!', '↺', '⊘', '⌁', '↯', '?', '1', '2'];
let adminSpreadsheetLibrary;

function loadSpreadsheetLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (adminSpreadsheetLibrary) return adminSpreadsheetLibrary;
  adminSpreadsheetLibrary = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('The spreadsheet reader could not be loaded.'));
    document.head.append(script);
  });
  return adminSpreadsheetLibrary;
}

async function readSpreadsheet(file) {
  const XLSX = await loadSpreadsheetLibrary();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })
    .map((row) => row.map((cell) => String(cell).trim()))
    .filter((row) => row.some(Boolean));
}

function guessAdminMapping(headers) {
  const find = (patterns) => headers.findIndex((header) => patterns.some((pattern) => String(header).toLowerCase().includes(pattern)));
  const studentName = find(['student name', 'pupil name', 'student', 'pupil', 'name']);
  const email = find(['email', 'e-mail']);
  const className = find(['class name', 'class', 'group', 'form']);
  return { studentName: studentName < 0 ? null : studentName, email: email < 0 ? null : email, className: className < 0 ? null : className };
}

function showAdminPage(content) {
  const page = document.createElement('section');
  page.className = 'admin-page';
  page.setAttribute('aria-label', 'Administration');
  const tabs = document.createElement('div');
  tabs.className = 'admin-tabs';
  const body = document.createElement('div');
  body.className = 'admin-body';
  const views = [['behaviour', 'Behaviour types'], ['classes', 'Import classes']];
  let activeView = 'behaviour';
  let sheetState = { fileName: '', matrix: [], mapping: { studentName: null, email: null, className: null }, selectedRows: new Set(), message: '' };

  views.forEach(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-tab${key === activeView ? ' is-active' : ''}`;
    button.dataset.view = key;
    button.textContent = label;
    button.addEventListener('click', () => {
      activeView = key;
      tabs.querySelectorAll('.admin-tab').forEach((item) => item.classList.toggle('is-active', item.dataset.view === key));
      render();
    });
    tabs.append(button);
  });

  function renderBehaviourTypes() {
    body.replaceChildren();
    const intro = document.createElement('div');
    intro.className = 'admin-intro';
    intro.innerHTML = '<h2>Behaviour types</h2><p>Create the positive and negative points available to teachers.</p>';
    const form = document.createElement('form');
    form.className = 'admin-behaviour-form';
    const type = document.createElement('select');
    type.setAttribute('aria-label', 'Behaviour type');
    type.append(new Option('Positive', 'positive'), new Option('Negative', 'negative'));
    const icon = document.createElement('select');
    icon.className = 'admin-icon-select';
    icon.setAttribute('aria-label', 'Behaviour icon');
    ADMIN_ICON_CHOICES.forEach((choice) => icon.append(new Option(choice, choice)));
    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 40;
    name.required = true;
    name.placeholder = 'Behaviour name';
    name.setAttribute('aria-label', 'Behaviour name');
    const points = document.createElement('input');
    points.type = 'number';
    points.min = '1';
    points.step = '1';
    points.value = '1';
    points.required = true;
    points.className = 'admin-points-input';
    points.title = 'Points awarded';
    points.setAttribute('aria-label', 'Points awarded');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Add behaviour';
    form.append(type, icon, name, points, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const label = name.value.trim();
      if (!label) return;
      addBehaviourType(type.value, icon.value, label, points.value);
      name.value = '';
      points.value = '1';
      renderBehaviourTypes();
    });
    const columns = document.createElement('div');
    columns.className = 'admin-behaviour-columns';
    ['positive', 'negative'].forEach((kind) => {
      const section = document.createElement('section');
      section.className = `admin-behaviour-list admin-behaviour-list--${kind}`;
      const heading = document.createElement('h3');
      heading.textContent = kind === 'positive' ? 'Positive points' : 'Negative points';
      section.append(heading);
      const items = getBehaviourTypes(kind);
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'admin-empty';
        empty.textContent = 'No behaviour types configured.';
        section.append(empty);
      }
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'admin-behaviour-row';
        const symbol = document.createElement('span');
        symbol.className = 'admin-behaviour-icon';
        symbol.textContent = item.icon;
        const label = document.createElement('span');
        label.className = 'admin-behaviour-name';
        label.textContent = item.name;
        const score = document.createElement('span');
        score.className = 'admin-behaviour-points';
        score.textContent = `${item.points} pt${item.points === 1 ? '' : 's'}`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove ${item.name}`);
        remove.addEventListener('click', () => { removeBehaviourType(item.id); renderBehaviourTypes(); });
        row.append(symbol, label, score, remove);
        section.append(row);
      });
      columns.append(section);
    });
    body.append(intro, form, columns);
  }

  function setMapping(field, column) {
    Object.keys(sheetState.mapping).forEach((key) => { if (sheetState.mapping[key] === column) sheetState.mapping[key] = null; });
    sheetState.mapping[field] = column;
    renderClassImport();
  }

  function renderClassImport() {
    body.replaceChildren();
    const intro = document.createElement('div');
    intro.className = 'admin-intro';
    intro.innerHTML = '<h2>Import classes</h2><p>Upload a spreadsheet, map its columns, then choose the pupil rows to import.</p>';
    const upload = document.createElement('label');
    upload.className = 'admin-upload';
    upload.innerHTML = `<strong>${sheetState.fileName || 'Choose a spreadsheet'}</strong><span>Excel, OpenDocument, CSV or TSV</span>`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.xlsb,.ods,.csv,.tsv,.txt';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      upload.classList.add('is-loading');
      upload.querySelector('span').textContent = 'Reading spreadsheet…';
      try {
        const matrix = await readSpreadsheet(file);
        if (matrix.length < 2) throw new Error('The spreadsheet needs a header and at least one data row.');
        sheetState = {
          fileName: file.name,
          matrix,
          mapping: guessAdminMapping(matrix[0]),
          selectedRows: new Set(matrix.slice(1).map((_, index) => index + 1)),
          message: '',
        };
      } catch (error) {
        sheetState.message = error.message;
      }
      renderClassImport();
    });
    upload.append(input);
    body.append(intro, upload);
    if (sheetState.message) {
      const message = document.createElement('p');
      message.className = 'admin-message';
      message.textContent = sheetState.message;
      body.append(message);
    }
    if (!sheetState.matrix.length) return;

    const headers = sheetState.matrix[0];
    const fields = [['studentName', 'Student name'], ['email', 'Email'], ['className', 'Class']];
    const mapping = document.createElement('section');
    mapping.className = 'admin-mapping';
    const mappingTitle = document.createElement('h3');
    mappingTitle.textContent = 'Map spreadsheet columns';
    const targets = document.createElement('div');
    targets.className = 'admin-map-targets';
    fields.forEach(([field, label]) => {
      const target = document.createElement('button');
      target.type = 'button';
      target.className = `admin-map-target${sheetState.mapping[field] !== null ? ' is-mapped' : ''}`;
      target.innerHTML = `<span>${label}${field === 'email' ? ' (optional)' : ''}</span><strong>${sheetState.mapping[field] === null ? 'Drop a column here' : ''}</strong>`;
      if (sheetState.mapping[field] !== null) target.querySelector('strong').textContent = headers[sheetState.mapping[field]] || `Column ${sheetState.mapping[field] + 1}`;
      target.addEventListener('dragover', (event) => { event.preventDefault(); target.classList.add('is-over'); });
      target.addEventListener('dragleave', () => target.classList.remove('is-over'));
      target.addEventListener('drop', (event) => { event.preventDefault(); setMapping(field, Number(event.dataTransfer.getData('text/column'))); });
      target.addEventListener('click', () => { if (sheetState.mapping[field] !== null) { sheetState.mapping[field] = null; renderClassImport(); } });
      targets.append(target);
    });
    const columnList = document.createElement('div');
    columnList.className = 'admin-column-list';
    headers.forEach((header, column) => {
      const card = document.createElement('div');
      card.className = 'admin-column-card';
      const chip = document.createElement('div');
      chip.className = 'admin-column-chip';
      chip.draggable = true;
      chip.textContent = header || `Column ${column + 1}`;
      chip.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/column', String(column)));
      card.append(chip);
      fields.forEach(([field, label]) => {
        const checkLabel = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = sheetState.mapping[field] === column;
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) setMapping(field, column);
          else { sheetState.mapping[field] = null; renderClassImport(); }
        });
        checkLabel.append(checkbox, document.createTextNode(label));
        card.append(checkLabel);
      });
      columnList.append(card);
    });
    mapping.append(mappingTitle, targets, columnList);

    const preview = document.createElement('section');
    preview.className = 'admin-preview';
    const previewHead = document.createElement('div');
    previewHead.className = 'admin-preview__head';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.checked = sheetState.selectedRows.size === sheetState.matrix.length - 1;
    selectAll.setAttribute('aria-label', 'Select all rows');
    selectAll.addEventListener('change', () => {
      sheetState.selectedRows = selectAll.checked ? new Set(sheetState.matrix.slice(1).map((_, index) => index + 1)) : new Set();
      renderClassImport();
    });
    const previewTitle = document.createElement('strong');
    previewTitle.textContent = `Spreadsheet preview · ${sheetState.selectedRows.size} selected`;
    previewHead.append(selectAll, previewTitle);
    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-preview__table';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const selectorHeader = document.createElement('th');
    selectorHeader.textContent = 'Use';
    headerRow.append(selectorHeader);
    headers.forEach((header) => { const th = document.createElement('th'); th.textContent = header; headerRow.append(th); });
    thead.append(headerRow);
    const tbody = document.createElement('tbody');
    sheetState.matrix.slice(1, 101).forEach((row, offset) => {
      const rowIndex = offset + 1;
      const tr = document.createElement('tr');
      const selectionCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = sheetState.selectedRows.has(rowIndex);
      checkbox.setAttribute('aria-label', `Import row ${rowIndex + 1}`);
      checkbox.addEventListener('change', () => { if (checkbox.checked) sheetState.selectedRows.add(rowIndex); else sheetState.selectedRows.delete(rowIndex); previewTitle.textContent = `Spreadsheet preview · ${sheetState.selectedRows.size} selected`; });
      selectionCell.append(checkbox);
      tr.append(selectionCell);
      headers.forEach((_, column) => { const td = document.createElement('td'); td.textContent = row[column] || ''; tr.append(td); });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    tableWrap.append(table);
    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.className = 'admin-import-button';
    importButton.textContent = 'Import selected classes';
    importButton.disabled = sheetState.mapping.studentName === null || sheetState.mapping.className === null || !sheetState.selectedRows.size;
    importButton.addEventListener('click', () => {
      const grouped = new Map();
      [...sheetState.selectedRows].sort((a, b) => a - b).forEach((rowIndex) => {
        const row = sheetState.matrix[rowIndex];
        const studentName = row?.[sheetState.mapping.studentName]?.trim();
        const className = row?.[sheetState.mapping.className]?.trim();
        if (!studentName || !className) return;
        if (!grouped.has(className)) grouped.set(className, []);
        grouped.get(className).push({ name: studentName, email: sheetState.mapping.email === null ? '' : row[sheetState.mapping.email]?.trim() || '' });
      });
      const records = [...grouped].map(([name, students]) => ({ name, students }));
      if (!records.length) { sheetState.message = 'No valid class and student rows were found.'; renderClassImport(); return; }
      importClassRecords(records);
      sheetState.message = `${records.length} class${records.length === 1 ? '' : 'es'} imported. They are now available in Classes.`;
      renderClassImport();
    });
    preview.append(previewHead, tableWrap, importButton);
    body.append(mapping, preview);
  }

  function render() {
    if (activeView === 'behaviour') renderBehaviourTypes();
    else renderClassImport();
  }

  page.append(tabs, body);
  render();
  content.append(page);
}
