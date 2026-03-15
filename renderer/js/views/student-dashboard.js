import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast, escapeHtml, formatDate, deadlineClass, deadlineLabel } from '../utils.js';
import { CATEGORIES } from './timeline.js';
import { renderRessourcesInline } from './ressources.js';

// ─── Dépôt de fichier (partagé, exporté) ──────────────────────────────────────

export async function deposerFichier(travail, onSuccess = null) {
  const filePath = await call(window.api.openFileDialog);
  if (!filePath) return;

  const fileName = filePath.split(/[\\/]/).pop();

  const ok = await call(window.api.addDepot, {
    travailId: travail.id,
    studentId: state.currentUser.id,
    filePath,
    fileName,
  });
  if (ok === null) return;

  showToast(`Fichier deposé : ${fileName}`, 'success');
  document.dispatchEvent(new CustomEvent('depot:success'));

  if (onSuccess) {
    await onSuccess();
  } else {
    await renderStudentTravaux();
  }
}

// ─── Dashboard complet (section Travaux étudiant) ─────────────────────────────

export async function renderStudentDashboard(container) {
  if (!container) return;
  container.innerHTML = '<div class="std-loading">Chargement…</div>';

  const user    = state.currentUser;
  const travaux = await call(window.api.getStudentTravaux, user.id);
  if (!travaux) { container.innerHTML = ''; return; }

  const sorted  = [...travaux].sort((a, b) => a.deadline.localeCompare(b.deadline));

  const aRendre = sorted.filter(t => t.depot_id == null && t.type !== 'jalon');
  const jalons  = sorted.filter(t => t.type === 'jalon' && deadlineClass(t.deadline) !== 'deadline-passed');
  const attente = sorted.filter(t => t.depot_id != null && t.note == null);
  const notes   = sorted.filter(t => t.depot_id != null && t.note != null);

  const late   = aRendre.filter(t => deadlineClass(t.deadline) === 'deadline-passed').length;
  const urgent = aRendre.filter(t => ['deadline-critical', 'deadline-soon'].includes(deadlineClass(t.deadline))).length;

  container.innerHTML = '';

  // ── Barre de stats ────────────────────────────────────────────────────────
  const statsBar = document.createElement('div');
  statsBar.className = 'std-stats-bar';
  statsBar.innerHTML = `
    <div class="std-stat ${late > 0 ? 'std-stat-alert' : (aRendre.length === 0 ? 'std-stat-ok' : '')}">
      <span class="std-stat-num">${aRendre.length}</span>
      <span class="std-stat-label">A rendre</span>
      ${late > 0 ? `<span class="std-stat-sub">${late} en retard</span>` : ''}
    </div>
    <div class="std-stat ${urgent > 0 ? 'std-stat-warn' : ''}">
      <span class="std-stat-num">${urgent}</span>
      <span class="std-stat-label">Urgents (&lt;48h)</span>
    </div>
    <div class="std-stat">
      <span class="std-stat-num">${attente.length}</span>
      <span class="std-stat-label">En correction</span>
    </div>
    <div class="std-stat std-stat-ok">
      <span class="std-stat-num">${notes.length}</span>
      <span class="std-stat-label">Notes</span>
    </div>
  `;
  container.appendChild(statsBar);

  // ── Sections ──────────────────────────────────────────────────────────────
  const sections = document.createElement('div');
  sections.className = 'std-sections';

  if (!aRendre.length && !jalons.length && !attente.length && !notes.length) {
    sections.innerHTML = '<div class="std-empty">Aucun travail pour le moment.</div>';
    container.appendChild(sections);
    return;
  }

  const urgencyOrder = ['deadline-passed', 'deadline-critical', 'deadline-soon', 'deadline-warning', 'deadline-ok'];
  const aRendreSorted = [...aRendre].sort((a, b) =>
    urgencyOrder.indexOf(deadlineClass(a.deadline)) - urgencyOrder.indexOf(deadlineClass(b.deadline))
  );

  if (aRendreSorted.length) _buildSection(sections, 'A rendre', aRendreSorted, _buildARendreCard);
  if (jalons.length)        _buildSection(sections, 'Jalons a venir', jalons, _buildJalonCard);
  if (attente.length)       _buildSection(sections, 'En attente de note', attente, _buildAttenteCard);
  if (notes.length)         _buildSection(sections, 'Notes', notes, _buildNoteCard);

  container.appendChild(sections);
}

function _buildSection(parent, title, items, cardFn) {
  const section = document.createElement('div');
  section.className = 'std-section';
  section.innerHTML = `<div class="std-section-title">${title}</div>`;
  const grid = document.createElement('div');
  grid.className = 'std-cards';
  for (const t of items) grid.appendChild(cardFn(t));
  section.appendChild(grid);
  parent.appendChild(section);
}

function _buildARendreCard(t) {
  const cls      = deadlineClass(t.deadline);
  const label    = deadlineLabel(t.deadline);
  const catColor = CATEGORIES[t.category]?.color ?? '#888';
  const isLate   = cls === 'deadline-passed';

  const card = document.createElement('div');
  card.className = `std-card std-card-arendre${isLate ? ' std-card-late' : ''}`;
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="deadline-badge ${cls}">${label}</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}${t.group_name ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}</div>
    <div class="std-card-deadline">Limite : <strong>${formatDate(t.deadline)}</strong></div>
    ${t.description ? `<div class="std-card-desc">${escapeHtml(t.description)}</div>` : ''}
    <div class="std-card-res" id="std-res-${t.id}"></div>
  `;

  const btn = document.createElement('button');
  btn.className   = `btn-primary std-btn-deposer${isLate ? ' std-btn-late' : ''}`;
  btn.textContent = isLate ? 'Deposer (en retard)' : 'Deposer un fichier';
  btn.addEventListener('click', () => {
    deposerFichier(t, async () => {
      const c = document.getElementById('student-view');
      if (c) await renderStudentDashboard(c);
    });
  });
  card.appendChild(btn);

  renderRessourcesInline(t.id, card.querySelector(`#std-res-${t.id}`));
  return card;
}

