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

