const state = { molecule: null, viewer: null, structureView: '3d' };
const examples = {
  aspirin: { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  caffeine: { name: 'Caffeine', smiles: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O' },
  ethanol: { name: 'Ethanol', smiles: 'CCO' }
};
const propertyLabels = [
  ['molecular_weight_g_mol', 'Molecular weight', 'g/mol'],
  ['calculated_log_p', 'Calculated logP', ''],
  ['tpsa_angstrom_squared', 'Topological polar area', 'Å²'],
  ['fraction_sp3', 'Fraction sp³', ''],
  ['hydrogen_bond_donors', 'H-bond donors', ''],
  ['hydrogen_bond_acceptors', 'H-bond acceptors', ''],
  ['rotatable_bonds', 'Rotatable bonds', ''],
  ['ring_count', 'Ring count', '']
];
const $ = (id) => document.getElementById(id);

function showView(view) {
  for (const section of document.querySelectorAll('.view')) section.classList.toggle('active', section.id === `view-${view}`);
  for (const item of document.querySelectorAll('.nav-item')) item.classList.toggle('active', item.dataset.view === view);
  $('breadcrumb').textContent = view.toUpperCase().replace('-', ' ');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'molecule' && state.viewer) setTimeout(() => state.viewer.resize(), 70);
}

function message(id, text, error = false) {
  const node = $(id);
  node.textContent = text;
  node.hidden = !text;
  node.classList.toggle('error', error);
}

async function postJson(path, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || `Research request failed (${response.status}).`);
  return data;
}

function formatValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(value < 1 ? 3 : 2);
  return value == null ? '—' : String(value);
}

function selectStructureView(choice) {
  if (choice === '3d' && state.molecule?.geometry?.status !== 'calculated') choice = '2d';
  state.structureView = choice;
  for (const button of document.querySelectorAll('[data-structure-view]')) button.classList.toggle('active', button.dataset.structureView === choice);
  $('molecule-3d').hidden = choice !== '3d' || !state.molecule;
  $('molecule-2d').hidden = choice !== '2d' || !state.molecule;
  if (choice === '3d' && state.viewer) setTimeout(() => { state.viewer.resize(); state.viewer.render(); }, 50);
}

