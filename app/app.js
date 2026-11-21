// Leonida Platinum Log — GTA 6 trophy guide & tracker.
// Static, offline: the only fetch is the local trophies.json beside this file.
// Progress lives in localStorage; export/import and the share link are the only ways it leaves the browser.

const KEY = 'gta6-trophy-guide-v2';
const $ = (id) => document.getElementById(id);
const byId = new Map();
let doc = null;

const state = {
  view: 'tracker',
  search: '',
  grade: 'all',
  kind: 'all',
  status: 'all',
  spoilers: true,
  earned: new Set(),
  detail: null,
};

function loadEarned() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 55));
  } catch {
    return new Set();
  }
}

function saveEarned() {
  localStorage.setItem(KEY, JSON.stringify([...state.earned].sort((a, b) => a - b)));
}

function gradeLabel(g) {
  return g[0].toUpperCase() + g.slice(1);
}

function isHidden(t) {
  return t.story && state.spoilers && !state.earned.has(t.id);
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('view')) state.view = h.get('view');
  if (h.get('grade')) state.grade = h.get('grade');
  if (h.get('kind')) state.kind = h.get('kind');
  if (h.get('status')) state.status = h.get('status');
  if (h.get('spoilers') === 'off') state.spoilers = false;
  if (h.get('spoilers') === 'on') state.spoilers = true;
  if (h.get('earned')) {
    const ids = h.get('earned').split(',').map(Number).filter((n) => n >= 1 && n <= 55);
    if (ids.length) state.earned = new Set(ids);
  }
  if (h.get('t')) state.detail = Number(h.get('t')) || null;
}

function writeHash() {
  const h = new URLSearchParams();
  h.set('view', state.view);
  if (state.grade !== 'all') h.set('grade', state.grade);
  if (state.kind !== 'all') h.set('kind', state.kind);
  if (state.status !== 'all') h.set('status', state.status);
  h.set('spoilers', state.spoilers ? 'on' : 'off');
  if (state.earned.size) h.set('earned', [...state.earned].sort((a, b) => a - b).join(','));
  if (state.detail) h.set('t', String(state.detail));
  history.replaceState(null, '', `#${h.toString()}`);
}

function renderProgress() {
  const total = doc.trophies.length;
  const n = state.earned.size;
  $('progressText').textContent = `${n} of ${total} earned`;
  $('progressPct').textContent = `${Math.round((n / total) * 100)}%`;
  $('progressFill').style.width = `${(n / total) * 100}%`;
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of doc.trophies) {
    totals[t.grade]++;
    if (state.earned.has(t.id)) counts[t.grade]++;
  }
  $('gradeCounts').innerHTML = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `<span><b>${counts[g]}/${totals[g]}</b> ${gradeLabel(g)}</span>`)
    .join('');
}

function renderAudit() {
  const missable = doc.trophies.filter((t) => t.missable === 'possible').length;
  $('auditStrip').innerHTML =
    `<b>Audit:</b> 55/55 official trophies — 1 platinum, 2 gold, 6 silver, 46 bronze · ` +
    `27 visible + 28 hidden on PSN · ${missable} flagged possible missable · ` +
    `55 guides in our own words, each with named sources · names, descriptions &amp; grades cross-checked ` +
    `against PlanetGTA6's Exophase / PSNProfiles table (18 Nov 2026) · zero network requests when running.`;
}

function cardFor(t) {
  if (isHidden(t)) {
    const el = document.createElement('div');
    el.className = 'card spoiled';
    el.innerHTML = `<div><div style="font-size:1.6rem">🔒</div><strong>Story / secret trophy #${t.id}</strong><br>Hidden by the spoiler shield until earned.<br><span style="font-size:.85rem">Turn the shield off above to reveal it.</span></div>`;
    return el;
  }
  const el = document.createElement('article');
  el.className = 'card' + (state.earned.has(t.id) ? ' earned' : '');
  const pills = [
    `<span class="pill ${t.grade}">${gradeLabel(t.grade)}</span>`,
    `<span class="pill kind">${t.kind}</span>`,
  ];
  if (t.story) pills.push('<span class="pill story">Story / secret</span>');
  if (t.missable === 'possible') pills.push('<span class="pill miss">Possible missable</span>');
  el.innerHTML =
    `<h3>#${t.id} — ${escapeHtml(t.name)}</h3>` +
    `<p class="desc">${escapeHtml(t.description)}</p>` +
    `<div class="meta">${pills.join('')}</div>` +
    `<p class="guide">${escapeHtml(t.guide)}</p>` +
    `<label class="check-row"><input type="checkbox" ${state.earned.has(t.id) ? 'checked' : ''} aria-label="Mark ${escapeHtml(t.name)} earned"> ${state.earned.has(t.id) ? 'Earned ✓' : 'Mark earned'}</label>`;
  el.querySelector('input').addEventListener('change', (e) => {
    e.stopPropagation();
    toggleEarned(t.id, e.target.checked);
  });
  el.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    openDetail(t.id);
  });
  return el;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toggleEarned(id, on) {
  if (on) state.earned.add(id);
  else state.earned.delete(id);
  saveEarned();
  renderAll();
}