function _buildJalonCard(t) {
  const cls      = deadlineClass(t.deadline);
  const label    = deadlineLabel(t.deadline);
  const catColor = CATEGORIES[t.category]?.color ?? '#888';

  const card = document.createElement('div');
  card.className = 'std-card std-card-jalon';
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="jalon-badge">Jalon</span>
      <span class="deadline-badge ${cls}">${label}</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}</div>
    <div class="std-card-deadline">Le <strong>${formatDate(t.deadline)}</strong></div>
    ${t.description ? `<div class="std-card-desc">${escapeHtml(t.description)}</div>` : ''}
  `;
  return card;
}

function _buildAttenteCard(t) {
  const catColor = CATEGORIES[t.category]?.color ?? '#888';

  const card = document.createElement('div');
  card.className = 'std-card std-card-attente';
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="timeline-status rendu">Rendu ✓</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}</div>
    <div class="std-card-file">
      <span class="std-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>
      <span class="stc-pending-note">En attente de note</span>
    </div>
    <div class="std-card-deadline">Depose le ${formatDate(t.submitted_at)}</div>
  `;
  return card;
}

function _buildNoteCard(t) {
  const catColor  = CATEGORIES[t.category]?.color ?? '#888';
  const noteClass = t.note >= 14 ? 'note-good' : t.note >= 10 ? 'note-mid' : 'note-low';

  const card = document.createElement('div');
  card.className = 'std-card std-card-note';
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="note-badge ${noteClass}">${t.note}/20</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}</div>
    ${t.feedback ? `<div class="std-card-feedback">"${escapeHtml(t.feedback)}"</div>` : ''}
  `;
  return card;
}

// ─── Panel "Mes travaux" (vue compacte — panneau droit) ───────────────────────

export async function renderStudentTravaux() {
  const panel = document.getElementById('right-panel');
  state.rightPanel = 'mes-travaux';
  panel.classList.remove('hidden');

  const travaux = await call(window.api.getStudentTravaux, state.currentUser.id);
  if (!travaux) return;

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">Mes travaux</span>
      <button class="btn-ghost" id="btn-close-mes-travaux">Fermer</button>
    </div>
    <div class="panel-body" id="mes-travaux-body"></div>
  `;

  document.getElementById('btn-close-mes-travaux').addEventListener('click', () => {
    state.rightPanel = null;
    panel.classList.add('hidden');
  });

  const body = document.getElementById('mes-travaux-body');

  if (!travaux.length) {
    body.innerHTML = '<div class="empty-state"><p>Aucun travail pour le moment.</p></div>';
    return;
  }

  const aRendre = travaux.filter(t => t.depot_id == null && t.type !== 'jalon');
  const rendus  = travaux.filter(t => t.depot_id != null);

  if (aRendre.length) {
    body.appendChild(_sectionTitle('A rendre'));
    for (const t of aRendre) body.appendChild(_makePanelCard(t));
  }
  if (rendus.length) {
    body.appendChild(_sectionTitle('Rendus'));
    for (const t of rendus) body.appendChild(_makePanelCard(t));
  }
}

function _sectionTitle(text) {
  const el = document.createElement('div');
  el.className   = 'panel-section-title';
  el.textContent = text;
  return el;
}

function _makePanelCard(t) {
  const rendu    = t.depot_id != null;
  const card     = document.createElement('div');
  card.className = `student-travail-card ${rendu ? 'rendu' : ''}`;

  const cls      = deadlineClass(t.deadline);
  const label    = deadlineLabel(t.deadline);
  const catColor = CATEGORIES[t.category]?.color ?? '#888';

  card.innerHTML = `
    <div class="stc-header">
      <span class="stc-title">${escapeHtml(t.title)}</span>
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category ?? 'TP')}</span>
      ${!rendu ? `<span class="deadline-badge ${cls}">${label}</span>` : ''}
    </div>
    <div class="stc-meta">
      #${escapeHtml(t.channel_name)}
      ${t.group_name ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}
      &middot; limite le ${formatDate(t.deadline)}
    </div>
    ${t.description ? `<div class="stc-description">${escapeHtml(t.description)}</div>` : ''}
    <div class="stc-depot-area" id="depot-area-${t.id}">
      ${rendu ? _renderRenduInfo(t) : ''}
    </div>
    <div class="stc-ressources-zone" id="stc-res-${t.id}"></div>
    ${!rendu ? `<button class="btn-primary stc-btn-deposer" data-travail-id="${t.id}">Deposer un fichier</button>` : ''}
  `;

  if (!rendu) {
    card.querySelector('.stc-btn-deposer').addEventListener('click', () => deposerFichier(t));
  }

  renderRessourcesInline(t.id, card.querySelector(`#stc-res-${t.id}`));
  return card;
}

function _renderRenduInfo(t) {
  return `
    <div class="stc-rendu-info">
      <span class="stc-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>
      <span class="stc-submitted-at">Depose le ${formatDate(t.submitted_at)}</span>
      ${t.note != null
        ? `<span class="note-badge">${t.note}/20</span>`
        : '<span class="stc-pending-note">Non note</span>'
      }
    </div>
    ${t.feedback ? `<div class="stc-feedback">${escapeHtml(t.feedback)}</div>` : ''}
  `;
}