function renderMolecule(data) {
  state.molecule = data;
  $('molecule-empty').hidden = true;
  $('molecule-results').hidden = false;
  $('structure-state').textContent = data.geometry.status === 'calculated' ? '3D CALCULATED' : '2D CALCULATED';
  $('result-name').textContent = data.name || 'Untitled molecule';
  $('result-formula').textContent = data.properties.molecular_formula || '—';
  $('result-smiles').textContent = data.canonical_smiles;
  $('result-stereo').textContent = data.unresolved_stereochemistry.length ? `${data.unresolved_stereochemistry.length} unspecified centre(s)` : 'None flagged';
  $('result-geometry').textContent = data.geometry.status === 'calculated' ? `${data.geometry.forcefield || 'No force field'} conformer` : 'Not requested';
  $('molecule-svg').src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.svg)}`;
  const grid = $('properties-grid');
  grid.replaceChildren();
  for (const [key, label, unit] of propertyLabels) {
    const card = document.createElement('div'); card.className = 'property-item';
    const value = document.createElement('strong'); value.textContent = `${formatValue(data.properties[key])}${unit ? ` ${unit}` : ''}`;
    const caption = document.createElement('span'); caption.textContent = label;
    card.append(value, caption); grid.append(card);
  }
  if (data.geometry.status === 'calculated' && window.$3Dmol) {
    $('molecule-3d').hidden = false;
    $('molecule-2d').hidden = true;
    $('molecule-3d').replaceChildren();
    state.viewer = window.$3Dmol.createViewer($('molecule-3d'), { backgroundColor: '#0e252a', antialias: true });
    state.viewer.addModel(data.geometry.mol_block, 'sdf');
    state.viewer.setStyle({}, { stick: { radius: 0.18, colorscheme: 'Jmol' }, sphere: { scale: 0.25, colorscheme: 'Jmol' } });
    state.viewer.zoomTo(); state.viewer.render();
    selectStructureView('3d');
  } else {
    state.viewer = null;
    selectStructureView('2d');
    if (data.geometry.status === 'calculated') message('molecule-message', '3D renderer unavailable; calculated 2D depiction remains available.', true);
  }
  $('molecule-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function analyseMolecule(event) {
  event.preventDefault();
  const button = $('analyse-button');
  button.disabled = true; button.textContent = 'Calculating structure…';
  message('molecule-message', 'Validating structure and calculating descriptors…');
  try {
    const data = await postJson('/api/molecule', { smiles: $('smiles-input').value.trim(), name: $('molecule-name').value.trim(), include_3d: $('include-3d').checked });
    message('molecule-message', '');
    renderMolecule(data);
  } catch (error) { message('molecule-message', error.message, true); }
  finally { button.disabled = false; button.innerHTML = 'Analyse structure <span>↗</span>'; }
}

function renderCandidates(result) {
  const list = $('disease-candidates'); list.replaceChildren();
  const candidates = result.data.candidates || [];
  if (!candidates.length) { message('disease-message', 'No matching disease records were returned. Try a more specific term.'); return; }
  message('disease-message', `${candidates.length} candidate disease record${candidates.length === 1 ? '' : 's'} found. Select one to inspect its evidence.`);
  for (const candidate of candidates) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'candidate';
    const body = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = candidate.name || candidate.id;
    const meta = document.createElement('span'); meta.className = 'candidate-meta'; meta.textContent = `${candidate.id} · ${candidate.match || 'source match'}`;
    const arrow = document.createElement('b'); arrow.textContent = '↗';
    body.append(title, meta); button.append(body, arrow);
    button.addEventListener('click', () => researchDisease(candidate.id, candidate.name));
    list.append(button);
  }
}

async function searchDisease(event) {
  event.preventDefault();
  const button = $('disease-search-button'); button.disabled = true; button.textContent = 'Searching…';
  $('disease-candidates').replaceChildren(); $('disease-report').hidden = true;
  message('disease-message', 'Retrieving source-linked disease records…');
  try { renderCandidates(await postJson('/api/disease/search', { query: $('disease-query').value.trim() })); }
  catch (error) { message('disease-message', error.message, true); }
  finally { button.disabled = false; button.textContent = 'Search ↗'; }
}

async function researchDisease(id, name) {
  message('disease-message', `Researching ${name || id} and its target evidence…`);
  $('disease-report').hidden = true;
  try {
    const result = await postJson('/api/disease/report', { disease_id: id });
    $('disease-report').hidden = false;
    $('disease-report-title').textContent = result.data.name || result.data.disease?.name || name || id;
    $('dossier-link').href = `${result.bundle_url}disease.html`;
    const targets = result.data.targets || [];
    $('disease-report-note').textContent = `${targets.length} source-ranked target${targets.length === 1 ? '' : 's'} in this report. Scores are provider associations, not efficacy predictions.`;
    const list = $('target-list'); list.replaceChildren();
    for (const [index, target] of targets.slice(0, 20).entries()) {
      const card = document.createElement('div'); card.className = 'target-card';
      const rank = document.createElement('span'); rank.className = 'target-rank'; rank.textContent = String(index + 1).padStart(2, '0');
      const body = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = target.symbol || target.name || target.id || 'Target';
      const details = document.createElement('p'); details.textContent = target.name && target.symbol ? target.name : (target.id || 'Source-linked target record');
      const score = document.createElement('span'); score.className = 'target-score'; score.textContent = formatValue(target.association_score ?? target.score);
      body.append(title, details); card.append(rank, body, score); list.append(card);
    }
    message('disease-message', 'Report ready. Open the full dossier for source records and limitations.');
    $('disease-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { message('disease-message', error.message, true); }
}

function exportMolecule() {
  if (!state.molecule) return;
  const value = { ...state.molecule, svg: undefined, geometry: { ...state.molecule.geometry, mol_block: undefined } };
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'varma-molecule-research.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function checkConnection() {
  try {
    const response = await fetch('/api/health'); if (!response.ok) throw new Error('offline');
    const data = await response.json();
    $('connection-status').textContent = data.status === 'ready' ? 'Research engine connected' : 'Engine unavailable';
    $('connection-status').classList.toggle('offline', data.status !== 'ready');
  } catch { $('connection-status').textContent = 'Engine unavailable'; $('connection-status').classList.add('offline'); }
}

for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view));
for (const button of document.querySelectorAll('[data-structure-view]')) button.addEventListener('click', () => selectStructureView(button.dataset.structureView));
for (const button of document.querySelectorAll('[data-example]')) button.addEventListener('click', () => {
  const sample = examples[button.dataset.example]; $('smiles-input').value = sample.smiles; $('molecule-name').value = sample.name;
  $('char-count').textContent = `${sample.smiles.length} / 1000`; $('molecule-form').requestSubmit();
});
$('smiles-input').addEventListener('input', () => { $('char-count').textContent = `${$('smiles-input').value.length} / 1000`; });
$('molecule-form').addEventListener('submit', analyseMolecule);
$('disease-search-form').addEventListener('submit', searchDisease);
$('export-molecule').addEventListener('click', exportMolecule);
checkConnection();
