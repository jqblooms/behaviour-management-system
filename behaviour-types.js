const BEHAVIOUR_TYPES_KEY = 'behaviour-management-system-behaviour-types';

const DEFAULT_BEHAVIOUR_TYPES = [
  ['positive', '↑', 'Merit'], ['positive', '♥', 'Caring'], ['positive', '★', 'Star student'],
  ['positive', '✓', 'On task'], ['positive', '☀', 'Participation'], ['positive', '⚑', 'Teamwork'],
  ['positive', '1', 'Level 1'], ['positive', '2', 'Level 2'],
  ['negative', '!', 'Warning'], ['negative', '↺', 'Retry'], ['negative', '⊘', 'Off task'],
  ['negative', '⌁', 'Disruption'], ['negative', '↯', 'Late work'], ['negative', '?', 'No equipment'],
  ['negative', '1', 'Level 1'], ['negative', '2', 'Level 2'],
].map(([type, icon, name], index) => ({ id: `behaviour-${type}-${index}`, type, icon, name }));

function getBehaviourTypes(type) {
  const stored = readStoredArray(BEHAVIOUR_TYPES_KEY);
  const items = stored ?? DEFAULT_BEHAVIOUR_TYPES.map((item) => ({ ...item }));
  return type ? items.filter((item) => item.type === type) : items;
}

function saveBehaviourTypes(items) { writeStoredValue(BEHAVIOUR_TYPES_KEY, items); }

function addBehaviourType(type, icon, name) {
  const items = getBehaviourTypes();
  items.push({ id: `behaviour-user-${Date.now()}`, type, icon, name });
  saveBehaviourTypes(items);
}

function removeBehaviourType(id) {
  saveBehaviourTypes(getBehaviourTypes().filter((item) => item.id !== id));
}

function getBehaviourAwardPairs(type) {
  return getBehaviourTypes(type).map(({ icon, name }) => [icon, name]);
}