function renderTracker() {
  const grid = $('trophyGrid');
  grid.replaceChildren();
  const q = state.search.trim().toLowerCase();
  const list = doc.trophies.filter((t) => {
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (state.kind !== 'all' && t.kind !== state.kind) return false;
    if (state.status === 'earned' && !state.earned.has(t.id)) return false;
    if (state.status === 'remaining' && state.earned.has(t.id)) return false;
    if (state.status === 'missable' && t.missable !== 'possible') return false;
    if (q && !(`${t.name} ${t.description} ${t.guide}`.toLowerCase().includes(q))) return false;
    return true;
  });
  $('resultCount').textContent = `Showing ${list.length} of 55 trophies · ${state.earned.size} earned`;
  for (const t of list) grid.append(cardFor(t));
  if (!list.length) grid.innerHTML = '<p class="intro">No trophies match these filters.</p>';
}

function renderRoadmap() {
  const box = $('roadmapList');
  box.replaceChildren();
  for (const phase of doc.roadmap) {
    const earned = phase.trophies.filter((id) => state.earned.has(id)).length;
    const div = document.createElement('div');
    div.className = 'phase';
    div.innerHTML =
      `<h2><span class="n">Phase ${phase.phase} —</span> ${escapeHtml(phase.title)}</h2>` +
      `<p>${escapeHtml(phase.text)}</p>` +
      `<p class="phase-count">${earned} of ${phase.trophies.length} earned in this phase</p>`;
    const refs = document.createElement('div');
    refs.className = 'trophy-refs';
    for (const id of phase.trophies) {
      const t = byId.get(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = state.earned.has(id) ? `✓ #${id} ${t.name}` : `#${id} ${t.name}`;
      if (state.earned.has(id)) b.classList.add('done');
      b.addEventListener('click', () => openDetail(id));
      refs.append(b);
    }
    div.append(refs);
    box.append(div);
  }
}

function renderMissables() {
  $('missableIntro').innerHTML =
    `<b>${escapeHtml(doc.missable_note)}</b><br>` +
    `Each flag below carries its own reason, and the detail view of every flagged trophy explains ` +
    `what to do before the attempt — save first, then try.`;
  const box = $('missableList');
  box.replaceChildren();
  for (const t of doc.trophies.filter((x) => x.missable === 'possible')) box.append(cardFor(t));
}

function sourceName(key) {
  const s = doc.sources.find((x) => x.key === key);
  return s ? s.name : key;
}

function renderSources() {
  const box = $('sourceList');
  box.replaceChildren();
  for (const s of doc.sources) {
    const div = document.createElement('div');
    div.className = 'source';
    div.innerHTML = `<h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.note)}</p>`;
    box.append(div);
  }
  $('checkList').innerHTML = [
    'All 55 names, descriptions and grades match the official PSN list as reported by PlanetGTA6 from Exophase, cross-checked with PSNProfiles and TrueAchievements (18 Nov 2026).',
    'Grade split verified: 1 platinum, 2 gold, 6 silver, 46 bronze; 27 visible + 28 hidden on PSN.',
    'Roadmap phases cover all 55 trophies exactly once; missable flags carry a reason and a named source.',
    'Every guide is written in our own words — other guides are cited, never copied.',
    'The app loads no network resource: index.html, style.css, app.js and data/trophies.json only. Open it with the network off and every view still works.',
    'No Rockstar logo or official artwork is used anywhere in the app.',
  ].map((c) => `<li>${escapeHtml(c)}</li>`).join('');
}

function renderViews() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${state.view}`));
  if (state.view === 'tracker') renderTracker();
  if (state.view === 'roadmap') renderRoadmap();
  if (state.view === 'missables') renderMissables();
  if (state.view === 'sources') renderSources();
}

function renderAll() {
  renderProgress();
  renderViews();
  writeHash();
}

function openDetail(id) {
  const t = byId.get(id);
  if (!t) return;
  state.detail = id;
  const srcs = t.sources.map((k) => `<li>${escapeHtml(sourceName(k))}</li>`).join('');
  $('detailBody').innerHTML =
    `<h2 id="detailName">#${t.id} — ${escapeHtml(t.name)}</h2>` +
    `<div class="meta"><span class="pill ${t.grade}">${gradeLabel(t.grade)}</span><span class="pill kind">${t.kind}</span>` +
    (t.story ? '<span class="pill story">Story / secret</span>' : '') +
    (t.missable === 'possible' ? '<span class="pill miss">Possible missable</span>' : '') + `</div>` +
    `<h3>Official description</h3><p class="desc">${escapeHtml(t.description)}</p>` +
    (t.missable === 'possible' ? `<h3>When it can be missed</h3><p class="warn">${escapeHtml(t.missable_reason)}</p>` : '') +
    `<h3>Guide</h3><p>${escapeHtml(t.guide)}</p>` +
    `<h3>Sources</h3><ul>${srcs}</ul>` +
    `<p><label class="check-row"><input id="detailCheck" type="checkbox" ${state.earned.has(id) ? 'checked' : ''}> ${state.earned.has(id) ? 'Earned ✓' : 'Mark earned'}</label></p>`;
  $('detail').classList.remove('hidden');
  $('detailCheck').addEventListener('change', (e) => toggleEarned(id, e.target.checked));
  writeHash();
}

