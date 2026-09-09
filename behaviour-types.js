const BEHAVIOUR_TYPES_KEY = 'behaviour-management-system-behaviour-types';

const DEFAULT_BEHAVIOUR_TYPES = [
  ['positive', '↑', 'Merit', 1], ['positive', '♥', 'Caring', 1], ['positive', '★', 'Star student', 1],
  ['positive', '✓', 'On task', 1], ['positive', '☀', 'Participation', 1], ['positive', '⚑', 'Teamwork', 1],
  ['positive', '1', 'Level 1', 1], ['positive', '2', 'Level 2', 2],
  ['negative', '!', 'Warning', 1], ['negative', '↺', 'Retry', 1], ['negative', '⊘', 'Off task', 1],
  ['negative', '⌁', 'Disruption', 1], ['negative', '↯', 'Late work', 1], ['negative', '?', 'No equipment', 1],
  ['negative', '1', 'Level 1', 1], ['negative', '2', 'Level 2', 2],
].map(([type, icon, name, points], index) => ({ id: `behaviour-${type}-${index}`, type, icon, name, points }));

function normaliseBehaviourPoints(value) {
  const points = Math.round(Number(value));
  return Number.isFinite(points) && points >= 1 ? points : 1;
}

function getBehaviourTypes(type) {
  const stored = readStoredArray(BEHAVIOUR_TYPES_KEY);
  const items = (stored ?? DEFAULT_BEHAVIOUR_TYPES.map((item) => ({ ...item })))
    .map((item) => ({ ...item, points: normaliseBehaviourPoints(item.points) }));
  return type ? items.filter((item) => item.type === type) : items;
}

function saveBehaviourTypes(items) { writeStoredValue(BEHAVIOUR_TYPES_KEY, items); }

function addBehaviourType(type, icon, name, points) {
  const items = getBehaviourTypes();
  items.push({ id: `behaviour-user-${Date.now()}`, type, icon, name, points: normaliseBehaviourPoints(points) });
  saveBehaviourTypes(items);
}

function removeBehaviourType(id) {
  saveBehaviourTypes(getBehaviourTypes().filter((item) => item.id !== id));
}

function getBehaviourAwardPairs(type) {
  return getBehaviourTypes(type).map(({ icon, name, points }) => [icon, name, normaliseBehaviourPoints(points)]);
}