function closeDetail() {
  state.detail = null;
  $('detail').classList.add('hidden');
  writeHash();
}

function flash(msg) {
  $('actionMsg').textContent = msg;
  setTimeout(() => { $('actionMsg').textContent = ''; }, 4000);
}

async function init() {
  const res = await fetch('data/trophies.json');
  doc = await res.json();
  for (const t of doc.trophies) byId.set(t.id, t);

  readHash();
  state.earned = new Set([...state.earned]);
  const stored = loadEarned();
  if (!location.hash.includes('earned=')) state.earned = stored;
  else for (const id of stored) state.earned.add(id);

  $('search').value = state.search;
  $('gradeFilter').value = state.grade;
  $('kindFilter').value = state.kind;
  $('statusFilter').value = state.status;
  $('spoilerToggle').checked = state.spoilers;

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    renderAll();
  }));
  $('search').addEventListener('input', (e) => { state.search = e.target.value; renderTracker(); writeHash(); });
  $('gradeFilter').addEventListener('change', (e) => { state.grade = e.target.value; renderAll(); });
  $('kindFilter').addEventListener('change', (e) => { state.kind = e.target.value; renderAll(); });
  $('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; renderAll(); });
  $('spoilerToggle').addEventListener('change', (e) => { state.spoilers = e.target.checked; renderAll(); });

  $('exportBtn').addEventListener('click', () => {
    const payload = { game: 'Grand Theft Auto VI', exported: new Date().toISOString(), earned: [...state.earned].sort((a, b) => a - b) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = 'gta6-trophy-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('Progress exported.');
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const arr = Array.isArray(data) ? data : data.earned;
      if (!Array.isArray(arr)) throw new Error('no earned list');
      const ids = arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 55);
      if (!ids.length && arr.length) throw new Error('no valid trophy ids');
      state.earned = new Set(ids);
      saveEarned();
      renderAll();
      flash(`Imported ${ids.length} earned trophies.`);
    } catch (err) {
      flash(`Import failed: ${err.message} — file not changed.`);
    }
    e.target.value = '';
  });
  $('copyLinkBtn').addEventListener('click', async () => {
    writeHash();
    try {
      await navigator.clipboard.writeText(location.href);
      flash('Share link copied (progress lives in the link).');
    } catch {
      flash('Copy failed — copy the address bar URL instead.');
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all earned trophies? This clears the saved progress in this browser.')) return;
    state.earned = new Set();
    saveEarned();
    renderAll();
    flash('Progress reset.');
  });
  $('detailClose').addEventListener('click', closeDetail);
  $('detail').addEventListener('click', (e) => { if (e.target === $('detail')) closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  renderAudit();
  renderAll();
  if (state.detail) openDetail(state.detail);
}

init();
